// API JSON de l'application. Toutes les routes protégées filtrent par workspace_id.
import express from 'express';
import { z } from 'zod';
import { CATEGORIES, ORDER_STATUSES, PLANS } from '../config.js';
import { currentPeriod } from '../db.js';
import {
  SESSION_COOKIE, clearSessionCookie, createSession, destroySession, dummyVerify,
  findSession, hashPassword, readCookie, safeEqual, sessionCookie, verifyPassword,
} from '../auth.js';
import { HttpError, RateLimiter } from '../security.js';
import { analyzeMessage, findRelatedOrder } from '../ai/index.js';

const str = (max) => z.string().trim().max(max);
const email = z.string().trim().toLowerCase().max(254).email();
const password = z.string().min(10, 'Mot de passe : 10 caractères minimum.').max(200);
const id = z.coerce.number().int().positive();

const SignupSchema = z.object({ email, password, name: str(100).default(''), storeName: str(100).min(1) });
const LoginSchema = z.object({ email, password: z.string().max(200) });
const WorkspaceSchema = z.object({
  name: str(100).min(1),
  tone: z.enum(['friendly', 'formal', 'concise']),
  policies: str(8000),
  signature: str(300),
});
const OrderSchema = z.object({
  order_number: str(64).min(1).transform((s) => s.replace(/^#/, '')),
  customer_name: str(120).default(''),
  customer_email: z.union([email, z.literal('')]).default(''),
  status: z.enum(ORDER_STATUSES).default('paid'),
  // Accepte « 20,5 » (virgule décimale européenne) comme « 20.5 ».
  total: z.preprocess((v) => (typeof v === 'string' ? v.replace(',', '.').trim() || 0 : v), z.coerce.number().min(0).max(1_000_000)).default(0),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('EUR'),
  items: str(1000).default(''),
  carrier: str(80).default(''),
  tracking_number: str(120).default(''),
  shipping_address: str(500).default(''),
  notes: str(1000).default(''),
});
const MessageSchema = z.object({
  customer_name: str(120).default(''),
  customer_email: z.union([email, z.literal('')]).default(''),
  channel: z.enum(['email', 'chat', 'instagram', 'facebook', 'whatsapp', 'other']).default('email'),
  subject: str(300).default(''),
  body: str(10_000).min(1, 'Le message est vide.'),
  analyze: z.boolean().default(true),
});
const MessageUpdateSchema = z.object({
  draft_reply: str(6000).optional(),
  status: z.enum(['new', 'analyzed', 'replied', 'archived']).optional(),
  order_id: z.union([id, z.null()]).optional(),
  category: z.enum(CATEGORIES).optional(),
});
const WaitlistSchema = z.object({
  email,
  shop_url: str(300).default(''),
  monthly_messages: z.enum(['', '<50', '50-200', '200-500', '500+']).default(''),
  consent: z.literal(true, { message: 'Consentement requis.' }),
});

export const DEFAULT_LIMITS = { login: 10, signup: 5, aiPerMinute: 20, waitlist: 10 };

export function createApiRouter({ db, ai, limits = {} }) {
  const lim = { ...DEFAULT_LIMITS, ...limits };
  const router = express.Router();
  const loginLimiter = new RateLimiter({ windowMs: 15 * 60_000, max: lim.login });
  const signupLimiter = new RateLimiter({ windowMs: 60 * 60_000, max: lim.signup });
  const aiLimiter = new RateLimiter({ windowMs: 60_000, max: lim.aiPerMinute });
  const publicLimiter = new RateLimiter({ windowMs: 60 * 60_000, max: lim.waitlist });

  router.use(express.json({ limit: '200kb' }));

  // --- Session et protection CSRF --------------------------------------------------------
  router.use((req, res, next) => {
    req.session = findSession(db, readCookie(req, SESSION_COOKIE));
    next();
  });

  // Les requêtes qui modifient des données doivent venir de notre propre site.
  router.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin) {
      let host = null;
      try { host = new URL(origin).host; } catch { /* origine illisible ou "null" */ }
      if (host !== req.headers.host) throw new HttpError(403, 'Origine refusée.');
    }
    if (req.session && !safeEqual(req.get('x-csrf-token'), req.session.csrf_token)) {
      throw new HttpError(403, 'Jeton de sécurité invalide. Rechargez la page.', 'csrf');
    }
    next();
  });

  const requireAuth = (req, res, next) => {
    if (!req.session) throw new HttpError(401, 'Connexion requise.', 'auth');
    req.ws = req.session.workspace_id;
    next();
  };

  const getWorkspace = (wsId) => db.prepare('SELECT * FROM workspaces WHERE id = ?').get(wsId);
  const getUsage = (wsId) => db.prepare('SELECT ai_calls FROM usage WHERE workspace_id = ? AND period = ?')
    .get(wsId, currentPeriod())?.ai_calls || 0;

  function startSession(res, userId) {
    const s = createSession(db, userId);
    res.setHeader('Set-Cookie', sessionCookie(s.token, s.expiresAt));
    return s;
  }

  // --- Public ----------------------------------------------------------------------------
  router.get('/health', (req, res) => res.json({ ok: true, ai: ai.name }));

  router.post('/waitlist', (req, res) => {
    if (!publicLimiter.take(`wl:${req.ip}`)) throw new HttpError(429, 'Trop de tentatives. Réessayez plus tard.');
    const data = WaitlistSchema.parse(req.body);
    db.prepare(`INSERT INTO waitlist (email, shop_url, monthly_messages, consent_at) VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(email) DO NOTHING`).run(data.email, data.shop_url, data.monthly_messages);
    res.json({ ok: true });
  });

  // --- Comptes ---------------------------------------------------------------------------
  router.post('/auth/signup', async (req, res) => {
    if (!signupLimiter.take(`su:${req.ip}`)) throw new HttpError(429, 'Trop de créations de compte. Réessayez plus tard.');
    const data = SignupSchema.parse(req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email)) {
      throw new HttpError(409, 'Un compte existe déjà avec cet e-mail.');
    }
    const hash = await hashPassword(data.password);
    const userId = db.transaction(() => {
      const ws = db.prepare('INSERT INTO workspaces (name, signature) VALUES (?, ?)').run(data.storeName, `L'équipe ${data.storeName}`);
      return db.prepare('INSERT INTO users (workspace_id, email, password_hash, name) VALUES (?, ?, ?, ?)')
        .run(ws.lastInsertRowid, data.email, hash, data.name).lastInsertRowid;
    })();
    const s = startSession(res, userId);
    res.status(201).json({ ok: true, csrfToken: s.csrf });
  });

  router.post('/auth/login', async (req, res) => {
    const data = LoginSchema.parse(req.body);
    const key = `li:${req.ip}:${data.email}`;
    if (!loginLimiter.take(key)) throw new HttpError(429, 'Trop de tentatives. Réessayez dans 15 minutes.');
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(data.email);
    const ok = user ? await verifyPassword(data.password, user.password_hash) : await dummyVerify(data.password);
    if (!ok) throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
    loginLimiter.reset(key);
    const s = startSession(res, user.id);
    res.json({ ok: true, csrfToken: s.csrf });
  });

  router.post('/auth/logout', (req, res) => {
    destroySession(db, readCookie(req, SESSION_COOKIE));
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req, res) => {
    const ws = getWorkspace(req.ws);
    const plan = PLANS[ws.plan] || PLANS.free;
    res.json({
      user: { email: req.session.email, name: req.session.name, role: req.session.role },
      workspace: { name: ws.name, tone: ws.tone, policies: ws.policies, signature: ws.signature, plan: ws.plan },
      plan,
      usage: { period: currentPeriod(), aiCalls: getUsage(req.ws), limit: plan.monthlyMessages },
      ai: ai.name,
      csrfToken: req.session.csrf_token,
    });
  });

  router.put('/workspace', requireAuth, (req, res) => {
    const data = WorkspaceSchema.parse(req.body);
    db.prepare('UPDATE workspaces SET name = ?, tone = ?, policies = ?, signature = ? WHERE id = ?')
      .run(data.name, data.tone, data.policies, data.signature, req.ws);
    res.json({ ok: true });
  });

  // Export de toutes les données de la boutique (droit d'accès RGPD).
  router.get('/account/export', requireAuth, (req, res) => {
    const ws = getWorkspace(req.ws);
    res.setHeader('Content-Disposition', 'attachment; filename="export-donnees.json"');
    res.json({
      exported_at: new Date().toISOString(),
      workspace: ws,
      users: db.prepare('SELECT email, name, role, created_at FROM users WHERE workspace_id = ?').all(req.ws),
      orders: db.prepare('SELECT * FROM orders WHERE workspace_id = ?').all(req.ws),
      messages: db.prepare('SELECT * FROM messages WHERE workspace_id = ?').all(req.ws),
    });
  });

  // Suppression définitive du compte et de toutes ses données (droit à l'effacement).
  router.post('/account/delete', requireAuth, async (req, res) => {
    const { password: pw } = z.object({ password: z.string().max(200) }).parse(req.body);
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.user_id);
    if (!(await verifyPassword(pw, user.password_hash))) throw new HttpError(401, 'Mot de passe incorrect.');
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(req.ws);
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.json({ ok: true });
  });

  // --- Commandes -------------------------------------------------------------------------
  const orderOut = (o) => o && ({ ...o, total: o.total_cents / 100 });

  router.get('/orders', requireAuth, (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : null;
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const rows = db.prepare(`SELECT * FROM orders WHERE workspace_id = ?
      AND (? IS NULL OR status = ?)
      AND (? = '' OR order_number LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?)
      ORDER BY created_at DESC, id DESC LIMIT 500`).all(req.ws, status, status, q, like, like, like);
    res.json({ orders: rows.map(orderOut) });
  });

  function insertOrder(wsId, o) {
    return db.prepare(`INSERT INTO orders (workspace_id, order_number, customer_name, customer_email, status, total_cents,
      currency, items, carrier, tracking_number, shipping_address, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(wsId, o.order_number, o.customer_name, o.customer_email, o.status,
      Math.round(o.total * 100), o.currency, o.items, o.carrier, o.tracking_number, o.shipping_address, o.notes);
  }

  router.post('/orders', requireAuth, (req, res) => {
    const o = OrderSchema.parse(req.body);
    try {
      const r = insertOrder(req.ws, o);
      res.status(201).json({ order: orderOut(db.prepare('SELECT * FROM orders WHERE id = ?').get(r.lastInsertRowid)) });
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw new HttpError(409, 'Ce numéro de commande existe déjà.');
      throw e;
    }
  });

  // Import CSV simple : en-têtes reconnus = noms des champs de commande.
  router.post('/orders/import', requireAuth, (req, res) => {
    const { csv } = z.object({ csv: z.string().max(150_000) }).parse(req.body);
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new HttpError(400, 'Fichier vide ou sans en-tête.');
    const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    if (!headers.includes('order_number')) throw new HttpError(400, 'Colonne « order_number » obligatoire.');
    let imported = 0;
    const errors = [];
    db.transaction(() => {
      rows.slice(1, 1001).forEach((cells, i) => {
        if (cells.every((c) => !c.trim())) return;
        const obj = Object.fromEntries(headers.map((h, j) => [h, cells[j] ?? '']));
        const parsed = OrderSchema.safeParse(obj);
        if (!parsed.success) { errors.push(`Ligne ${i + 2} : ${parsed.error.issues[0].path.join('.')} invalide`); return; }
        try { insertOrder(req.ws, parsed.data); imported += 1; } catch { errors.push(`Ligne ${i + 2} : numéro déjà existant`); }
      });
    })();
    res.json({ imported, errors: errors.slice(0, 20) });
  });

  router.put('/orders/:id', requireAuth, (req, res) => {
    const orderId = id.parse(req.params.id);
    const o = OrderSchema.parse(req.body);
    const r = db.prepare(`UPDATE orders SET order_number = ?, customer_name = ?, customer_email = ?, status = ?, total_cents = ?,
      currency = ?, items = ?, carrier = ?, tracking_number = ?, shipping_address = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ? AND workspace_id = ?`).run(o.order_number, o.customer_name, o.customer_email, o.status, Math.round(o.total * 100),
      o.currency, o.items, o.carrier, o.tracking_number, o.shipping_address, o.notes, orderId, req.ws);
    if (!r.changes) throw new HttpError(404, 'Commande introuvable.');
    res.json({ order: orderOut(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)) });
  });

  router.delete('/orders/:id', requireAuth, (req, res) => {
    const r = db.prepare('DELETE FROM orders WHERE id = ? AND workspace_id = ?').run(id.parse(req.params.id), req.ws);
    if (!r.changes) throw new HttpError(404, 'Commande introuvable.');
    res.json({ ok: true });
  });

  // --- Messages --------------------------------------------------------------------------
  const messageOut = (m) => m && ({ ...m, needs_action: !!m.needs_action, missing_info: JSON.parse(m.missing_info || '[]') });
  const getMessage = (wsId, msgId) => db.prepare('SELECT * FROM messages WHERE id = ? AND workspace_id = ?').get(msgId, wsId);

  router.get('/messages', requireAuth, (req, res) => {
    const status = ['new', 'analyzed', 'replied', 'archived', 'open'].includes(req.query.status) ? req.query.status : null;
    const category = CATEGORIES.includes(req.query.category) ? req.query.category : null;
    const rows = db.prepare(`SELECT m.*, o.order_number AS linked_order_number FROM messages m
      LEFT JOIN orders o ON o.id = m.order_id AND o.workspace_id = m.workspace_id
      WHERE m.workspace_id = ?
      AND (? IS NULL OR (? = 'open' AND m.status IN ('new','analyzed')) OR m.status = ?)
      AND (? IS NULL OR m.category = ?)
      ORDER BY CASE m.urgency WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, m.created_at DESC, m.id DESC
      LIMIT 500`).all(req.ws, status, status, status, category, category);
    res.json({ messages: rows.map(messageOut) });
  });

  router.get('/messages/:id', requireAuth, (req, res) => {
    const m = getMessage(req.ws, id.parse(req.params.id));
    if (!m) throw new HttpError(404, 'Message introuvable.');
    const order = m.order_id ? db.prepare('SELECT * FROM orders WHERE id = ? AND workspace_id = ?').get(m.order_id, req.ws) : null;
    res.json({ message: messageOut(m), order: orderOut(order) });
  });

  async function runAnalysis(wsId, msg) {
    if (!aiLimiter.take(`ai:${wsId}`)) throw new HttpError(429, 'Trop d\'analyses en une minute. Patientez un instant.');
    const ws = getWorkspace(wsId);
    const plan = PLANS[ws.plan] || PLANS.free;
    const period = currentPeriod();
    // Réservation atomique d'une analyse dans le quota mensuel.
    const reserved = db.transaction(() => {
      if (getUsage(wsId) >= plan.monthlyMessages) return false;
      db.prepare(`INSERT INTO usage (workspace_id, period, ai_calls) VALUES (?, ?, 1)
        ON CONFLICT(workspace_id, period) DO UPDATE SET ai_calls = ai_calls + 1`).run(wsId, period);
      return true;
    })();
    if (!reserved) {
      throw new HttpError(402, `Quota mensuel atteint (${plan.monthlyMessages} analyses, formule ${plan.name}).`, 'quota');
    }

    const order = findRelatedOrder(db, wsId, msg);
    try {
      const { analysis } = await analyzeMessage({ provider: ai, workspace: ws, message: msg, order });
      // Si l'IA a repéré un numéro que la recherche initiale n'a pas trouvé, on retente le lien.
      let linked = order;
      if (!linked && analysis.order_number) {
        linked = db.prepare('SELECT * FROM orders WHERE workspace_id = ? AND order_number = ?').get(wsId, analysis.order_number) || null;
      }
      db.prepare(`UPDATE messages SET status = CASE WHEN status = 'new' THEN 'analyzed' ELSE status END,
        category = ?, urgency = ?, needs_action = ?, action_reason = ?, language = ?, sentiment = ?, summary = ?,
        detected_order_number = ?, order_id = ?, draft_reply = ?, missing_info = ?, confidence = ?, ai_provider = ?,
        ai_error = NULL, analyzed_at = datetime('now') WHERE id = ? AND workspace_id = ?`).run(
        analysis.category, analysis.urgency, analysis.needs_action ? 1 : 0, analysis.action_reason, analysis.language,
        analysis.sentiment, analysis.summary, analysis.order_number, linked?.id ?? null, analysis.draft_reply,
        JSON.stringify(analysis.missing_info), analysis.confidence, ai.name, msg.id, wsId,
      );
    } catch (e) {
      // Échec de l'IA : on rend l'analyse au quota et on garde une trace lisible.
      db.prepare('UPDATE usage SET ai_calls = MAX(ai_calls - 1, 0) WHERE workspace_id = ? AND period = ?').run(wsId, period);
      db.prepare('UPDATE messages SET ai_error = ? WHERE id = ? AND workspace_id = ?')
        .run(String(e.message || e).slice(0, 300), msg.id, wsId);
      console.error('[ia]', e.message || e);
    }
    return getMessage(wsId, msg.id);
  }

  router.post('/messages', requireAuth, async (req, res) => {
    const data = MessageSchema.parse(req.body);
    const r = db.prepare(`INSERT INTO messages (workspace_id, customer_name, customer_email, channel, subject, body)
      VALUES (?, ?, ?, ?, ?, ?)`).run(req.ws, data.customer_name, data.customer_email, data.channel, data.subject, data.body);
    let msg = getMessage(req.ws, r.lastInsertRowid);
    let warning = null;
    if (data.analyze) {
      try { msg = await runAnalysis(req.ws, msg); } catch (e) {
        if (!(e instanceof HttpError)) throw e;
        warning = e.message;
      }
    }
    res.status(201).json({ message: messageOut(msg), warning });
  });

  router.post('/messages/:id/analyze', requireAuth, async (req, res) => {
    const msg = getMessage(req.ws, id.parse(req.params.id));
    if (!msg) throw new HttpError(404, 'Message introuvable.');
    res.json({ message: messageOut(await runAnalysis(req.ws, msg)) });
  });

  router.put('/messages/:id', requireAuth, (req, res) => {
    const msgId = id.parse(req.params.id);
    const data = MessageUpdateSchema.parse(req.body);
    if (!getMessage(req.ws, msgId)) throw new HttpError(404, 'Message introuvable.');
    if (data.order_id && !db.prepare('SELECT 1 FROM orders WHERE id = ? AND workspace_id = ?').get(data.order_id, req.ws)) {
      throw new HttpError(404, 'Commande introuvable.');
    }
    const sets = [];
    const vals = [];
    for (const key of ['draft_reply', 'status', 'order_id', 'category']) {
      if (data[key] !== undefined) { sets.push(`${key} = ?`); vals.push(data[key]); }
    }
    if (data.status === 'replied') sets.push("replied_at = datetime('now')");
    if (sets.length) db.prepare(`UPDATE messages SET ${sets.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...vals, msgId, req.ws);
    res.json({ message: messageOut(getMessage(req.ws, msgId)) });
  });

  router.delete('/messages/:id', requireAuth, (req, res) => {
    const r = db.prepare('DELETE FROM messages WHERE id = ? AND workspace_id = ?').run(id.parse(req.params.id), req.ws);
    if (!r.changes) throw new HttpError(404, 'Message introuvable.');
    res.json({ ok: true });
  });

  // --- Tableau de bord -------------------------------------------------------------------
  router.get('/stats', requireAuth, (req, res) => {
    const one = (sql, ...a) => db.prepare(sql).get(req.ws, ...a);
    const open = one("SELECT COUNT(*) n FROM messages WHERE workspace_id = ? AND status IN ('new','analyzed')").n;
    const urgent = one("SELECT COUNT(*) n FROM messages WHERE workspace_id = ? AND status IN ('new','analyzed') AND urgency = 'high'").n;
    const actions = one("SELECT COUNT(*) n FROM messages WHERE workspace_id = ? AND status IN ('new','analyzed') AND needs_action = 1").n;
    const replied30 = one("SELECT COUNT(*) n FROM messages WHERE workspace_id = ? AND status = 'replied' AND replied_at >= datetime('now','-30 days')").n;
    const total = one('SELECT COUNT(*) n FROM messages WHERE workspace_id = ?').n;
    const byCategory = db.prepare(`SELECT category, COUNT(*) n FROM messages WHERE workspace_id = ? AND category IS NOT NULL
      GROUP BY category ORDER BY n DESC`).all(req.ws);
    const byLanguage = db.prepare(`SELECT language, COUNT(*) n FROM messages WHERE workspace_id = ? AND language IS NOT NULL
      GROUP BY language ORDER BY n DESC LIMIT 8`).all(req.ws);
    const ordersToShip = one("SELECT COUNT(*) n FROM orders WHERE workspace_id = ? AND status IN ('paid','preparing')").n;
    const ws = getWorkspace(req.ws);
    const plan = PLANS[ws.plan] || PLANS.free;
    res.json({
      open, urgent, actions, replied30, total, byCategory, byLanguage, ordersToShip,
      // Estimation prudente et affichée comme telle : 4 minutes gagnées par réponse préparée.
      minutesSavedEstimate: replied30 * 4,
      usage: { aiCalls: getUsage(req.ws), limit: plan.monthlyMessages },
    });
  });

  return router;
}

// Lecteur CSV minimal (guillemets, virgules ou points-virgules).
export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

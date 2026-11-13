// En-têtes de sécurité, limitation de débit et gestion d'erreurs.
import { config } from './config.js';

export function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:",
    "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'",
    "form-action 'self'", "frame-ancestors 'none'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

// Limiteur en mémoire à fenêtre fixe. Suffisant pour un seul serveur.
export class RateLimiter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.hits = new Map();
  }

  // Renvoie true si la requête est autorisée.
  take(key) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 50_000) this.sweep(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.max;
  }

  reset(key) { this.hits.delete(key); }

  sweep(now = Date.now()) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Contenu trop volumineux.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide.' });
  if (err?.name === 'ZodError') {
    const issue = err.issues?.[0];
    return res.status(400).json({ error: `Champ invalide : ${issue?.path?.join('.') || 'inconnu'}.` });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  console.error('[erreur]', err);
  res.status(500).json({ error: 'Erreur interne. Réessayez dans un instant.' });
}

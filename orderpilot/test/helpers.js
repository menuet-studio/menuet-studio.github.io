// Outils de test : un serveur neuf avec une base en mémoire et l'IA « démo ».
process.env.ORDERPILOT_SKIP_DOTENV = '1';

const { openDatabase } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { createDemoProvider } = await import('../src/ai/demo.js');

export async function startTestServer({ ai = createDemoProvider(), limits = { signup: 1000 } } = {}) {
  const db = openDatabase(':memory:');
  const app = createApp({ db, ai, limits });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, base, close: () => new Promise((r) => server.close(r)) };
}

// Petit client HTTP qui garde le cookie de session et le jeton CSRF, comme un navigateur.
export function client(base) {
  let cookie = '';
  let csrf = '';
  async function request(method, url, body, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    if (csrf && method !== 'GET' && !('x-csrf-token' in extraHeaders)) headers['x-csrf-token'] = csrf;
    const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* réponse non JSON */ }
    if (json?.csrfToken) csrf = json.csrfToken;
    return { status: res.status, body: json, headers: res.headers, text };
  }
  return {
    get: (u, h) => request('GET', u, undefined, h),
    post: (u, b, h) => request('POST', u, b ?? {}, h),
    put: (u, b, h) => request('PUT', u, b, h),
    del: (u, h) => request('DELETE', u, undefined, h),
    get cookie() { return cookie; },
  };
}

export async function signup(base, email = `u${Math.random().toString(36).slice(2)}@test.dev`) {
  const c = client(base);
  const r = await c.post('/api/auth/signup', { email, password: 'correct-horse-battery', name: 'Alex', storeName: 'Boutique Test' });
  if (r.status !== 201) throw new Error(`signup failed: ${r.status} ${JSON.stringify(r.body)}`);
  return { c, email };
}

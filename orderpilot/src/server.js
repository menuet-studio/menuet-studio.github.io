// Démarrage du serveur : `npm start` (ou `npm run dev` pour le rechargement automatique).
import { config } from './config.js';
import { openDatabase } from './db.js';
import { createAiProvider } from './ai/index.js';
import { createApp } from './app.js';

const db = openDatabase(config.databasePath);
const ai = createAiProvider(config.ai);
const app = createApp({ db, ai });

// Nettoyage quotidien des sessions expirées.
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 86400_000).unref();

const server = app.listen(config.port, () => {
  console.log(`${config.brandName} est lancé sur http://localhost:${config.port} (IA : ${ai.name})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { server.close(() => { db.close(); process.exit(0); }); });
}

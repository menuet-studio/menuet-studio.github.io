// Assemble l'application : sécurité, API, fichiers statiques.
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { createApiRouter } from './routes/api.js';
import { errorHandler, securityHeaders } from './security.js';

export function createApp({ db, ai, limits }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use('/api', createApiRouter({ db, ai, limits }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue.' }));

  const publicDir = path.join(config.root, 'public');
  app.get('/config.js', (req, res) => {
    res.type('application/javascript').send(`window.APP_CONFIG = ${JSON.stringify({ brand: config.brandName })};`);
  });
  app.use(express.static(publicDir, { extensions: ['html'], maxAge: config.isProduction ? '1h' : 0 }));
  app.use((req, res) => res.status(404).sendFile(path.join(publicDir, '404.html')));
  app.use(errorHandler);
  return app;
}

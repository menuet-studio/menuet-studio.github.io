// Configuration centrale. Toutes les valeurs sensibles viennent de variables d'environnement.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Charge le fichier .env s'il existe (fonction intégrée à Node.js >= 20.12).
if (!process.env.ORDERPILOT_SKIP_DOTENV) {
  try { process.loadEnvFile(path.join(root, '.env')); } catch { /* pas de .env : valeurs par défaut */ }
}

const env = process.env;
const isProduction = env.NODE_ENV === 'production';
const anthropicKey = env.ANTHROPIC_API_KEY || '';

export const config = {
  root,
  isProduction,
  port: Number(env.PORT) || 3000,
  brandName: env.BRAND_NAME || 'OrderPilot',
  databasePath: env.DATABASE_PATH
    ? path.resolve(root, env.DATABASE_PATH)
    : path.join(root, 'data', 'orderpilot.db'),
  trustProxy: env.TRUST_PROXY === '1',
  cookieSecure: isProduction,
  sessionDays: 30,
  ai: {
    provider: env.AI_PROVIDER || (anthropicKey ? 'anthropic' : 'demo'),
    apiKey: anthropicKey,
    model: env.AI_MODEL || 'claude-opus-5-5',
    // Adresse explicite de l'API : on n'hérite jamais d'une variable ANTHROPIC_BASE_URL externe.
    baseURL: env.AI_BASE_URL || 'https://api.anthropic.com',
  },
};

// Formules d'abonnement. Les limites sont appliquées côté serveur.
export const PLANS = {
  free: { id: 'free', name: 'Gratuit', priceEur: 0, monthlyMessages: 30, seats: 1 },
  essential: { id: 'essential', name: 'Essentiel', priceEur: 19, monthlyMessages: 500, seats: 2 },
  pro: { id: 'pro', name: 'Pro', priceEur: 49, monthlyMessages: 2000, seats: 5 },
};

export const CATEGORIES = [
  'order_status', 'order_change', 'cancellation', 'return_refund',
  'product_question', 'complaint', 'other',
];

export const ORDER_STATUSES = [
  'pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded',
];

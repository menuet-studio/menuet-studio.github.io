// Point d'entrée IA : choisit le fournisseur, retrouve la commande liée, vérifie la réponse.
import { createAnthropicProvider } from './anthropic.js';
import { createDemoProvider, extractOrderNumber } from './demo.js';
import { normalizeAnalysis } from './schema.js';

export function createAiProvider(aiConfig) {
  if (aiConfig.provider === 'anthropic') return createAnthropicProvider(aiConfig);
  return createDemoProvider();
}

// Cherche la commande concernée : d'abord par numéro, puis la plus récente du même e-mail.
export function findRelatedOrder(db, workspaceId, message) {
  const number = extractOrderNumber(`${message.subject || ''}\n${message.body}`);
  if (number) {
    const byNumber = db.prepare(
      `SELECT * FROM orders WHERE workspace_id = ? AND (order_number = ? OR order_number = ? OR order_number = ?)`,
    ).get(workspaceId, number, `#${number}`, number.replace(/^[A-Z]+-?/i, ''));
    if (byNumber) return byNumber;
  }
  if (message.customer_email) {
    return db.prepare(
      'SELECT * FROM orders WHERE workspace_id = ? AND customer_email = ? COLLATE NOCASE ORDER BY created_at DESC, id DESC LIMIT 1',
    ).get(workspaceId, message.customer_email) || null;
  }
  return null;
}

export async function analyzeMessage({ provider, workspace, message, order }) {
  const { analysis, usage } = await provider.analyze({ workspace, message, order });
  return { analysis: normalizeAnalysis(analysis), usage };
}

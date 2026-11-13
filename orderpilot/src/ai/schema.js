// Format exact que l'IA doit renvoyer. Toute réponse est vérifiée contre ce schéma.
import { z } from 'zod';
import { CATEGORIES } from '../config.js';

export const AnalysisSchema = z.object({
  category: z.enum(CATEGORIES),
  urgency: z.enum(['low', 'normal', 'high']),
  needs_action: z.boolean(),
  action_reason: z.string(),
  language: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  order_number: z.string(),
  summary: z.string(),
  draft_reply: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  missing_info: z.array(z.string()),
});

// Nettoyage défensif après validation (longueurs maximales, code langue).
export function normalizeAnalysis(raw) {
  const a = AnalysisSchema.parse(raw);
  const clip = (s, n) => String(s).trim().slice(0, n);
  return {
    ...a,
    action_reason: clip(a.action_reason, 300),
    language: clip(a.language, 8).toLowerCase() || 'und',
    order_number: clip(a.order_number, 64).replace(/^#/, ''),
    summary: clip(a.summary, 300),
    draft_reply: clip(a.draft_reply, 4000),
    missing_info: a.missing_info.slice(0, 6).map((s) => clip(s, 160)),
  };
}

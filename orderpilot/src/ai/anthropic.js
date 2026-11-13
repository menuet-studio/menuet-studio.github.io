// Fournisseur IA réel : Claude via le SDK officiel Anthropic, avec sortie JSON validée.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AnalysisSchema } from './schema.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';

// Modèles qui acceptent le repli automatique côté serveur en cas de refus de sécurité.
const FALLBACK_MODELS = /^claude-(opus-5-5|sonnet-5-5|opus-5|fable-5)/;

export function createAnthropicProvider({ apiKey, model, baseURL }) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante.');
  // authToken: null : on n'utilise jamais un autre identifiant présent dans l'environnement.
  const client = new Anthropic({ apiKey, authToken: null, baseURL, maxRetries: 2, timeout: 60_000 });

  return {
    name: `anthropic:${model}`,
    async analyze(input) {
      const params = {
        model,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
        // Effort faible : tâche de tri et de rédaction courte, on limite le coût.
        output_config: { effort: 'low', format: betaZodOutputFormat(AnalysisSchema) },
      };
      if (FALLBACK_MODELS.test(model)) {
        params.betas = ['server-side-fallback-2026-07-01'];
        params.fallbacks = 'default';
      }

      const response = await client.beta.messages.parse(params);
      if (response.stop_reason === 'refusal') throw new Error('Le modèle a refusé de traiter ce message.');
      if (response.stop_reason === 'max_tokens') throw new Error('Réponse IA tronquée.');
      if (!response.parsed_output) throw new Error('Réponse IA illisible.');
      return {
        analysis: response.parsed_output,
        usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      };
    },
  };
}

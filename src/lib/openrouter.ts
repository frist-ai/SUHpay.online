// OpenRouter API client (OpenAI-compatible)
// Docs: https://openrouter.ai/docs/api-reference

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// Free models with fallback rotation (best Russian first)
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'z-ai/glm-4.5-air:free',
  'openai/gpt-oss-120b:free',
  'minimax/minimax-m2.5:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
];

// Track which models are currently rate-limited (temporary ban)
const rateLimitedModels = new Set<string>();
const RATE_LIMIT_COOLDOWN = 60_000; // 1 min cooldown per model

function getModelsToTry(settingsModel: string): string[] {
  const models: string[] = [];

  // Try user-selected model first (unless it's rate-limited)
  if (settingsModel && !rateLimitedModels.has(settingsModel)) {
    models.push(settingsModel);
  }

  // Then fallbacks (skip rate-limited ones)
  for (const m of FALLBACK_MODELS) {
    if (!models.includes(m) && !rateLimitedModels.has(m)) {
      models.push(m);
    }
  }

  // If all are rate-limited, allow all
  if (models.length === 0) {
    rateLimitedModels.clear();
    return settingsModel ? [settingsModel, ...FALLBACK_MODELS] : [...FALLBACK_MODELS];
  }

  return models;
}

// OpenRouter chat completion with automatic model fallback
export async function openRouterChat(
  settings: OpenRouterSettings,
  messages: OpenRouterMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const maxTokens = options.maxTokens || settings.maxTokens || 1500;
  const temperature = Math.min(Math.max(options.temperature ?? settings.temperature ?? 0.7, 0), 1);

  if (!settings.apiKey) {
    console.error('[OpenRouter] Missing apiKey');
    return null;
  }

  const modelsToTry = getModelsToTry(options.model || settings.model || '');
  const messagesCount = messages.length;

  for (const model of modelsToTry) {
    try {
      console.log(`[OpenRouter] Trying model: ${model} (${messagesCount} messages)`);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'https://suhpay.online',
          'X-Title': 'SUH[pay] Store',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorCode = errorData?.code;
        const errorMsg = errorData?.error?.message || errorData?.message || '';

        console.error(`[OpenRouter] ${model}: ${response.status} — ${errorMsg}`);

        // Rate limited — mark and try next model
        if (response.status === 429 || errorCode === 429) {
          rateLimitedModels.add(model);
          setTimeout(() => rateLimitedModels.delete(model), RATE_LIMIT_COOLDOWN);
          console.log(`[OpenRouter] Rate limited: ${model}, trying next...`);
          continue;
        }

        // Auth error — don't retry
        if (response.status === 401 || response.status === 403) return 'ERROR:UNAUTHORIZED';
        if (response.status === 402) return 'ERROR:PAYMENT_REQUIRED';

        // Other error — try next model
        continue;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || null;
      const usedModel = data?.model || model;

      if (text) {
        console.log(`[OpenRouter] Success: ${usedModel}`);
        return text;
      }

      // Empty response — try next
      continue;
    } catch (error) {
      console.error(`[OpenRouter] Error with ${model}:`, error);
      continue;
    }
  }

  console.error('[OpenRouter] All models failed');
  return null;
}

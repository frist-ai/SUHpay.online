// Yandex GPT API client
// Docs: https://cloud.yandex.ru/docs/yandexgpt/

interface YandexMessage {
  role: 'system' | 'user' | 'assistant';
  text: string;
}

interface YandexOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface YandexSettings {
  apiKey: string;       // API key secret
  apiKeyId: string;     // API key ID
  folderId: string;     // Yandex Cloud folder ID
  model: string;        // yandexgpt-lite, yandexgpt, yandexgpt-32k
  maxTokens: number;
  temperature: number;
}

// Yandex GPT completion
export async function yandexGPT(settings: YandexSettings, messages: YandexMessage[], options: YandexOptions = {}): Promise<string | null> {
  const model = options.model || settings.model || 'yandexgpt-lite';
  const maxTokens = String(options.maxTokens || settings.maxTokens || 1500);
  const temperature = Math.min(Math.max(options.temperature ?? settings.temperature ?? 0.7, 0), 1);

  if (!settings.apiKey || !settings.folderId) {
    console.error('[YandexGPT] Missing apiKey or folderId');
    return null;
  }

  const modelUri = `gpt://${settings.folderId}/${model}`;

  console.log('[YandexGPT] Request:', { modelUri, folderId: settings.folderId, model, maxTokens, temperature, messagesCount: messages.length });

  try {
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${settings.apiKey}`,
      },
      body: JSON.stringify({
        modelUri,
        completionOptions: {
          stream: false,
          temperature,
          maxTokens,
        },
        messages: messages.map(m => ({
          role: m.role,
          text: m.text,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[YandexGPT] Completion error:', response.status, errorText);

      // Return readable error codes
      if (response.status === 403) return 'ERROR:FORBIDDEN';
      if (response.status === 400) return 'ERROR:BAD_REQUEST';
      if (response.status === 401) return 'ERROR:UNAUTHORIZED';
      if (response.status === 429) return 'ERROR:RATE_LIMIT';
      if (response.status === 402) return 'ERROR:PAYMENT_REQUIRED';
      return null;
    }

    const data = await response.json();
    const text = data?.result?.alternatives?.[0]?.message?.text || null;
    return text;
  } catch (error) {
    console.error('[YandexGPT] Error:', error);
    return null;
  }
}

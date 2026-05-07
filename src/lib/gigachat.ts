// GigaChat API helper
// Note: GigaChat uses self-signed certificates from Sberbank

interface GigaChatToken {
  access_token: string;
  expires_at: number;
}

// Token cache
let cachedToken: GigaChatToken | null = null;

// Generate Authorization Key from Client ID and Client Secret
function generateAuthKey(clientId: string, clientSecret: string): string {
  // Auth Key is base64 encoded "clientId:clientSecret"
  const credentials = `${clientId}:${clientSecret}`;
  return Buffer.from(credentials).toString('base64');
}

// Custom fetch that bypasses TLS verification for GigaChat
async function fetchInsecure(url: string, options: RequestInit): Promise<Response> {
  // For Node.js environment, we need to disable TLS verification
  // This is required for GigaChat's self-signed certificates

  try {
    // Try to use undici which allows bypassing TLS verification
    // undici is bundled with Node.js 18+
    const { Agent, fetch: undiciFetch } = await import('undici') as any;

    const agent = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });

    return await undiciFetch(url, {
      ...options,
      dispatcher: agent,
    });
  } catch (undiciError) {
    // Fallback to regular fetch (will likely fail with certificate error)
    // But we try anyway in case the environment has the cert
    return fetch(url, options);
  }
}

// Get GigaChat access token using OAuth2
export async function getGigaChatToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  try {
    // Generate auth key from credentials
    const authKey = generateAuthKey(clientId, clientSecret);

    // GigaChat OAuth2 endpoint - requires TLS bypass
    const response = await fetchInsecure('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': crypto.randomUUID(),
        'Authorization': `Basic ${authKey}`,
      },
      body: 'scope=GIGACHAT_API_PERS&grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GigaChat] Token error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const expiresIn = data.expires_in || data.expiresIn || 3600;
    // Cache the token (expires in seconds, convert to ms and subtract 60s for safety)
    cachedToken = {
      access_token: data.access_token,
      expires_at: Date.now() + ((expiresIn) - 60) * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error('[GigaChat] Error getting token:', error);
    return null;
  }
}

// GigaChat chat completion
export async function gigaChatCompletion(
  token: string,
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string | null> {
  const { model = 'GigaChat', maxTokens = 1200, temperature = 0.7 } = options;

  try {
    const response = await fetchInsecure('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GigaChat] Completion error:', response.status, errorText);
      // Return readable error for common HTTP codes
      if (response.status === 402) return 'ERROR:PAYMENT_REQUIRED';
      if (response.status === 401) return 'ERROR:UNAUTHORIZED';
      if (response.status === 429) return 'ERROR:RATE_LIMIT';
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || null;
    return content;
  } catch (error) {
    console.error('[GigaChat] Error in completion:', error);
    return null;
  }
}

// Full GigaChat request with auto token refresh
export async function gigaChat(
  clientId: string,
  clientSecret: string,
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string | null> {
  const token = await getGigaChatToken(clientId, clientSecret);
  if (!token) {
    console.error('[GigaChat] Failed to get token');
    return null;
  }

  return gigaChatCompletion(token, messages, options);
}

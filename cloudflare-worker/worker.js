// Cloudflare Worker - Reverse Proxy for Suhpay
// This worker proxies requests to Netlify, bypassing mobile ISP blocks

const NETLIFY_URL = 'https://suhpays.netlify.app';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Build target URL
    const targetUrl = NETLIFY_URL + url.pathname + url.search;
    
    // Clone request headers
    const headers = new Headers(request.headers);
    
    // Set proper host header for Netlify
    headers.set('Host', 'suhpays.netlify.app');
    headers.set('X-Forwarded-Host', url.hostname);
    headers.set('X-Forwarded-Proto', 'https');
    headers.set('X-Real-IP', request.headers.get('CF-Connecting-IP') || '');
    
    // Forward the request to Netlify
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual',
    });
    
    try {
      const response = await fetch(proxyRequest);
      
      // Clone response to modify headers
      const proxyResponse = new Response(response.body, response);
      
      // Copy response headers
      response.headers.forEach((value, key) => {
        // Skip hop-by-hop headers
        if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
          proxyResponse.headers.set(key, value);
        }
      });
      
      // Add CORS headers for Telegram
      proxyResponse.headers.set('Access-Control-Allow-Origin', '*');
      proxyResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      proxyResponse.headers.set('Access-Control-Allow-Headers', '*');
      
      // CSP for Telegram Mini Apps
      proxyResponse.headers.set('Content-Security-Policy', "frame-ancestors 'self' https://*.telegram.org https://t.me https://web.telegram.org;");
      
      return proxyResponse;
    } catch (error) {
      return new Response('Proxy Error: ' + error.message, { status: 502 });
    }
  },
};

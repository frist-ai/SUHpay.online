'use client';

/**
 * Global fetch interceptor — automatically attaches Telegram initData
 * as X-Telegram-Init-Data header to every API request.
 * 
 * Works in Telegram Mini App environment where window.Telegram.WebApp.initData
 * is available. Does nothing outside Telegram.
 */

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;

  function getTelegramInitData(): string | null {
    try {
      const data = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData;
      if (typeof data === 'string' && data.length > 0) return data;
    } catch {
      // Ignore
    }
    return null;
  }

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const initData = getTelegramInitData();

    if (initData) {
      // Always create an init object, even if fetch() was called without one
      const fetchInit = init || {};
      const headers = new Headers(fetchInit.headers);

      if (!headers.has('X-Telegram-Init-Data')) {
        headers.set('X-Telegram-Init-Data', initData);
      }

      return originalFetch.call(window, input, { ...fetchInit, headers });
    }

    return originalFetch.call(window, input, init);
  };
}

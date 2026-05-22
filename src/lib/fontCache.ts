const FONT_CACHE_NAME = 'linkhub-font-cache-v1';
const inFlight = new Map<string, Promise<void>>();

export async function prefetchFontStyles(urls: string[]): Promise<void> {
  if (typeof caches === 'undefined') return;
  await Promise.all(
    urls.map(async (url) => {
      if (inFlight.has(url)) return inFlight.get(url);
      const task = (async () => {
        try {
          const cache = await caches.open(FONT_CACHE_NAME);
          const cached = await cache.match(url);
          if (cached) return;
          const response = await fetch(url, { mode: 'no-cors', cache: 'force-cache' });
          if (response) {
            await cache.put(url, response);
          }
        } catch {
          // ignore cache errors
        }
      })();
      inFlight.set(url, task);
      try {
        await task;
      } finally {
        inFlight.delete(url);
      }
    })
  );
}

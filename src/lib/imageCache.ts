const IMAGE_CACHE_NAME = 'linkhub-image-cache-v1';
const inFlight = new Map<string, Promise<void>>();

export async function prefetchImage(url: string | null | undefined): Promise<void> {
  if (!url || typeof caches === 'undefined') return;
  if (inFlight.has(url)) return inFlight.get(url) ?? undefined;

  const task = (async () => {
    try {
      const cache = await caches.open(IMAGE_CACHE_NAME);
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
}

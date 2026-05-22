const hostnameCache = new Map<string, string>();

export function getHostnameCached(url: string): string {
  if (hostnameCache.has(url)) return hostnameCache.get(url) ?? '';
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = '';
  }
  hostnameCache.set(url, host);
  return host;
}

export function getHostnameOrUrl(url: string): string {
  const host = getHostnameCached(url);
  return host || url;
}

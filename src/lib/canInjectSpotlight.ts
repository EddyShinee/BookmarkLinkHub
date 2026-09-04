/** Trang extension của chính LinkHub (new tab, options, spotlight window). */
export function isOwnExtensionPage(url: string | undefined | null): boolean {
  if (!url) return false;
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return false;
  try {
    return url.startsWith(chrome.runtime.getURL(''));
  } catch {
    return false;
  }
}

/**
 * Chrome chặn content script trên chrome://, Web Store, PDF viewer nội bộ, file:, v.v.
 * Overlay chỉ an toàn trên http(s) thông thường.
 */
export function canInjectSpotlight(url: string | undefined | null): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const host = parsed.hostname;
  if (host === 'chromewebstore.google.com') return false;
  if (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) return false;
  if (host === 'microsoftedge.microsoft.com' && parsed.pathname.includes('/addon')) return false;
  return true;
}

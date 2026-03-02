/**
 * Mở URL trong tab hiện tại hoặc tab mới.
 * - Extension: chrome.tabs (update tab hiện tại hoặc tạo mới).
 * - Web: window.location / window.open.
 */
export function openLink(url: string, inCurrentTab?: boolean): void {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    if (inCurrentTab) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) chrome.tabs.update(tabs[0].id, { url });
        else chrome.tabs.create({ url });
      });
    } else {
      chrome.tabs.create({ url });
    }
    return;
  }
  if (inCurrentTab) {
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

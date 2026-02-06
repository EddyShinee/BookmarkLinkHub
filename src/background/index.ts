const NEWTAB_PATH = '/src/newtab/index.html';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-linkhub',
    title: 'Add to LinkHub',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-to-linkhub' && tab?.url && !tab.url.startsWith('chrome://')) {
    const params = new URLSearchParams({ add: '1', url: tab.url, title: tab.title ?? '' });
    chrome.tabs.create({ url: chrome.runtime.getURL(NEWTAB_PATH) + '?' + params.toString() });
  }
});

// Chụp màn hình tab hiện tại (gọi từ popup → chạy ở background để dùng host permission)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'CAPTURE_VISIBLE_TAB') {
    return false;
  }
  chrome.windows.getCurrent((win) => {
    const windowId = win?.id;
    const opts: chrome.tabs.CaptureVisibleTabOptions = { format: 'png' };
    chrome.tabs.captureVisibleTab(windowId, opts)
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((err: Error) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
  });
  return true; // keep channel open for async sendResponse
});

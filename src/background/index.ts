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

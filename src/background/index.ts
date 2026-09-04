import { canInjectSpotlight, isOwnExtensionPage } from '../lib/canInjectSpotlight';
import { isSpotlightOpenUrlMessage, LH_TOGGLE_SPOTLIGHT, SPOTLIGHT_COMMAND } from '../lib/spotlightMessages';
import spotlightOverlayScript from '../content/spotlightOverlay.tsx?script';

const NEWTAB_PATH = '/src/newtab/index.html';
const FLOATING_WIDTH = 580;
const FLOATING_HEIGHT = 520;

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

chrome.commands.onCommand.addListener((command) => {
  if (command !== SPOTLIGHT_COMMAND) return;
  void toggleSpotlightCommand();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.windows.getCurrent((win) => {
      const windowId = win?.id;
      const opts: chrome.tabs.CaptureVisibleTabOptions = { format: 'png' };
      chrome.tabs.captureVisibleTab(windowId, opts)
        .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
        .catch((err: Error) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
    });
    return true;
  }

  if (isSpotlightOpenUrlMessage(msg)) {
    void openSpotlightUrl(msg, sender).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});


async function toggleSpotlightCommand(): Promise<void> {
  const floating = await findFloatingSpotlightWindow();
  const lastWin = await chrome.windows.getLastFocused().catch(() => undefined);

  if (floating?.id != null && lastWin?.id === floating.id) {
    await chrome.windows.remove(floating.id).catch(() => undefined);
    return;
  }

  const tab = await getActiveTab();
  const toggled = await tryToggleOverlay(tab);
  if (toggled) {
    if (floating?.id != null) await chrome.windows.remove(floating.id).catch(() => undefined);
    return;
  }

  if (floating?.id != null) {
    await chrome.windows.remove(floating.id).catch(() => undefined);
    return;
  }

  await openFloatingWindow(tab?.id);
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function tryToggleOverlay(tab: chrome.tabs.Tab | undefined): Promise<boolean> {
  if (!tab?.id || !tab.url) return false;

  if (isOwnExtensionPage(tab.url)) {
    return sendToggle(tab.id);
  }

  if (!canInjectSpotlight(tab.url)) return false;

  if (await sendToggle(tab.id)) return true;
  await delay(50);
  if (await sendToggle(tab.id)) return true;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [spotlightOverlayScript.replace(/^\//, '')],
    });
  } catch {
    return false;
  }

  for (let i = 0; i < 8; i += 1) {
    await delay(40);
    if (await sendToggle(tab.id)) return true;
  }
  return false;
}

function sendToggle(tabId: number): Promise<boolean> {
  return chrome.tabs
    .sendMessage(tabId, { type: LH_TOGGLE_SPOTLIGHT })
    .then(() => true)
    .catch(() => false);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function findFloatingSpotlightWindow(): Promise<chrome.windows.Window | undefined> {
  const spotlightUrl = chrome.runtime.getURL('src/spotlight/index.html');
  const wins = await chrome.windows.getAll({ populate: true });
  return wins.find(
    (w) => w.type === 'popup' && w.tabs?.some((t) => typeof t.url === 'string' && t.url.startsWith(spotlightUrl))
  );
}

async function openFloatingWindow(sourceTabId?: number): Promise<void> {
  const last = await chrome.windows.getLastFocused().catch(() => undefined);
  const left = Math.round((last?.left ?? 0) + ((last?.width ?? FLOATING_WIDTH) - FLOATING_WIDTH) / 2);
  const top = Math.round((last?.top ?? 0) + ((last?.height ?? FLOATING_HEIGHT) - FLOATING_HEIGHT) / 2);
  const page = chrome.runtime.getURL('src/spotlight/index.html');
  const url = sourceTabId != null ? `${page}?tabId=${sourceTabId}` : page;
  await chrome.windows.create({
    url,
    type: 'popup',
    width: FLOATING_WIDTH,
    height: FLOATING_HEIGHT,
    left,
    top,
    focused: true,
  });
}

async function openSpotlightUrl(
  msg: { url: string; newTab?: boolean; tabId?: number },
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const fromFloating = typeof sender.url === 'string' && sender.url.includes('spotlight/index.html');
  const tabId = typeof msg.tabId === 'number' ? msg.tabId : fromFloating ? undefined : sender.tab?.id;
  if (msg.newTab || tabId == null) {
    await chrome.tabs.create({ url: msg.url });
  } else {
    await chrome.tabs.update(tabId, { url: msg.url });
  }
  const floating = await findFloatingSpotlightWindow();
  if (floating?.id != null) {
    await chrome.windows.remove(floating.id).catch(() => undefined);
  }
}

export {};

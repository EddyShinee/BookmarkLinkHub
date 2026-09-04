import { createRoot, type Root } from 'react-dom/client';
import { SettingsProvider } from '../contexts/SettingsContext';
import { createDoubleShiftDetector } from '../lib/doubleShift';
import { isSpotlightToggleMessage } from '../lib/spotlightMessages';
import { readDoubleShiftEnabled, subscribeDoubleShiftEnabled } from '../lib/spotlightShortcut';
import SpotlightShell from '../spotlight/SpotlightShell';
import overlayCss from '../styles/globals.css?inline';

const HOST_ID = 'linkhub-spotlight-host';

declare global {
  // eslint-disable-next-line no-var
  var __lhSpotlightInit: boolean | undefined;
}

function isTopFrame(): boolean {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

if (isTopFrame() && !globalThis.__lhSpotlightInit) {
  globalThis.__lhSpotlightInit = true;
  bootOverlay();
}

function bootOverlay() {
  let open = false;
  let root: Root | null = null;
  let host: HTMLElement | null = null;

  const applyHostVisibility = () => {
    if (!host) return;
    host.style.display = open ? 'block' : 'none';
    host.style.pointerEvents = open ? 'auto' : 'none';
    if (open) host.setAttribute('data-open', 'true');
    else host.removeAttribute('data-open');
  };

  const focusSearchInput = () => {
    const mount = host?.shadowRoot?.getElementById('lh-root');
    const input = mount?.querySelector<HTMLInputElement>('input[type="text"]:not([disabled])');
    if (!input) return false;
    input.focus({ preventScroll: true });
    if (!input.value) input.select();
    return host?.shadowRoot?.activeElement === input;
  };

  const ensureMount = (): HTMLElement => {
    const existing = document.getElementById(HOST_ID);
    if (existing?.shadowRoot) {
      host = existing;
      const mount = existing.shadowRoot.getElementById('lh-root');
      if (mount) return mount;
    }

    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute(
      'style',
      'all:initial;position:fixed;inset:0;z-index:2147483647;display:none;pointer-events:none;'
    );
    const shadow = host.attachShadow({ mode: 'open' });

    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(overlayCss);
      shadow.adoptedStyleSheets = [sheet];
    } catch {
      const style = document.createElement('style');
      style.textContent = overlayCss;
      shadow.appendChild(style);
    }

    const mount = document.createElement('div');
    mount.id = 'lh-root';
    mount.style.height = '100%';
    shadow.appendChild(mount);
    document.documentElement.appendChild(host);
    return mount;
  };

  const render = () => {
    const mount = ensureMount();
    applyHostVisibility();
    if (!root) root = createRoot(mount);
    root.render(
      <SettingsProvider applyDocumentTheme={false}>
        <SpotlightShell
          variant="overlay"
          open={open}
          onClose={() => {
            open = false;
            render();
          }}
        />
      </SettingsProvider>
    );
  };

  const toggle = () => {
    open = !open;
    render();
    if (!open) return;
    // Double Shift / command có thể mở trước khi React commit + Shift còn giữ —
    // thử focus vài lần sau khi panel hiện.
    let tries = 0;
    const tick = () => {
      if (!open) return;
      if (focusSearchInput()) return;
      tries += 1;
      if (tries < 15) window.setTimeout(tick, tries < 4 ? 20 : 40);
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(tick);
    });
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isSpotlightToggleMessage(msg)) return;
    toggle();
    sendResponse({ ok: true });
  });

  let stopDoubleShift: (() => void) | null = null;
  const syncDoubleShift = (enabled: boolean) => {
    stopDoubleShift?.();
    stopDoubleShift = null;
    if (!enabled) return;
    stopDoubleShift = createDoubleShiftDetector(toggle);
  };
  void readDoubleShiftEnabled().then(syncDoubleShift);
  subscribeDoubleShiftEnabled(syncDoubleShift);
}

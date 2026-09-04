import { useCallback, useEffect, useState } from 'react';
import SearchSpotlightModal, { type SpotlightItem } from '../components/SearchSpotlightModal';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../hooks/useAuth';
import { loadSpotlightItems } from '../lib/loadSpotlightItems';
import { LH_OPEN_URL } from '../lib/spotlightMessages';

const NEWTAB_HTML = 'src/newtab/index.html';

function parseSourceTabId(): number | undefined {
  try {
    const raw = new URLSearchParams(window.location.search).get('tabId');
    if (!raw) return undefined;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

function openViaBackground(url: string, newTab: boolean, tabId?: number) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else window.location.href = url;
    return;
  }
  chrome.runtime.sendMessage({ type: LH_OPEN_URL, url, newTab, tabId });
}

export default function SpotlightShell({
  variant,
  open,
  onClose,
  sourceTabId,
}: {
  variant: 'overlay' | 'window';
  open: boolean;
  onClose: () => void;
  sourceTabId?: number;
}) {
  const settings = useSettings();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [status, setStatus] = useState<'ready' | 'loading' | 'signed-out'>('loading');
  const resolvedTabId = sourceTabId ?? (variant === 'window' ? parseSourceTabId() : undefined);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (authLoading) {
      setStatus('loading');
      return;
    }
    if (!user) {
      setItems([]);
      setStatus('signed-out');
      return;
    }
    setStatus('loading');
    void loadSpotlightItems()
      .then((result) => {
        if (cancelled) return;
        if (!result.signedIn) {
          setItems([]);
          setStatus('signed-out');
          return;
        }
        setItems(result.items);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [open, user, authLoading]);

  const handleOpen = useCallback(
    (url: string, opts?: { newTab?: boolean }) => {
      const newTab = opts?.newTab || settings.openLinkIn !== 'current_tab';
      openViaBackground(url, newTab, resolvedTabId);
      onClose();
    },
    [onClose, resolvedTabId, settings.openLinkIn]
  );

  const handleOpenLinkHub = useCallback(() => {
    const url =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL(NEWTAB_HTML)
        : '/';
    openViaBackground(url, true);
    onClose();
  }, [onClose]);

  const isLight = settings.theme === 'light';
  const modal = (
    <SearchSpotlightModal
      open={open}
      items={items}
      onClose={onClose}
      onOpen={handleOpen}
      variant={variant}
      shortcutHint="global"
      status={status}
      onOpenLinkHub={handleOpenLinkHub}
    />
  );

  if (variant === 'overlay') {
    return <div className={`lh-spotlight-root h-full ${isLight ? 'light' : ''}`}>{modal}</div>;
  }

  return modal;
}

import { useCallback, useEffect } from 'react';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
import { useDoubleShiftShortcut } from '../hooks/useDoubleShiftShortcut';
import { isSpotlightToggleMessage, LH_REQUEST_SPOTLIGHT } from '../lib/spotlightMessages';
import SpotlightShell from './SpotlightShell';

function FloatingSpotlight() {
  const { spotlightDoubleShift } = useSettings();
  const closeWindow = useCallback(() => window.close(), []);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    const listener = (msg: unknown) => {
      if (!isSpotlightToggleMessage(msg)) return;
      window.close();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const onDoubleShift = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: LH_REQUEST_SPOTLIGHT });
      return;
    }
    window.close();
  }, []);
  useDoubleShiftShortcut(onDoubleShift, spotlightDoubleShift !== false);

  return <SpotlightShell variant="window" open onClose={closeWindow} />;
}

export default function SpotlightApp() {
  return (
    <SettingsProvider>
      <FloatingSpotlight />
    </SettingsProvider>
  );
}

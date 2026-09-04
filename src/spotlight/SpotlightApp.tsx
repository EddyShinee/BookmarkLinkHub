import { useEffect } from 'react';
import { SettingsProvider } from '../contexts/SettingsContext';
import { isSpotlightToggleMessage } from '../lib/spotlightMessages';
import SpotlightShell from './SpotlightShell';

function FloatingSpotlight() {
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    const listener = (msg: unknown) => {
      if (!isSpotlightToggleMessage(msg)) return;
      window.close();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return <SpotlightShell variant="window" open onClose={() => window.close()} />;
}

export default function SpotlightApp() {
  return (
    <SettingsProvider>
      <FloatingSpotlight />
    </SettingsProvider>
  );
}

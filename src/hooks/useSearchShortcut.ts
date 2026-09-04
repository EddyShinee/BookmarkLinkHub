import { useEffect } from 'react';

export function useSearchShortcut(onTrigger: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Ctrl/⌘+K trên Dashboard. Global Spotlight dùng Ctrl/⌘+Shift+K (chrome.commands).
        e.preventDefault();
        onTrigger();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTrigger]);
}

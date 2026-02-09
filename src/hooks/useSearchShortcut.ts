import { useEffect } from 'react';

export function useSearchShortcut(onTrigger: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTypingElement =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (target as HTMLElement | null)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Cho phép dùng trong khi đang gõ, vì đây là shortcut có modifier
        e.preventDefault();
        onTrigger();
      }

      // Nếu sau này cần chặn trong khi đang gõ ở chỗ khác, có thể dùng isTypingElement
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTrigger]);
}


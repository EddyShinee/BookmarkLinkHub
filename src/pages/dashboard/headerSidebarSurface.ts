import type { CSSProperties } from 'react';
import type { Theme } from '../../lib/settings';

/** Header / sidebar / footer. Glass stays transparent so the page color shows through. Flat mode uses that same color. */
export function chromePanelBackground(
  headerSidebarColorEffect: boolean | undefined,
  theme: Theme,
  pageBackground?: string
): CSSProperties {
  if (headerSidebarColorEffect !== false) {
    return {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    };
  }
  if (pageBackground) return { backgroundColor: pageBackground };
  return theme === 'light' ? { backgroundColor: '#e5e5e5' } : { backgroundColor: '#1E293B' };
}

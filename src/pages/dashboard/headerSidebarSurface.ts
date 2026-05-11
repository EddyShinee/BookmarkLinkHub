import type { CSSProperties } from 'react';
import type { Theme } from '../../lib/settings';

/** Header / sidebar panel background (glass blur vs solid by theme). */
export function chromePanelBackground(
  headerSidebarColorEffect: boolean | undefined,
  theme: Theme
): CSSProperties {
  if (headerSidebarColorEffect !== false) {
    return {
      backgroundColor: 'transparent',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    };
  }
  return theme === 'light' ? { backgroundColor: '#e5e5e5' } : { backgroundColor: '#1E293B' };
}

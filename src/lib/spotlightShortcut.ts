import { SPOTLIGHT_COMMAND, SPOTLIGHT_SHORTCUTS_URL } from './spotlightMessages';

export type SpotlightCommandShortcut = {
  shortcut: string;
  assigned: boolean;
};

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().includes('MAC');
}

/** Chrome trả về "Ctrl+Shift+K", "⌘+Shift+K", "Command+Shift+K", … */
export function parseShortcutParts(shortcut: string): string[] {
  if (!shortcut.trim()) return [];
  return shortcut
    .split('+')
    .map((part) => {
      const raw = part.trim();
      if (!raw) return '';
      const key = raw.toLowerCase();
      if (key === 'command' || key === 'meta' || raw === '⌘') return '⌘';
      if (key === 'macctrl' || key === 'ctrl' || key === 'control') return 'Ctrl';
      if (key === 'shift' || raw === '⇧') return isMacPlatform() ? '⇧' : 'Shift';
      if (key === 'alt' || key === 'option' || raw === '⌥') return isMacPlatform() ? '⌥' : 'Alt';
      if (key === 'search') return 'Search';
      return raw.length === 1 ? raw.toUpperCase() : raw;
    })
    .filter(Boolean);
}

export async function getSpotlightCommandShortcut(): Promise<SpotlightCommandShortcut> {
  if (typeof chrome === 'undefined' || !chrome.commands?.getAll) {
    return { shortcut: '', assigned: false };
  }
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === SPOTLIGHT_COMMAND);
    const shortcut = cmd?.shortcut?.trim() ?? '';
    return { shortcut, assigned: shortcut.length > 0 };
  } catch {
    return { shortcut: '', assigned: false };
  }
}

export function openChromeShortcutsPage(): void {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url: SPOTLIGHT_SHORTCUTS_URL });
    return;
  }
  window.open(SPOTLIGHT_SHORTCUTS_URL, '_blank', 'noopener,noreferrer');
}

export const LH_TOGGLE_SPOTLIGHT = 'LH_TOGGLE_SPOTLIGHT' as const;
export const LH_OPEN_URL = 'LH_OPEN_URL' as const;
export const LH_REQUEST_SPOTLIGHT = 'LH_REQUEST_SPOTLIGHT' as const;
export const SPOTLIGHT_COMMAND = 'open-spotlight';
export const SPOTLIGHT_SHORTCUTS_URL = 'chrome://extensions/shortcuts';

export type SpotlightToggleMessage = {
  type: typeof LH_TOGGLE_SPOTLIGHT;
};

export type SpotlightRequestMessage = {
  type: typeof LH_REQUEST_SPOTLIGHT;
};

export type SpotlightOpenUrlMessage = {
  type: typeof LH_OPEN_URL;
  url: string;
  newTab?: boolean;
  tabId?: number;
};

export type SpotlightRuntimeMessage = SpotlightToggleMessage | SpotlightOpenUrlMessage | SpotlightRequestMessage;

export function isSpotlightToggleMessage(msg: unknown): msg is SpotlightToggleMessage {
  return !!msg && typeof msg === 'object' && (msg as { type?: string }).type === LH_TOGGLE_SPOTLIGHT;
}

export function isSpotlightRequestMessage(msg: unknown): msg is SpotlightRequestMessage {
  return !!msg && typeof msg === 'object' && (msg as { type?: string }).type === LH_REQUEST_SPOTLIGHT;
}

export function isSpotlightOpenUrlMessage(msg: unknown): msg is SpotlightOpenUrlMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as { type?: string; url?: unknown };
  return m.type === LH_OPEN_URL && typeof m.url === 'string' && m.url.length > 0;
}

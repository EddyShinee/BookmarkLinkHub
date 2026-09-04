export const LH_TOGGLE_SPOTLIGHT = 'LH_TOGGLE_SPOTLIGHT' as const;
export const LH_OPEN_URL = 'LH_OPEN_URL' as const;

export type SpotlightToggleMessage = {
  type: typeof LH_TOGGLE_SPOTLIGHT;
};

export type SpotlightOpenUrlMessage = {
  type: typeof LH_OPEN_URL;
  url: string;
  newTab?: boolean;
  tabId?: number;
};

export type SpotlightRuntimeMessage = SpotlightToggleMessage | SpotlightOpenUrlMessage;

export function isSpotlightToggleMessage(msg: unknown): msg is SpotlightToggleMessage {
  return !!msg && typeof msg === 'object' && (msg as { type?: string }).type === LH_TOGGLE_SPOTLIGHT;
}

export function isSpotlightOpenUrlMessage(msg: unknown): msg is SpotlightOpenUrlMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as { type?: string; url?: unknown };
  return m.type === LH_OPEN_URL && typeof m.url === 'string' && m.url.length > 0;
}

/** Cài đặt app — lưu trong chrome.storage.local */
export const SETTINGS_STORAGE_KEY = 'linkhub_settings';

export type Locale = 'vi' | 'en';
export type Theme = 'dark' | 'light';
export type CategoryCardHeight = 'auto' | 'equal';
export type OpenLinkIn = 'new_tab' | 'current_tab';

export interface DragDropSettings {
  board: boolean;
  category: boolean;
  bookmark: boolean;
}

export interface AppSettings {
  locale: Locale;
  categoryColumns: 2 | 3 | 4 | 5 | 6;
  theme: Theme;
  backgroundColor: string;
  categoryCardHeight: CategoryCardHeight;
  openLinkIn: OpenLinkIn;
  dragDrop: DragDropSettings;
  categoryColorFillContent: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'vi',
  categoryColumns: 4,
  theme: 'dark',
  backgroundColor: '#0F172A',
  categoryCardHeight: 'auto',
  openLinkIn: 'new_tab',
  dragDrop: {
    board: true,
    category: true,
    bookmark: true,
  },
  categoryColorFillContent: false,
};

export const BACKGROUND_COLORS = [
  '#0F172A', '#1e3a5f', '#312e81', '#4c1d95', '#14532d', '#166534',
  '#0c4a6e', '#1e293b', '#422006', '#1c1917', '#18181b', '#3f3f46',
];

/** Cài đặt app — lưu trong chrome.storage.local */
export const SETTINGS_STORAGE_KEY = 'linkhub_settings';

export type Locale = 'vi' | 'en';
export type Theme = 'dark' | 'light';
export type CategoryCardHeight = 'auto' | 'equal';
export type TimeFormat = '12' | '24';
export type OpenLinkIn = 'new_tab' | 'current_tab';

/** Sắp xếp category: theo ngày tạo (tăng/giảm) hoặc theo tên (A-Z / Z-A) */
export type CategorySortOrder = 'created_asc' | 'created_desc' | 'name_asc' | 'name_desc';

export interface DragDropSettings {
  board: boolean;
  category: boolean;
  bookmark: boolean;
}

export interface AppSettings {
  locale: Locale;
  categoryColumns: 2 | 3 | 4 | 5 | 6;
  categorySortOrder: CategorySortOrder;
  theme: Theme;
  backgroundColor: string;
  backgroundMode: 'color' | 'image';
  backgroundImageUrl: string | null;
  backgroundOverlayOpacity: number; // 0-100
  landingBackgroundColor?: string | null;
  landingBackgroundMode?: 'color' | 'image';
  landingBackgroundImageUrl?: string | null;
  landingBackgroundOverlayOpacity?: number | null;
  categoryCardHeight: CategoryCardHeight;
  openLinkIn: OpenLinkIn;
  dragDrop: DragDropSettings;
  categoryColorFillContent: boolean;
  startOnLanding: boolean;
  timeFormat: TimeFormat;
  showLandingPomodoro?: boolean;
  showLandingTodos?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'vi',
  categoryColumns: 4,
  categorySortOrder: 'name_asc',
  theme: 'dark',
  backgroundColor: '#0F172A',
  backgroundMode: 'color',
  backgroundImageUrl: null,
  backgroundOverlayOpacity: 90,
  categoryCardHeight: 'auto',
  openLinkIn: 'new_tab',
  dragDrop: {
    board: true,
    category: true,
    bookmark: true,
  },
  categoryColorFillContent: false,
  startOnLanding: true,
  timeFormat: '24',
  showLandingPomodoro: true,
  showLandingTodos: true,
};

export const BACKGROUND_COLORS = [
  '#0F172A', '#1e3a5f', '#312e81', '#4c1d95', '#14532d', '#166534',
  '#0c4a6e', '#1e293b', '#422006', '#1c1917', '#18181b', '#3f3f46',
];

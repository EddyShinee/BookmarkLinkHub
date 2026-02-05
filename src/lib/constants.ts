export const MSG = {
  GET_BOOKMARKS: 'GET_BOOKMARKS',
  ADD_BOOKMARK: 'ADD_BOOKMARK',
  ADD_PENDING_PAGE: 'ADD_PENDING_PAGE',
  GET_PENDING_PAGE: 'GET_PENDING_PAGE',
  CLEAR_PENDING_PAGE: 'CLEAR_PENDING_PAGE',
} as const;

export interface PendingPage {
  url: string;
  title: string;
}

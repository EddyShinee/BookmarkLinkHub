/** Adapter lưu session Supabase.
 *
 * - Trong môi trường extension: dùng chrome.storage.local (ổn định, shared giữa tabs).
 * - Trong localhost / non-extension: fallback sang window.localStorage để tránh lỗi `chrome is undefined`.
 */
const hasChromeStorage =
  typeof chrome !== 'undefined' &&
  !!chrome.storage &&
  !!chrome.storage.local;

export const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    new Promise((resolve) => {
      if (hasChromeStorage) {
        chrome.storage.local.get([key], (r) => resolve(r[key] ?? null));
        return;
      }

      try {
        const v = window.localStorage.getItem(key);
        resolve(v);
      } catch {
        resolve(null);
      }
    }),

  setItem: (key: string, value: string): Promise<void> =>
    new Promise((resolve) => {
      if (hasChromeStorage) {
        chrome.storage.local.set({ [key]: value }, () => resolve());
        return;
      }

      try {
        window.localStorage.setItem(key, value);
      } catch {
        // ignore
      }
      resolve();
    }),

  removeItem: (key: string): Promise<void> =>
    new Promise((resolve) => {
      if (hasChromeStorage) {
        chrome.storage.local.remove(key, () => resolve());
        return;
      }

      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
      resolve();
    }),
};

# LinkHub — Chrome Extension (Tab mới = Trang Dấu trang)

Khi **mở tab mới**, Chrome hiển thị trang quản lý bookmark (LinkHub) thay vì trang New Tab mặc định. Giao diện React + Tailwind, đồng bộ qua Supabase.

## Tech stack

- **Chrome Extension**: Manifest V3  
- **Build**: Vite + @crxjs/vite-plugin  
- **Frontend**: React (hooks), React Router, Tailwind CSS  
- **Backend**: Supabase (auth + DB), session trong `chrome.storage.local`  

## Cấu trúc

```
src/
├── newtab/           # Tab mới → Full app (Login, Dashboard, Boards, Bookmarks)
│   ├── index.html
│   ├── main.tsx
│   └── NewTabApp.tsx
├── popup/            # Popup nhỏ: "Mở trang Dấu trang", "Thêm trang này"
├── options/          # Cài đặt (theme, import/export)
├── background/       # Service worker (context menu "Add to LinkHub")
├── lib/              # supabaseClient, chromeStorageAdapter, constants
├── hooks/            # useAuth, useBookmarks
├── components/       # BookmarkItem, ...
└── pages/            # Login, Register, Dashboard
```

## Chạy & load extension

1. `npm install`
2. Tạo `.env` từ `.env.example`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`
3. `npm run dev`
4. Chrome → `chrome://extensions` → Load unpacked → chọn thư mục **`dist`**

**Lưu ý:** Load thư mục **dist**, không load thư mục gốc project.

## Luồng chính

- **Mở tab mới (Ctrl+T / Cmd+T)** → Hiển thị LinkHub (đăng nhập → Dashboard, boards, categories, bookmarks).
- **Click icon extension** → Popup: mở trang dấu trang hoặc thêm trang hiện tại.
- **Chuột phải trang** → "Add to LinkHub" → Mở tab mới với form thêm bookmark (url/title điền sẵn).

Tính năng chi tiết (boards, categories, tìm kiếm, cài đặt, i18n) mở rộng theo file plan Markdown.

## Deploy bản Web lên Vercel

Bạn có thể chạy cùng giao diện (Login, Dashboard, Landing) dưới dạng **web app** và deploy lên [Vercel](https://vercel.com).  

📄 **Hướng dẫn từng bước:** xem **[DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)**.

**Tóm tắt nhanh:**

1. **Build bản web** (output trong `dist-web`):
   ```bash
   npm run build:web
   ```

2. **Deploy lên Vercel**
   - Đẩy code lên GitHub → [vercel.com](https://vercel.com) → **Add New Project** → import repo.
   - Vercel đọc sẵn `vercel.json` (Build: `npm run build:web`, Output: `dist-web`).
   - Thêm **Environment Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (giống `.env` local).

3. **Chạy thử local** trước khi deploy:
   ```bash
   npm run preview:web
   ```
   Mở http://localhost:4173.

**Lưu ý:** Bản web không có popup extension hay context menu "Add to LinkHub"; đăng nhập và dữ liệu bookmark dùng chung Supabase với extension.

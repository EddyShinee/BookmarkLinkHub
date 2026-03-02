# Hướng dẫn Deploy LinkHub lên Vercel

Cùng một source code có thể chạy vừa **Chrome extension** vừa **web app** trên Vercel. Bản web dùng chung Supabase với extension (cùng đăng nhập, cùng dữ liệu bookmark).

---

## Bước 1: Chuẩn bị code trên GitHub

1. **Tạo repo GitHub** (nếu chưa có):
   - Vào [github.com](https://github.com) → **New repository** → đặt tên (vd: `linkhub`).
   - Không tick "Add a README" nếu bạn đã có code local.

2. **Đẩy code lên GitHub** từ máy local:
   ```bash
   cd /path/to/LinkHub
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```
   (Thay `<username>` và `<repo>` bằng tên GitHub và tên repo của bạn.)

3. **Đảm bảo có file `.env.example`** (không cần đẩy `.env`):
   - Trong repo nên có `.env.example` với nội dung:
     ```
     VITE_SUPABASE_URL=https://xxx.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJ...
     ```
   - File `.env` thật nên nằm trong `.gitignore` (không lên GitHub).

---

## Bước 2: Tạo project trên Vercel

1. Vào **[vercel.com](https://vercel.com)** và đăng nhập (nên dùng **Continue with GitHub**).

2. Click **Add New…** → **Project**.

3. **Import Git Repository**:
   - Chọn repo **LinkHub** (hoặc tên repo bạn đã tạo).
   - Click **Import**.

4. **Configure Project** (trang cấu hình):
   - **Framework Preset:** để **Other** (hoặc Vite nếu có).
   - **Build Command:** `npm run build:web`  
     (Nếu Vercel đã đọc `vercel.json` thì có thể đã điền sẵn.)
   - **Output Directory:** `dist-web`  
     (Cũng có thể đã điền sẵn từ `vercel.json`.)
   - **Root Directory:** để trống (`.`).

5. **Environment Variables** (biến môi trường):
   - Click **Environment Variables**.
   - Thêm 2 biến (dùng giá trị giống file `.env` local):

   | Name                   | Value                    | Môi trường   |
   |------------------------|--------------------------|--------------|
   | `VITE_SUPABASE_URL`    | `https://xxx.supabase.co`| Production, Preview, Development |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon key)   | Production, Preview, Development |

   - Sau đó click **Deploy**.

---

## Bước 3: Chờ build và kiểm tra

1. Vercel sẽ chạy **Build Command** và tạo **Output** từ thư mục `dist-web`.
2. Khi build **thành công**, bạn sẽ thấy link dạng:
   - `https://linkhub-xxx.vercel.app` (hoặc tên project bạn đặt).
3. Mở link → vào trang Login → đăng nhập bằng tài khoản Supabase (cùng với extension) → dùng thử Dashboard / Landing.

---

## Bước 4: (Tùy chọn) Đổi tên domain / custom domain

- Trong project Vercel: **Settings** → **Domains** → thêm domain tùy chỉnh hoặc đổi subdomain `.vercel.app`.
- **Settings** → **Environment Variables**: có thể chỉnh lại biến cho từng môi trường (Production / Preview / Development) nếu cần.

---

## Lưu ý

- **Mỗi lần push code** lên nhánh đã kết nối (vd: `main`), Vercel sẽ **tự build và deploy** lại.
- **Preview deployments**: mỗi pull request sẽ có một URL preview riêng.
- Bản web **không có** popup extension hay "Add to LinkHub" từ context menu; mọi thao tác qua giao diện web. Dữ liệu và đăng nhập **dùng chung** Supabase với extension.

---

## Kiểm tra build local trước khi deploy

Để chắc chắn build web chạy đúng:

```bash
npm install
npm run build:web
npm run preview:web
```

Mở http://localhost:4173, đăng nhập và thử các chức năng. Nếu ổn thì deploy lên Vercel sẽ giống môi trường này.

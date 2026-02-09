# Hướng dẫn đăng LinkHub lên Chrome Web Store

## Chuẩn bị

### 1. Tài khoản nhà phát triển

- Vào **[Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)**.
- Đăng nhập bằng tài khoản Google.
- Đóng **lệ phí một lần** (khoảng **$5 USD**) để mở tài khoản nhà phát triển.
- Chọn email dùng cho tài khoản (sau này **không đổi được**).

### 2. Icon (khuyến nghị)

Chrome Web Store yêu cầu ít nhất **icon 128×128 px**. Hiện tại project dùng icon placeholder.

- Thay icon thật trong thư mục **`public/icons/`**:
  - `16.png` (16×16)
  - `48.png` (48×48)
  - `128.png` (128×128) — **bắt buộc**
- Có thể dùng một ảnh 128×128 rồi resize cho 16 và 48, hoặc dùng [favicon.io](https://favicon.io/), [realfavicongenerator.net](https://realfavicongenerator.net/).

### 3. Build và đóng gói ZIP

Trong thư mục project chạy:

```bash
npm run pack
```

Lệnh này sẽ:

1. Chạy `npm run build` (tạo bản production, CSP không còn localhost).
2. Đóng gói thư mục `dist/` thành file **`linkhub-chrome-store.zip`** ở thư mục gốc.

**Lưu ý:** File ZIP phải có **manifest.json ở thư mục gốc** (đã đúng với cách đóng gói hiện tại). Kích thước tối đa: **2GB**.

---

## Đăng extension lên Store

### Bước 1: Upload

1. Mở [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Chọn **“Add new item”** (Thêm mục mới).
3. Chọn **“Choose file”** → chọn **`linkhub-chrome-store.zip`** → **Upload**.
4. Nếu manifest và ZIP hợp lệ, bạn sẽ vào trang chỉnh sửa item.

### Bước 2: Điền thông tin

Trong menu bên trái, điền lần lượt:

| Tab | Nội dung |
|-----|----------|
| **Package** | Thông tin từ file ZIP (xem, không sửa). |
| **Store listing** | Tên, mô tả ngắn, mô tả chi tiết, ảnh (128×128, 440×280, 920×680…), thể loại, ngôn ngữ. |
| **Privacy** | Mục đích extension, cách xử lý dữ liệu (ví dụ: đăng nhập Supabase, lưu bookmark). |
| **Distribution** | Miễn phí/trả phí, quốc gia, đối tượng (công khai / unlisted / private). |
| **Test instructions** | (Tùy chọn) Hướng dẫn cho reviewer test extension, nếu cần. |

### Bước 3: Gửi duyệt

- Chọn **“Submit for Review”**.
- Trong hộp thoại có thể chọn:
  - **Tự động publish** sau khi duyệt xong, hoặc
  - **Defer publish** để bạn tự bấm publish sau (trong vòng 30 ngày).

Sau khi gửi, extension sẽ được đội ngũ Chrome Web Store duyệt. Thời gian tùy từng đợt, thường vài ngày.

---

## Cập nhật phiên bản sau này

1. Tăng **version** trong **`package.json`** (ví dụ `0.1.0` → `0.1.1`).
2. Chạy lại **`npm run pack`**.
3. Vào Chrome Developer Dashboard → chọn item LinkHub → **“Upload new package”** → chọn file **`linkhub-chrome-store.zip`** mới.
4. Điền ghi chú thay đổi (Release notes) rồi **Submit for Review** (hoặc Update) như lần đầu.

---

## Tài liệu chính thức

- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)
- [Register developer account](https://developer.chrome.com/docs/webstore/register)

---
name: Authenticator TOTP Feature
overview: "Thêm tính năng Authenticator (TOTP 2FA) vào extension: truy cập từ popup và modal trên New Tab, quét QR bằng upload ảnh hoặc capture màn hình (có chọn vùng), lưu và đồng bộ qua Supabase."
todos: []
isProject: false
---

## **1. Luồng truy cập**

- **Popup:** Thêm nút "Authenticator" / "Mã 2FA" → mở New Tab với query ?open=authenticator (giống "Mở trang Dấu trang").

- **New Tab (Dashboard):** Thêm mục menu cố định "Authenticator" trên sidebar (cùng khu vực IT Tool box) → mở modal Authenticator. Khi load Dashboard mà URL có ?open=authenticator thì tự mở modal này.

open new tab ?open=authenticatormenu Authenticator or queryPopupNew TabDashboardAuthenticator ModalDanh sách mã TOTPThêm tài khoảnUpload ảnh hoặc Capture màn hìnhNhập thủ công

## **2. Cơ sở dữ liệu (Supabase)**

- **Bảng mới:** authenticator_entries

- id uuid PK, user_id uuid FK → [profiles.id](http://profiles.id)

- issuer text (vd: "Google"), account_name text (vd: "[user@gmail.com](mailto:user@gmail.com)")

- secret text (secret TOTP base32, chỉ lưu với RLS)

- sort_order int, created_at, updated_at

- **RLS:** Bật RLS; policy cho phép SELECT/INSERT/UPDATE/DELETE chỉ khi auth.uid() = user_id (đồng bộ đa thiết bị cho cùng user).

Tạo bảng và RLS qua migration (DDL) trong Supabase.

## **3. Thư viện cần thêm**

- **jsQR:** Giải mã QR từ ảnh (canvas/ImageData). Dùng cho: ảnh upload và ảnh từ capture màn hình (sau khi user chọn vùng).

- **TOTP:** Dùng **otplib** (hoặc package nhỏ tương đương) để sinh mã 6 số từ secret (base32, bước 30s). Có sẵn trong npm.

Cài: jsQR, otplib (và @types/jsQR nếu cần).

## **4. UI: Modal Authenticator**

- **Vị trí component:** src/components/AuthenticatorModal.tsx (hoặc thư mục AuthenticatorModal/ nếu tách nhiều file). Props: open, onClose.

- **Nội dung chính:**

- **Danh sách entry:** Mỗi dòng: icon/issuer, tên tài khoản, **mã 6 số** (TOTP hiện tại), đồng hồ đếm ngược ~30s, nút Copy. Kéo thứ tự (tùy chọn).

- **Nút "Thêm tài khoản":** Mở bước chọn cách thêm:

- **Quét QR:** Chọn "Upload ảnh" hoặc "Chụp màn hình".

- **Upload ảnh:** <input type="file" accept="image/*"> → vẽ ảnh lên canvas → (tùy chọn) cho phép user **chọn vùng** (kéo chuột vẽ hình chữ nhật) → crop vùng đó → đưa vào jsQR → parse otpauth://totp/...?secret=... lấy secret, issuer, account.

- **Chụp màn hình:** Gọi chrome.tabs.captureVisibleTab() (cần tab đang active khi user bấm; extension đã có activeTab) → nhận dataUrl ảnh → hiển thị ảnh, cùng flow "chọn vùng" + jsQR như trên.

- **Nhập thủ công:** Form nhập Issuer, Tên tài khoản, Secret (base32) → lưu vào Supabase.

- Sau khi thêm (từ QR hoặc thủ công): INSERT vào authenticator_entries, đóng bước thêm, refresh list.

- **Bảo mật hiển thị:** Có thể ẩn secret trong UI (chỉ hiện mã 6 số và copy), không log secret ra console.

## **5. Logic nghiệp vụ**

- **Parse otpauth URL:** Từ QR payload (dạng otpauth://totp/Issuer:account?secret=XXX&issuer=...) trích secret, issuer, account (label) để tạo bản ghi.

- **Tạo mã TOTP:** Dùng otplib (hoặc tương đương) với secret đã lưu, bước 30s; hiển thị mã và đếm ngược 30s rồi refresh.

- **Sync:** Đọc danh sách từ Supabase theo user_id (đã đăng nhập); thêm/sửa/xóa đều gọi Supabase → tự đồng bộ thiết bị khác khi cùng user.

## **6. Tích hợp Dashboard và Popup**

- **Dashboard 1:**

- State: authenticatorModalOpen, set true khi click menu "Authenticator" hoặc khi useEffect đọc [location.search](http://location.search) thấy open=authenticator.

- Render <AuthenticatorModal open={...} onClose={...} /> (dùng cùng pattern với ITToolboxModal).

- Sidebar: Thêm nút/mục "Authenticator" (icon khóa hoặc shield) phía trên hoặc dưới IT Tool box.

- **NewTabApp / route:** Khi vào route "/" với query ?open=authenticator, Dashboard mount xong thì set authenticatorModalOpen = true (truyền qua state hoặc search params khi render Dashboard).

- **Popup 2:** Thêm nút thứ 3 (vd: "Authenticator" / "Mã 2FA") gọi chrome.tabs.create({ url: newtabUrl + '?open=authenticator' }).

## **7. Quyền extension**

- **Hiện tại:** activeTab, storage, contextMenus; host_permissions Supabase.

- **Capture màn hình:** chrome.tabs.captureVisibleTab() thường dùng được với activeTab khi user đang ở tab nội dung và tương tác với extension. Nếu manifest yêu cầu thêm permission cho captureVisibleTab (tùy phiên bản), thêm trong manifest.config.ts (vd: "activeTab" đủ cho capture tab hiện tại khi user trigger từ extension).

## **8. Các file cần tạo/sửa (tóm tắt)**


| Hạng mục           | File / Hành động                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Migration Supabase | Tạo bảng authenticator_entries + RLS                                                                              |
| Dependency         | package.json: thêm jsQR, otplib                                                                                   |
| Component          | src/components/AuthenticatorModal.tsx (hoặc thư mục)                                                              |
| Hook (optional)    | src/hooks/useAuthenticatorEntries.ts – fetch/CRUD Supabase                                                        |
| Dashboard          | Dashboard.tsx: state modal, menu item, đọc query open=authenticator, render modal                                 |
| Popup              | PopupApp.tsx: nút mở New Tab với ?open=authenticator                                                              |
| i18n               | src/lib/i18n.ts: thêm chuỗi Authenticator / Thêm tài khoản / Upload ảnh / Chụp màn hình / Nhập thủ công (vi + en) |


## **9. Trải nghiệm "chọn vùng"**

- Sau khi có ảnh (từ file hoặc captureVisibleTab): hiển thị ảnh trong một khung (có thể scale để vừa khung).

- User kéo chuột vẽ một hình chữ nhật trên ảnh (drag to select). Khi thả chuột: crop vùng đó ra ImageData/canvas rồi gọi jsQR. Nếu không chọn vùng thì dùng toàn bộ ảnh để decode.

- Nếu jsQR không đọc được (sai vùng hoặc không phải QR): hiển thị thông báo "Không tìm thấy mã QR, vui lòng chọn lại vùng hoặc thử ảnh khác".

## **10. Thứ tự thực hiện gợi ý**

1. Migration Supabase + cài jsQR, otplib.

1. Hook/API đọc danh sách + thêm/xóa entry (Supabase).

1. AuthenticatorModal: list TOTP + countdown + copy, nút Thêm tài khoản.

1. Flow Thêm: upload ảnh + chọn vùng + jsQR + parse otpauth; captureVisibleTab + chọn vùng + jsQR; nhập thủ công.

1. Tích hợp Dashboard (menu + query) và Popup (nút mở tab).

1. i18n và chỉnh style cho đồng bộ với IT Tool box / theme hiện tại.


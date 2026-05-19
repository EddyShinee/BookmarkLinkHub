import { useSettings } from '../contexts/SettingsContext';
import PublicPageLayout from '../components/PublicPageLayout';

export default function PrivacyPolicy() {
  const settings = useSettings();
  const isEnglish = settings.locale === 'en';

  return (
    <PublicPageLayout
      title={isEnglish ? 'Privacy Policy' : 'Chính sách quyền riêng tư'}
      subtitle={isEnglish ? 'Last updated: May 19, 2026' : 'Cập nhật lần cuối: 19/05/2026'}
    >
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '1. Information We Collect' : '1. Thông tin chúng tôi thu thập'}
        </h2>
        {isEnglish ? (
          <p>
            LinkHub stores the data you create in the app, such as Boards, Categories, Bookmarks,
            and Authenticator information (issuer, account name, secret). This data is stored in
            LinkHub&apos;s Supabase database to sync across devices.
          </p>
        ) : (
          <p>
            LinkHub lưu trữ dữ liệu bạn tạo trong ứng dụng như Board, Category, Bookmark và
            thông tin Authenticator (issuer, account name, secret). Dữ liệu này được lưu trong
            cơ sở dữ liệu Supabase của LinkHub để đồng bộ giữa thiết bị.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '2. Local Browser Data' : '2. Dữ liệu cục bộ trên trình duyệt'}
        </h2>
        {isEnglish ? (
          <p>
            UI preferences (theme, language, column count, open-link behavior, etc.) are saved in
            <code className="px-1 rounded bg-black/20">chrome.storage.local</code> to keep your
            settings even after you close the browser.
          </p>
        ) : (
          <p>
            Các tuỳ chỉnh giao diện (theme, ngôn ngữ, số cột, tuỳ chọn mở link...) được lưu
            trong <code className="px-1 rounded bg-black/20">chrome.storage.local</code> để
            giữ cấu hình ngay cả khi bạn đóng trình duyệt.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '3. Extension Permissions' : '3. Quyền extension'}
        </h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>
            <strong>storage</strong>: {isEnglish ? 'store settings and user state.' : 'lưu cấu hình và trạng thái người dùng.'}
          </li>
          <li>
            <strong>tabs / activeTab / windows</strong>: {isEnglish ? 'open the app and read the active tab when adding a bookmark.' : 'mở trang quản lý và lấy thông tin tab hiện tại khi thêm bookmark.'}
          </li>
          <li>
            <strong>contextMenus</strong>: {isEnglish ? 'add the “Add to LinkHub” menu.' : 'thêm menu “Add to LinkHub”.'}
          </li>
          <li>
            <strong>videoCapture / desktopCapture</strong>: {isEnglish ? 'used for QR scanning and screen capture in Authenticator.' : 'dùng cho tính năng quét QR và chụp màn hình khi thêm Authenticator.'}
          </li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '4. Data Sharing' : '4. Chia sẻ dữ liệu'}
        </h2>
        {isEnglish ? (
          <p>
            We do not sell or share personal data with third parties. Data is used only to
            provide synchronization and features within LinkHub.
          </p>
        ) : (
          <p>
            Chúng tôi không bán hoặc chia sẻ dữ liệu cá nhân cho bên thứ ba. Dữ liệu chỉ được
            sử dụng để cung cấp chức năng đồng bộ và hiển thị trong LinkHub.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '5. Contact' : '5. Liên hệ'}
        </h2>
        {isEnglish ? (
          <p>
            If you have privacy questions, please visit the Support page to submit a request.
          </p>
        ) : (
          <p>
            Nếu bạn có câu hỏi về quyền riêng tư, vui lòng vào trang Support để gửi yêu cầu hỗ trợ.
          </p>
        )}
      </section>
    </PublicPageLayout>
  );
}

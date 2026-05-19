import PublicPageLayout from '../components/PublicPageLayout';

export default function PrivacyPolicy() {
  return (
    <PublicPageLayout
      title="Privacy Policy"
      subtitle="Last updated: May 19, 2026"
    >
      <section>
        <h2 className="text-base font-semibold text-white/90">1. Thông tin chúng tôi thu thập</h2>
        <p>
          LinkHub lưu trữ dữ liệu bạn tạo trong ứng dụng như Board, Category, Bookmark và
          thông tin Authenticator (issuer, account name, secret). Dữ liệu này được lưu trong
          cơ sở dữ liệu Supabase của LinkHub để đồng bộ giữa thiết bị.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">2. Dữ liệu cục bộ trên trình duyệt</h2>
        <p>
          Các tuỳ chỉnh giao diện (theme, ngôn ngữ, số cột, tuỳ chọn mở link...) được lưu
          trong <code className="px-1 rounded bg-black/20">chrome.storage.local</code> để
          giữ cấu hình ngay cả khi bạn đóng trình duyệt.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">3. Quyền extension</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li><strong>storage</strong>: lưu cấu hình và trạng thái người dùng.</li>
          <li><strong>tabs / activeTab / windows</strong>: mở trang quản lý và lấy thông tin tab hiện tại khi thêm bookmark.</li>
          <li><strong>contextMenus</strong>: thêm menu “Add to LinkHub”.</li>
          <li><strong>videoCapture / desktopCapture</strong>: dùng cho tính năng quét QR và chụp màn hình khi thêm Authenticator.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">4. Chia sẻ dữ liệu</h2>
        <p>
          Chúng tôi không bán hoặc chia sẻ dữ liệu cá nhân cho bên thứ ba. Dữ liệu chỉ được
          sử dụng để cung cấp chức năng đồng bộ và hiển thị trong LinkHub.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">5. Liên hệ</h2>
        <p>
          Nếu bạn có câu hỏi về quyền riêng tư, vui lòng vào trang Support để gửi yêu cầu hỗ trợ.
        </p>
      </section>
    </PublicPageLayout>
  );
}

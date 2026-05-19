import PublicPageLayout from '../components/PublicPageLayout';

export default function Support() {
  return (
    <PublicPageLayout
      title="Support"
      subtitle="Need help with LinkHub? We’re here to assist."
    >
      <section>
        <h2 className="text-base font-semibold text-white/90">1. Hỗ trợ kỹ thuật</h2>
        <p>
          Nếu bạn gặp lỗi khi đồng bộ, không mở được trang, hoặc cần trợ giúp khi thêm
          Authenticator, hãy gửi yêu cầu hỗ trợ qua GitHub Issues.
        </p>
        <p className="mt-2">
          <a
            className="text-[#256af4] hover:underline"
            href="https://github.com/EddyShinee/BookmarkLinkHub/issues"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/EddyShinee/BookmarkLinkHub/issues
          </a>
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">2. Góp ý & tính năng mới</h2>
        <p>
          Bạn có thể tạo issue mới để đề xuất tính năng, hoặc gửi phản hồi để cải thiện
          giao diện và trải nghiệm sử dụng.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">3. Liên kết cần thiết</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>
            <a className="text-[#256af4] hover:underline" href="#/privacy">
              Privacy Policy
            </a>
          </li>
          <li>
            <a className="text-[#256af4] hover:underline" href="#/terms">
              Terms of Service
            </a>
          </li>
        </ul>
      </section>
    </PublicPageLayout>
  );
}

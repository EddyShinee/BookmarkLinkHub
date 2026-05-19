import { useSettings } from '../contexts/SettingsContext';
import PublicPageLayout from '../components/PublicPageLayout';

export default function Support() {
  const settings = useSettings();
  const isEnglish = settings.locale === 'en';

  return (
    <PublicPageLayout
      title={isEnglish ? 'Support' : 'Hỗ trợ'}
      subtitle={isEnglish ? 'Need help with LinkHub? We’re here to assist.' : 'Bạn cần hỗ trợ? Chúng tôi luôn sẵn sàng.'}
    >
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '1. Technical Support' : '1. Hỗ trợ kỹ thuật'}
        </h2>
        {isEnglish ? (
          <p>
            If you have sync issues, cannot open pages, or need help with Authenticator,
            please submit a request via GitHub Issues.
          </p>
        ) : (
          <p>
            Nếu bạn gặp lỗi khi đồng bộ, không mở được trang, hoặc cần trợ giúp khi thêm
            Authenticator, hãy gửi yêu cầu hỗ trợ qua GitHub Issues.
          </p>
        )}
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
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '2. Feedback & Feature Requests' : '2. Góp ý & tính năng mới'}
        </h2>
        {isEnglish ? (
          <p>
            You can open a new issue to request features or share feedback to improve
            the product and user experience.
          </p>
        ) : (
          <p>
            Bạn có thể tạo issue mới để đề xuất tính năng, hoặc gửi phản hồi để cải thiện
            giao diện và trải nghiệm sử dụng.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '3. Useful Links' : '3. Liên kết cần thiết'}
        </h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>
            <a className="text-[#256af4] hover:underline" href="#/privacy">
              {isEnglish ? 'Privacy Policy' : 'Chính sách quyền riêng tư'}
            </a>
          </li>
          <li>
            <a className="text-[#256af4] hover:underline" href="#/terms">
              {isEnglish ? 'Terms of Service' : 'Điều khoản sử dụng'}
            </a>
          </li>
        </ul>
      </section>
    </PublicPageLayout>
  );
}

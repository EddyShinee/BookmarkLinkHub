import { useSettings } from '../contexts/SettingsContext';
import PublicPageLayout from '../components/PublicPageLayout';

export default function TermsOfService() {
  const settings = useSettings();
  const isEnglish = settings.locale === 'en';

  return (
    <PublicPageLayout
      title={isEnglish ? 'Terms of Service' : 'Điều khoản sử dụng'}
      subtitle={isEnglish ? 'Last updated: May 19, 2026' : 'Cập nhật lần cuối: 19/05/2026'}
    >
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '1. Acceptance of Terms' : '1. Chấp nhận điều khoản'}
        </h2>
        {isEnglish ? (
          <p>
            By using LinkHub, you agree to these terms. If you do not agree, please stop
            using the application.
          </p>
        ) : (
          <p>
            Bằng cách sử dụng LinkHub, bạn đồng ý với các điều khoản này. Nếu không đồng ý,
            vui lòng ngừng sử dụng ứng dụng.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '2. Account & Security' : '2. Tài khoản & bảo mật'}
        </h2>
        {isEnglish ? (
          <p>
            You are responsible for securing your account and Authenticator data.
            Do not share secrets or verification codes with others.
          </p>
        ) : (
          <p>
            Bạn chịu trách nhiệm bảo mật tài khoản và dữ liệu Authenticator của mình.
            Không chia sẻ secret hoặc mã xác thực với người khác.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '3. Acceptable Use' : '3. Sử dụng hợp lệ'}
        </h2>
        {isEnglish ? (
          <p>
            You must not use LinkHub for unlawful purposes or in ways that harm others.
          </p>
        ) : (
          <p>
            Bạn không được sử dụng LinkHub cho mục đích vi phạm pháp luật hoặc gây ảnh hưởng
            tới hệ thống của người khác.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '4. Limitation of Liability' : '4. Giới hạn trách nhiệm'}
        </h2>
        {isEnglish ? (
          <p>
            LinkHub is provided as-is. We are not responsible for data loss caused by device
            failures, network issues, or third-party actions.
          </p>
        ) : (
          <p>
            LinkHub cung cấp dịch vụ theo hiện trạng. Chúng tôi không chịu trách nhiệm về
            mất dữ liệu do lỗi thiết bị, lỗi mạng hoặc hành vi của bên thứ ba.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">
          {isEnglish ? '5. Changes to Terms' : '5. Thay đổi điều khoản'}
        </h2>
        {isEnglish ? (
          <p>
            These terms may be updated over time. The latest version will always be
            available on this page.
          </p>
        ) : (
          <p>
            Điều khoản có thể được cập nhật theo thời gian. Phiên bản mới nhất luôn được
            công bố tại trang này.
          </p>
        )}
      </section>
    </PublicPageLayout>
  );
}

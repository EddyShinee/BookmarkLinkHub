import PublicPageLayout from '../components/PublicPageLayout';

export default function TermsOfService() {
  return (
    <PublicPageLayout
      title="Terms of Service"
      subtitle="Last updated: May 19, 2026"
    >
      <section>
        <h2 className="text-base font-semibold text-white/90">1. Chấp nhận điều khoản</h2>
        <p>
          Bằng cách sử dụng LinkHub, bạn đồng ý với các điều khoản này. Nếu không đồng ý,
          vui lòng ngừng sử dụng ứng dụng.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">2. Tài khoản & bảo mật</h2>
        <p>
          Bạn chịu trách nhiệm bảo mật tài khoản và dữ liệu Authenticator của mình.
          Không chia sẻ secret hoặc mã xác thực với người khác.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">3. Sử dụng hợp lệ</h2>
        <p>
          Bạn không được sử dụng LinkHub cho mục đích vi phạm pháp luật hoặc gây ảnh hưởng
          tới hệ thống của người khác.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">4. Giới hạn trách nhiệm</h2>
        <p>
          LinkHub cung cấp dịch vụ theo hiện trạng. Chúng tôi không chịu trách nhiệm về
          mất dữ liệu do lỗi thiết bị, lỗi mạng hoặc hành vi của bên thứ ba.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-white/90">5. Thay đổi điều khoản</h2>
        <p>
          Điều khoản có thể được cập nhật theo thời gian. Phiên bản mới nhất luôn được
          công bố tại trang này.
        </p>
      </section>
    </PublicPageLayout>
  );
}

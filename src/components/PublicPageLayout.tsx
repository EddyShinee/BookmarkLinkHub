import { type ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

interface PublicPageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function PublicPageLayout({ title, subtitle, children }: PublicPageLayoutProps) {
  const settings = useSettings();
  const isLight = settings.theme === 'light';
  const isEnglish = settings.locale === 'en';
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const lang = params.get('lang');
    if (lang === 'en' || lang === 'vi') {
      settings.setLocale(lang);
    }
  }, [location.search, settings]);

  const navLinkClass = isLight
    ? 'text-slate-600 hover:text-slate-900'
    : 'text-[#9fb3d9] hover:text-white';

  const navLabels = isEnglish
    ? {
        privacy: 'Privacy',
        terms: 'Terms',
        support: 'Support',
        openApp: 'Open App',
        tagline: 'Bookmark Manager Extension',
      }
    : {
        privacy: 'Chính sách',
        terms: 'Điều khoản',
        support: 'Hỗ trợ',
        openApp: 'Mở ứng dụng',
        tagline: 'Trình quản lý bookmark',
      };

  return (
    <div
      className={`min-h-screen font-display ${
        isLight ? 'bg-white text-slate-900' : 'bg-[#0f172a] text-white'
      }`}
    >
      <header
        className={`sticky top-0 z-10 border-b backdrop-blur ${
          isLight ? 'border-slate-200 bg-white/90' : 'border-white/10 bg-[#0f172a]/90'
        }`}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#256af4] rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <span className="material-symbols-outlined text-white text-[18px]">hub</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">LinkHub</span>
              <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#90a4cb]'}`}>
                {navLabels.tagline}
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-[12px] font-medium">
            <Link to="/privacy" className={navLinkClass}>{navLabels.privacy}</Link>
            <Link to="/terms" className={navLinkClass}>{navLabels.terms}</Link>
            <Link to="/support" className={navLinkClass}>{navLabels.support}</Link>
            <div className="flex items-center gap-1 rounded-lg border px-1 py-0.5">
              <button
                type="button"
                onClick={() => settings.setLocale('en')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  isEnglish
                    ? 'bg-[#256af4] text-white'
                    : isLight
                      ? 'text-slate-500 hover:bg-slate-100'
                      : 'text-[#9fb3d9] hover:bg-white/10'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => settings.setLocale('vi')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  !isEnglish
                    ? 'bg-[#256af4] text-white'
                    : isLight
                      ? 'text-slate-500 hover:bg-slate-100'
                      : 'text-[#9fb3d9] hover:bg-white/10'
                }`}
              >
                VI
              </button>
            </div>
            <Link
              to="/login"
              className={`px-3 py-1.5 rounded-lg border transition ${
                isLight
                  ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  : 'border-white/10 text-[#9fb3d9] hover:bg-white/10 hover:text-white'
              }`}
            >
              {navLabels.openApp}
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-[#90a4cb]'}`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`space-y-6 text-sm leading-relaxed ${isLight ? 'text-slate-700' : 'text-[#cbd5f5]'}`}>
          {children}
        </div>
      </main>

      <footer className={`border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
        <div className="max-w-4xl mx-auto px-6 py-6 text-[11px]">
          <p className={isLight ? 'text-slate-500' : 'text-[#90a4cb]'}>
            © {new Date().getFullYear()} LinkHub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

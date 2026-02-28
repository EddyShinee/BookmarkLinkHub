import { Link } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';

export default function EmailConfirmed() {
  const { locale } = useSettings();
  const t = getT(locale);

  return (
    <div className="fixed inset-0 overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-primary-500/10 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/10 border border-white/10 backdrop-blur-2xl shadow-[0_24px_80px_rgba(15,23,42,0.85)] p-6 sm:p-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
            LinkHub
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-50 mb-2">
          {t.emailConfirmedTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mb-6">
          {t.emailConfirmedSubtitle}
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-400 text-white text-sm font-semibold shadow-[0_18px_45px_rgba(37,99,235,0.55)] transition"
        >
          {t.emailConfirmedButton}
        </Link>
      </div>
    </div>
  );
}


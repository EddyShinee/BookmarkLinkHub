import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';

export default function Register() {
  const { locale, setLocale } = useSettings();
  const t = getT(locale);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
   const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/#/email-confirmed`,
        },
      });
      if (error) throw error;
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.registerErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/10 border border-white/10 backdrop-blur-2xl shadow-[0_24px_80px_rgba(15,23,42,0.85)] p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-400 shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-200">LinkHub</span>
            </div>
          </div>
          <div className="inline-flex items-center rounded-full bg-slate-900/60 border border-white/10 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setLocale('vi')}
              className={`px-2.5 py-1 rounded-full font-medium transition ${
                locale === 'vi'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-2.5 py-1 rounded-full font-medium transition ${
                locale === 'en'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-semibold text-gray-50 mb-1">
          {t.registerTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mb-6">
          {t.registerSubtitle}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder={t.loginEmailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full py-2 px-3.5 rounded-lg text-sm border border-white/10 bg-slate-900/40 text-gray-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/70 focus:border-transparent"
          />
          <input
            type="password"
            placeholder={t.loginPasswordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full py-2 px-3.5 rounded-lg text-sm border border-white/10 bg-slate-900/40 text-gray-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/70 focus:border-transparent"
          />
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-md px-2 py-1">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg text-sm bg-primary-500 hover:bg-primary-400 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_18px_45px_rgba(37,99,235,0.55)] transition"
          >
            {loading ? t.registerLoading : t.registerButton}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] sm:text-xs text-slate-300">
          {t.haveAccountQuestion}{' '}
          <Link to="/login" className="font-semibold text-primary-300 hover:text-primary-200 hover:underline">
            {t.loginLinkText}
          </Link>
        </p>
      </div>

      {success && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/10 shadow-[0_24px_80px_rgba(15,23,42,0.9)] p-6 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
              <span className="material-symbols-outlined text-emerald-400 text-2xl">check_circle</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-50 mb-2">
              {t.registerSuccessTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mb-6">
              {t.registerSuccessBody}
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-400 text-white text-sm font-semibold shadow-[0_18px_45px_rgba(37,99,235,0.55)] transition"
            >
              {t.registerSuccessButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

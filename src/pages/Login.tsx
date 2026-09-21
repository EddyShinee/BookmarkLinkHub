import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';
import {
  detectBiometricPlatform,
  isBiometricAvailable,
  listBiometricCredentials,
  unlockWithBiometrics,
  type BiometricCredentialInfo,
} from '../lib/biometricAuth';
import {
  biometricErrorMessage,
  biometricMethodIcon,
  biometricMethodLabel,
  withMethod,
} from '../lib/biometricMessages';

export default function Login() {
  const { locale, setLocale, startOnLanding } = useSettings();
  const t = getT(locale);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [biometricCreds, setBiometricCreds] = useState<BiometricCredentialInfo[]>([]);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const navigate = useNavigate();

  const platform = detectBiometricPlatform();
  const methodLabel = biometricMethodLabel(locale, platform);

  useEffect(() => {
    let active = true;
    (async () => {
      const [available, creds] = await Promise.all([
        isBiometricAvailable(),
        listBiometricCredentials(),
      ]);
      if (!active) return;
      setBiometricCreds(available ? creds : []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate(startOnLanding ? '/landing' : '/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loginErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError(null);
    setBiometricLoading(true);
    try {
      const secret = await unlockWithBiometrics();
      const { error } = await supabase.auth.signInWithPassword({
        email: secret.email,
        password: secret.password,
      });
      if (error) {
        setError(t.biometricPasswordOutdated);
        return;
      }
      navigate(startOnLanding ? '/landing' : '/', { replace: true });
    } catch (e) {
      setError(biometricErrorMessage(locale, e));
    } finally {
      setBiometricLoading(false);
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
          {t.loginTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mb-6">
          {t.loginSubtitle}
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
            {loading ? t.loginLoading : t.loginButton}
          </button>
        </form>

        {biometricCreds.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                {t.searchOr}
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading || loading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm border border-white/15 bg-white/5 text-gray-50 font-medium hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <span className="material-symbols-outlined text-[18px] text-primary-300">
                {biometricMethodIcon(platform)}
              </span>
              {biometricLoading
                ? withMethod(t.biometricLoginLoading, methodLabel)
                : withMethod(t.biometricLoginButton, methodLabel)}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {biometricCreds.map((c) => c.email).join(', ')}
            </p>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] sm:text-xs text-slate-300">
          {t.noAccountQuestion}{' '}
          <Link to="/register" className="font-semibold text-primary-300 hover:text-primary-200 hover:underline">
            {t.registerLinkText}
          </Link>
        </p>
      </div>
    </div>
  );
}

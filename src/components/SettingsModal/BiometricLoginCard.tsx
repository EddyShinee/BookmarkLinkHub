/** Quản lý đăng nhập sinh trắc học: thêm / đổi tên / cập nhật mật khẩu / xoá. */
import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';
import { supabase } from '../../lib/supabaseClient';
import {
  deleteBiometricCredential,
  detectBiometricPlatform,
  enrollBiometricCredential,
  isBiometricAvailable,
  listBiometricCredentials,
  renameBiometricCredential,
  updateBiometricSecret,
  type BiometricCredentialInfo,
} from '../../lib/biometricAuth';
import {
  biometricErrorMessage,
  biometricMethodIcon,
  biometricMethodLabel,
  withMethod,
} from '../../lib/biometricMessages';

type Mode =
  | { type: 'idle' }
  | { type: 'add' }
  | { type: 'update'; id: string }
  | { type: 'rename'; id: string }
  | { type: 'confirm-delete'; id: string };

export default function BiometricLoginCard() {
  const s = useSettings();
  const t = getT(s.locale);
  const isLight = s.theme === 'light';

  const platform = detectBiometricPlatform();
  const methodLabel = biometricMethodLabel(s.locale, platform);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [creds, setCreds] = useState<BiometricCredentialInfo[]>([]);
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<Mode>({ type: 'idle' });
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setCreds(await listBiometricCredentials());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [supported, list, userRes] = await Promise.all([
        isBiometricAvailable(),
        listBiometricCredentials(),
        supabase.auth.getUser(),
      ]);
      if (!active) return;
      setAvailable(supported);
      setCreds(list);
      setEmail(userRes.data.user?.email ?? '');
    })();
    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setMode({ type: 'idle' });
    setPassword('');
    setLabel('');
    setError(null);
  };

  const inputClass =
    'w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-accent/35 ' +
    (isLight
      ? 'bg-white border border-black/15 text-slate-900 placeholder:text-slate-400'
      : 'bg-black/40 border border-white/20 text-slate-50 placeholder:text-slate-400');

  const primaryBtn =
    'w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-medium transition bg-accent text-white hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed';

  const ghostBtn =
    'inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[11px] transition ' +
    (isLight
      ? 'bg-slate-50 border border-black/10 text-slate-700 hover:bg-slate-100'
      : 'bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white');

  const iconBtn =
    'p-1 rounded-lg transition ' +
    (isLight
      ? 'text-slate-500 hover:text-slate-900 hover:bg-black/[0.06]'
      : 'text-text-muted hover:text-white hover:bg-white/10');

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(s.locale === 'vi' ? 'vi-VN' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  /** Xác minh mật khẩu với Supabase trước khi mã hoá & lưu. */
  const verifyPassword = async (): Promise<boolean> => {
    if (!email) {
      setError(t.biometricNeedSession);
      return false;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(t.biometricErrorWrongPassword);
      return false;
    }
    return true;
  };

  const handleEnroll = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!(await verifyPassword())) return;
      await enrollBiometricCredential({
        email,
        password,
        label: label.trim() || methodLabel,
      });
      await refresh();
      setNotice(withMethod(t.biometricEnrollSuccess, methodLabel));
      resetForm();
    } catch (e) {
      setError(biometricErrorMessage(s.locale, e));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateSecret = async (id: string) => {
    if (!password) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!(await verifyPassword())) return;
      await updateBiometricSecret(id, { email, password });
      await refresh();
      setNotice(t.biometricUpdateSuccess);
      resetForm();
    } catch (e) {
      setError(biometricErrorMessage(s.locale, e));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await renameBiometricCredential(id, label);
      await refresh();
      setNotice(t.biometricRenameSuccess);
      resetForm();
    } catch (e) {
      setError(biometricErrorMessage(s.locale, e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteBiometricCredential(id);
      await refresh();
      setNotice(t.biometricDeleteSuccess);
      resetForm();
    } catch (e) {
      setError(biometricErrorMessage(s.locale, e));
    } finally {
      setBusy(false);
    }
  };

  const mutedText = isLight ? 'text-slate-500' : 'text-text-muted';
  const bodyText = isLight ? 'text-slate-700' : 'text-text-secondary';

  if (available === false) {
    return (
      <p className={`text-[11px] leading-relaxed ${mutedText}`}>
        {withMethod(t.biometricUnsupported, methodLabel)}
      </p>
    );
  }

  return (
    <div className="space-y-2.5" data-testid="biometric-card">
      <p className={`text-[11px] leading-relaxed ${mutedText}`}>
        {withMethod(t.biometricDescription, methodLabel)}
      </p>

      {creds.length === 0 && mode.type !== 'add' && (
        <p className={`text-[11px] ${bodyText}`}>{t.biometricEmpty}</p>
      )}

      {creds.length > 0 && (
        <ul className="space-y-1.5">
          {creds.map((cred) => (
            <li
              key={cred.id}
              className={`rounded-lg px-2 py-1.5 border ${
                isLight ? 'border-black/10 bg-slate-50' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-accent mt-0.5">
                  {biometricMethodIcon(cred.platform)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[11px] font-medium truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {cred.label}
                  </p>
                  <p className={`text-[10px] truncate ${mutedText}`}>{cred.email}</p>
                  <p className={`text-[10px] ${mutedText}`}>
                    {t.biometricCreatedAt}: {formatDate(cred.createdAt)} ·{' '}
                    {t.biometricLastUsed}:{' '}
                    {cred.lastUsedAt ? formatDate(cred.lastUsedAt) : t.biometricNeverUsed}
                  </p>
                  <p className={`text-[10px] ${mutedText}`}>
                    {cred.keyMode === 'prf' ? t.biometricKeyModePrf : t.biometricKeyModeLocal}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    className={iconBtn}
                    title={t.biometricRename}
                    aria-label={t.biometricRename}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setLabel(cred.label);
                      setMode({ type: 'rename', id: cred.id });
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    title={t.biometricUpdateSecret}
                    aria-label={t.biometricUpdateSecret}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setPassword('');
                      setMode({ type: 'update', id: cred.id });
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">key</span>
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    title={t.delete}
                    aria-label={t.delete}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setMode({ type: 'confirm-delete', id: cred.id });
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              {mode.type === 'confirm-delete' && mode.id === cred.id && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`text-[11px] flex-1 ${bodyText}`}>{t.biometricDeleteConfirm}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(cred.id)}
                    className="inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-60"
                  >
                    {t.biometricDeleteYes}
                  </button>
                  <button type="button" onClick={resetForm} className={ghostBtn}>
                    {t.cancel}
                  </button>
                </div>
              )}

              {mode.type === 'rename' && mode.id === cred.id && (
                <div className="mt-1.5 space-y-1.5">
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t.biometricDeviceLabel}
                    className={inputClass}
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRename(cred.id)}
                      className={primaryBtn}
                    >
                      {t.biometricRenameSubmit}
                    </button>
                    <button type="button" onClick={resetForm} className={ghostBtn}>
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}

              {mode.type === 'update' && mode.id === cred.id && (
                <div className="mt-1.5 space-y-1.5">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.biometricPasswordLabel}
                    autoComplete="current-password"
                    className={inputClass}
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy || !password}
                      onClick={() => handleUpdateSecret(cred.id)}
                      className={primaryBtn}
                    >
                      {busy ? t.biometricSaving : t.biometricUpdateSubmit}
                    </button>
                    <button type="button" onClick={resetForm} className={ghostBtn}>
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {mode.type === 'add' ? (
        <div className="space-y-1.5">
          <div>
            <p className={`text-[10px] uppercase tracking-wider ${mutedText}`}>
              {t.biometricAccountLabel}
            </p>
            <input type="email" value={email} readOnly disabled className={inputClass} />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.biometricPasswordLabel}
            autoComplete="current-password"
            className={inputClass}
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.biometricDeviceLabel}
            className={inputClass}
          />
          <p className={`text-[10px] leading-relaxed ${mutedText}`}>{t.biometricPasswordHint}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy || !password}
              onClick={handleEnroll}
              className={primaryBtn}
            >
              <span className="material-symbols-outlined text-[14px]">
                {biometricMethodIcon(platform)}
              </span>
              {busy ? t.biometricEnrollLoading : t.biometricEnrollSubmit}
            </button>
            <button type="button" onClick={resetForm} className={ghostBtn}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={available === null}
          onClick={() => {
            setError(null);
            setNotice(null);
            setPassword('');
            setLabel(methodLabel);
            setMode({ type: 'add' });
          }}
          className={ghostBtn}
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          {t.biometricAddButton}
        </button>
      )}

      {creds.length > 0 && (
        <p className={`text-[10px] leading-relaxed ${mutedText}`}>{t.biometricDeleteNote}</p>
      )}

      {error && (
        <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-1">
          {notice}
        </p>
      )}
    </div>
  );
}

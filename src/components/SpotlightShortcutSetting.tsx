import React, { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';
import {
  getSpotlightCommandShortcut,
  openChromeShortcutsPage,
  parseShortcutParts,
} from '../lib/spotlightShortcut';

function ShortcutKbd({ parts, isLight }: { parts: string[]; isLight: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-text-muted ${
        isLight ? 'border-black/15 bg-black/[0.03]' : 'border-white/15 bg-white/5'
      }`}
    >
      {parts.map((key, i) => (
        <React.Fragment key={`${key}-${i}`}>
          {i > 0 && <span className="opacity-50">+</span>}
          <kbd className="font-medium text-[11px]">{key}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

export default function SpotlightShortcutSetting({ compact = false }: { compact?: boolean }) {
  const s = useSettings();
  const t = getT(s.locale);
  const isLight = s.theme === 'light';
  const [shortcut, setShortcut] = useState('');
  const [assigned, setAssigned] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getSpotlightCommandShortcut();
    setShortcut(next.shortcut);
    setAssigned(next.assigned);
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  const parts = parseShortcutParts(shortcut);
  const dashboardKeys =
    typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().includes('MAC') ? '⌘K' : 'Ctrl+K';
  const dashboardHint = t.spotlightShortcutDashboardHint.replace('{keys}', dashboardKeys);

  const changeBtnClass = compact
    ? `shrink-0 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[11px] font-medium transition ${
        isLight
          ? 'bg-slate-50 border border-black/10 text-slate-700 hover:bg-slate-100'
          : 'bg-white/5 border border-white/10 text-[#cbd5f5] hover:bg-white/10'
      }`
    : `shrink-0 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${
        isLight
          ? 'bg-slate-50 border border-black/10 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          : 'bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white'
      }`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {assigned && parts.length > 0 ? (
            <ShortcutKbd parts={parts} isLight={isLight} />
          ) : (
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-text-muted'}`}>
              {t.spotlightShortcutUnset}
            </span>
          )}
        </div>
        <button type="button" onClick={openChromeShortcutsPage} className={changeBtnClass}>
          {t.spotlightShortcutChange}
        </button>
      </div>
      <p className={`leading-relaxed ${compact ? 'text-[10px] text-[#94a3b8]' : 'text-[11px] text-text-muted'}`}>
        {t.spotlightShortcutHint}
      </p>
      <p className={`leading-relaxed ${compact ? 'text-[10px] text-[#94a3b8]' : 'text-[11px] text-text-muted'}`}>
        {dashboardHint}
      </p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="min-w-0">
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-text-muted'}`}>
            {t.spotlightDoubleShift}
          </p>
          <p className={`mt-0.5 leading-relaxed ${compact ? 'text-[10px] text-[#94a3b8]' : 'text-[11px] text-text-muted'}`}>
            {t.spotlightDoubleShiftHint}
          </p>
        </div>
        <button
          type="button"
          onClick={() => s.setSpotlightDoubleShift(s.spotlightDoubleShift === false)}
          className={`min-w-[44px] shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
            s.spotlightDoubleShift !== false
              ? 'bg-accent/20 text-accent border border-accent/40'
              : isLight
                ? 'bg-slate-100 text-slate-500 border border-black/10'
                : 'bg-white/10 text-text-muted hover:bg-white/15 border border-white/10'
          }`}
        >
          {s.spotlightDoubleShift !== false ? t.on : t.off}
        </button>
      </div>
    </div>
  );
}

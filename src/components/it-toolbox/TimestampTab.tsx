import React, { useEffect, useMemo, useState } from 'react';
import { getT } from '../../lib/i18n';
import { ActionBtn, CopyButton, Label, ToolboxInput, useToolboxChrome } from './ui';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDatetimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function parseTimestampInput(raw: string, now = new Date()): Date | null {
  const s = raw.trim();
  if (!s) return now;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    if (Math.abs(n) < 1e11) return new Date(n * 1000);
    return new Date(n);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ResultRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { codeClass, mutedClass } = useToolboxChrome();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>{label}</span>
        <CopyButton text={value} />
      </div>
      <code className={`block text-[12px] font-mono break-all rounded-lg border px-2.5 py-2 ${codeClass}`}>
        {value || '—'}
      </code>
    </div>
  );
}

export function TimestampTab({ t }: { t: ReturnType<typeof getT> }) {
  const { panelClass, headingClass, mutedClass, isLight } = useToolboxChrome();
  const [now, setNow] = useState(() => new Date());
  const [input, setInput] = useState('');
  const [localValue, setLocalValue] = useState(() => toDatetimeLocal(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const parsed = useMemo(() => parseTimestampInput(input, now), [input, now]);

  useEffect(() => {
    if (parsed) setLocalValue(toDatetimeLocal(parsed));
  }, [parsed]);

  const applyNow = () => {
    const d = new Date();
    setInput(String(Math.floor(d.getTime() / 1000)));
  };

  const applyLocal = (v: string) => {
    setLocalValue(v);
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) setInput(String(Math.floor(d.getTime() / 1000)));
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 overflow-y-auto">
      <div className={`rounded-xl border p-4 space-y-3 ${panelClass}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-xs font-semibold ${headingClass}`}>{t.itToolboxTimestampInput}</h3>
          <ActionBtn onClick={applyNow} variant="primary">{t.itToolboxTimestampNow}</ActionBtn>
        </div>
        <Label>{t.itToolboxTimestampPaste}</Label>
        <ToolboxInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.itToolboxTimestampPlaceholder}
        />
        <Label>{t.itToolboxTimestampLocal}</Label>
        <input
          type="datetime-local"
          step={1}
          value={localValue}
          onChange={(e) => applyLocal(e.target.value)}
          className={`w-full max-w-xs px-3 py-2 rounded-lg border text-xs ${
            isLight
              ? 'border-black/10 bg-white text-slate-900'
              : 'border-white/10 bg-white/5 text-white'
          }`}
        />
        {!parsed && (
          <p className="text-[11px] text-red-400">{t.itToolboxTimestampInvalid}</p>
        )}
      </div>

      {parsed && (
        <div className={`rounded-xl border p-4 grid grid-cols-1 md:grid-cols-2 gap-3 ${panelClass}`}>
          <ResultRow label={t.itToolboxTimestampUnixSec} value={String(Math.floor(parsed.getTime() / 1000))} />
          <ResultRow label={t.itToolboxTimestampUnixMs} value={String(parsed.getTime())} />
          <ResultRow label={t.itToolboxTimestampIso} value={parsed.toISOString()} />
          <ResultRow label={t.itToolboxTimestampUtc} value={parsed.toUTCString()} />
          <ResultRow label={t.itToolboxTimestampLocalOut} value={parsed.toString()} />
          <p className={`md:col-span-2 text-[11px] ${mutedClass}`}>{t.itToolboxTimestampHint}</p>
        </div>
      )}
    </div>
  );
}

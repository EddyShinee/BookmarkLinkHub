import React, { useMemo, useState } from 'react';
import { getT } from '../../lib/i18n';
import { ActionBtn, CopyButton, Label, TextArea, useToolboxChrome } from './ui';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function formatPreview(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  return `Object(${Object.keys(value).length})`;
}

function valueColor(value: JsonValue, isLight: boolean): string {
  if (value === null) return isLight ? 'text-slate-400' : 'text-slate-400';
  if (typeof value === 'string') return isLight ? 'text-emerald-700' : 'text-emerald-300';
  if (typeof value === 'number') return isLight ? 'text-sky-700' : 'text-sky-300';
  if (typeof value === 'boolean') return isLight ? 'text-amber-700' : 'text-amber-300';
  return isLight ? 'text-slate-600' : 'text-text-secondary';
}

function JsonNode({
  name,
  value,
  path,
  depth,
  forceOpen,
  onUserToggle,
}: {
  name: string;
  value: JsonValue;
  path: string;
  depth: number;
  forceOpen: boolean | null;
  onUserToggle: () => void;
}) {
  const { isLight, mutedClass } = useToolboxChrome();
  const expandable = value !== null && typeof value === 'object';
  const [open, setOpen] = useState(depth < 2);
  const shown = forceOpen === null ? open : forceOpen;

  const entries = expandable
    ? Array.isArray(value)
      ? value.map((item, i) => [String(i), item] as const)
      : Object.entries(value)
    : [];

  return (
    <div className="font-mono text-[11px] leading-6">
      <div className="flex items-start gap-1 group min-w-0">
        {expandable ? (
          <button
            type="button"
            onClick={() => {
              onUserToggle();
              setOpen((v) => !(forceOpen === null ? v : forceOpen));
            }}
            className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded ${mutedClass}`}
            aria-expanded={shown}
          >
            <span className="material-symbols-outlined text-[14px] leading-none">
              {shown ? 'expand_more' : 'chevron_right'}
            </span>
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <span className={isLight ? 'text-violet-700' : 'text-violet-300'}>{name}</span>
        <span className={mutedClass}>:</span>
        {!expandable || !shown ? (
          <span className={`min-w-0 break-all ${valueColor(value, isLight)}`}>{formatPreview(value)}</span>
        ) : (
          <span className={mutedClass}>{formatPreview(value)}</span>
        )}
        <span className="opacity-0 group-hover:opacity-100 transition ml-1 flex-shrink-0">
          <CopyButton text={path} />
        </span>
      </div>
      {expandable && shown && (
        <div className={`ml-3 pl-2 border-l ${isLight ? 'border-black/10' : 'border-white/10'}`}>
          {entries.length === 0 ? (
            <p className={mutedClass}>{Array.isArray(value) ? '[]' : '{}'}</p>
          ) : (
            entries.map(([k, v]) => (
              <JsonNode
                key={k}
                name={k}
                value={v as JsonValue}
                path={Array.isArray(value) ? `${path}[${k}]` : path === '$' ? `$.${k}` : `${path}.${k}`}
                depth={depth + 1}
                forceOpen={forceOpen}
                onUserToggle={onUserToggle}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function JsonTreeTab({ t }: { t: ReturnType<typeof getT> }) {
  const { panelClass, headingClass } = useToolboxChrome();
  const [input, setInput] = useState('{\n  "hello": "world"\n}');
  const [forceOpen, setForceOpen] = useState<boolean | null>(null);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(input) as JsonValue };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [input]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full min-h-0">
      <div className="flex flex-col min-h-0">
        <Label>{t.itToolboxInputJson}</Label>
        <TextArea
          value={input}
          onChange={(v) => {
            setInput(v);
            setForceOpen(null);
          }}
          rows={16}
          className="flex-1 min-h-[160px]"
        />
        {!parsed.ok && <p className="mt-1.5 text-[11px] text-red-400">{parsed.error}</p>}
      </div>
      <div className={`flex flex-col min-h-0 rounded-xl border p-3 ${panelClass}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className={`text-xs font-semibold ${headingClass}`}>{t.itToolboxJsonTreeTitle}</h3>
          <div className="flex gap-1.5">
            <ActionBtn compact onClick={() => setForceOpen(true)} variant="neutral">{t.itToolboxJsonTreeExpand}</ActionBtn>
            <ActionBtn compact onClick={() => setForceOpen(false)} variant="neutral">{t.itToolboxJsonTreeCollapse}</ActionBtn>
          </div>
        </div>
        <p className="text-[11px] text-text-muted mb-2">{t.itToolboxJsonTreeHint}</p>
        <div className="flex-1 min-h-0 overflow-auto pr-1">
          {parsed.ok ? (
            <JsonNode
              name="$"
              value={parsed.value}
              path="$"
              depth={0}
              forceOpen={forceOpen}
              onUserToggle={() => setForceOpen(null)}
            />
          ) : (
            <p className="text-[11px] text-text-muted">{t.itToolboxJsonTreeWaiting}</p>
          )}
        </div>
      </div>
    </div>
  );
}

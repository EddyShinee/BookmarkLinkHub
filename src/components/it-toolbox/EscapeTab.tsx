import React, { useState } from 'react';
import { getT } from '../../lib/i18n';
import { ActionBtn, Label, TextArea } from './ui';

function unescapeOnce(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return input;

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') return parsed;
    } catch {
      // fall through
    }
  }

  try {
    return JSON.parse(`"${trimmed}"`);
  } catch {
    return trimmed
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/\\\\/g, '\\');
  }
}

export function unescapeText(input: string, deep = false, maxPasses = 8): string {
  if (!deep) return unescapeOnce(input);
  let prev = input;
  for (let i = 0; i < maxPasses; i++) {
    const next = unescapeOnce(prev);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

export function escapeText(input: string): string {
  return JSON.stringify(input).slice(1, -1);
}

export function EscapeTab({ t }: { t: ReturnType<typeof getT> }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxEscapeInput}</Label>
        <TextArea
          value={input}
          onChange={setInput}
          placeholder={'Hello\\n\\"world\\"'}
          rows={14}
          className="flex-1 min-h-[140px]"
        />
        <p className="mt-2 rounded-lg border border-dashed border-current/10 bg-black/[0.04] px-2.5 py-1.5 text-[11px] leading-relaxed text-text-muted">
          {t.itToolboxEscapeHint}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
        <ActionBtn onClick={() => setOutput(unescapeText(input, false))} variant="primary">
          {t.itToolboxEscapeRemove}
        </ActionBtn>
        <ActionBtn onClick={() => setOutput(unescapeText(input, true))} variant="info">
          {t.itToolboxEscapeRemoveDeep}
        </ActionBtn>
        <ActionBtn onClick={() => setOutput(escapeText(input))} variant="warning">
          {t.itToolboxEscapeAdd}
        </ActionBtn>
      </div>
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxResult}</Label>
        <TextArea
          value={output}
          readOnly
          copyable
          placeholder={t.itToolboxResultPlaceholder}
          rows={14}
          className="flex-1 min-h-[140px]"
        />
      </div>
    </div>
  );
}

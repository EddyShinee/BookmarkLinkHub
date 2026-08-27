import React, { useState } from 'react';
import { getT } from '../../lib/i18n';
import { ActionBtn, Label, TextArea } from './ui';

export function encodeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeHtml(input: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = input;
  return el.value;
}

export function HtmlTab({ t }: { t: ReturnType<typeof getT> }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const encode = () => {
    setError(null);
    setOutput(encodeHtml(input));
  };

  const decode = () => {
    setError(null);
    try {
      setOutput(decodeHtml(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.itToolboxErrorDecode);
      setOutput('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxHtmlInput}</Label>
        <TextArea
          value={input}
          onChange={setInput}
          placeholder={'<div class="box">Hello & welcome</div>'}
          rows={14}
          className="flex-1 min-h-[140px]"
        />
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
      </div>
      <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
        <ActionBtn onClick={encode} variant="info">{t.itToolboxHtmlEncode}</ActionBtn>
        <ActionBtn onClick={decode} variant="primary">{t.itToolboxHtmlDecode}</ActionBtn>
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

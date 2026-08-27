import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useSettings } from '../contexts/SettingsContext';
import { generatePassword, generateUuids, hashText } from '../lib/cryptoUtils';
import { chromeStorageAdapter } from '../lib/chromeStorageAdapter';
import { getT } from '../lib/i18n';
import {
  REGEX_CHEATSHEET_IDS,
  REGEX_CHEATSHEET_PATTERNS,
  type RegexCheatsheetId,
  highlightInputHtml,
  runRegex,
  sanitizeRegexFlags,
} from '../lib/regexUtils';
import { HtmlTab } from './it-toolbox/HtmlTab';
import { JsonTreeTab } from './it-toolbox/JsonTreeTab';
import { TimestampTab } from './it-toolbox/TimestampTab';
import { ActionBtn, CopyButton, Label, TextArea, ToolboxInput, useToolboxChrome } from './it-toolbox/ui';

export type TabId =
  | 'json'
  | 'json-tree'
  | 'jwt'
  | 'url'
  | 'base64'
  | 'html'
  | 'regex'
  | 'qr-gen'
  | 'crypto-gen'
  | 'timestamp';

const LAST_TAB_KEY = 'it_toolbox_last_tab';
const ALL_TABS: TabId[] = [
  'jwt',
  'json',
  'json-tree',
  'url',
  'base64',
  'html',
  'regex',
  'timestamp',
  'qr-gen',
  'crypto-gen',
];

interface ITToolboxModalProps {
  open: boolean;
  onClose: () => void;
}

// ——— JSON ———
function JsonTab({ t }: { t: ReturnType<typeof getT> }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const beautify = () => {
    setError(null);
    try {
      const parsed = JSON.parse(input || '{}');
      setOutput(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      setOutput('');
    }
  };

  const minify = () => {
    setError(null);
    try {
      const parsed = JSON.parse(input || '{}');
      setOutput(JSON.stringify(parsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      setOutput('');
    }
  };

  const decode = () => {
    setError(null);
    try {
      const parsed = JSON.parse(input || 'null');
      setOutput(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      setOutput('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxInputJson}</Label>
        <TextArea value={input} onChange={setInput} placeholder='{"key": "value"}' error={!!error} rows={14} className="flex-1 min-h-[140px]" />
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
      </div>
      <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
        <ActionBtn onClick={beautify} variant="success">{t.itToolboxBeautify}</ActionBtn>
        <ActionBtn onClick={minify} variant="warning">{t.itToolboxMinify}</ActionBtn>
        <ActionBtn onClick={decode} variant="primary">Decode</ActionBtn>
      </div>
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxResult}</Label>
        <TextArea value={output} onChange={undefined} placeholder={t.itToolboxResultPlaceholder} readOnly copyable rows={14} className="flex-1 min-h-[140px]" />
      </div>
    </div>
  );
}

// ——— JWT helpers ———
function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  try {
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return '';
  }
}

function base64UrlEncode(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Chuỗi có đúng 3 segment base64url (JWT). */
function looksLikeJwt(s: string): boolean {
  const p = s.trim().split('.');
  return p.length === 3 && p.every((x) => x.length > 0);
}

/** Tìm JWT dài nhất trong text (header thường bắt đầu bằng eyJ). */
function extractJwtByRegex(s: string): string | null {
  const re = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  let best = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[0].length > best.length) best = m[0];
  }
  return best || null;
}

/** JWT nằm trong log JSON dạng ..."payload":"eyJ..."... (kể cả chuỗi escape như log). */
function extractJwtFromPayloadFieldInText(s: string): string | null {
  const patterns = [
    /"payload"\s*:\s*"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)"/,
    /\\"payload\\"\s*:\s*\\"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\\"/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1] && looksLikeJwt(m[1])) return m[1];
  }
  return null;
}

function normalizePastedLogText(raw: string): string {
  return raw
    .replace(/^\s*request\s*:\s*/i, '')
    .trim()
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

const MAX_JWT_NEST_DEPTH = 10;

/**
 * Trích JWT từ log dạng:
 * `Request : ["https://...","{\"payload\":\"eyJ...\"}"]`
 * hoặc JSON có `payload`, hoặc chuỗi JSON lồng nhau.
 */
function extractJwtFromNestedValue(val: unknown, depth: number): string | null {
  if (depth > MAX_JWT_NEST_DEPTH) return null;
  if (typeof val === 'string') {
    const u = val.trim();
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return null;
    if (looksLikeJwt(u)) return u;
    try {
      return extractJwtFromNestedValue(JSON.parse(u), depth + 1);
    } catch {
      return extractJwtByRegex(u);
    }
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      const r = extractJwtFromNestedValue(item, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (val && typeof val === 'object') {
    const p = (val as Record<string, unknown>).payload;
    if (p !== undefined) {
      const r = extractJwtFromNestedValue(p, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function extractJwtFromPastedText(raw: string): string | null {
  const s0 = normalizePastedLogText(raw);
  if (!s0) return null;
  if (looksLikeJwt(s0)) return s0.trim();
  try {
    const parsed = JSON.parse(s0);
    const fromNested = extractJwtFromNestedValue(parsed, 0);
    if (fromNested) return fromNested;
  } catch {
    // không parse được JSON đầy đủ — vẫn có thể có payload trong chuỗi log
  }
  const fromPayloadKey = extractJwtFromPayloadFieldInText(s0);
  if (fromPayloadKey) return fromPayloadKey;
  return extractJwtByRegex(s0);
}

async function signHmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const dataBuffer = enc.encode(data);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ——— JWT Tab ———
function JwtTab({ t }: { t: ReturnType<typeof getT> }) {
  const [input, setInput] = useState('');
  const [secret, setSecret] = useState('');
  const [headerOut, setHeaderOut] = useState('');
  const [payloadOut, setPayloadOut] = useState('');
  const [signatureValid, setSignatureValid] = useState<boolean | null>(null);
  const [encodePayload, setEncodePayload] = useState('');
  const [encodeSecret, setEncodeSecret] = useState('');
  const [encodedJwt, setEncodedJwt] = useState('');
  const [jwtError, setJwtError] = useState<string | null>(null);
  const [jwtAutoExtracted, setJwtAutoExtracted] = useState(false);
  const [mode, setMode] = useState<'decode' | 'encode'>('decode');

  const decodeJwt = async () => {
    setJwtError(null);
    setSignatureValid(null);
    const raw = input.trim();
    if (!raw) {
      setHeaderOut('');
      setPayloadOut('');
      setJwtAutoExtracted(false);
      return;
    }
    const extracted = extractJwtFromPastedText(raw);
    // Không dùng raw làm token: log có URL nhiều dấu "." → split('.') sai, báo lỗi 3 phần oan.
    const token = extracted?.trim() ?? '';
    setJwtAutoExtracted(Boolean(extracted && extracted.trim() !== raw.trim()));

    if (!token || !looksLikeJwt(token)) {
      setJwtError(t.itToolboxJwtInvalid);
      setHeaderOut('');
      setPayloadOut('');
      return;
    }

    const parts = token.split('.');
    try {
      const headerJson = base64UrlDecode(parts[0]);
      const payloadJson = base64UrlDecode(parts[1]);
      setHeaderOut(headerJson ? (() => { try { return JSON.stringify(JSON.parse(headerJson), null, 2); } catch { return headerJson; } })() : '');
      setPayloadOut(payloadJson ? (() => { try { return JSON.stringify(JSON.parse(payloadJson), null, 2); } catch { return payloadJson; } })() : '');

      if (secret.trim()) {
        const expectedSig = await signHmacSha256(secret.trim(), `${parts[0]}.${parts[1]}`);
        const actualSig = parts[2];
        setSignatureValid(expectedSig === actualSig);
      }
    } catch (e) {
      setJwtError(e instanceof Error ? e.message : t.itToolboxErrorDecode);
      setHeaderOut('');
      setPayloadOut('');
    }
  };

  const beautifyPayload = () => {
    try {
      const parsed = JSON.parse(payloadOut || '{}');
      setPayloadOut(JSON.stringify(parsed, null, 2));
    } catch {
      // ignore
    }
  };

  const minifyPayload = () => {
    try {
      const parsed = JSON.parse(payloadOut || '{}');
      setPayloadOut(JSON.stringify(parsed));
    } catch {
      // ignore
    }
  };

  const encodeJwt = async () => {
    setJwtError(null);
    try {
      const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = base64UrlEncode(encodePayload.trim() || '{}');
      const unsigned = `${header}.${payload}`;
      if (encodeSecret.trim()) {
        const sig = await signHmacSha256(encodeSecret.trim(), unsigned);
        setEncodedJwt(`${unsigned}.${sig}`);
      } else {
        setEncodedJwt(`${unsigned}.`);
      }
    } catch (e) {
      setJwtError(e instanceof Error ? e.message : t.itToolboxErrorEncode);
      setEncodedJwt('');
    }
  };

  React.useEffect(() => {
    const raw = input.trim();
    if (!raw) {
      setHeaderOut('');
      setPayloadOut('');
      setSignatureValid(null);
      setJwtError(null);
      setJwtAutoExtracted(false);
      return;
    }
    decodeJwt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, secret]);

  React.useEffect(() => {
    if (!encodePayload.trim()) {
      setEncodedJwt('');
      setJwtError(null);
      return;
    }
    encodeJwt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encodePayload, encodeSecret]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col min-h-0 gap-3 overflow-y-auto flex-1">
        <div className="flex gap-1.5 mb-1">
          <button
            type="button"
            onClick={() => setMode('decode')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border ${
              mode === 'decode'
                ? 'bg-violet-500/20 border-violet-400 text-violet-500'
                : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
            }`}
          >
            Decode
          </button>
          <button
            type="button"
            onClick={() => setMode('encode')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border ${
              mode === 'encode'
                ? 'bg-amber-500/20 border-amber-400 text-amber-500'
                : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
            }`}
          >
            Encode
          </button>
        </div>

        {mode === 'decode' ? (
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3.5 space-y-2.5 flex-shrink-0">
            <Label>JWT</Label>
            <TextArea value={input} onChange={setInput} placeholder={t.itToolboxJwtPaste} rows={6} />
            <ToolboxInput
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Secret (verify)"
            />
            {signatureValid !== null && (
              <p className={`text-[11px] ${signatureValid ? 'text-emerald-400' : 'text-red-400'}`}>
                {signatureValid ? t.itToolboxJwtSignatureValid : t.itToolboxJwtSignatureInvalid}
              </p>
            )}
            {jwtAutoExtracted && !jwtError && (
              <p className="text-[11px] text-sky-300/90">{t.itToolboxJwtAutoDetected}</p>
            )}
            {jwtError && <p className="text-[11px] text-red-400">{jwtError}</p>}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2.5 flex-shrink-0">
            <Label>Payload (JSON)</Label>
            <TextArea
              value={encodePayload}
              onChange={setEncodePayload}
              placeholder='{"sub":"user123","exp":9999999999}'
              rows={8}
            />
            <ToolboxInput
              type="text"
              value={encodeSecret}
              onChange={(e) => setEncodeSecret(e.target.value)}
              placeholder="Secret"
            />
            {jwtError && <p className="text-[11px] text-red-400">{jwtError}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col min-h-0 gap-4 overflow-y-auto flex-1">
        {mode === 'decode' ? (
          <>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5 flex flex-col min-h-0">
              <Label>Header</Label>
              <TextArea value={headerOut} onChange={undefined} readOnly copyable rows={3} className="min-h-[64px]" />
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5 flex flex-col min-h-0 flex-1">
              <Label>Payload</Label>
              <TextArea value={payloadOut} onChange={setPayloadOut} rows={10} className="min-h-[140px] flex-1" />
              <div className="mt-1.5 flex gap-2">
                <ActionBtn onClick={beautifyPayload} variant="success">{t.itToolboxBeautify}</ActionBtn>
                <ActionBtn onClick={minifyPayload} variant="warning">{t.itToolboxMinify}</ActionBtn>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5 flex flex-col min-h-0 flex-1">
            <Label>{t.itToolboxJwtEncoded}</Label>
            <TextArea
              value={encodedJwt}
              onChange={undefined}
              readOnly
              copyable
              rows={12}
              placeholder={t.itToolboxJwtEncodedPlaceholder}
              className="min-h-[160px] flex-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ——— URL Tab ———
function UrlTab({ t }: { t: ReturnType<typeof getT> }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const encode = () => {
    setUrlError(null);
    try {
      setOutput(encodeURIComponent(input));
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : t.itToolboxErrorEncode);
      setOutput('');
    }
  };

  const decode = () => {
    setUrlError(null);
    try {
      setOutput(decodeURIComponent(input));
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : t.itToolboxErrorDecode);
      setOutput('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxInputString}</Label>
        <TextArea value={input} onChange={setInput} placeholder="https://example.com?q=hello world" rows={14} className="flex-1 min-h-[140px]" />
        {urlError && <p className="mt-1.5 text-[11px] text-red-400">{urlError}</p>}
      </div>
      <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
        <ActionBtn onClick={encode} variant="info">Encode</ActionBtn>
        <ActionBtn onClick={decode} variant="primary">Decode</ActionBtn>
      </div>
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxResult}</Label>
        <TextArea value={output} onChange={undefined} readOnly copyable placeholder={t.itToolboxResult} rows={14} className="flex-1 min-h-[140px]" />
      </div>
    </div>
  );
}

// ——— Base64 Tab ———
function Base64Tab({ t }: { t: ReturnType<typeof getT> }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [b64Error, setB64Error] = useState<string | null>(null);

  const encode = () => {
    setB64Error(null);
    try {
      setOutput(btoa(unescape(encodeURIComponent(input))));
    } catch (e) {
      setB64Error(e instanceof Error ? e.message : t.itToolboxErrorEncode);
      setOutput('');
    }
  };

  const decode = () => {
    setB64Error(null);
    try {
      setOutput(decodeURIComponent(escape(atob(input.replace(/\s/g, '')))));
    } catch (e) {
      setB64Error(e instanceof Error ? e.message : t.itToolboxBase64Invalid);
      setOutput('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxInputString}</Label>
        <TextArea value={input} onChange={setInput} placeholder={t.itToolboxBase64Placeholder} rows={14} className="flex-1 min-h-[140px]" />
        {b64Error && <p className="mt-1.5 text-[11px] text-red-400">{b64Error}</p>}
      </div>
      <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
        <ActionBtn onClick={encode} variant="success">Encode</ActionBtn>
        <ActionBtn onClick={decode} variant="primary">Decode</ActionBtn>
      </div>
      <div className="flex flex-col min-h-0 flex-1">
        <Label>{t.itToolboxResult}</Label>
        <TextArea value={output} onChange={undefined} readOnly copyable placeholder={t.itToolboxResult} rows={14} className="flex-1 min-h-[140px]" />
      </div>
    </div>
  );
}

const CHEAT_LABEL: Record<RegexCheatsheetId, (tr: ReturnType<typeof getT>) => string> = {
  Email: (tr) => tr.itToolboxRegexCheatEmail,
  Url: (tr) => tr.itToolboxRegexCheatUrl,
  PhoneVn: (tr) => tr.itToolboxRegexCheatPhoneVn,
  Ipv4: (tr) => tr.itToolboxRegexCheatIpv4,
  Uuid: (tr) => tr.itToolboxRegexCheatUuid,
};

function FlagChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { chipIdle } = useToolboxChrome();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-[11px] font-mono border transition ${
        active ? 'bg-accent/25 border-accent/50 text-accent' : chipIdle
      }`}
    >
      {label}
    </button>
  );
}

// ——— Regex Tab ———
function RegexTab({ t }: { t: ReturnType<typeof getT> }) {
  const [pattern, setPattern] = useState('');
  const [flagG, setFlagG] = useState(true);
  const [flagI, setFlagI] = useState(false);
  const [flagM, setFlagM] = useState(false);
  const [flagS, setFlagS] = useState(false);
  const [flagU, setFlagU] = useState(false);
  const [flagY, setFlagY] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [replaceMode, setReplaceMode] = useState<'match' | 'replace'>('match');
  const [replaceWith, setReplaceWith] = useState('');
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);

  const flags = useMemo(() => {
    let s = '';
    if (flagG) s += 'g';
    if (flagI) s += 'i';
    if (flagM) s += 'm';
    if (flagS) s += 's';
    if (flagU) s += 'u';
    if (flagY) s += 'y';
    return sanitizeRegexFlags(s);
  }, [flagG, flagI, flagM, flagS, flagU, flagY]);

  const matchRun = useMemo(() => runRegex(pattern, flags, testInput), [pattern, flags, testInput]);
  const replaceRun = useMemo(
    () => (replaceMode === 'replace' ? runRegex(pattern, flags, testInput, replaceWith) : null),
    [replaceMode, pattern, flags, testInput, replaceWith]
  );

  const displayError = replaceRun?.error ?? matchRun.error;
  const highlightedHtml = useMemo(
    () => highlightInputHtml(testInput, matchRun.highlights),
    [testInput, matchRun.highlights]
  );

  const applyCheat = (id: RegexCheatsheetId) => {
    setPattern(REGEX_CHEATSHEET_PATTERNS[id]);
    setCheatsheetOpen(false);
  };

  const copyMatches = async () => {
    const text = matchRun.matches
      .map((m, i) => `#${i + 1} @${m.index}: ${JSON.stringify(m.value)} groups: [${m.groups.map((g) => JSON.stringify(g)).join(', ')}]`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text || t.itToolboxRegexNoMatches);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setReplaceMode('match')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
            replaceMode === 'match'
              ? 'bg-accent/20 border-accent/50 text-accent'
              : 'bg-white/5 border-white/10 text-text-secondary'
          }`}
        >
          {t.itToolboxRegexMatchMode}
        </button>
        <button
          type="button"
          onClick={() => setReplaceMode('replace')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
            replaceMode === 'replace'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
              : 'bg-white/5 border-white/10 text-text-secondary'
          }`}
        >
          {t.itToolboxRegexReplaceMode}
        </button>
        <button
          type="button"
          onClick={() => setCheatsheetOpen((o) => !o)}
          className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-medium border border-white/10 bg-white/5 text-text-secondary hover:text-white"
        >
          {cheatsheetOpen ? t.itToolboxRegexCheatsheetHide : t.itToolboxRegexCheatsheetShow}: {t.itToolboxRegexCheatsheet}
        </button>
      </div>

      {cheatsheetOpen && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-white/10 bg-white/[0.03] flex-shrink-0">
          {REGEX_CHEATSHEET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyCheat(id)}
              className="px-2.5 py-1 rounded-md text-[11px] border border-white/15 bg-white/5 hover:bg-white/10 text-white"
            >
              {CHEAT_LABEL[id](t)}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
          <div>
            <Label>{t.itToolboxRegexPattern}</Label>
            <TextArea value={pattern} onChange={setPattern} placeholder="\\d+" rows={3} className="min-h-[72px]" />
          </div>
          <div>
            <Label>{t.itToolboxRegexFlags}</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <FlagChip label="g" active={flagG} onClick={() => setFlagG((v) => !v)} />
              <FlagChip label="i" active={flagI} onClick={() => setFlagI((v) => !v)} />
              <FlagChip label="m" active={flagM} onClick={() => setFlagM((v) => !v)} />
              <FlagChip label="s" active={flagS} onClick={() => setFlagS((v) => !v)} />
              <FlagChip label="u" active={flagU} onClick={() => setFlagU((v) => !v)} />
              <FlagChip label="y" active={flagY} onClick={() => setFlagY((v) => !v)} />
            </div>
          </div>
          {replaceMode === 'replace' && (
            <div>
              <Label>{t.itToolboxRegexReplaceWith}</Label>
              <TextArea value={replaceWith} onChange={setReplaceWith} placeholder="$1" rows={2} />
            </div>
          )}
          <div className="flex flex-col flex-1 min-h-[120px]">
            <Label>{t.itToolboxRegexTestString}</Label>
            <TextArea value={testInput} onChange={setTestInput} placeholder="..." rows={8} className="flex-1 min-h-[100px]" />
          </div>
        </div>

        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          {displayError && <p className="text-[11px] text-red-400 flex-shrink-0">{displayError}</p>}
          {replaceMode === 'replace' && replaceRun?.replaced !== null && (
            <div className="flex flex-col min-h-0 flex-shrink-0">
              <Label>{t.itToolboxRegexReplacePreview}</Label>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all rounded-lg border border-white/10 bg-white/[0.02] p-3 max-h-[28vh] overflow-y-auto text-white/90">
                {replaceRun?.replaced ?? ''}
              </pre>
            </div>
          )}
          {replaceMode === 'match' && (
            <div className="flex flex-col flex-shrink-0 min-h-0 max-h-[32vh]">
              <div className="flex items-center justify-between gap-2 mb-1 flex-shrink-0">
                <Label>{t.itToolboxRegexHighlighted}</Label>
              </div>
              <div
                className="text-xs font-mono whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-white/[0.02] p-3 flex-1 min-h-[100px] overflow-y-auto text-white/90"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </div>
          )}
          <div className="flex flex-col flex-1 min-h-0 mt-1">
              <div className="flex items-center justify-between flex-shrink-0 mb-1">
                <span className="text-[10px] font-semibold uppercase text-text-muted tracking-wider">{t.itToolboxRegexMatches}</span>
                <div className="flex items-center gap-2">
                  {copyFlash && <span className="text-[10px] text-emerald-400">{t.copied}</span>}
                  <button
                    type="button"
                    onClick={copyMatches}
                    className="text-[10px] text-accent hover:underline"
                  >
                    {t.itToolboxCopy}
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] flex-1 min-h-[100px] max-h-[40vh] overflow-y-auto p-2 space-y-2">
                {matchRun.matches.length === 0 ? (
                  <p className="text-[11px] text-text-muted">{t.itToolboxRegexNoMatches}</p>
                ) : (
                  matchRun.matches.map((m, idx) => (
                    <div key={`${m.index}-${idx}`} className="text-[11px] border-b border-white/5 pb-2 last:border-0 font-mono">
                      <span className="text-text-muted">#{idx + 1}</span>{' '}
                      <span className="text-sky-300/90">@{m.index}</span>{' '}
                      <span className="text-emerald-300/90 break-all">{JSON.stringify(m.value)}</span>
                      {m.groups.length > 0 && (
                        <div className="mt-1 pl-2 text-text-secondary">
                          groups: [{m.groups.map((g) => JSON.stringify(g)).join(', ')}]
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— QR Generator Tab ———
type QrEcc = 'L' | 'M' | 'Q' | 'H';

function QrGenTab({ t }: { t: ReturnType<typeof getT> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [content, setContent] = useState('');
  const [ecc, setEcc] = useState<QrEcc>('M');
  const [size, setSize] = useState(256);
  const [fg, setFg] = useState('#0f172a');
  const [bg, setBg] = useState('#ffffff');
  const [qrError, setQrError] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!content.trim()) {
      setQrError(null);
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setQrError(null);
        await QRCode.toCanvas(canvas, content, {
          errorCorrectionLevel: ecc,
          width: Math.min(512, Math.max(64, size)),
          margin: 2,
          color: { dark: fg, light: bg },
        });
        if (cancelled) return;
      } catch (e) {
        if (!cancelled) {
          setQrError(e instanceof Error ? e.message : t.itToolboxQrError);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t stable for QR error fallback
  }, [content, ecc, size, fg, bg]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !content.trim()) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'linkhub-qr.png';
    a.click();
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !content.trim()) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
      if (!blob || !navigator.clipboard?.write) {
        throw new Error('no-clipboard');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1500);
    } catch {
      window.alert(t.itToolboxCopyFailed);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
        <div>
          <Label>{t.itToolboxQrContent}</Label>
          <TextArea value={content} onChange={setContent} placeholder="https://..." rows={8} className="min-h-[120px]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label>{t.itToolboxQrEcc}</Label>
            <select
              value={ecc}
              onChange={(e) => setEcc(e.target.value as QrEcc)}
              className="mt-1 w-full px-2 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white"
            >
              <option value="L">L</option>
              <option value="M">M</option>
              <option value="Q">Q</option>
              <option value="H">H</option>
            </select>
          </div>
          <div>
            <Label>{t.itToolboxQrSize}</Label>
            <input
              type="number"
              min={64}
              max={512}
              step={32}
              value={size}
              onChange={(e) => setSize(Number(e.target.value) || 256)}
              className="mt-1 w-full px-2 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white"
            />
          </div>
          <div>
            <Label>{t.itToolboxQrFg}</Label>
            <input
              type="color"
              value={fg}
              onChange={(e) => setFg(e.target.value)}
              className="mt-1 w-full h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer"
            />
          </div>
          <div>
            <Label>{t.itToolboxQrBg}</Label>
            <input
              type="color"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
              className="mt-1 w-full h-9 rounded-lg border border-white/10 bg-transparent cursor-pointer"
            />
          </div>
        </div>
        {!content.trim() && <p className="text-[11px] text-text-muted">{t.itToolboxQrEmpty}</p>}
        {qrError && <p className="text-[11px] text-red-400">{qrError}</p>}
        <div className="flex flex-wrap gap-2">
          <ActionBtn onClick={downloadPng} variant="success" disabled={!content.trim()}>
            {t.itToolboxQrDownloadPng}
          </ActionBtn>
          <ActionBtn onClick={copyImage} variant="info" disabled={!content.trim()}>
            {t.itToolboxQrCopyImage}
          </ActionBtn>
          {copyFlash && <span className="text-[11px] text-emerald-400 self-center">{t.copied}</span>}
        </div>
      </div>
      <div className="flex flex-col items-center justify-start gap-2 min-w-0">
        <Label>{t.itToolboxQrPreview}</Label>
        <div className="rounded-xl border border-white/10 bg-white p-2 inline-block">
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        </div>
      </div>
    </div>
  );
}

function HashRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { mutedClass, codeClass } = useToolboxChrome();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>{label}</span>
        <CopyButton text={value} />
      </div>
      <code className={`text-[11px] font-mono break-all rounded border px-2 py-1.5 ${codeClass}`}>
        {value || '—'}
      </code>
    </div>
  );
}

// ——— Hash / UUID / Password Tab ———
function CryptoGenTab({ t }: { t: ReturnType<typeof getT> }) {
  const { panelClass, headingClass, codeClass } = useToolboxChrome();
  const [hashInput, setHashInput] = useState('');
  const [hashes, setHashes] = useState<{ md5: string; sha1: string; sha256: string; sha512: string } | null>(null);
  const [uuidBlock, setUuidBlock] = useState('');
  const [pwdLen, setPwdLen] = useState(16);
  const [pwdLower, setPwdLower] = useState(true);
  const [pwdUpper, setPwdUpper] = useState(true);
  const [pwdDigits, setPwdDigits] = useState(true);
  const [pwdSpecial, setPwdSpecial] = useState(true);
  const [password, setPassword] = useState('');
  const [flash, setFlash] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const h = await hashText(hashInput);
      if (!cancelled) setHashes(h);
    })();
    return () => {
      cancelled = true;
    };
  }, [hashInput]);

  useEffect(() => {
    setPassword(
      generatePassword({
        length: pwdLen,
        lower: pwdLower,
        upper: pwdUpper,
        digits: pwdDigits,
        special: pwdSpecial,
      })
    );
  }, [pwdLen, pwdLower, pwdUpper, pwdDigits, pwdSpecial]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlash(t.copied);
      setTimeout(() => setFlash(''), 1500);
    } catch {
      setFlash(t.itToolboxCopyFailed);
      setTimeout(() => setFlash(''), 2000);
    }
  };

  const genUuids = (n: 1 | 10 | 100) => {
    const lines = generateUuids(n === 1 ? 1 : n);
    setUuidBlock(lines.join('\n'));
  };

  return (
    <div className="flex flex-col gap-5 h-full min-h-0 overflow-y-auto">
      {flash && (
        <p className={`text-[11px] ${flash === t.itToolboxCopyFailed ? 'text-red-400' : 'text-emerald-400'}`}>{flash}</p>
      )}

      <section className={`rounded-xl border p-4 space-y-3 ${panelClass}`}>
        <h3 className={`text-xs font-semibold ${headingClass}`}>{t.itToolboxCryptoHashInput}</h3>
        <TextArea value={hashInput} onChange={setHashInput} rows={4} placeholder="" />
        {hashes && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <HashRow label={t.itToolboxCryptoMd5} value={hashes.md5} />
            <HashRow label={t.itToolboxCryptoSha1} value={hashes.sha1} />
            <HashRow label={t.itToolboxCryptoSha256} value={hashes.sha256} />
            <HashRow label={t.itToolboxCryptoSha512} value={hashes.sha512} />
          </div>
        )}
      </section>

      <section className={`rounded-xl border p-4 space-y-3 ${panelClass}`}>
        <h3 className={`text-xs font-semibold ${headingClass}`}>{t.itToolboxCryptoUuidTitle}</h3>
        <div className="flex flex-wrap gap-2">
          <ActionBtn onClick={() => genUuids(1)} variant="primary">
            {t.itToolboxCryptoGenOne}
          </ActionBtn>
          <ActionBtn onClick={() => genUuids(10)} variant="neutral">
            {t.itToolboxCryptoGen10}
          </ActionBtn>
          <ActionBtn onClick={() => genUuids(100)} variant="neutral">
            {t.itToolboxCryptoGen100}
          </ActionBtn>
          <ActionBtn onClick={() => copyText(uuidBlock)} variant="success" disabled={!uuidBlock}>
            {t.itToolboxCopy}
          </ActionBtn>
        </div>
        <TextArea value={uuidBlock} onChange={setUuidBlock} readOnly copyable rows={6} placeholder="UUID…" />
      </section>

      <section className={`rounded-xl border p-4 space-y-3 ${panelClass}`}>
        <h3 className={`text-xs font-semibold ${headingClass}`}>{t.itToolboxCryptoPasswordTitle}</h3>
        <div className="flex flex-col gap-2">
          <Label>{t.itToolboxCryptoPasswordLength}: {pwdLen}</Label>
          <input
            type="range"
            min={8}
            max={64}
            value={pwdLen}
            onChange={(e) => setPwdLen(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex flex-wrap gap-3 text-[11px] text-text-secondary">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={pwdLower} onChange={(e) => setPwdLower(e.target.checked)} />
              {t.itToolboxCryptoLower}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={pwdUpper} onChange={(e) => setPwdUpper(e.target.checked)} />
              {t.itToolboxCryptoUpper}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={pwdDigits} onChange={(e) => setPwdDigits(e.target.checked)} />
              {t.itToolboxCryptoDigits}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={pwdSpecial} onChange={(e) => setPwdSpecial(e.target.checked)} />
              {t.itToolboxCryptoSpecial}
            </label>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <code className={`flex-1 min-w-0 text-xs font-mono break-all rounded border px-2 py-2 ${codeClass}`}>
              {password}
            </code>
            <ActionBtn
              onClick={() =>
                setPassword(
                  generatePassword({
                    length: pwdLen,
                    lower: pwdLower,
                    upper: pwdUpper,
                    digits: pwdDigits,
                    special: pwdSpecial,
                  })
                )
              }
              variant="warning"
            >
              {t.itToolboxCryptoRegenerate}
            </ActionBtn>
            <ActionBtn onClick={() => copyText(password)} variant="success">
              {t.itToolboxCopy}
            </ActionBtn>
          </div>
        </div>
      </section>
    </div>
  );
}

const TAB_STYLES: Record<TabId, { active: string; icon: string }> = {
  jwt: { active: 'text-violet-500 bg-violet-500/10', icon: 'token' },
  json: { active: 'text-accent bg-accent/10', icon: 'data_object' },
  'json-tree': { active: 'text-indigo-500 bg-indigo-500/10', icon: 'account_tree' },
  url: { active: 'text-emerald-500 bg-emerald-500/10', icon: 'link' },
  base64: { active: 'text-amber-500 bg-amber-500/10', icon: 'code' },
  html: { active: 'text-orange-500 bg-orange-500/10', icon: 'html' },
  regex: { active: 'text-rose-500 bg-rose-500/10', icon: 'pattern' },
  timestamp: { active: 'text-teal-500 bg-teal-500/10', icon: 'schedule' },
  'qr-gen': { active: 'text-cyan-500 bg-cyan-500/10', icon: 'qr_code_2' },
  'crypto-gen': { active: 'text-slate-500 bg-slate-500/10', icon: 'tag' },
};

type NavGroupId = 'convert' | 'inspect' | 'generate';

const NAV_GROUPS: { id: NavGroupId; items: TabId[] }[] = [
  { id: 'convert', items: ['jwt', 'json', 'json-tree', 'url', 'base64', 'html'] },
  { id: 'inspect', items: ['regex', 'timestamp'] },
  { id: 'generate', items: ['qr-gen', 'crypto-gen'] },
];

function groupLabel(id: NavGroupId, tr: ReturnType<typeof getT>): string {
  if (id === 'convert') return tr.itToolboxGroupConvert;
  if (id === 'inspect') return tr.itToolboxGroupInspect;
  return tr.itToolboxGroupGenerate;
}

function tabLabel(id: TabId, tr: ReturnType<typeof getT>): string {
  switch (id) {
    case 'jwt':
      return 'JWT';
    case 'json':
      return 'JSON';
    case 'json-tree':
      return tr.itToolboxTabJsonTree;
    case 'url':
      return 'URL';
    case 'base64':
      return 'Base64';
    case 'html':
      return tr.itToolboxTabHtml;
    case 'regex':
      return tr.itToolboxTabRegex;
    case 'timestamp':
      return tr.itToolboxTabTimestamp;
    case 'qr-gen':
      return tr.itToolboxTabQrGen;
    case 'crypto-gen':
      return tr.itToolboxTabCrypto;
  }
}

function isTabId(v: string | null): v is TabId {
  return !!v && (ALL_TABS as string[]).includes(v);
}

export default function ITToolboxModal({ open, onClose }: ITToolboxModalProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const isLight = settings.theme === 'light';
  const [activeTab, setActiveTab] = useState<TabId>('jwt');
  const [tabReady, setTabReady] = useState(false);
  const [toolQuery, setToolQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const stored = await chromeStorageAdapter.getItem(LAST_TAB_KEY);
      if (cancelled) return;
      if (isTabId(stored)) setActiveTab(stored);
      setTabReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !tabReady) return;
    void chromeStorageAdapter.setItem(LAST_TAB_KEY, activeTab);
  }, [activeTab, open, tabReady]);

  const selectTab = (id: TabId) => {
    setActiveTab(id);
    setToolQuery('');
  };

  const q = toolQuery.trim().toLowerCase();
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((id) => !q || tabLabel(id, t).toLowerCase().includes(q)),
  })).filter((g) => g.items.length > 0);

  if (!open) return null;

  const border = isLight ? 'border-black/10' : 'border-white/10';
  const dialogBg = isLight ? 'bg-white' : 'bg-sidebar';
  const titleClass = isLight ? 'text-slate-900' : 'text-white';
  const closeBtn = isLight
    ? 'text-slate-500 hover:text-slate-900 hover:bg-black/[0.06]'
    : 'text-text-muted hover:text-white hover:bg-white/10';
  const navIdle = isLight
    ? 'text-slate-600 hover:bg-black/[0.04] hover:text-slate-900'
    : 'text-text-muted hover:bg-white/5 hover:text-white';
  const sidebarBg = isLight ? 'bg-slate-50/80' : 'bg-black/20';

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm ${
        isLight ? 'bg-slate-900/40' : 'bg-black/60'
      }`}
      onClick={onClose}
    >
      <div
        className={`${dialogBg} border ${border} rounded-2xl shadow-2xl w-[92vw] max-w-[1100px] h-[86vh] max-h-[86vh] flex flex-col overflow-hidden`}
        role="dialog"
        aria-labelledby="it-toolbox-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${border} flex-shrink-0`}>
          <h2 id="it-toolbox-title" className={`flex items-center gap-2 text-base font-semibold ${titleClass}`}>
            <span className="material-symbols-outlined text-accent text-[20px]">build</span>
            {t.itToolboxTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition ${closeBtn}`}
            aria-label={t.itToolboxClose}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <nav className={`w-52 flex-shrink-0 border-r ${border} ${sidebarBg} flex flex-col`}>
            <div className="p-2.5">
              <div className="relative">
                <span className="material-symbols-outlined text-[16px] absolute left-2 top-1/2 -translate-y-1/2 text-text-muted">
                  search
                </span>
                <input
                  type="search"
                  value={toolQuery}
                  onChange={(e) => setToolQuery(e.target.value)}
                  placeholder={t.itToolboxSearchTools}
                  className={`w-full pl-7 pr-2 py-1.5 rounded-lg border text-[11px] ${
                    isLight
                      ? 'border-black/10 bg-white text-slate-900 placeholder-slate-400'
                      : 'border-white/10 bg-white/5 text-white placeholder-text-muted'
                  }`}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
              {visibleGroups.map((group) => (
                <div key={group.id}>
                  <p className={`px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-text-muted'}`}>
                    {groupLabel(group.id, t)}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((id) => {
                      const style = TAB_STYLES[id];
                      const active = activeTab === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => selectTab(id)}
                          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[12px] font-medium text-left transition ${
                            active ? style.active : navIdle
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{style.icon}</span>
                          <span className="truncate">{tabLabel(id, t)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          <div className="flex-1 overflow-hidden p-5 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === 'json' && <JsonTab t={t} />}
              {activeTab === 'json-tree' && <JsonTreeTab t={t} />}
              {activeTab === 'jwt' && <JwtTab t={t} />}
              {activeTab === 'url' && <UrlTab t={t} />}
              {activeTab === 'base64' && <Base64Tab t={t} />}
              {activeTab === 'html' && <HtmlTab t={t} />}
              {activeTab === 'regex' && <RegexTab t={t} />}
              {activeTab === 'timestamp' && <TimestampTab t={t} />}
              {activeTab === 'qr-gen' && <QrGenTab t={t} />}
              {activeTab === 'crypto-gen' && <CryptoGenTab t={t} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

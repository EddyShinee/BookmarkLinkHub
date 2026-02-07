import React, { useState } from 'react';

type TabId = 'json' | 'jwt' | 'url' | 'base64';

interface ITToolboxModalProps {
  open: boolean;
  onClose: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase text-text-muted tracking-wider mb-1">
      {children}
    </label>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
  error,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  error?: boolean;
  readOnly?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={readOnly}
      placeholder={placeholder}
      rows={rows}
      className={`w-full px-3 py-2 rounded-lg border bg-white/5 text-xs text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40 resize-y font-mono ${
        error ? 'border-red-500/60' : 'border-white/10'
      } ${className}`}
    />
  );
}

const BTN_VARIANTS = {
  primary: 'bg-accent/20 border-accent/50 text-accent hover:bg-accent/30 hover:text-white',
  success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 hover:text-white',
  warning: 'bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30 hover:text-white',
  info: 'bg-sky-500/20 border-sky-500/50 text-sky-400 hover:bg-sky-500/30 hover:text-white',
  neutral: 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white',
} as const;

function ActionBtn({
  onClick,
  children,
  disabled,
  variant = 'neutral',
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: keyof typeof BTN_VARIANTS;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-[8.5rem] flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium border disabled:opacity-50 transition ${BTN_VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}

// ——— JSON ———
function JsonTab() {
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
        <Label>Nhập / Dán JSON</Label>
        <TextArea value={input} onChange={setInput} placeholder='{"key": "value"}' error={!!error} rows={14} className="flex-1 min-h-[140px]" />
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
      </div>
      <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
        <ActionBtn onClick={beautify} variant="success">Làm đẹp</ActionBtn>
        <ActionBtn onClick={minify} variant="warning">Làm gọn</ActionBtn>
        <ActionBtn onClick={decode} variant="primary">Decode</ActionBtn>
      </div>
      <div className="flex flex-col min-h-0 flex-1">
        <Label>Kết quả</Label>
        <TextArea value={output} onChange={undefined} placeholder="Kết quả hiển thị ở đây" readOnly rows={14} className="flex-1 min-h-[140px]" />
      </div>
    </div>
  );
}

// ——— JWT helpers (no external lib: base64url + optional HMAC with Web Crypto) ———
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
function JwtTab() {
  const [input, setInput] = useState('');
  const [secret, setSecret] = useState('');
  const [headerOut, setHeaderOut] = useState('');
  const [payloadOut, setPayloadOut] = useState('');
  const [signatureValid, setSignatureValid] = useState<boolean | null>(null);
  const [encodePayload, setEncodePayload] = useState('');
  const [encodeSecret, setEncodeSecret] = useState('');
  const [encodedJwt, setEncodedJwt] = useState('');
  const [jwtError, setJwtError] = useState<string | null>(null);
  const [mode, setMode] = useState<'decode' | 'encode'>('decode');

  const decodeJwt = async () => {
    setJwtError(null);
    setSignatureValid(null);
    const raw = input.trim();
    if (!raw) {
      setHeaderOut('');
      setPayloadOut('');
      return;
    }
    const parts = raw.split('.');
    if (parts.length !== 3) {
      setJwtError('JWT phải có 3 phần (header.payload.signature)');
      setHeaderOut('');
      setPayloadOut('');
      return;
    }
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
      setJwtError(e instanceof Error ? e.message : 'Lỗi decode');
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
      setJwtError(e instanceof Error ? e.message : 'Lỗi encode');
      setEncodedJwt('');
    }
  };

  // Tự động decode khi có token / secret
  React.useEffect(() => {
    const raw = input.trim();
    if (!raw) {
      setHeaderOut('');
      setPayloadOut('');
      setSignatureValid(null);
      setJwtError(null);
      return;
    }
    decodeJwt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, secret]);

  // Tự động encode khi thay đổi payload / secret
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
                ? 'bg-violet-500/20 border-violet-400 text-violet-200'
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
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
            }`}
          >
            Encode
          </button>
        </div>

        {mode === 'decode' ? (
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3.5 space-y-2.5 flex-shrink-0">
            <Label>JWT</Label>
            <TextArea value={input} onChange={setInput} placeholder="Dán token JWT" rows={6} />
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Secret (verify)"
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white placeholder-text-muted"
            />
            {signatureValid !== null && (
              <p className={`text-[11px] ${signatureValid ? 'text-emerald-400' : 'text-red-400'}`}>
                Chữ ký: {signatureValid ? 'Hợp lệ' : 'Không hợp lệ'}
              </p>
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
            <input
              type="text"
              value={encodeSecret}
              onChange={(e) => setEncodeSecret(e.target.value)}
              placeholder="Secret"
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white placeholder-text-muted"
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
              <TextArea value={headerOut} onChange={undefined} readOnly rows={3} className="min-h-[64px]" />
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5 flex flex-col min-h-0 flex-1">
              <Label>Payload</Label>
              <TextArea value={payloadOut} onChange={setPayloadOut} rows={10} className="min-h-[140px] flex-1" />
              <div className="mt-1.5 flex gap-2">
                <ActionBtn onClick={beautifyPayload} variant="success">Làm đẹp</ActionBtn>
                <ActionBtn onClick={minifyPayload} variant="warning">Làm gọn</ActionBtn>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5 flex flex-col min-h-0 flex-1">
            <Label>JWT sau Encode</Label>
            <TextArea
              value={encodedJwt}
              onChange={undefined}
              readOnly
              rows={12}
              placeholder="JWT sau encode"
              className="min-h-[160px] flex-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ——— URL Tab ———
function UrlTab() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const encode = () => {
    setUrlError(null);
    try {
      setOutput(encodeURIComponent(input));
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : 'Lỗi encode');
      setOutput('');
    }
  };

  const decode = () => {
    setUrlError(null);
    try {
      setOutput(decodeURIComponent(input));
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : 'Lỗi decode');
      setOutput('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col min-h-0 flex-1">
        <Label>Nhập chuỗi</Label>
        <TextArea value={input} onChange={setInput} placeholder="https://example.com?q=hello world" rows={14} className="flex-1 min-h-[140px]" />
        {urlError && <p className="mt-1.5 text-[11px] text-red-400">{urlError}</p>}
      </div>
      <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
        <ActionBtn onClick={encode} variant="info">Encode</ActionBtn>
        <ActionBtn onClick={decode} variant="primary">Decode</ActionBtn>
      </div>
      <div className="flex flex-col min-h-0 flex-1">
        <Label>Kết quả</Label>
        <TextArea value={output} onChange={undefined} readOnly placeholder="Kết quả" rows={14} className="flex-1 min-h-[140px]" />
      </div>
    </div>
  );
}

// ——— Base64 Tab ———
function Base64Tab() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [b64Error, setB64Error] = useState<string | null>(null);

  const encode = () => {
    setB64Error(null);
    try {
      setOutput(btoa(unescape(encodeURIComponent(input))));
    } catch (e) {
      setB64Error(e instanceof Error ? e.message : 'Lỗi encode');
      setOutput('');
    }
  };

  const decode = () => {
    setB64Error(null);
    try {
      setOutput(decodeURIComponent(escape(atob(input.replace(/\s/g, '')))));
    } catch (e) {
      setB64Error(e instanceof Error ? e.message : 'Chuỗi không phải Base64 hợp lệ');
      setOutput('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 h-full min-h-0 items-stretch">
      <div className="flex flex-col min-h-0 flex-1">
        <Label>Nhập chuỗi</Label>
        <TextArea value={input} onChange={setInput} placeholder="Văn bản hoặc Base64" rows={14} className="flex-1 min-h-[140px]" />
        {b64Error && <p className="mt-1.5 text-[11px] text-red-400">{b64Error}</p>}
      </div>
      <div className="flex flex-col justify-center gap-2.5 flex-shrink-0">
        <ActionBtn onClick={encode} variant="success">Encode</ActionBtn>
        <ActionBtn onClick={decode} variant="primary">Decode</ActionBtn>
      </div>
      <div className="flex flex-col min-h-0 flex-1">
        <Label>Kết quả</Label>
        <TextArea value={output} onChange={undefined} readOnly placeholder="Kết quả" rows={14} className="flex-1 min-h-[140px]" />
      </div>
    </div>
  );
}

const TAB_STYLES: Record<TabId, { active: string; icon: string }> = {
  jwt: { active: 'border-violet-500 text-violet-400 bg-violet-500/10', icon: 'token' },
  json: { active: 'border-accent text-accent bg-accent/10', icon: 'data_object' },
  url: { active: 'border-emerald-500 text-emerald-400 bg-emerald-500/10', icon: 'link' },
  base64: { active: 'border-amber-500 text-amber-400 bg-amber-500/10', icon: 'code' },
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'jwt', label: 'JWT' },
  { id: 'json', label: 'JSON' },
  { id: 'url', label: 'URL' },
  { id: 'base64', label: 'Base64' },
];

export default function ITToolboxModal({ open, onClose }: ITToolboxModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('jwt');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-sidebar border border-white/10 rounded-2xl shadow-2xl w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-labelledby="it-toolbox-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h2 id="it-toolbox-title" className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="material-symbols-outlined text-accent text-[20px]">build</span>
            IT Tool box
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex border-b border-white/10 px-2 gap-0.5 flex-shrink-0 overflow-x-auto">
          {TABS.map(({ id, label }) => {
            const style = TAB_STYLES[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition whitespace-nowrap ${
                  activeTab === id
                    ? style.active
                    : 'border-transparent text-text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{style.icon}</span>
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-hidden p-5 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'json' && <JsonTab />}
            {activeTab === 'jwt' && <JwtTab />}
            {activeTab === 'url' && <UrlTab />}
            {activeTab === 'base64' && <Base64Tab />}
          </div>
        </div>
      </div>
    </div>
  );
}

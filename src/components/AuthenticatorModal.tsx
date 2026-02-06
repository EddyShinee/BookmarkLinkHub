import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuthenticatorEntries, type AuthenticatorEntry } from '../hooks/useAuthenticatorEntries';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';
import { supabaseUrlDisplay } from '../lib/supabaseClient';
import { generateTOTP, getTimeRemaining } from '../lib/totp';

const TOTP_STEP = 30;

/** Màu avatar theo issuer (ổn định, dễ phân biệt) */
const ENTRY_COLORS = [
  { bg: 'from-violet-500 to-purple-600', border: 'border-violet-400/50', ring: 'ring-violet-400/20' },
  { bg: 'from-blue-500 to-cyan-500', border: 'border-blue-400/50', ring: 'ring-blue-400/20' },
  { bg: 'from-emerald-500 to-teal-500', border: 'border-emerald-400/50', ring: 'ring-emerald-400/20' },
  { bg: 'from-amber-500 to-orange-500', border: 'border-amber-400/50', ring: 'ring-amber-400/20' },
  { bg: 'from-rose-500 to-pink-500', border: 'border-rose-400/50', ring: 'ring-rose-400/20' },
  { bg: 'from-indigo-500 to-blue-600', border: 'border-indigo-400/50', ring: 'ring-indigo-400/20' },
  { bg: 'from-fuchsia-500 to-pink-600', border: 'border-fuchsia-400/50', ring: 'ring-fuchsia-400/20' },
  { bg: 'from-sky-500 to-blue-500', border: 'border-sky-400/50', ring: 'ring-sky-400/20' },
];

function getEntryColor(issuer: string, index: number) {
  let n = index;
  for (let i = 0; i < (issuer || '').length; i++) n = (n * 31 + issuer.charCodeAt(i)) >>> 0;
  return ENTRY_COLORS[Math.abs(n) % ENTRY_COLORS.length];
}

function useTotpTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

interface AuthenticatorModalProps {
  open: boolean;
  onClose: () => void;
  userId: string | undefined;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase text-text-muted tracking-wider mb-1">
      {children}
    </label>
  );
}

export default function AuthenticatorModal({ open, onClose, userId }: AuthenticatorModalProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const { entries, loading, addEntry, deleteEntry, updateOrder, refetch } = useAuthenticatorEntries(userId);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [addMode, setAddMode] = useState<'qr' | 'manual'>('qr');
  const [qrSubMode, setQrSubMode] = useState<'upload' | 'capture' | null>(null);
  const [manualIssuer, setManualIssuer] = useState('');
  const [manualAccount, setManualAccount] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [qrDecodeError, setQrDecodeError] = useState<string | null>(null);

  useTotpTick();

  useEffect(() => {
    if (open && userId) refetch();
  }, [open, userId, refetch]);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
  }, []);

  const handleAddManual = useCallback(async () => {
    setAddError(null);
    if (!manualSecret.trim()) {
      setAddError(t.pleaseEnterSecret);
      return;
    }
    try {
      await addEntry(manualIssuer.trim(), manualAccount.trim(), manualSecret.trim());
      setManualIssuer('');
      setManualAccount('');
      setManualSecret('');
      setAddPanelOpen(false);
      setAddMode('qr');
      setQrSubMode(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi thêm tài khoản';
      const isSchemaCache = msg && /schema cache|could not find the table/i.test(msg);
      const suffix = isSchemaCache ? ` ${t.schemaCacheHint} ${t.connectedTo}: ${supabaseUrlDisplay}` : '';
      setAddError(msg + suffix);
    }
  }, [addEntry, manualIssuer, manualAccount, manualSecret, t]);

  const handleCloseAddPanel = useCallback(() => {
    setAddPanelOpen(false);
    setAddMode('qr');
    setQrSubMode(null);
    setAddError(null);
    setManualIssuer('');
    setManualAccount('');
    setManualSecret('');
    setCapturedImageUrl(null);
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setQrDecodeError(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
  }, [imagePreviewUrl, capturedImageUrl]);

  const [searchQuery, setSearchQuery] = useState('');
  const filteredEntries = entries.filter(
    (e) =>
      !searchQuery.trim() ||
      e.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.account_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = entries.findIndex((e) => e.id === activeId);
      const newIndex = entries.findIndex((e) => e.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(entries, oldIndex, newIndex);
      updateOrder(next);
    },
    [entries, updateOrder]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/5 ${
          addPanelOpen
            ? 'w-[95vw] max-w-[960px] max-h-[90vh] bg-[#182234]'
            : 'w-full max-w-[420px] max-h-[800px] h-[75vh] bg-[#151b28]'
        }`}
        role="dialog"
        aria-labelledby="authenticator-title"
        onClick={(e) => e.stopPropagation()}
      >
        {!userId ? (
          <>
            <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
              <h2 id="authenticator-title" className="text-xl font-bold tracking-tight text-white">
                {t.authenticator}
              </h2>
              <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#90a4cb] hover:text-white hover:bg-white/5" aria-label={t.close}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-[#90a4cb] text-sm py-6 px-6">{t.loginToUseAuthenticator}</p>
          </>
        ) : addPanelOpen ? (
          <AddEntryPanel
              t={t}
              addMode={addMode}
              setAddMode={setAddMode}
              qrSubMode={qrSubMode}
              setQrSubMode={setQrSubMode}
              manualIssuer={manualIssuer}
              setManualIssuer={setManualIssuer}
              manualAccount={manualAccount}
              setManualAccount={setManualAccount}
              manualSecret={manualSecret}
              setManualSecret={setManualSecret}
              onAddManual={handleAddManual}
              onClose={handleCloseAddPanel}
              addError={addError}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              imagePreviewUrl={imagePreviewUrl}
              setImagePreviewUrl={setImagePreviewUrl}
              capturedImageUrl={capturedImageUrl}
              setCapturedImageUrl={setCapturedImageUrl}
              qrDecodeError={qrDecodeError}
              setQrDecodeError={setQrDecodeError}
              onEntryAdded={() => {
                handleCloseAddPanel();
                refetch();
              }}
              userId={userId}
            />
        ) : (
          <>
            <div className="flex flex-col gap-5 p-6 pb-2 z-10 bg-[#151b28]/95 backdrop-blur-sm sticky top-0 border-b border-white/5">
              <div className="flex items-center justify-between">
                <h1 id="authenticator-title" className="text-white text-2xl font-bold tracking-tight">
                  {t.authenticator}
                </h1>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                  aria-label={t.close}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-accent transition-colors">
                  <span className="material-symbols-outlined text-[20px]">search</span>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchAccounts}
                  className="block w-full pl-11 pr-4 py-3 rounded-xl bg-[#1e2532] border-none text-white placeholder-gray-500 focus:ring-1 focus:ring-accent focus:bg-[#232b3a] transition-all text-sm font-medium"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 pb-24 relative">
              {loading ? (
                <p className="text-[#90a4cb] text-sm py-6">Đang tải...</p>
              ) : filteredEntries.length === 0 ? (
                <p className="text-[#90a4cb] text-sm py-6">{entries.length === 0 ? t.noAccountsYet : 'Không có kết quả.'}</p>
              ) : searchQuery.trim() ? (
                filteredEntries.map((entry, idx) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onCopy={handleCopyCode}
                    onDelete={() => deleteEntry(entry.id)}
                    t={t}
                    accentColor={getEntryColor(entry.issuer ?? '', idx)}
                  />
                ))
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    {entries.map((entry, idx) => (
                      <SortableEntryRow
                        key={entry.id}
                        entry={entry}
                        index={idx}
                        onCopy={handleCopyCode}
                        onDelete={() => deleteEntry(entry.id)}
                        t={t}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#151b28] to-transparent pointer-events-none z-10" aria-hidden />
            </div>
            <div className="absolute bottom-6 right-6 z-20">
              <button
                type="button"
                onClick={() => setAddPanelOpen(true)}
                className="w-14 h-14 bg-accent rounded-full shadow-[0_0_20px_-5px_rgba(129,140,248,0.5)] flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all group"
                aria-label={t.addAccount}
              >
                <span className="material-symbols-outlined text-[28px] group-hover:rotate-90 transition-transform duration-300">add</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type AccentColor = (typeof ENTRY_COLORS)[number];

function EntryRow({
  entry,
  onCopy,
  onDelete,
  t,
  accentColor,
}: {
  entry: AuthenticatorEntry;
  onCopy: (code: string) => void;
  onDelete: () => void;
  t: ReturnType<typeof getT>;
  accentColor?: AccentColor;
}) {
  const [code, setCode] = useState('------');
  const [copied, setCopied] = useState(false);
  const remaining = getTimeRemaining(TOTP_STEP);
  const progressPct = (remaining / TOTP_STEP) * 100;
  const isLow = remaining <= 5;
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;
  const color = accentColor ?? ENTRY_COLORS[0];

  useEffect(() => {
    let cancelled = false;
    generateTOTP(entry.secret, TOTP_STEP).then((c) => {
      if (!cancelled) setCode(c);
    }).catch(() => {
      if (!cancelled) setCode('------');
    });
    return () => { cancelled = true; };
  }, [entry.secret, remaining]);

  const handleCopy = () => {
    onCopy(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const displayCode = code !== '------' ? `${code.slice(0, 3)} ${code.slice(3)}` : '------';
  const initial = (entry.issuer || entry.account_name || 'A').charAt(0).toUpperCase();

  return (
    <div
      className={`group relative flex items-center justify-between p-3.5 rounded-xl transition-all cursor-pointer border-l-4 ${color.border} hover:bg-[#1e2532] hover:shadow-md hover:ring-1 ${color.ring} border-y border-r border-transparent hover:border-white/5`}
      onClick={handleCopy}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center overflow-hidden shadow-md ring-2 ring-white/20`}>
          <span className="text-white font-bold text-lg drop-shadow">{initial}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-white font-semibold text-[15px] truncate">{entry.issuer || 'Account'}</span>
          <span className="text-[#90a4cb] text-xs truncate">{entry.account_name || ''}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-mono font-semibold text-lg tracking-wider transition-colors ${isLow ? 'text-red-400 animate-pulse' : 'text-white group-hover:text-accent'}`}>
          {displayCode}
        </span>
        <div className="relative w-[28px] h-[28px] flex items-center justify-center shrink-0" title={`${remaining}s`}>
          <svg className="transform -rotate-90 w-full h-full drop-shadow-sm" viewBox="0 0 28 28">
            <circle cx="14" cy="14" fill="transparent" r={radius} stroke="#1e293b" strokeWidth="2.5" />
            <circle
              className="transition-all duration-1000"
              cx="14"
              cy="14"
              fill="transparent"
              r={radius}
              stroke={isLow ? '#ef4444' : 'currentColor'}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              strokeWidth="2.5"
              style={{ color: 'var(--tw-accent, #818CF8)' }}
            />
          </svg>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#90a4cb] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          aria-label={t.delete}
        >
          <span className="material-symbols-outlined text-[18px]">delete_outline</span>
        </button>
      </div>
      {copied && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e2532]/95 rounded-xl pointer-events-none">
          <span className="text-accent font-medium text-sm flex items-center gap-1 drop-shadow">
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            {t.copied}
          </span>
        </div>
      )}
    </div>
  );
}

function SortableEntryRow({
  entry,
  index,
  onCopy,
  onDelete,
  t,
}: {
  entry: AuthenticatorEntry;
  index: number;
  onCopy: (code: string) => void;
  onDelete: () => void;
  t: ReturnType<typeof getT>;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const accentColor = getEntryColor(entry.issuer ?? '', index);

  return (
    <div ref={setNodeRef} style={style} className={`flex items-stretch gap-0 ${isDragging ? 'opacity-70 scale-[0.98] z-50' : ''}`}>
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-8 shrink-0 cursor-grab active:cursor-grabbing text-[#64748b] hover:text-[#94a3b8] touch-none"
        aria-label={t.dragDrop}
      >
        <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
      </div>
      <div className="flex-1 min-w-0">
        <EntryRow entry={entry} onCopy={onCopy} onDelete={onDelete} t={t} accentColor={accentColor} />
      </div>
    </div>
  );
}

interface AddEntryPanelProps {
  t: ReturnType<typeof getT>;
  addMode: 'qr' | 'manual';
  setAddMode: (m: 'qr' | 'manual') => void;
  qrSubMode: 'upload' | 'capture' | null;
  setQrSubMode: (m: 'upload' | 'capture' | null) => void;
  manualIssuer: string;
  setManualIssuer: (s: string) => void;
  manualAccount: string;
  setManualAccount: (s: string) => void;
  manualSecret: string;
  setManualSecret: (s: string) => void;
  onAddManual: () => void;
  onClose: () => void;
  addError: string | null;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  imagePreviewUrl: string | null;
  setImagePreviewUrl: (s: string | null) => void;
  capturedImageUrl: string | null;
  setCapturedImageUrl: (s: string | null) => void;
  qrDecodeError: string | null;
  setQrDecodeError: (s: string | null) => void;
  onEntryAdded: () => void;
  userId: string;
}

function AddEntryPanel(props: AddEntryPanelProps) {
  const {
    t,
    addMode,
    setAddMode,
    setQrSubMode,
    manualIssuer,
    setManualIssuer,
    manualAccount,
    setManualAccount,
    manualSecret,
    setManualSecret,
    onAddManual,
    onClose,
    addError,
    setSelectedFile,
    setImagePreviewUrl,
    setCapturedImageUrl,
    setQrDecodeError,
    onEntryAdded,
    userId,
  } = props;

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const currentImageUrl = props.imagePreviewUrl || props.capturedImageUrl;

  const setFileFromFile = useCallback(
    (file: File) => {
      if (!file || !file.type.startsWith('image/')) return;
      setQrDecodeError(null);
      setSelectedFile(file);
      if (props.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(props.imagePreviewUrl);
      setCapturedImageUrl(null);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.onerror = () => {
        setQrDecodeError(t.decodeError);
      };
      reader.readAsDataURL(file);
    },
    [props.imagePreviewUrl, setImagePreviewUrl, setCapturedImageUrl, setSelectedFile, setQrDecodeError, t.decodeError]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileFromFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFileFromFile(file);
  };

  const handleCaptureScreen = useCallback(() => {
    setQrDecodeError(null);
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setQrDecodeError(t.captureNotAvailable);
      return;
    }
    chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (res: { ok?: boolean; dataUrl?: string; error?: string } | undefined) => {
      const err = chrome.runtime.lastError;
      if (err) {
        setQrDecodeError(t.captureError + (err.message ? ` (${err.message})` : ''));
        return;
      }
      if (res?.ok && res.dataUrl) {
        if (props.capturedImageUrl) URL.revokeObjectURL(props.capturedImageUrl);
        setCapturedImageUrl(res.dataUrl);
      } else if (res && !res.ok) {
        setQrDecodeError(t.captureError + (res.error ? ` (${res.error})` : ''));
      }
    });
  }, [setCapturedImageUrl, setQrDecodeError, props.capturedImageUrl, t]);

  return (
    <>
      <div className="flex items-center justify-between p-6 border-b border-[#314368] shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-white">{t.addNewAuthenticator}</h1>
          <p className="text-sm text-[#90a4cb]">{t.chooseHowToAdd}</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#90a4cb] hover:text-white hover:bg-white/5 transition-colors" aria-label={t.close}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {addMode === 'manual' ? (
        <div className="overflow-y-auto p-6 md:p-8">
          <div className="max-w-md space-y-4">
            <div>
              <Label>{t.issuer}</Label>
              <input
                type="text"
                value={manualIssuer}
                onChange={(e) => setManualIssuer(e.target.value)}
                placeholder="Google"
                className="w-full px-3 py-2.5 rounded-lg border border-[#314368] bg-[#1e2532] text-sm text-white placeholder-[#90a4cb] focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <Label>{t.accountName}</Label>
              <input
                type="text"
                value={manualAccount}
                onChange={(e) => setManualAccount(e.target.value)}
                placeholder="user@gmail.com"
                className="w-full px-3 py-2.5 rounded-lg border border-[#314368] bg-[#1e2532] text-sm text-white placeholder-[#90a4cb] focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <Label>{t.secretBase32}</Label>
              <input
                type="text"
                value={manualSecret}
                onChange={(e) => setManualSecret(e.target.value)}
                placeholder="JBSWY3DPEHPK3PXP"
                className="w-full px-3 py-2.5 rounded-lg border border-[#314368] bg-[#1e2532] text-sm text-white font-mono placeholder-[#90a4cb] focus:ring-1 focus:ring-accent"
              />
            </div>
            {addError && <p className="text-sm text-red-400">{addError}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onAddManual} className="px-6 py-2.5 rounded-lg bg-accent/20 text-accent border border-accent/50 text-sm font-semibold hover:bg-accent/30 transition-colors">
                {t.add}
              </button>
              <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-lg border border-[#314368] text-sm font-medium text-white hover:bg-white/5 transition-colors">
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-y-auto p-6 md:p-8 flex-1 min-h-0">
            <div className="flex flex-col md:flex-row gap-8 items-stretch">
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-accent">qr_code_scanner</span>
                  <h2 className="text-base font-semibold text-white">{t.scanQRCode}</h2>
                </div>
                <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-[#314368] ring-2 ring-transparent ring-offset-2 ring-offset-[#182234] focus-within:ring-accent">
                  {currentImageUrl ? (
                    <div className="absolute inset-0 flex flex-col">
                      <QRImageCropAndDecode
                        t={t}
                        imageUrl={currentImageUrl}
                        userId={userId}
                        onEntryAdded={onEntryAdded}
                        onError={props.setQrDecodeError}
                        embedded
                        fileType={props.selectedFile?.type}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-[#1e2532] flex items-center justify-center p-8 md:p-12">
                        <div className="relative w-full h-full max-w-[280px] max-h-[280px] flex items-center justify-center">
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white/80 rounded-tl-lg" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white/80 rounded-tr-lg" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white/80 rounded-bl-lg" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white/80 rounded-br-lg" />
                          <div className="absolute left-0 right-0 h-0.5 bg-accent animate-pulse opacity-80" style={{ boxShadow: '0 0 15px rgba(129,140,248,0.8)' }} />
                        </div>
                      </div>
                      <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-[#90a4cb] px-4">
                        {t.uploadScreenshotQR}
                      </p>
                    </>
                  )}
                  {props.qrDecodeError && (
                    <p className="absolute top-2 left-2 right-2 text-xs text-red-400 bg-black/60 px-2 py-1 rounded">{props.qrDecodeError}</p>
                  )}
                </div>
                <p className="text-sm text-[#90a4cb] text-center">{t.pointCameraAtQR}</p>
              </div>

              <div className="flex md:flex-col items-center justify-center gap-4 text-[#90a4cb] shrink-0">
                <div className="h-px w-full md:w-px md:h-16 bg-[#314368]" />
                <span className="text-xs font-bold uppercase tracking-wider px-2">OR</span>
                <div className="h-px w-full md:w-px md:h-16 bg-[#314368]" />
              </div>

              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-accent">upload_file</span>
                  <h2 className="text-base font-semibold text-white">{t.uploadQRImage}</h2>
                </div>
                <label
                  className={`flex-1 min-h-[240px] flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-all cursor-pointer p-6 text-center group ${
                    isDragging ? 'border-accent bg-accent/10' : 'border-[#314368] bg-white/5 hover:bg-white/10 hover:border-accent/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.svg,.svgz"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-full bg-[#182234] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-3xl text-accent">cloud_upload</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-bold text-white">{t.clickOrDragFile}</p>
                    <p className="text-sm text-[#90a4cb] max-w-[200px]">{t.supportsPNGJPG}</p>
                  </div>
                  <span
                    className="mt-2 px-4 py-2 bg-[#182234] border border-[#314368] rounded-lg text-sm font-medium text-white shadow-sm hover:bg-[#222f49] transition-colors"
                    onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                  >
                    {t.selectFile}
                  </span>
                </label>
                <p className="text-sm text-[#90a4cb] text-center">{t.uploadScreenshotQR}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={handleCaptureScreen}
                    className="px-3 py-2 rounded-lg text-xs font-medium border border-[#314368] text-[#90a4cb] hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {t.captureScreen}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#182234] border-t border-[#314368] p-6 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setAddMode('manual')}
              className="flex items-center gap-2 text-sm text-[#90a4cb] hover:text-white transition-colors group"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:text-accent transition-colors">keyboard</span>
              <span>{t.cantScanEnterManually}</span>
            </button>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg border border-[#314368] text-sm font-medium text-white hover:bg-white/5 transition-colors">
                {t.cancel}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

interface QRImageCropAndDecodeProps {
  t: ReturnType<typeof getT>;
  imageUrl: string;
  userId: string;
  onEntryAdded: () => void;
  onError: (msg: string | null) => void;
  embedded?: boolean;
  fileType?: string;
}

function QRImageCropAndDecode({ t, imageUrl, userId, onEntryAdded, onError, embedded, fileType }: QRImageCropAndDecodeProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [decoding, setDecoding] = useState(false);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const { addEntry } = useAuthenticatorEntries(userId);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    imgRef.current = img;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setCrop(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCrop({
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      w: Math.abs(x - dragStart.x),
      h: Math.abs(y - dragStart.y),
    });
  };

  const handleMouseUp = () => {
    setDragStart(null);
  };

  const decodeQR = useCallback(async () => {
    if (!imgRef.current || !canvasRef.current) return;
    if (fileType === 'image/svg+xml') {
      onError(t.svgNotSupportedForScan);
      return;
    }
    const img = imgRef.current;
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      onError(t.imageNotLoaded);
      return;
    }
    setDecoding(true);
    onError(null);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0 && crop && crop.w > 10 && crop.h > 10) {
        const scaleX = img.naturalWidth / rect.width;
        const scaleY = img.naturalHeight / rect.height;
        sx = Math.round(crop.x * scaleX);
        sy = Math.round(crop.y * scaleY);
        sw = Math.round(crop.w * scaleX);
        sh = Math.round(crop.h * scaleY);
      }
      if (sw < 10 || sh < 10) {
        sw = img.naturalWidth;
        sh = img.naturalHeight;
      }
      let imageData: ImageData;
      try {
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        imageData = ctx.getImageData(0, 0, sw, sh);
      } catch (canvasErr: unknown) {
        const isSecurity = canvasErr instanceof Error && (canvasErr.name === 'SecurityError' || /tainted|getImageData/i.test(canvasErr.message));
        onError(isSecurity ? t.canvasTaintedError : (canvasErr instanceof Error ? canvasErr.message : t.decodeError));
        return;
      }

      const jsQR = (await import('jsqr')).default;
      const tryDecode = (data: Uint8ClampedArray, w: number, h: number) => jsQR(data, w, h);
      let result = tryDecode(imageData.data, imageData.width, imageData.height);
      if (!result?.data) {
        const inverted = new Uint8ClampedArray(imageData.data.length);
        for (let i = 0; i < imageData.data.length; i += 4) {
          inverted[i] = 255 - imageData.data[i];
          inverted[i + 1] = 255 - imageData.data[i + 1];
          inverted[i + 2] = 255 - imageData.data[i + 2];
          inverted[i + 3] = imageData.data[i + 3];
        }
        result = tryDecode(inverted, imageData.width, imageData.height);
      }
      if (!result?.data && (sw > 1000 || sh > 1000)) {
        try {
          const maxDim = 800;
          const scale = maxDim / Math.max(sw, sh);
          const tw = Math.round(sw * scale);
          const th = Math.round(sh * scale);
          canvas.width = tw;
          canvas.height = th;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
          imageData = ctx.getImageData(0, 0, tw, th);
          result = tryDecode(imageData.data, imageData.width, imageData.height);
          if (!result?.data) {
            const inverted = new Uint8ClampedArray(imageData.data.length);
            for (let i = 0; i < imageData.data.length; i += 4) {
              inverted[i] = 255 - imageData.data[i];
              inverted[i + 1] = 255 - imageData.data[i + 1];
              inverted[i + 2] = 255 - imageData.data[i + 2];
              inverted[i + 3] = imageData.data[i + 3];
            }
            result = tryDecode(inverted, imageData.width, imageData.height);
          }
        } catch (_) {
          /* keep result from first attempt */
        }
      }
      if (!result || !result.data) {
        onError(t.qrNotFound);
        return;
      }

      const data = result.data;
      if (!data.startsWith('otpauth://')) {
        onError(t.invalidOtpauth);
        return;
      }

      const url = new URL(data.replace('otpauth://', 'https://x/'));
      const secret = url.searchParams.get('secret');
      if (!secret) {
        onError(t.noSecretInQR);
        return;
      }
      const pathLabel = url.pathname.replace(/^\/totp\/?/i, '').replace(/^\//, '');
      const label = decodeURIComponent(pathLabel || '');
      const issuerParam = url.searchParams.get('issuer') || '';
      const issuer = issuerParam ? decodeURIComponent(issuerParam) : (label.split(':')[0] || 'Unknown');
      const accountName = label.includes(':') ? label.split(':').slice(1).join(':').trim() : label || 'Account';

      try {
        await addEntry(issuer, accountName, secret);
        onEntryAdded();
      } catch (saveErr: unknown) {
        const saveMsg = saveErr instanceof Error ? saveErr.message : (saveErr && typeof saveErr === 'object' && 'message' in saveErr) ? String((saveErr as { message: unknown }).message) : typeof saveErr === 'string' ? saveErr : '';
        const isSchemaCache = saveMsg && /schema cache|could not find the table/i.test(saveMsg);
        const hint = isSchemaCache ? ` ${t.schemaCacheHint} ${t.connectedTo}: ${supabaseUrlDisplay}` : '';
        onError(saveMsg ? `${t.saveAccountError} ${saveMsg}.${hint}` : t.saveAccountError);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message) : typeof err === 'string' ? err : '';
      onError(msg && msg !== 'undefined' ? msg : t.decodeError);
    } finally {
      setDecoding(false);
    }
  }, [crop, fileType, addEntry, onEntryAdded, onError, t]);

  return (
    <div className={embedded ? 'absolute inset-0 flex flex-col overflow-auto p-3' : 'space-y-3'}>
      {!embedded && <p className="text-[11px] text-text-muted">{t.selectRegionThenScan}</p>}
      <div
        ref={containerRef}
        className={`relative overflow-hidden flex items-center justify-center ${embedded ? 'flex-1 min-h-0 rounded-lg bg-black/20' : 'border border-white/10 rounded-lg bg-black/20 max-h-[280px]'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt="QR"
          className={embedded ? 'max-w-full max-h-full object-contain select-none' : 'max-w-full max-h-[260px] object-contain select-none'}
          draggable={false}
          onLoad={handleImageLoad}
          style={{ pointerEvents: 'none' }}
        />
        {crop && crop.w > 5 && crop.h > 5 && (
          <div
            className="absolute border-2 border-accent pointer-events-none"
            style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
          />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button
        type="button"
        onClick={decodeQR}
        disabled={decoding}
        className={embedded ? 'mt-2 shrink-0 px-4 py-2 rounded-lg text-xs font-medium bg-accent/20 text-accent border border-accent/50 hover:bg-accent/30 disabled:opacity-50' : 'px-4 py-2 rounded-lg text-xs font-medium bg-accent/20 text-accent border border-accent/50 hover:bg-accent/30 disabled:opacity-50'}
      >
        {decoding ? t.decoding : t.scanCode}
      </button>
    </div>
  );
}

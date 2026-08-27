import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { chromeStorageAdapter } from '../lib/chromeStorageAdapter';
import { useUnsplashBackground } from '../hooks/useUnsplashBackground';
import { prefetchImage } from '../lib/imageCache';
import Toast, { type ToastType } from '../components/Toast';

const DEFAULT_LANDING_BACKGROUND =
  'https://images.unsplash.com/photo-1769878539345-2d8c4769209d?q=80&w=1483&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

function CardSheen() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-violet-500 via-accent to-cyan-400" />
      <div className="pointer-events-none absolute -top-20 left-1/2 h-36 w-48 -translate-x-1/2 rounded-full bg-white/25 blur-3xl" />
    </>
  );
}

function ghostHeaderBtn(isLight: boolean, enabled = true) {
  if (!enabled) {
    return isLight
      ? 'bg-slate-200/60 border-black/10 text-slate-400 cursor-not-allowed opacity-60'
      : 'bg-black/20 border-white/10 text-slate-400 cursor-not-allowed opacity-60';
  }
  return isLight
    ? 'bg-white/80 border-black/10 text-slate-800 hover:bg-white hover:shadow-sm'
    : 'bg-white/8 border-white/15 text-white hover:bg-white/15';
}

export default function Landing() {
  const settings = useSettings();
  const t = getT(settings.locale);
  const navigate = useNavigate();
  const { user } = useAuth();

  type TodoPriority = 'low' | 'medium' | 'high';
  type LandingTodo = {
    id: string;
    text: string;
    done: boolean;
    priority: TodoPriority;
    createdAt: number;
  };

  const [now, setNow] = useState(() => new Date());
  const [bgSettingsOpen, setBgSettingsOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [localDisplayName, setLocalDisplayName] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState(
    settings.landingBackgroundImageUrl ??
      settings.backgroundImageUrl ??
      DEFAULT_LANDING_BACKGROUND
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [todos, setTodos] = useState<LandingTodo[]>([]);
  const [todoInput, setTodoInput] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [sortBy, setSortBy] = useState<'created' | 'priority'>('created');
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const [pomodoroTotalSeconds, setPomodoroTotalSeconds] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');
  const [pomodoroCustomMinutes, setPomodoroCustomMinutes] = useState('25');
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    actionLabel?: string;
    onAction?: () => void;
    duration?: number;
  }>({
    message: '',
    type: 'info',
  });
  const pomodoroModeRef = useRef(pomodoroMode);
  pomodoroModeRef.current = pomodoroMode;
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [mainScrolled, setMainScrolled] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        navigate('/bookmarks');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  // Ask for full name if missing
  useEffect(() => {
    if (!user) {
      setNameModalOpen(false);
      setLocalDisplayName(null);
      return;
    }
    const metaName = (user.user_metadata?.full_name as string | undefined) ?? null;
    if (metaName && metaName.trim()) {
      setLocalDisplayName(metaName.trim());
      setNameModalOpen(false);
    } else {
      setNameModalOpen(true);
    }
  }, [user]);

  useEffect(() => {
    if (!pomodoroRunning) return;
    const locale = settings.locale;
    const id = setInterval(() => {
      setPomodoroSeconds((prev) => {
        if (prev <= 1) {
          const mode = pomodoroModeRef.current;
          const endedWork = mode === 'work';
          const nextMode = endedWork ? 'break' : 'work';
          const nextSeconds = nextMode === 'work' ? 25 * 60 : 5 * 60;
          queueMicrotask(() => {
            const tt = getT(locale);
            setToast({
              message: endedWork ? tt.landingPomodoroToastWorkDone : tt.landingPomodoroToastBreakDone,
              type: 'info',
            });
          });
          setPomodoroMode(nextMode);
          setPomodoroTotalSeconds(nextSeconds);
          return nextSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoroRunning, settings.locale]);

  // Load todos: from DB if logged in, otherwise from local storage (extension/localStorage)
  useEffect(() => {
    const userId = user?.id;
    const load = async () => {
      try {
        if (userId) {
          const { data, error } = await supabase
            .from('landing_todos')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
          if (!error && Array.isArray(data)) {
            setTodos(
              data.map((row: any) => ({
                id: String(row.id),
                text: String(row.text ?? ''),
                done: Boolean(row.done),
                priority: (row.priority as TodoPriority) ?? 'medium',
                createdAt: row.created_at ? Date.parse(row.created_at as string) : Date.now(),
              }))
            );
            return;
          }
        }
        // Fallback to local storage if no user or DB error
        const raw = await chromeStorageAdapter.getItem('landing_todos');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setTodos(
              parsed.map((item: any) => ({
                id: String(item.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
                text: String(item.text ?? ''),
                done: Boolean(item.done),
                priority: (item.priority as TodoPriority) ?? 'medium',
                createdAt:
                  typeof item.createdAt === 'number'
                    ? item.createdAt
                    : Date.now(),
              }))
            );
          }
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [user?.id]);

  // Keep local storage cache in sync for offline/extension use
  useEffect(() => {
    chromeStorageAdapter.setItem('landing_todos', JSON.stringify(todos));
  }, [todos]);

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return t.landingGreetingMorning;
    if (hour < 18) return t.landingGreetingAfternoon;
    return t.landingGreetingEvening;
  }, [now, t]);

  const displayName =
    localDisplayName ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  const effectiveBackgroundImageUrl =
    settings.landingBackgroundImageUrl ??
    settings.backgroundImageUrl ??
    DEFAULT_LANDING_BACKGROUND;
  const hasImage = !!effectiveBackgroundImageUrl;
  const overlayOpacity = (settings.backgroundOverlayOpacity ?? 80) / 100;

  useEffect(() => {
    if (effectiveBackgroundImageUrl) {
      prefetchImage(effectiveBackgroundImageUrl);
    }
  }, [effectiveBackgroundImageUrl]);
  const pomodoroProgress =
    pomodoroTotalSeconds > 0 ? pomodoroSeconds / pomodoroTotalSeconds : 0;

  const dateStr = useMemo(
    () =>
      now.toLocaleDateString(settings.locale === 'vi' ? 'vi-VN' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [now, settings.locale]
  );

  const clockParts = useMemo(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const use12 = settings.timeFormat === '12';
    const h = use12 ? ((hours + 11) % 12) + 1 : hours;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const period = use12
      ? hours < 12
        ? settings.locale === 'vi'
          ? 'SA'
          : 'AM'
        : settings.locale === 'vi'
          ? 'CH'
          : 'PM'
      : null;
    return { hhmm: `${pad(h)}:${pad(minutes)}`, ss: pad(seconds), period };
  }, [now, settings.timeFormat, settings.locale]);

  const showPomodoro = settings.showLandingPomodoro ?? true;
  const showTodos = settings.showLandingTodos ?? true;
  const gridColsClass = 'grid-cols-1 md:grid-cols-3';
  const gridRowsClass = 'max-md:[grid-auto-rows:minmax(200px,auto)] md:[grid-auto-rows:40vh]';

  const unsplashEnabled =
    settings.autoBackgroundSource === 'unsplash' &&
    (settings.autoBackgroundScope === 'landing' ||
      settings.autoBackgroundScope === 'both');

  const {
    imageUrl: unsplashImageUrl,
    refresh: refreshUnsplash,
  } = useUnsplashBackground({
    enabled: unsplashEnabled,
    scope: 'landing',
    baseQuery: settings.autoBackgroundQuery ?? null,
    timeOfDayMode: settings.autoBackgroundTimeOfDayMode ?? 'off',
    morningQuery: settings.autoBackgroundMorningQuery ?? null,
    noonQuery: settings.autoBackgroundNoonQuery ?? null,
    eveningQuery: settings.autoBackgroundEveningQuery ?? null,
    intervalHours: settings.autoBackgroundIntervalHoursLanding ?? null,
  });

  const finalBackgroundImageUrl =
    (unsplashEnabled && unsplashImageUrl) || effectiveBackgroundImageUrl;

  const isLight = settings.theme === 'light';

  const glassCard = isLight
    ? 'relative overflow-hidden rounded-[28px] border border-white/80 bg-white/70 ring-1 ring-black/[0.05] backdrop-blur-2xl shadow-[0_24px_70px_rgba(15,23,42,0.14)]'
    : 'relative overflow-hidden rounded-[28px] border border-white/12 bg-zinc-950/40 ring-1 ring-white/[0.07] backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.55)]';

  const pomodoroShellClass = !showPomodoro
    ? ''
    : `${glassCard} px-4 py-5 sm:px-5 sm:py-6`;

  const heroShellClass = `${glassCard} px-5 py-6 sm:px-8 sm:py-8 md:px-10 md:py-10`;

  const todosShellClass = !showTodos
    ? ''
    : `${glassCard} px-4 py-4 sm:px-5 sm:py-5`;

  const panelStrong = isLight ? 'text-slate-800' : 'text-slate-200';
  const panelMuted = isLight ? 'text-slate-600' : 'text-slate-300';

  const modalDenseInput =
    'w-full px-2 py-1.5 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-accent/35 ' +
    (isLight
      ? 'bg-white border border-black/15 text-slate-900 placeholder:text-slate-400'
      : 'bg-black/40 border border-white/25 text-slate-50 placeholder:text-slate-400 focus:ring-white/60');

  const modalNumInput =
    'w-16 px-2 py-1 rounded-lg text-[11px] outline-none text-center focus:ring-2 focus:ring-accent/35 ' +
    (isLight
      ? 'bg-white border border-black/15 text-slate-900'
      : 'bg-black/40 border border-white/25 text-slate-50 focus:ring-white/60');

  const nameModalField =
    'w-full mb-4 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-accent/40 ' +
    (isLight
      ? 'bg-white border border-black/15 text-slate-900 placeholder:text-slate-400'
      : 'bg-black/60 border border-white/20 text-slate-50 placeholder:text-slate-500 focus:ring-white/70');

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={
          hasImage
            ? {
                backgroundImage: `url(${finalBackgroundImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }
            : {
                backgroundColor:
                  settings.landingBackgroundColor ?? settings.backgroundColor,
              }
        }
      />
      <div
        className="absolute inset-0"
        style={{
          background: isLight
            ? 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(248,250,252,0.55) 48%, rgba(226,232,240,0.72) 100%)'
            : 'radial-gradient(circle at top, rgba(15,23,42,0.28), rgba(15,23,42,0.72))',
          opacity: overlayOpacity,
        }}
      />
      <div className="landing-vignette" />
      <div className="landing-grain" />

      <div className="relative z-10 flex flex-col min-h-full w-full">
        <div className="flex-shrink-0 px-3 pt-3 sm:px-5 sm:pt-4">
          <div
            className={`mx-auto max-w-[1600px] flex items-center justify-between gap-2 rounded-2xl border px-2.5 py-2 sm:px-3 transition-shadow duration-300 ${
              isLight
                ? 'bg-white/70 border-white/80 backdrop-blur-xl shadow-[0_10px_40px_rgba(15,23,42,0.08)]'
                : 'bg-black/35 border-white/12 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.35)]'
            } ${
              mainScrolled
                ? isLight
                  ? 'shadow-[0_12px_36px_rgba(15,23,42,0.14)]'
                  : 'shadow-[0_16px_48px_rgba(0,0,0,0.55)]'
                : ''
            }`}
          >
            <div className="inline-flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-[0_8px_24px_rgba(129,140,248,0.45)]">
                <span className="material-symbols-outlined text-[18px]">hub</span>
              </div>
              <div className="min-w-0 hidden sm:block">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    isLight ? 'text-slate-800' : 'text-white'
                  }`}
                >
                  LinkHub
                </p>
                <p className={`flex items-center gap-1.5 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                  {dateStr}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (unsplashEnabled) {
                    refreshUnsplash();
                  }
                }}
                disabled={!unsplashEnabled}
                className={`inline-flex items-center justify-center gap-1 rounded-full max-sm:min-h-[44px] max-sm:min-w-[44px] sm:min-h-0 sm:min-w-0 px-2.5 py-1.5 sm:px-3 border text-[11px] transition ${ghostHeaderBtn(
                  isLight,
                  unsplashEnabled
                )}`}
                title={
                  unsplashEnabled
                    ? settings.locale === 'vi'
                      ? 'Đổi background ngay lập tức (Unsplash)'
                      : 'Change background now (Unsplash)'
                    : settings.locale === 'vi'
                      ? 'Bật Unsplash background trong Cài đặt để dùng nút này'
                      : 'Enable Unsplash background in Settings to use this button'
                }
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span className="hidden sm:inline">{t.landingChangeBackground}</span>
              </button>
              <button
                type="button"
                onClick={() => setBgSettingsOpen((o) => !o)}
                className={`inline-flex items-center justify-center gap-1 rounded-full max-sm:min-h-[44px] max-sm:px-3 sm:min-h-0 px-2.5 py-1.5 sm:px-3 border text-[11px] transition ${ghostHeaderBtn(
                  isLight
                )}`}
                aria-label={t.settings}
              >
                <span className="material-symbols-outlined text-[16px]">settings</span>
                <span className="hidden sm:inline">{t.settings}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/bookmarks?open=it-tools')}
                className={`hidden md:inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 border text-[11px] font-medium transition ${ghostHeaderBtn(
                  isLight
                )}`}
              >
                <span className="material-symbols-outlined text-[16px]">handyman</span>
                <span>{t.landingSecondaryCta}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/bookmarks')}
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-full max-sm:min-h-[44px] sm:min-h-0 bg-gradient-to-r from-violet-500 to-cyan-400 text-white px-3 py-1.5 sm:px-4 text-[10px] sm:text-[11px] font-semibold shadow-[0_10px_30px_rgba(129,140,248,0.4)] hover:brightness-110 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] motion-reduce:transform-none"
              >
                <span className="material-symbols-outlined text-[14px] sm:text-[16px]">bookmark</span>
                <span>{t.landingPrimaryCta}</span>
                <span className="hidden sm:inline ml-1 rounded border border-white/30 px-1 py-0.5 text-[9px] font-medium opacity-80">
                  {navigator.platform?.toUpperCase().includes('MAC') ? '⌘+B' : 'Ctrl+B'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div
          ref={mainScrollRef}
          onScroll={() => {
            const el = mainScrollRef.current;
            setMainScrolled(!!el && el.scrollTop > 8);
          }}
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-6 flex flex-col ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
        >
          <div className="w-full max-w-[1600px] mx-auto py-4 sm:py-6 pb-8 text-left flex-1 flex flex-col min-h-0 max-md:flex-none max-md:min-h-0 md:justify-center">
          <div className={`grid gap-6 sm:gap-8 lg:gap-10 items-stretch landing-stagger ${gridColsClass} ${gridRowsClass}`}>
            {/* Pomodoro column */}
            <div
              className={`landing-stagger-item h-full flex flex-col min-h-0 ${pomodoroShellClass}`}
            >
              {showPomodoro && (
                <>
              <CardSheen />
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] ${panelStrong}`}
                >
                  <span className="material-symbols-outlined text-[16px] text-emerald-400">timer</span>
                  Pomodoro
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    pomodoroMode === 'work'
                      ? isLight
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-emerald-500/20 text-emerald-300'
                      : isLight
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-sky-500/20 text-sky-300'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      pomodoroMode === 'work' ? 'bg-emerald-400' : 'bg-sky-400'
                    } ${pomodoroRunning ? 'animate-pulse' : ''}`}
                  />
                  {pomodoroMode === 'work'
                    ? settings.locale === 'vi'
                      ? 'Tập trung'
                      : 'Focus'
                    : settings.locale === 'vi'
                      ? 'Nghỉ'
                      : 'Break'}
                </span>
              </div>
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden mb-4 ${
                  isLight ? 'bg-black/10' : 'bg-white/10'
                }`}
              >
                <div
                  className={`h-full rounded-full shadow-[0_0_12px_rgba(52,211,153,0.9)] transition-all duration-300 ${
                    pomodoroMode === 'work' ? 'bg-emerald-400' : 'bg-sky-400'
                  }`}
                  style={{ width: `${pomodoroProgress * 100}%` }}
                />
              </div>

              <div className="flex-1 flex items-center justify-center mb-2 w-full">
                <div
                  className={`w-28 h-28 sm:w-32 sm:h-32 md:w-[156px] md:h-[156px] flex-shrink-0 ${
                    pomodoroRunning
                      ? pomodoroMode === 'break'
                        ? 'pomodoro-ring-break'
                        : 'pomodoro-ring-active'
                      : ''
                  }`}
                >
                <svg width="100%" height="100%" viewBox="0 0 80 80" className="max-w-full max-h-full">
                  {(() => {
                    const radius = 36;
                    const circumference = 2 * Math.PI * radius;
                    const clamped =
                      pomodoroProgress < 0 ? 0 : pomodoroProgress > 1 ? 1 : pomodoroProgress;
                    const offset = circumference * (1 - clamped);
                    const remainingMinutes = Math.max(
                      0,
                      Math.floor(pomodoroSeconds / 60)
                    );
                    const remainingSeconds = Math.max(0, pomodoroSeconds % 60);
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    const trackStroke = isLight
                      ? 'rgba(100,116,139,0.28)'
                      : 'rgba(148,163,184,0.28)';
                    const progressStroke =
                      pomodoroMode === 'break'
                        ? isLight
                          ? 'rgba(2,132,199,0.95)'
                          : 'rgba(125,211,252,0.95)'
                        : isLight
                          ? 'rgba(5,150,105,0.95)'
                          : 'rgba(52,211,153,0.95)';
                    const timeFill = isLight ? 'rgba(15,23,42,0.92)' : 'rgba(248,250,252,0.95)';
                    return (
                      <>
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke={trackStroke}
                          strokeWidth="5"
                          fill="transparent"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke={progressStroke}
                          strokeWidth="5"
                          fill="transparent"
                          strokeDasharray={`${circumference} ${circumference}`}
                          strokeDashoffset={offset}
                          strokeLinecap="round"
                          transform="rotate(-90 40 40)"
                        />
                        <text
                          x="40"
                          y="40"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={timeFill}
                          fontSize="14"
                          fontWeight="600"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {`${remainingMinutes}:${pad(remainingSeconds)}`}
                        </text>
                      </>
                    );
                  })()}
                </svg>
                </div>
              </div>

                  <div className="mt-auto space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPomodoroRunning((r) => !r)}
                    className="flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-900 text-[11px] font-semibold shadow-[0_8px_20px_rgba(16,185,129,0.28)] hover:brightness-110"
                  >
                    {pomodoroRunning
                      ? settings.locale === 'vi'
                        ? 'Tạm dừng'
                        : 'Pause'
                      : settings.locale === 'vi'
                      ? 'Bắt đầu'
                      : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPomodoroRunning(false);
                      const next = pomodoroMode === 'work' ? 25 * 60 : 5 * 60;
                      setPomodoroSeconds(next);
                      setPomodoroTotalSeconds(next);
                    }}
                    className={`px-3 py-2 rounded-xl text-[11px] border min-w-[80px] ${
                      isLight
                        ? 'bg-white/80 text-slate-800 border-black/10 hover:bg-white'
                        : 'bg-white/10 text-slate-100 hover:bg-white/20 border-white/20'
                    }`}
                  >
                    {settings.locale === 'vi' ? 'Đặt lại' : 'Reset'}
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setPomodoroMode('work');
                      setPomodoroRunning(false);
                      setPomodoroSeconds(25 * 60);
                      setPomodoroTotalSeconds(25 * 60);
                    }}
                    className={`flex-1 min-w-[100px] px-2 py-1.5 rounded-xl border text-[11px] font-medium ${
                      pomodoroMode === 'work'
                        ? isLight
                          ? 'bg-emerald-100 border-emerald-400/80 text-emerald-800'
                          : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : isLight
                          ? 'bg-white/60 border-black/10 text-slate-700'
                          : 'bg-white/5 border-white/15 text-slate-300'
                    }`}
                  >
                    {settings.locale === 'vi' ? '25 phút tập trung' : '25 min focus'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPomodoroMode('break');
                      setPomodoroRunning(false);
                      setPomodoroSeconds(5 * 60);
                      setPomodoroTotalSeconds(5 * 60);
                    }}
                    className={`flex-1 min-w-[100px] px-2 py-1.5 rounded-xl border text-[11px] font-medium ${
                      pomodoroMode === 'break'
                        ? isLight
                          ? 'bg-sky-100 border-sky-400/80 text-sky-800'
                          : 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                        : isLight
                          ? 'bg-white/60 border-black/10 text-slate-700'
                          : 'bg-white/5 border-white/15 text-slate-300'
                    }`}
                  >
                    {settings.locale === 'vi' ? '5 phút nghỉ' : '5 min break'}
                  </button>
                </div>

                    <div className={`flex items-center gap-2 text-[10px] flex-wrap ${panelMuted}`}>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={pomodoroCustomMinutes}
                    onChange={(e) => setPomodoroCustomMinutes(e.target.value)}
                    className={`w-20 px-2 py-1.5 rounded-xl text-[11px] outline-none text-center focus:ring-2 focus:ring-accent/40 ${
                      isLight
                        ? 'bg-white border border-black/15 text-slate-900'
                        : 'bg-black/40 border border-white/25 text-slate-50 focus:ring-white/60'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const minutes = parseInt(pomodoroCustomMinutes || '0', 10);
                      if (!Number.isFinite(minutes) || minutes <= 0) return;
                      const seconds = minutes * 60;
                      setPomodoroRunning(false);
                      setPomodoroSeconds(seconds);
                      setPomodoroTotalSeconds(seconds);
                    }}
                    className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] border text-center ${
                      isLight
                        ? 'bg-white/80 text-slate-800 border-black/10 hover:bg-white'
                        : 'bg-white/10 text-slate-100 hover:bg-white/20 border-white/20'
                    }`}
                  >
                    {settings.locale === 'vi' ? 'Áp dụng phút tùy chỉnh' : 'Apply custom minutes'}
                  </button>
                </div>
              </div>
              </>
              )}
            </div>

            <div
              className={`landing-stagger-item h-full flex flex-col justify-center ${heroShellClass}`}
            >
              <CardSheen />
              <div
                className={`landing-clock flex items-baseline justify-center gap-1.5 font-semibold leading-none ${
                  isLight
                    ? 'text-slate-900 [text-shadow:0_1px_0_rgba(255,255,255,0.6)]'
                    : 'drop-shadow-[0_16px_52px_rgba(0,0,0,0.95)] text-white'
                }`}
              >
                <span
                  className={`text-[52px] sm:text-[68px] md:text-[84px] ${
                    isLight
                      ? 'text-slate-900'
                      : 'bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent'
                  }`}
                >
                  {clockParts.hhmm}
                </span>
                <span
                  className={`text-[28px] sm:text-[36px] md:text-[44px] font-medium ${
                    isLight ? 'text-indigo-500' : 'text-cyan-300'
                  }`}
                >
                  :{clockParts.ss}
                </span>
                {clockParts.period && (
                  <span
                    className={`ml-1 text-[20px] sm:text-[28px] md:text-[34px] font-semibold ${
                      isLight ? 'text-slate-700' : 'text-white/80'
                    }`}
                  >
                    {clockParts.period}
                  </span>
                )}
              </div>
              <p
                className={`mt-5 text-lg sm:text-2xl md:text-[1.75rem] font-semibold tracking-tight text-center ${
                  isLight
                    ? 'text-slate-800'
                    : 'drop-shadow-[0_8px_32px_rgba(0,0,0,0.88)] text-white'
                }`}
              >
                {greeting}
                {displayName ? (
                  <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {`, ${displayName}`}
                  </span>
                ) : null}
                <span className={isLight ? 'text-slate-700' : 'text-white/90'}>.</span>
              </p>
              <p className={`mt-2 text-center text-[12px] sm:text-sm ${panelMuted}`}>
                {t.landingFocusQuestion}
              </p>
              <p
                className={`mt-3 inline-flex self-center items-center rounded-full border px-3 py-1 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] ${
                  isLight
                    ? 'border-black/10 bg-white/70 text-slate-600'
                    : 'border-white/15 bg-white/5 text-slate-300/90'
                }`}
              >
                {dateStr}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/bookmarks')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-900 px-3.5 py-1.5 text-[11px] font-semibold shadow-sm hover:shadow-md"
                >
                  <span className="material-symbols-outlined text-[15px]">bookmark</span>
                  {t.landingPrimaryCta}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/bookmarks?open=it-tools')}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium ${
                    isLight
                      ? 'border-black/10 bg-white/70 text-slate-800 hover:bg-white'
                      : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">handyman</span>
                  {t.landingSecondaryCta}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/bookmarks?open=authenticator')}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-medium ${
                    isLight
                      ? 'border-black/10 bg-white/70 text-slate-800 hover:bg-white'
                      : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">shield</span>
                  {t.landingOpenAuthenticator}
                </button>
              </div>
            </div>

            <div
              className={`landing-stagger-item h-full min-h-0 flex flex-col ${todosShellClass}`}
            >
            {showTodos && (
            <>
            <CardSheen />
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/30 to-rose-400/20">
                  <span className="material-symbols-outlined text-[16px] text-amber-400">checklist</span>
                </span>
                <div>
                <span
                  className={`text-[12px] font-semibold uppercase tracking-[0.16em] ${panelStrong}`}
                >
                  {t.landingTodoTitle}
                </span>
                <span className={`ml-2 text-[12px] ${panelMuted}`}>
                  {todos.filter((t) => !t.done).length}/{todos.length}
                </span>
                </div>
              </div>
              <div
                className={`flex items-center gap-1 text-[11px] rounded-full px-1.5 py-0.5 border flex-shrink-0 ${
                  isLight ? 'bg-black/[0.04] border-black/10' : 'bg-white/5 border-white/15'
                }`}
              >
                {(['all', 'active', 'done'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`px-2 py-0.5 rounded-full ${
                      filter === key
                        ? 'bg-white/90 text-slate-900'
                        : isLight
                          ? 'text-slate-700'
                          : 'text-slate-200'
                    }`}
                  >
                    {key === 'all'
                      ? t.landingTodoFilterAll
                      : key === 'active'
                      ? t.landingTodoFilterActive
                      : t.landingTodoFilterDone}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-[11px] flex-shrink-0">
                <span className={panelStrong}>{t.landingTodoPriority}</span>
                {(['low', 'medium', 'high'] as TodoPriority[]).map((p) => {
                  const color =
                    p === 'low' ? 'bg-emerald-400' : p === 'medium' ? 'bg-amber-400' : 'bg-rose-400';
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isLight ? 'border-black/25' : 'border-white/40'
                      } ${newPriority === p ? '' : 'opacity-50'}`}
                    >
                      <span className={`w-3 h-3 rounded-full ${color}`} />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 text-[11px] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSortBy('created')}
                  className={`px-2 py-0.5 rounded-full border ${
                    sortBy === 'created'
                      ? 'bg-white/90 text-slate-900 border-transparent'
                      : isLight
                        ? 'bg-black/[0.04] text-slate-700 border-black/15'
                        : 'bg-white/5 text-slate-200 border-white/20'
                  }`}
                >
                  {t.landingTodoSortCreated}
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('priority')}
                  className={`px-2 py-0.5 rounded-full border ${
                    sortBy === 'priority'
                      ? 'bg-white/90 text-slate-900 border-transparent'
                      : isLight
                        ? 'bg-black/[0.04] text-slate-700 border-black/15'
                        : 'bg-white/5 text-slate-200 border-white/20'
                  }`}
                >
                  {t.landingTodoSortPriority}
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = todoInput.trim();
                if (!text) return;
                const tempId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                const todo: LandingTodo = {
                  id: tempId,
                  text,
                  done: false,
                  priority: newPriority,
                  createdAt: Date.now(),
                };
                setTodos((prev) => [...prev, todo]);
                setToast({ message: t.landingTodoToastAdded, type: 'success' });
                if (user?.id) {
                  supabase
                    .from('landing_todos')
                    .insert({
                      user_id: user.id,
                      text: todo.text,
                      done: todo.done,
                      priority: todo.priority,
                    })
                    .select('*')
                    .single()
                    .then(() => {
                      // Replace temp id with real id from DB
                      return supabase
                        .from('landing_todos')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: true });
                    })
                    .then((res) => {
                      if (res && !res.error && Array.isArray(res.data)) {
                        setTodos(
                          res.data.map((row: any) => ({
                            id: String(row.id),
                            text: String(row.text ?? ''),
                            done: Boolean(row.done),
                            priority: (row.priority as TodoPriority) ?? 'medium',
                            createdAt: row.created_at
                              ? Date.parse(row.created_at as string)
                              : Date.now(),
                          }))
                        );
                      }
                    });
                }
                setTodoInput('');
              }}
              className="flex items-center gap-2 mb-2"
            >
              <input
                type="text"
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                placeholder={t.landingTodoPlaceholder}
                className={`flex-1 rounded-xl px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-accent/40 ${
                  isLight
                    ? 'bg-white border border-black/10 text-slate-900 placeholder:text-slate-400 shadow-sm'
                    : 'bg-white/5 border border-white/15 text-slate-50 placeholder:text-slate-400 focus:ring-white/70'
                }`}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-white text-[11px] font-semibold hover:brightness-110 disabled:opacity-60"
                disabled={!todoInput.trim()}
              >
                {t.landingTodoAdd}
              </button>
            </form>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1.5">
              {todos.length === 0 ? (
                <div className={`flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center ${panelMuted}`}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-violet-400/10">
                    <span className="material-symbols-outlined text-[26px] text-amber-400">edit_note</span>
                  </span>
                  <p className="text-[12px] max-w-[16rem]">{t.landingTodoEmpty}</p>
                </div>
              ) : (
                todos
                  .filter((item) => {
                    if (filter === 'active') return !item.done;
                    if (filter === 'done') return item.done;
                    return true;
                  })
                  .sort((a, b) => {
                    // Always show active tasks first
                    const doneDiff = Number(a.done) - Number(b.done);
                    if (doneDiff !== 0) return doneDiff;
                    if (sortBy === 'created') return a.createdAt - b.createdAt;
                    const rank = { low: 0, medium: 1, high: 2 } as const;
                    const diff = rank[b.priority] - rank[a.priority];
                    return diff !== 0 ? diff : a.createdAt - b.createdAt;
                  })
                  .map((item) => {
                    const colorClass =
                      item.priority === 'high'
                        ? 'border-rose-400/80'
                        : item.priority === 'medium'
                        ? 'border-amber-400/80'
                        : 'border-emerald-400/80';
                    return (
                      <div
                        key={item.id}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] text-left transition border-l-2 ${colorClass} ${
                          isLight
                            ? 'bg-white/70 hover:bg-white border border-black/5'
                            : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/5'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const markingDone = !item.done;
                            setTodos((prev) => {
                              const next = prev.map((t) =>
                                t.id === item.id ? { ...t, done: !t.done } : t
                              );
                              const changed = next.find((t) => t.id === item.id);
                              if (changed && user?.id && !item.id.startsWith('local-')) {
                                supabase
                                  .from('landing_todos')
                                  .update({ done: changed.done, updated_at: new Date().toISOString() })
                                  .eq('id', changed.id)
                                  .eq('user_id', user.id)
                                  .then(() => {});
                              }
                              return next;
                            });
                            if (markingDone) {
                              setToast({ message: t.landingTodoToastDone, type: 'success' });
                            }
                          }}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isLight ? 'border-black/35' : 'border-white/60'
                            } ${item.done ? 'bg-white' : 'bg-transparent'}`}
                          >
                            {item.done && (
                              <span className="material-symbols-outlined text-[12px] text-slate-900">
                                check
                              </span>
                            )}
                          </span>
                          <span
                            className={`truncate ${
                              item.done
                                ? isLight
                                  ? 'text-slate-500 line-through'
                                  : 'text-slate-300 line-through'
                                : isLight
                                  ? 'text-slate-900'
                                  : 'text-slate-50'
                            }`}
                          >
                            {item.text}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setTodos((prev) => {
                              if (user?.id && !item.id.startsWith('local-')) {
                                supabase
                                  .from('landing_todos')
                                  .delete()
                                  .eq('id', item.id)
                                  .eq('user_id', user.id)
                                  .then(() => {});
                              }
                              return prev.filter((t) => t.id !== item.id);
                            })
                          }
                          className={`ml-2 text-[12px] ${
                            isLight
                              ? 'text-slate-500 hover:text-slate-900'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
            </>
            )}
            </div>
          </div>
          </div>
        </div>

        {bgSettingsOpen && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center px-4 backdrop-blur-sm"
            style={{ backgroundColor: 'var(--backdrop-strong)' }}
            onClick={() => setBgSettingsOpen(false)}
          >
            <div
              className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[24px] border p-0 text-left text-[11px] ${
                isLight
                  ? 'border-black/10 shadow-[0_24px_80px_rgba(15,23,42,0.18)]'
                  : 'border-white/12 shadow-[0_28px_90px_rgba(0,0,0,0.85)]'
              }`}
              style={{ backgroundColor: 'var(--surface-modal)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-violet-500 via-accent to-cyan-400" />
              <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`flex items-center gap-2 font-semibold text-sm tracking-wide ${
                    isLight ? 'text-slate-900' : 'text-slate-50'
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white">
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                  </span>
                  {t.landingBgSource}
                </span>
                <button
                  type="button"
                  onClick={() => setBgSettingsOpen(false)}
                  className={`text-sm ${
                    isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  ×
                </button>
              </div>

              <div
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px] ${
                  isLight ? 'text-slate-800' : 'text-slate-50'
                }`}
              >
                <div className="space-y-2">
                  <p className={`font-semibold uppercase tracking-[0.14em] text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                    {t.landingBgUpload}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full py-1.5 px-2 rounded-lg text-left transition ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {t.landingBgUpload}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const url = reader.result as string;
                          settings.setLandingBackgroundMode?.('image');
                          settings.setLandingBackgroundImageUrl?.(url);
                          setCustomUrl(url);
                        };
                        reader.readAsDataURL(file);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <p className={`font-semibold uppercase tracking-[0.14em] text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                    {t.landingBgUrl}
                  </p>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://example.com/background.jpg"
                    className={modalDenseInput}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      settings.setLandingBackgroundMode?.('image');
                      settings.setLandingBackgroundImageUrl?.(customUrl || null);
                      setBgSettingsOpen(false);
                    }}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 font-semibold hover:bg-white"
                  >
                    {t.landingBgApply}
                  </button>
                </div>

                <div className="space-y-2">
                  <p className={`font-semibold uppercase tracking-[0.14em] text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                    {t.timeFormat}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => settings.setTimeFormat('24')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium ${
                        settings.timeFormat === '24'
                          ? 'bg-white/90 text-slate-900'
                          : isLight
                            ? 'bg-black/[0.05] text-slate-700 border border-black/10'
                            : 'bg-white/5 text-slate-200'
                      }`}
                    >
                      {t.timeFormat24}
                    </button>
                    <button
                      type="button"
                      onClick={() => settings.setTimeFormat('12')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium ${
                        settings.timeFormat === '12'
                          ? 'bg-white/90 text-slate-900'
                          : isLight
                            ? 'bg-black/[0.05] text-slate-700 border border-black/10'
                            : 'bg-white/5 text-slate-200'
                      }`}
                    >
                      {t.timeFormat12}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div
                    className={`pt-1 border-t space-y-2 ${isLight ? 'border-black/10' : 'border-white/10'}`}
                  >
                    <p className={`font-semibold uppercase tracking-[0.14em] text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                      {settings.locale === 'vi' ? 'Hiển thị khu vực' : "Sections visibility"}
                    </p>
                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between gap-2">
                        <span className={isLight ? 'text-slate-700' : 'text-slate-200'}>
                          {settings.locale === 'vi' ? 'Pomodoro' : 'Pomodoro'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            (settings as any).setShowLandingPomodoro?.(!showPomodoro)
                          }
                          className={`relative inline-flex h-4 w-7 items-center rounded-full border transition ${
                            showPomodoro
                              ? 'bg-emerald-400/90 border-emerald-300'
                              : isLight
                                ? 'bg-slate-200 border-black/20'
                                : 'bg-black/40 border-white/30'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition ${
                              showPomodoro ? 'translate-x-3' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </label>
                      <label className="flex items-center justify-between gap-2">
                        <span className={isLight ? 'text-slate-700' : 'text-slate-200'}>
                          {settings.locale === 'vi' ? 'Todo hôm nay' : "Today's Focus"}
                        </span>
                        <button
                          type="button"
                          onClick={() => (settings as any).setShowLandingTodos?.(!showTodos)}
                          className={`relative inline-flex h-4 w-7 items-center rounded-full border transition ${
                            showTodos
                              ? 'bg-emerald-400/90 border-emerald-300'
                              : isLight
                                ? 'bg-slate-200 border-black/20'
                                : 'bg-black/40 border-white/30'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition ${
                              showTodos ? 'translate-x-3' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>

                  <div
                    className={`pt-1 border-t space-y-2 ${isLight ? 'border-black/10' : 'border-white/10'}`}
                  >
                    <p className={`font-semibold uppercase tracking-[0.14em] text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-300'}`}>
                      {t.autoBackgroundSectionTitle}
                    </p>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-200'}`}>
                          {t.autoBackgroundSource}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => settings.setAutoBackgroundSource('none')}
                            className={`px-2 py-0.5 rounded-full text-[11px] border ${
                              (settings.autoBackgroundSource ?? 'none') === 'none'
                                ? 'bg-accent/20 border-accent text-accent'
                                : isLight
                                  ? 'bg-black/[0.04] border-black/10 text-slate-700 hover:bg-black/[0.08]'
                                  : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            {t.autoBackgroundSourceNone}
                          </button>
                          <button
                            type="button"
                            onClick={() => settings.setAutoBackgroundSource('unsplash')}
                            className={`px-2 py-0.5 rounded-full text-[11px] border ${
                              settings.autoBackgroundSource === 'unsplash'
                                ? 'bg-accent/20 border-accent text-accent'
                                : isLight
                                  ? 'bg-black/[0.04] border-black/10 text-slate-700 hover:bg-black/[0.08]'
                                  : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            {t.autoBackgroundSourceUnsplash}
                          </button>
                        </div>
                      </div>

                      {settings.autoBackgroundSource === 'unsplash' && (
                        <div className="space-y-1.5">
                          <div className="space-y-1">
                            <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-200'}`}>
                              {t.autoBackgroundQueryLabel}
                            </span>
                            <input
                              type="text"
                              value={settings.autoBackgroundQuery ?? ''}
                              onChange={(e) =>
                                settings.setAutoBackgroundQuery(e.target.value || null)
                              }
                              placeholder="beach, forest, workspace..."
                              className={modalDenseInput}
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-200'}`}
                            >
                              {t.autoBackgroundIntervalHoursLabel}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={168}
                              value={settings.autoBackgroundIntervalHoursLanding ?? 0}
                              onChange={(e) =>
                                settings.setAutoBackgroundIntervalHoursLanding(
                                  e.target.value === ''
                                    ? null
                                    : Math.max(0, Number(e.target.value) || 0)
                                )
                              }
                              className={modalNumInput}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="flex items-center justify-between gap-2">
                              <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-200'}`}>
                                {t.autoBackgroundTimeOfDayMode}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  settings.setAutoBackgroundTimeOfDayMode(
                                    (settings.autoBackgroundTimeOfDayMode ?? 'off') ===
                                      'by_time_of_day'
                                      ? 'off'
                                      : 'by_time_of_day'
                                  )
                                }
                                className={`min-w-[60px] px-3 py-1 rounded-full text-[11px] font-medium transition ${
                                  (settings.autoBackgroundTimeOfDayMode ?? 'off') ===
                                  'by_time_of_day'
                                    ? 'bg-accent/20 text-accent border border-accent/40'
                                    : isLight
                                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-black/10'
                                      : 'bg-white/10 text-slate-300 hover:bg-white/15 border border-white/10'
                                }`}
                              >
                                {(settings.autoBackgroundTimeOfDayMode ?? 'off') ===
                                'by_time_of_day'
                                  ? t.on
                                  : t.off}
                              </button>
                            </label>

                            {(settings.autoBackgroundTimeOfDayMode ?? 'off') ===
                              'by_time_of_day' && (
                              <div className="space-y-1.5 mt-1">
                                <input
                                  type="text"
                                  value={settings.autoBackgroundMorningQuery ?? ''}
                                  onChange={(e) =>
                                    settings.setAutoBackgroundMorningQuery(
                                      e.target.value || null
                                    )
                                  }
                                  placeholder={t.autoBackgroundMorningQuery}
                                  className={modalDenseInput}
                                />
                                <input
                                  type="text"
                                  value={settings.autoBackgroundNoonQuery ?? ''}
                                  onChange={(e) =>
                                    settings.setAutoBackgroundNoonQuery(
                                      e.target.value || null
                                    )
                                  }
                                  placeholder={t.autoBackgroundNoonQuery}
                                  className={modalDenseInput}
                                />
                                <input
                                  type="text"
                                  value={settings.autoBackgroundEveningQuery ?? ''}
                                  onChange={(e) =>
                                    settings.setAutoBackgroundEveningQuery(
                                      e.target.value || null
                                    )
                                  }
                                  placeholder={t.autoBackgroundEveningQuery}
                                  className={modalDenseInput}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </div>
              </div>
              </div>
            )}

        {nameModalOpen && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center px-4 backdrop-blur-sm"
            style={{ backgroundColor: 'var(--backdrop-strong)' }}
            onClick={() => setNameModalOpen(false)}
          >
            <div
              className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[24px] border p-0 text-left text-[12px] ${
                isLight
                  ? 'border-black/10 shadow-[0_24px_80px_rgba(15,23,42,0.18)]'
                  : 'border-white/12 shadow-[0_28px_90px_rgba(0,0,0,0.85)]'
              }`}
              style={{ backgroundColor: 'var(--surface-modal)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-violet-500 via-accent to-cyan-400" />
              <div className="p-5">
              <h2
                className={`text-sm font-semibold mb-2 ${isLight ? 'text-slate-900' : 'text-slate-50'}`}
              >
                {settings.locale === 'vi' ? 'Chào bạn, cho mình biết tên nhé?' : 'Hi, what should we call you?'}
              </h2>
              <p className={`text-xs mb-3 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {settings.locale === 'vi'
                  ? 'Tên này sẽ được dùng để hiển thị trong lời chào: “Good evening, Tên của bạn”.'
                  : 'This name will be used in the greeting: “Good evening, Your name”.'}
              </p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={settings.locale === 'vi' ? 'Nhập tên của bạn' : 'Enter your name'}
                className={nameModalField}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNameModalOpen(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    isLight
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-black/10'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10 border-white/15'
                  }`}
                >
                  {settings.locale === 'vi' ? 'Để sau' : 'Later'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const trimmed = nameInput.trim();
                    if (!trimmed || !user) return;
                    setLocalDisplayName(trimmed);
                    setNameModalOpen(false);
                    try {
                      await supabase.auth.updateUser({
                        data: { full_name: trimmed },
                      });
                    } catch {
                      // ignore error, localDisplayName vẫn dùng được
                    }
                  }}
                  className="px-4 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs font-semibold hover:bg-white"
                >
                  {settings.locale === 'vi' ? 'Lưu tên' : 'Save'}
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
        <Toast
          message={toast.message}
          type={toast.type}
          open={!!toast.message}
          onClose={() =>
            setToast((p) => ({ ...p, message: '', actionLabel: undefined, onAction: undefined, duration: undefined }))
          }
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          duration={toast.duration}
        />
      </div>
    </div>
  );
}


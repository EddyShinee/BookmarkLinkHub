import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { chromeStorageAdapter } from '../lib/chromeStorageAdapter';

const DEFAULT_LANDING_BACKGROUND =
  'https://images.unsplash.com/photo-1769878539345-2d8c4769209d?q=80&w=1483&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

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
    const id = setInterval(() => {
      setPomodoroSeconds((prev) => {
        if (prev <= 1) {
          const nextMode = pomodoroMode === 'work' ? 'break' : 'work';
          const nextSeconds = nextMode === 'work' ? 25 * 60 : 5 * 60;
          setPomodoroMode(nextMode);
          setPomodoroTotalSeconds(nextSeconds);
          return nextSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoroRunning, pomodoroMode]);

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

  const timeStr = useMemo(
    () =>
      now.toLocaleTimeString(settings.locale === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    [now, settings.locale]
  );

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

  const showPomodoro = settings.showLandingPomodoro ?? true;
  const showTodos = settings.showLandingTodos ?? true;
  const gridColsClass = 'grid-cols-1 md:grid-cols-3';
  const gridRowsClass = 'max-md:[grid-auto-rows:minmax(200px,auto)] md:[grid-auto-rows:40vh]';

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={
          hasImage
            ? {
                backgroundImage: `url(${effectiveBackgroundImageUrl})`,
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
          background:
            'radial-gradient(circle at top, rgba(15,23,42,0.4), rgba(15,23,42,0.9))',
          opacity: overlayOpacity,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-full w-full">
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-3 sm:px-4 sm:py-4 gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-2.5 py-1 sm:px-3 sm:py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.18em] text-slate-100">
              LinkHub
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setBgSettingsOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1.5 sm:px-3 border border-white/25 text-white text-[11px] hover:bg-black/55 hover:text-white"
              aria-label={t.settings}
            >
              <span className="material-symbols-outlined text-[16px] text-white">settings</span>
              <span className="hidden sm:inline text-white">{t.settings}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/bookmarks')}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/95 text-slate-900 px-3 py-1.5 sm:px-4 text-[10px] sm:text-[11px] font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.7)] hover:bg-white"
            >
              <span className="material-symbols-outlined text-[14px] sm:text-[16px]">bookmark</span>
              <span>{t.landingPrimaryCta}</span>
              <span className="hidden sm:inline ml-1 rounded border border-slate-900/20 px-1 py-0.5 text-[9px] font-medium opacity-60">{navigator.platform?.toUpperCase().includes('MAC') ? '⌘+B' : 'Ctrl+B'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-6 text-white flex flex-col">
          <div className="w-full max-w-[1600px] mx-auto py-4 sm:py-6 pb-8 text-left flex-1 flex flex-col min-h-0 max-md:flex-none max-md:min-h-0 md:justify-center">
          <div className={`grid gap-6 sm:gap-8 lg:gap-10 items-stretch ${gridColsClass} ${gridRowsClass}`}>
            {/* Pomodoro column */}
            <div className={`h-full flex flex-col ${showPomodoro ? 'rounded-2xl bg-black/35 border border-white/20 backdrop-blur-[18px] px-3 py-4 sm:px-5 sm:py-5 shadow-[0_22px_70px_rgba(0,0,0,0.9)]' : ''}`}>
              {showPomodoro && (
                <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                  {settings.locale === 'vi' ? 'Pomodoro' : 'Pomodoro'}
                </span>
                <span className="text-[11px] text-slate-300">
                  {pomodoroMode === 'work'
                    ? settings.locale === 'vi'
                      ? 'Tập trung'
                      : 'Focus'
                    : settings.locale === 'vi'
                    ? 'Nghỉ'
                    : 'Break'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] transition-all duration-300"
                  style={{ width: `${pomodoroProgress * 100}%` }}
                />
              </div>

              <div className="flex-1 flex items-center justify-center mb-2 w-full">
                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-[140px] md:h-[140px] flex-shrink-0">
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
                    return (
                      <>
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke="rgba(148,163,184,0.35)"
                          strokeWidth="5"
                          fill="transparent"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke="rgba(248,250,252,0.9)"
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
                          fill="rgba(248,250,252,0.9)"
                          fontSize="14"
                          fontWeight="600"
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
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-[11px] font-semibold hover:bg-white"
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
                      setPomodoroSeconds(pomodoroMode === 'work' ? 25 * 60 : 5 * 60);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-slate-100 text-[11px] hover:bg-white/20 border border-white/25 min-w-[80px]"
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
                    }}
                    className={`flex-1 min-w-[100px] px-2 py-1 rounded-lg border ${
                      pomodoroMode === 'work'
                        ? 'bg-white/15 border-white/40'
                        : 'bg-black/20 border-white/20'
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
                    }}
                    className={`flex-1 min-w-[100px] px-2 py-1 rounded-lg border ${
                      pomodoroMode === 'break'
                        ? 'bg-white/15 border-white/40'
                        : 'bg-black/20 border-white/20'
                    }`}
                  >
                    {settings.locale === 'vi' ? '5 phút nghỉ' : '5 min break'}
                  </button>
                </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-300 flex-wrap">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={pomodoroCustomMinutes}
                    onChange={(e) => setPomodoroCustomMinutes(e.target.value)}
                    className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-white/25 text-[11px] text-slate-50 outline-none focus:ring-1 focus:ring-white/60 text-center"
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
                    className="flex-1 px-3 py-1 rounded-lg bg-white/10 text-slate-100 text-[11px] hover:bg-white/20 border border-white/25 text-center"
                  >
                    {settings.locale === 'vi' ? 'Áp dụng phút tùy chỉnh' : 'Apply custom minutes'}
                  </button>
                </div>
              </div>
              </>
              )}
            </div>

            <div className="rounded-3xl bg-black/30 border border-white/20 backdrop-blur-[22px] px-4 py-4 sm:px-6 sm:py-6 md:px-10 md:py-8 shadow-[0_26px_90px_rgba(0,0,0,0.9)] h-full flex flex-col justify-center">
              <div className="flex items-baseline justify-center gap-2 text-[56px] sm:text-[72px] md:text-[88px] font-semibold leading-none tracking-tight drop-shadow-[0_16px_52px_rgba(0,0,0,0.95)]">
                <span>
                  {(() => {
                    const hours = now.getHours();
                    const minutes = now.getMinutes();
                    const seconds = now.getSeconds();
                    const use12 = settings.timeFormat === '12';
                    const h = use12 ? ((hours + 11) % 12) + 1 : hours;
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${pad(h)}:${pad(minutes)}:${pad(seconds)}`;
                  })()}
                </span>
                {settings.timeFormat === '12' && (
                  <span className="text-[24px] sm:text-[32px] md:text-[40px] font-semibold">
                    {now.getHours() < 12
                      ? settings.locale === 'vi'
                        ? 'SA'
                        : 'AM'
                      : settings.locale === 'vi'
                      ? 'CH'
                      : 'PM'}
                  </span>
                )}
              </div>
              <p className="mt-4 text-lg sm:text-2xl md:text-3xl font-medium drop-shadow-[0_8px_32px_rgba(0,0,0,0.85)] text-center">
                {greeting}
                {displayName ? `, ${displayName}.` : '.'}
              </p>
              <p className="mt-2 text-sm sm:text-base text-slate-200/90 drop-shadow-[0_6px_20px_rgba(0,0,0,0.85)] text-center">
                {dateStr}
              </p>
            </div>

            <div className={`h-full min-h-0 flex flex-col ${showTodos ? 'rounded-2xl bg-black/35 border border-white/15 backdrop-blur-[14px] px-3 py-3 sm:px-4 shadow-[0_18px_45px_rgba(0,0,0,0.7)]' : ''}`}>
            {showTodos && (
            <>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div>
                <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                  {t.landingTodoTitle}
                </span>
                <span className="ml-2 text-[12px] text-slate-300">
                  {todos.filter((t) => !t.done).length}/{todos.length}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] bg-white/5 rounded-full px-1.5 py-0.5 border border-white/15 flex-shrink-0">
                {(['all', 'active', 'done'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`px-2 py-0.5 rounded-full ${
                      filter === key ? 'bg-white/90 text-slate-900' : 'text-slate-200'
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
                <span className="text-slate-200">{t.landingTodoPriority}</span>
                {(['low', 'medium', 'high'] as TodoPriority[]).map((p) => {
                  const color =
                    p === 'low' ? 'bg-emerald-400' : p === 'medium' ? 'bg-amber-400' : 'bg-rose-400';
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`w-5 h-5 rounded-full border border-white/40 flex items-center justify-center ${
                        newPriority === p ? '' : 'opacity-50'
                      }`}
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
                className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-[12px] text-slate-50 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-white/70"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-[11px] font-semibold hover:bg-white disabled:opacity-60"
                disabled={!todoInput.trim()}
              >
                +
              </button>
            </form>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1.5">
              {todos.length === 0 ? (
                <p className="text-[12px] text-slate-300">{t.landingTodoEmpty}</p>
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] text-left transition bg-white/0 hover:bg-white/5 border-l-2 ${colorClass}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
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
                            })
                          }
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <span
                            className={`w-4 h-4 rounded-full border border-white/60 flex items-center justify-center ${
                              item.done ? 'bg-white' : 'bg-transparent'
                            }`}
                          >
                            {item.done && (
                              <span className="material-symbols-outlined text-[12px] text-slate-900">
                                check
                              </span>
                            )}
                          </span>
                          <span
                            className={`truncate ${
                              item.done ? 'text-slate-300 line-through' : 'text-slate-50'
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
                          className="ml-2 text-[12px] text-slate-400 hover:text-white"
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
            className="fixed inset-0 flex items-center justify-center bg-black/60 px-4"
            onClick={() => setBgSettingsOpen(false)}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-950/95 border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.9)] p-4 sm:p-5 text-left text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-slate-50 text-sm tracking-wide">
                  {t.landingBgSource}
                </span>
                <button
                  type="button"
                  onClick={() => setBgSettingsOpen(false)}
                  className="text-slate-300 hover:text-white text-sm"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px] text-slate-50">
                <div className="space-y-2">
                  <p className="font-semibold uppercase tracking-[0.14em] text-slate-300 text-[10px]">
                    {t.landingBgUpload}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-left"
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
                          settings.setBackgroundMode('image');
                          if ((settings as any).setLandingBackgroundImageUrl) {
                            (settings as any).setLandingBackgroundImageUrl(url);
                          } else {
                            settings.setBackgroundImageUrl(url);
                          }
                          setCustomUrl(url);
                        };
                        reader.readAsDataURL(file);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <p className="font-semibold uppercase tracking-[0.14em] text-slate-300 text-[10px]">
                    {t.landingBgUrl}
                  </p>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://example.com/background.jpg"
                    className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/25 text-[11px] text-slate-50 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-white/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      settings.setBackgroundMode('image');
                      if ((settings as any).setLandingBackgroundImageUrl) {
                        (settings as any).setLandingBackgroundImageUrl(customUrl || null);
                      } else {
                        settings.setBackgroundImageUrl(customUrl || null);
                      }
                      setBgSettingsOpen(false);
                    }}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 font-semibold hover:bg-white"
                  >
                    {t.landingBgApply}
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold uppercase tracking-[0.14em] text-slate-300 text-[10px]">
                    {t.timeFormat}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => settings.setTimeFormat('24')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium ${
                        settings.timeFormat === '24'
                          ? 'bg-white/90 text-slate-900'
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
                          : 'bg-white/5 text-slate-200'
                      }`}
                    >
                      {t.timeFormat12}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.14em] text-slate-300 text-[10px]">
                      Tips
                    </p>
                    <p className="mt-1 text-slate-300/90 leading-relaxed">
                      {settings.locale === 'vi'
                        ? 'Nên dùng ảnh ngang 1920x1080 để hiển thị đẹp nhất trên màn hình.'
                        : 'Use landscape photos (e.g. 1920x1080) for the best visual quality.'}
                    </p>
                  </div>

                  <div className="pt-1 border-t border-white/10 space-y-2">
                    <p className="font-semibold uppercase tracking-[0.14em] text-slate-300 text-[10px]">
                      {settings.locale === 'vi' ? 'Hiển thị khu vực' : "Sections visibility"}
                    </p>
                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-slate-200">
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
                        <span className="text-slate-200">
                          {settings.locale === 'vi' ? 'Todo hôm nay' : "Today's Focus"}
                        </span>
                        <button
                          type="button"
                          onClick={() => (settings as any).setShowLandingTodos?.(!showTodos)}
                          className={`relative inline-flex h-4 w-7 items-center rounded-full border transition ${
                            showTodos
                              ? 'bg-emerald-400/90 border-emerald-300'
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
                </div>
                </div>
              </div>
              </div>
            )}

        {nameModalOpen && (
          <div
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4"
            onClick={() => setNameModalOpen(false)}
          >
            <div
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-950/95 border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.9)] p-4 sm:p-5 text-left text-[12px]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-sm font-semibold text-slate-50 mb-2">
                {settings.locale === 'vi' ? 'Chào bạn, cho mình biết tên nhé?' : 'Hi, what should we call you?'}
              </h2>
              <p className="text-slate-300 text-xs mb-3">
                {settings.locale === 'vi'
                  ? 'Tên này sẽ được dùng để hiển thị trong lời chào: “Good evening, Tên của bạn”.'
                  : 'This name will be used in the greeting: “Good evening, Your name”.'}
              </p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={settings.locale === 'vi' ? 'Nhập tên của bạn' : 'Enter your name'}
                className="w-full mb-4 px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-slate-50 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-white/70"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNameModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-200 text-xs hover:bg-white/10 border border-white/15"
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
        )}
      </div>
    </div>
  );
}


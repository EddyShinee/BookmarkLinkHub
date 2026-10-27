import React, { useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';
import { BACKGROUND_COLORS } from '../../lib/settings';
import SpotlightShortcutSetting from '../SpotlightShortcutSetting';
import BiometricLoginCard from './BiometricLoginCard';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onExportHtml?: () => void;
  onImportFile?: (file: File) => void;
}

function SettingLabel({ children }: { children: React.ReactNode }) {
  const s = useSettings();
  const light = s.theme === 'light';
  return (
    <label
      className={`block text-[11px] font-semibold uppercase tracking-wider mb-2 ${
        light ? 'text-slate-500' : 'text-text-muted'
      }`}
    >
      {children}
    </label>
  );
}

function SettingCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const s = useSettings();
  const light = s.theme === 'light';
  return (
    <div
      className={`rounded-xl border p-4 ${
        light ? 'border-black/10 bg-white shadow-sm' : 'border-white/10 bg-white/[0.02]'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  const s = useSettings();
  const light = s.theme === 'light';
  return (
    <section className="space-y-3">
      <h3 className={`text-sm font-semibold tracking-tight ${light ? 'text-slate-900' : 'text-white'}`}>{title}</h3>
      {children}
    </section>
  );
}

export default function SettingsModal({ open, onClose, onExportHtml, onImportFile }: SettingsModalProps) {
  const s = useSettings();
  const t = getT(s.locale);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const isLight = s.theme === 'light';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportFile) onImportFile(file);
    e.target.value = '';
  };

  const toggleBtn = (active: boolean) =>
    active
      ? 'bg-accent text-white shadow-[0_0_12px_rgba(129,140,248,0.35)]'
      : isLight
        ? 'bg-slate-100 text-slate-700 border border-black/10 hover:bg-slate-200 hover:text-slate-900'
        : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white border border-white/5';

  const stdInput =
    'w-full px-3 py-1.5 rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/40 ' +
    (isLight
      ? 'bg-white border border-black/15 text-slate-900 placeholder:text-slate-400 focus:border-accent/50'
      : 'bg-white/5 border border-white/10 text-white placeholder-text-muted focus:border-accent/40');

  const denseInput =
    'w-full px-2 py-1.5 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-accent/35 ' +
    (isLight
      ? 'bg-white border border-black/15 text-slate-900 placeholder:text-slate-400 focus:border-accent/50'
      : 'bg-black/40 border border-white/20 text-slate-50 placeholder:text-slate-400 focus:ring-white/60');

  const denseInputNum =
    'w-16 px-2 py-1 rounded-lg text-[11px] outline-none text-center focus:ring-2 focus:ring-accent/35 ' +
    (isLight
      ? 'bg-white border border-black/15 text-slate-900 focus:border-accent/50'
      : 'bg-black/40 border border-white/25 text-slate-50 focus:ring-white/60');

  const ghostRowBtn =
    'inline-flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] transition ' +
    (isLight
      ? 'bg-slate-50 border border-black/10 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      : 'bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white');

  const footerImportBtn =
    'w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border transition text-xs ' +
    (isLight
      ? 'bg-slate-50 border-black/10 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white');

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: 'var(--backdrop-strong)' }}
      onClick={onClose}
    >
      <div
        className={`rounded-2xl shadow-2xl flex flex-col w-[min(1280px,calc(100vw-1.5rem))] max-h-[min(920px,calc(100vh-1.5rem))] overflow-hidden border ${
          isLight ? 'border-black/10' : 'border-white/10'
        }`}
        style={{ backgroundColor: 'var(--surface-modal)' }}
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex shrink-0 items-center justify-between px-6 py-4 border-b ${
            isLight ? 'border-black/10 bg-white' : 'border-white/10 bg-sidebar'
          }`}
        >
          <h2
            id="settings-title"
            className={`flex items-center gap-2 text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}
          >
            <span className="material-symbols-outlined text-accent text-[20px]">settings</span>
            {t.settings}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition ${
              isLight
                ? 'text-slate-500 hover:text-slate-900 hover:bg-black/[0.06]'
                : 'text-text-muted hover:text-white hover:bg-white/10'
            }`}
            aria-label={t.close}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Cột 2: Màu nền & Auto background */}
            <SettingSection title={t.settingsSectionBackground}>
            <div className="space-y-3">
              <SettingCard>
                <SettingLabel>{t.backgroundColor}</SettingLabel>
                <div className="grid grid-cols-8 sm:grid-cols-12 xl:grid-cols-16 gap-2 mb-3">
                  {BACKGROUND_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        s.setBackgroundColor(color);
                        if (s.backgroundMode !== 'color') s.setBackgroundMode('color');
                      }}
                      className={`h-7 w-full rounded-md transition ring-2 ring-offset-1 ${
                        isLight ? 'ring-offset-white' : 'ring-offset-sidebar'
                      } hover:scale-105 ${
                        s.backgroundColor.toLowerCase() === color.toLowerCase()
                          ? 'ring-accent'
                          : 'ring-transparent hover:ring-white/30'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={color}
                      title={color}
                    />
                  ))}
                </div>
                <div className="mt-1 space-y-3">
                  <div className="flex gap-1.5 max-w-xs">
                    <button
                      type="button"
                      onClick={() => s.setBackgroundMode('color')}
                      className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-medium border ${
                        s.backgroundMode === 'color'
                          ? 'bg-accent/20 border-accent text-accent'
                          : isLight
                            ? 'bg-slate-100 border-black/10 text-slate-600 hover:bg-slate-200'
                            : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                      }`}
                    >
                      {t.backgroundModeColor}
                    </button>
                    <button
                      type="button"
                      onClick={() => s.setBackgroundMode('image')}
                      className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-medium border ${
                        s.backgroundMode === 'image'
                          ? 'bg-accent/20 border-accent text-accent'
                          : isLight
                            ? 'bg-slate-100 border-black/10 text-slate-600 hover:bg-slate-200'
                            : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                      }`}
                    >
                      {t.backgroundModeImage}
                    </button>
                  </div>

                  {s.backgroundMode === 'image' && (
                    <>
                      <div className="space-y-1.5">
                        <SettingLabel>{t.backgroundImage}</SettingLabel>
                        <input
                          type="text"
                          value={s.backgroundImageUrl ?? ''}
                          onChange={(e) => s.setBackgroundImageUrl(e.target.value || null)}
                          placeholder={t.backgroundImageUrl}
                          className={stdInput}
                        />
                        <input
                          ref={bgImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                const url = reader.result as string;
                                s.setBackgroundImageUrl(url);
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => bgImageInputRef.current?.click()}
                          className={ghostRowBtn}
                        >
                          <span className="material-symbols-outlined text-[14px]">upload</span>
                          {t.backgroundImageUpload}
                        </button>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-text-secondary">{t.backgroundOverlayOpacity}</span>
                          <span className="text-[11px] text-text-muted">{s.backgroundOverlayOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={s.backgroundOverlayOpacity}
                          onChange={(e) => s.setBackgroundOverlayOpacity(Number(e.target.value))}
                          className="w-full accent-accent"
                        />
                      </div>
                    </>
                  )}

                  <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase text-text-muted tracking-wider">
                        {t.headerSidebarColorEffect}
                      </span>
                      <button
                        type="button"
                        onClick={() => s.setHeaderSidebarColorEffect(!(s.headerSidebarColorEffect ?? true))}
                        className={`min-w-[60px] px-3 py-1 rounded-full text-[11px] font-medium transition ${
                          s.headerSidebarColorEffect !== false
                            ? 'bg-accent/20 text-accent border border-accent/40'
                            : 'bg-white/10 text-text-muted hover:bg-white/15 border border-white/10'
                        }`}
                      >
                        {s.headerSidebarColorEffect !== false ? t.on : t.off}
                      </button>
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
                      <p className="text-[10px] font-semibold uppercase text-text-muted tracking-wider">
                        {t.autoBackgroundSectionTitle}
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-text-secondary">{t.autoBackgroundSource}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => s.setAutoBackgroundSource('none')}
                              className={`px-2 py-0.5 rounded-full text-[11px] border ${
                                (s.autoBackgroundSource ?? 'none') === 'none'
                                  ? 'bg-accent/20 border-accent text-accent'
                                  : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                              }`}
                            >
                              {t.autoBackgroundSourceNone}
                            </button>
                            <button
                              type="button"
                              onClick={() => s.setAutoBackgroundSource('unsplash')}
                              className={`px-2 py-0.5 rounded-full text-[11px] border ${
                                s.autoBackgroundSource === 'unsplash'
                                  ? 'bg-accent/20 border-accent text-accent'
                                  : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                              }`}
                            >
                              {t.autoBackgroundSourceUnsplash}
                            </button>
                          </div>
                        </div>

                        {s.autoBackgroundSource === 'unsplash' && (
                          <div className="space-y-1.5">
                            <div className="space-y-1">
                              <span className="text-[11px] text-text-secondary">{t.autoBackgroundScope}</span>
                              <div className="flex flex-wrap gap-1">
                                {(['landing', 'dashboard', 'both'] as const).map((scope) => {
                                  const label =
                                    scope === 'landing'
                                      ? t.autoBackgroundScopeLanding
                                      : scope === 'dashboard'
                                      ? t.autoBackgroundScopeDashboard
                                      : t.autoBackgroundScopeBoth;
                                  const active = (s.autoBackgroundScope ?? 'landing') === scope;
                                  return (
                                    <button
                                      key={scope}
                                      type="button"
                                      onClick={() => s.setAutoBackgroundScope(scope)}
                                      className={`px-2 py-0.5 rounded-full text-[11px] border ${
                                        active
                                          ? 'bg-accent/20 border-accent text-accent'
                                          : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[11px] text-text-secondary">{t.autoBackgroundQueryLabel}</span>
                              <input
                                type="text"
                                value={s.autoBackgroundQuery ?? ''}
                                onChange={(e) => s.setAutoBackgroundQuery(e.target.value || null)}
                                placeholder="beach, mountain, workspace..."
                                className={denseInput}
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-text-secondary">
                                {t.autoBackgroundIntervalHoursLabel}
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={168}
                                value={s.autoBackgroundIntervalHoursLanding ?? 0}
                                onChange={(e) =>
                                  s.setAutoBackgroundIntervalHoursLanding(
                                    e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className={denseInputNum}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-text-secondary">
                                  {t.autoBackgroundTimeOfDayMode}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    s.setAutoBackgroundTimeOfDayMode(
                                      (s.autoBackgroundTimeOfDayMode ?? 'off') === 'by_time_of_day'
                                        ? 'off'
                                        : 'by_time_of_day'
                                    )
                                  }
                                  className={`min-w-[60px] px-3 py-1 rounded-full text-[11px] font-medium transition ${
                                    (s.autoBackgroundTimeOfDayMode ?? 'off') === 'by_time_of_day'
                                      ? 'bg-accent/20 text-accent border border-accent/40'
                                      : 'bg-white/10 text-text-muted hover:bg-white/15 border border-white/10'
                                  }`}
                                >
                                  {(s.autoBackgroundTimeOfDayMode ?? 'off') === 'by_time_of_day' ? t.on : t.off}
                                </button>
                              </label>

                              {(s.autoBackgroundTimeOfDayMode ?? 'off') === 'by_time_of_day' && (
                                <div className="space-y-1.5 mt-1">
                                  <input
                                    type="text"
                                    value={s.autoBackgroundMorningQuery ?? ''}
                                    onChange={(e) =>
                                      s.setAutoBackgroundMorningQuery(e.target.value || null)
                                    }
                                    placeholder={t.autoBackgroundMorningQuery}
                                    className={denseInput}
                                  />
                                  <input
                                    type="text"
                                    value={s.autoBackgroundNoonQuery ?? ''}
                                    onChange={(e) =>
                                      s.setAutoBackgroundNoonQuery(e.target.value || null)
                                    }
                                    placeholder={t.autoBackgroundNoonQuery}
                                    className={denseInput}
                                  />
                                  <input
                                    type="text"
                                    value={s.autoBackgroundEveningQuery ?? ''}
                                    onChange={(e) =>
                                      s.setAutoBackgroundEveningQuery(e.target.value || null)
                                    }
                                    placeholder={t.autoBackgroundEveningQuery}
                                    className={denseInput}
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
              </SettingCard>

            </div>
            </SettingSection>


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Cột 1: Ngôn ngữ, Trang bắt đầu & Giao diện */}
            <SettingSection title={t.settingsSectionGeneral}>
            <div className="space-y-3">
              <SettingCard>
                <SettingLabel>{t.language}</SettingLabel>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => s.setLocale('vi')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.locale === 'vi')}`}
                  >
                    {t.vietnamese}
                  </button>
                  <button
                    type="button"
                    onClick={() => s.setLocale('en')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.locale === 'en')}`}
                  >
                    {t.english}
                  </button>
                </div>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.startPage}</SettingLabel>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => s.setStartOnLanding(true)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.startOnLanding)}`}
                  >
                    {t.startPageLanding}
                  </button>
                  <button
                    type="button"
                    onClick={() => s.setStartOnLanding(false)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(!s.startOnLanding)}`}
                  >
                    {t.startPageBookmarks}
                  </button>
                </div>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.displayMode}</SettingLabel>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => s.setTheme('dark')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.theme === 'dark')}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">dark_mode</span>
                    {t.dark}
                  </button>
                  <button
                    type="button"
                    onClick={() => s.setTheme('light')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.theme === 'light')}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">light_mode</span>
                    {t.light}
                  </button>
                </div>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.categorySortOrder}</SettingLabel>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => s.setCategorySortOrder('created_asc')}
                      className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-lg text-xs font-medium transition ${toggleBtn(s.categorySortOrder === 'created_asc')}`}
                    >
                      {t.categorySortCreatedAsc}
                    </button>
                    <button
                      type="button"
                      onClick={() => s.setCategorySortOrder('created_desc')}
                      className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-lg text-xs font-medium transition ${toggleBtn(s.categorySortOrder === 'created_desc')}`}
                    >
                      {t.categorySortCreatedDesc}
                    </button>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => s.setCategorySortOrder('name_asc')}
                      className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-lg text-xs font-medium transition ${toggleBtn(s.categorySortOrder === 'name_asc')}`}
                    >
                      {t.categorySortNameAsc}
                    </button>
                    <button
                      type="button"
                      onClick={() => s.setCategorySortOrder('name_desc')}
                      className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-lg text-xs font-medium transition ${toggleBtn(s.categorySortOrder === 'name_desc')}`}
                    >
                      {t.categorySortNameDesc}
                    </button>
                  </div>
                </div>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.biometricSectionTitle}</SettingLabel>
                <BiometricLoginCard />
              </SettingCard>

            </div>
            </SettingSection>

            {/* Cột 3: Bố cục & Màu category & Mở link */}
            <SettingSection title={t.settingsSectionLayout}>
            <div className="space-y-3">
              <SettingCard>
                <SettingLabel>{t.categoryColumns}</SettingLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {([2, 3, 4, 5, 6] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => s.setCategoryColumns(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition ${toggleBtn(s.categoryColumns === n)}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.categoryCardHeight}</SettingLabel>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => s.setCategoryCardHeight('auto')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.categoryCardHeight === 'auto')}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">vertical_align_top</span>
                    {t.byContent}
                  </button>
                  <button
                    type="button"
                    onClick={() => s.setCategoryCardHeight('equal')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.categoryCardHeight === 'equal')}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">height</span>
                    {t.equalHeight}
                  </button>
                </div>
              </SettingCard>

              <SettingCard>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase text-text-muted tracking-wider">
                    {t.categoryColorFillContent}
                  </span>
                  <button
                    type="button"
                    onClick={() => s.setCategoryColorFillContent(!s.categoryColorFillContent)}
                    className={`min-w-[60px] px-3 py-1 rounded-full text-[11px] font-medium transition ${
                      s.categoryColorFillContent
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : 'bg-white/10 text-text-muted hover:bg-white/15 border border-white/10'
                    }`}
                  >
                    {s.categoryColorFillContent ? t.on : t.off}
                  </button>
                </div>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.openLink}</SettingLabel>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => s.setOpenLinkIn('new_tab')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.openLinkIn === 'new_tab')}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">tab</span>
                    {t.newTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => s.setOpenLinkIn('current_tab')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${toggleBtn(s.openLinkIn === 'current_tab')}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    {t.currentTab}
                  </button>
                </div>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.spotlightShortcut}</SettingLabel>
                <SpotlightShortcutSetting />
              </SettingCard>
            </div>
            </SettingSection>
            </div>

            <SettingSection title={t.settingsSectionData}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SettingCard>
                <SettingLabel>{t.importData}</SettingLabel>
                <p className="text-[11px] text-text-muted mb-2 leading-relaxed">{t.importDescription}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.html,.htm"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={footerImportBtn}
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  {t.chooseFile}
                </button>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.exportData}</SettingLabel>
                <p className="text-[11px] text-text-muted mb-2 leading-relaxed">{t.exportDescription}</p>
                <button
                  type="button"
                  onClick={onExportHtml}
                  className={footerImportBtn}
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  {t.exportToHtml}
                </button>
              </SettingCard>

              <SettingCard>
                <SettingLabel>{t.dragDrop}</SettingLabel>
                <div className="space-y-1.5">
                  {(
                    [
                      { key: 'board' as const, label: t.moveBoard },
                      { key: 'category' as const, label: t.moveCategory },
                      { key: 'bookmark' as const, label: t.moveBookmark },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <span className="text-xs text-text-secondary">{label}</span>
                      <button
                        type="button"
                        onClick={() => s.setDragDrop({ [key]: !s.dragDrop[key] })}
                        className={`min-w-[44px] px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                          s.dragDrop[key] ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-muted hover:bg-white/15'
                        }`}
                      >
                        {s.dragDrop[key] ? t.on : t.off}
                      </button>
                    </div>
                  ))}
                </div>
              </SettingCard>
            </div>
            </SettingSection>
          </div>
        </div>

        <div
          className={`flex shrink-0 justify-end px-6 py-3.5 border-t ${
            isLight ? 'border-black/10 bg-white' : 'border-white/10 bg-sidebar'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition shadow-[0_0_12px_rgba(129,140,248,0.25)]"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';
import { BACKGROUND_COLORS } from '../../lib/settings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onExportHtml?: () => void;
  onImportFile?: (file: File) => void;
}

function SettingLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase text-text-muted tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function SettingCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/[0.02] p-3 ${className}`}>
      {children}
    </div>
  );
}

export default function SettingsModal({ open, onClose, onExportHtml, onImportFile }: SettingsModalProps) {
  const s = useSettings();
  const t = getT(s.locale);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportFile) onImportFile(file);
    e.target.value = '';
  };

  const toggleBtn = (active: boolean) =>
    active
      ? 'bg-accent text-white shadow-[0_0_12px_rgba(129,140,248,0.35)]'
      : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white border border-white/5';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-sidebar border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-sidebar/95 backdrop-blur-md">
          <h2 id="settings-title" className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="material-symbols-outlined text-accent text-[20px]">settings</span>
            {t.settings}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition"
            aria-label={t.close}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cột 1: Ngôn ngữ & Giao diện */}
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
            </div>

            {/* Cột 2: Màu nền & Số cột */}
            <div className="space-y-3">
              <SettingCard>
                <SettingLabel>{t.backgroundColor}</SettingLabel>
                <div className="flex flex-wrap gap-1.5">
                  {BACKGROUND_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => s.setBackgroundColor(color)}
                      className={`w-6 h-6 rounded-md transition ring-2 ring-offset-1 ring-offset-sidebar hover:scale-105 ${
                        s.backgroundColor === color ? 'ring-accent' : 'ring-transparent hover:ring-white/30'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={color}
                    />
                  ))}
                </div>
              </SettingCard>

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
            </div>

            {/* Cột 3: Bố cục & Màu category & Mở link */}
            <div className="space-y-3">
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
            </div>

            {/* Cột 4: Dữ liệu & Hành vi */}
            <div className="space-y-3">
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
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white transition text-xs"
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
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white transition text-xs"
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
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end px-5 py-3 border-t border-white/10 bg-sidebar/95 backdrop-blur-md">
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

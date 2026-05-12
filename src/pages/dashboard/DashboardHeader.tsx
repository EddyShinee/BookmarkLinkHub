import React, { type RefObject } from 'react';
import type { User } from '@supabase/supabase-js';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';
import { chromePanelBackground } from './headerSidebarSurface';

export interface DashboardHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  user: User | undefined;
  userMenuRef: RefObject<HTMLDivElement | null>;
  userTriggerRef: RefObject<HTMLButtonElement | null>;
  userDropdownRef: RefObject<HTMLDivElement | null>;
  userMenuOpen: boolean;
  onToggleUserMenu: () => void;
  openUserMenuAbove: boolean;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export function DashboardHeader({
  sidebarOpen,
  onToggleSidebar,
  searchInputRef,
  searchQuery,
  onSearchQueryChange,
  user,
  userMenuRef,
  userTriggerRef,
  userDropdownRef,
  userMenuOpen,
  onToggleUserMenu,
  openUserMenuAbove,
  onOpenSettings,
  onSignOut,
}: DashboardHeaderProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const isLight = settings.theme === 'light';
  const borderChrome = isLight ? 'border-black/10' : 'border-white/10';

  const searchInputClass = isLight
    ? 'bg-white/90 border-black/15 text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-accent/40 focus:border-accent/50'
    : 'bg-white/5 border-white/10 text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40';

  const menuBtnClass = isLight
    ? 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
    : 'text-text-muted hover:text-white hover:bg-white/10';

  const userChipClass = isLight
    ? 'bg-white/80 hover:bg-white border-black/10 hover:border-black/15'
    : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10';

  const userNameClass = isLight ? 'text-slate-900' : 'text-white';

  return (
    <header
      className={`h-12 relative z-[100] flex items-center justify-between px-3 md:px-4 border-b ${borderChrome}`}
      style={chromePanelBackground(settings.headerSidebarColorEffect, settings.theme)}
    >
      <div className="flex items-center flex-1 max-w-md">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`mr-2 p-1.5 rounded-lg md:mr-3 transition ${menuBtnClass}`}
          aria-label={t.toggleSidebar}
        >
          <span className="material-icons-round text-[20px]">
            {sidebarOpen ? 'menu_open' : 'menu'}
          </span>
        </button>
        <div className="relative flex-1 group">
          <span
            className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] transition-colors group-focus-within:text-accent ${
              isLight ? 'text-slate-500' : 'text-text-muted'
            }`}
          >
            search
          </span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className={`block w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border transition-all ${searchInputClass}`}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2 md:ml-4 flex-shrink-0">
        <button
          type="button"
          onClick={() => (window.location.hash = '#/landing')}
          className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
            isLight
              ? 'border-black/10 bg-white/80 text-slate-800 hover:bg-white'
              : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">home</span>
          <span>{t.landingGoBackToLanding}</span>
          <span
            className={`ml-1 rounded border px-1 py-0.5 text-[9px] font-medium opacity-60 ${
              isLight ? 'border-black/15' : 'border-white/20'
            }`}
          >
            {navigator.platform?.toUpperCase().includes('MAC') ? '⌘+B' : 'Ctrl+B'}
          </span>
        </button>
        <div className="relative flex items-center gap-1.5" ref={userMenuRef}>
          <button
            ref={userTriggerRef}
            type="button"
            onClick={onToggleUserMenu}
            className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg transition border ${userChipClass}`}
          >
            <div
              className={`h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-xs ring-1 ${
                isLight ? 'ring-black/10' : 'ring-white/10'
              }`}
            >
              {user?.email?.slice(0, 1).toUpperCase() ?? '?'}
            </div>
            <div className="flex flex-col items-start max-w-[120px]">
              <span className={`text-xs font-medium leading-tight truncate w-full ${userNameClass}`}>
                {user?.user_metadata?.full_name ?? user?.email ?? 'User'}
              </span>
              <span className="text-[11px] text-text-muted leading-tight">{t.dashboardMemberBadge}</span>
            </div>
            <span className={`material-icons-round text-lg transition-transform ${userMenuOpen ? 'rotate-180' : ''} ${isLight ? 'text-slate-500' : 'text-text-muted'}`}>
              expand_more
            </span>
          </button>
          {userMenuOpen && (
            <div
              ref={userDropdownRef}
              className={`absolute right-0 w-48 rounded-lg border ${borderChrome} bg-sidebar shadow-xl shadow-black/40 py-1 z-[110] overflow-hidden ${
                openUserMenuAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
              }`}
            >
              <div className={`px-3 py-2 border-b ${borderChrome}`}>
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t.signedInAs}</p>
                <p className={`text-xs font-medium truncate mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white transition"
              >
                <span className="material-symbols-outlined text-base text-accent">settings</span>
                {t.settings}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-red-500/20 hover:text-red-400 transition"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                {t.logOut}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

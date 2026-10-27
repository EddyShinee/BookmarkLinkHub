---
name: linkhub
description: >-
  Works on LinkHub (BookmarkLinkHub): a Chrome Manifest V3 new-tab bookmark
  manager that also ships as a Vercel web app on the same React UI and
  Supabase data. Use when editing this repo, the extension, new tab, popup,
  spotlight, options, background, boards, categories, bookmarks, authenticator,
  i18n, schema, the web deploy, or a version bump before a new feature build.
---

# LinkHub

LinkHub is one React + Tailwind codebase with two builds. Extension and web share `NewTabApp`, Supabase, and settings. Chrome-only surfaces (popup, context menu, spotlight overlay, service worker) must not break the web build.

## Two runtimes

| | Extension | Web |
|---|---|---|
| Config | `vite.config.ts` + `@crxjs/vite-plugin` + `manifest.config.ts` | `vite.config.web.ts` |
| Dev / build | `npm run dev` (port 5173), `npm run build` → `dist/` | `npm run build:web` → `dist-web/`, `npm run preview:web` (port 4173) |
| Entry | `src/newtab/main.tsx` (also popup, options, spotlight, content, background) | `index.html` → `src/main-web.tsx` |
| Router | `HashRouter` | `HashRouter` |
| Deploy | `npm run pack` zips `dist/` as `linkhub-chrome-store-v<version>.zip` | Vercel: `vercel.json` builds `dist-web` |
| Session store | `chrome.storage.local` | `localStorage` fallback in `src/lib/chromeStorageAdapter.ts` |

Load the unpacked extension from **`dist`**, never the repo root. Version comes only from `package.json`; `manifest.config.ts` and `VITE_APP_VERSION` read it. Do not hardcode the version anywhere else.

## Version

Read the current version from `package.json` before changing it.

Bump it once when a **new feature** is ready to build (`npm run build`, `npm run build:web`, or `npm run pack`). Do the bump in the same change as the feature, before the build, so `dist/manifest.json` and `linkhub-chrome-store-v<version>.zip` carry the new number.

- New feature: raise the minor segment and reset patch. `0.3.0` → `0.4.0`.
- Bugfix-only build, no new feature: raise the patch segment. `0.3.0` → `0.3.1`.
- Several features shipped in one build: one bump, not one bump per feature.
- Do not bump for a rebuild of the same feature, a docs-only edit, a refactor with no user-facing change, or work still in progress.
- Change only `package.json`. Leave `package-lock.json` unless a dependency install updates it.

Env (never commit `.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Client is `src/lib/supabaseClient.ts`.

## Where to change things

- Shared app shell and routes: `src/newtab/NewTabApp.tsx`. Query `?add=1&url=&title=` opens the add-bookmark flow. `?open=authenticator|it-tools|settings` opens that modal. Either param forces Dashboard even when `startOnLanding` is on.
- Dashboard UI: `src/pages/Dashboard.tsx` and `src/pages/dashboard/`.
- Popup (extension only): `src/popup/PopupApp.tsx`.
- Options page: `src/options/`.
- Spotlight search: `src/spotlight/`, content overlay `src/content/spotlightOverlay.tsx`, messages `src/lib/spotlightMessages.ts`, service worker `src/background/index.ts`.
- Auth: `src/hooks/useAuth.ts`.
- Boards / categories / bookmarks: `src/hooks/useBookmarks.ts`, `useCategories.ts`, `useCards.ts`, `useBoardColumns.ts`. Types in `useBookmarks.ts` must match the schema.
- TOTP authenticator: `src/hooks/useAuthenticatorEntries.ts`, `src/lib/totp.ts`, `src/components/AuthenticatorModal.tsx`.
- Settings: `src/lib/settings.ts` (`AppSettings`) and `src/contexts/SettingsContext.tsx`. Profile column `settings_json` mirrors them.
- Copy: `src/lib/i18n.ts`. Locales are only `vi` and `en`. Default is `vi`. Add every new string to **both** objects and read it with `getT(locale)`.
- Local caches (chrome.storage / localStorage): `src/lib/*Snapshot.ts`, `popupSearchCache.ts`, `popupUiState.ts`, `urlCache.ts`, `imageCache.ts`, `fontCache.ts`.

Import alias `@/` maps to `src/`.

## Data model

Ownership chain: `profiles` ← `boards` ← `board_columns` and `categories` ← `bookmarks`. Also per-user: `landing_todos`, `authenticator_entries`.

RLS is on every table. Boards, columns, categories, and bookmarks are scoped through board ownership (`boards.user_id = auth.uid()`), not a `user_id` column on the child row. New tables need the same pattern: RLS enabled, policies for select/insert/update/delete, `updated_at` trigger using `handle_updated_at()`.

`authenticator_entries.secret` is a TOTP secret. Do not log it, put it in snapshots that sync elsewhere, or echo it in UI beyond the existing authenticator flow.

Schema source of truth for a fresh database is `schema.sql`. Incremental changes live in `migrations/*.sql`. When the schema changes, update **both**. Do not apply SQL to the remote project unless the user asks. There is no Supabase CLI project in this repo; the user runs SQL in the Supabase SQL editor.

## Rules that are easy to break

1. Guard every `chrome.*` use. On the web, `chrome` is undefined. Follow `typeof chrome !== 'undefined' && chrome.<api>` as in `chromeStorageAdapter.ts` and `openLink.ts`. Shared components (`NewTabApp`, Dashboard, settings, authenticator) must keep working in `npm run build:web`.
2. A new outbound host (API, font, image CDN) must be added to `content_security_policy.extension_pages` in `manifest.config.ts` for **both** production and development, or the extension will block the request. `host_permissions` may need the same host.
3. Keep extension-only behavior in `src/background`, `src/popup`, `src/content`, and `src/spotlight`. Do not import those modules from the web entry.
4. UI is Tailwind with `darkMode: 'class'`. Prefer tokens in `tailwind.config.js` (`main`, `sidebar`, `accent`, `text-*`, `ui` / `ui-sm` type scale) and `src/styles/globals.css`. Icons are Material Icons Round and Material Symbols Outlined, already linked from the HTML entries.
5. Drag-and-drop uses `@dnd-kit`. Column droppable ids use the `column-` prefix from `src/pages/dashboard/boardGrid.ts`.
6. Do not commit `.env`, `node_modules`, `dist`, `dist-web`, `*.zip`, or `.DS_Store`.

## Check the change

- Extension UI (new tab, popup, spotlight): `npm run dev`, reload the unpacked extension from `dist` at `chrome://extensions`.
- Web UI (landing, login, dashboard, public pages): `npm run build:web` or the Vite web config, then `npm run preview:web` and open `http://localhost:4173`.
- A change to shared state (settings, boards, bookmarks, auth) must be checked on every surface that reads it: new tab, popup, and web.
- Typecheck is `tsc` via the project `tsconfig.json` (`strict`, `noUnusedLocals`, `noUnusedParameters`). There is no test runner.

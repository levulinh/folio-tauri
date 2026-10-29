# Folio Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Notion-like layout with restrained macOS styling, neutral surfaces, and persistent appearance settings before Phase 4.

**Architecture:** Store one validated appearance object in the existing SQLite settings table through the Backend adapter. A single appearance store resolves the system theme and supplies CSS tokens, Mantine and BlockNote. Present settings in an accessible dialog; restyle the existing editor rather than replacing it.

**Tech Stack:** Existing Rust/rusqlite/Tauri 2, React, Zustand, Mantine, BlockNote, Vitest, Playwright WebKit. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-folio-appearance-tech-spec.md` is binding for this work; read it before each task. It supplements and overrides only appearance sections of the base tech spec as described in §1.

**Visual reference:** `folio-appearance-reference.html` beside this plan (copy of approved interactive mockup). The mockup is a visual reference only: its DOM editing, execCommand, fixed sample dates, fake saved indicator, sidebar navigation and status chips are not production implementations. Chips remain Phase 4. Product text is Vietnamese, slash-menu labels English.

## Global Constraints
- Work in `/Users/levulinh/Workspace/personal/folio-tauri`, branch `codex/appearance`, from clean main. Do not touch the Swift repo.
- Preserve document model, save pipeline, IME guards, history routing, drag regions and window capabilities. No schema migration is needed: settings table exists.
- Preserve the 900 px content maximum and 72 px desktop gutters (1044 px border-box). Keep editor text aligned with title; no editor card/background.
- Port 5173 may be the owner's running app. Playwright uses the existing dedicated 5199 server. Never kill the owner's server.
- Settings are device-local; no sync implied. Existing generic settings/export work in Phase 8 must reuse this object, not overwrite it.
- New visible strings belong in `ui/src/i18n/vi.ts`. Reuse installed SVG/icon facilities; no new icon font or remote font request.
- Commits follow repository conventions. Review each task and the complete branch. Do not merge or push as part of execution.

## Review Focus
1. Fast successive setting edits must persist the latest pair, including when a previous request fails (Task 2).
2. Explicit Light/Dark must override OS changes in both popovers and editor; System responds live (Task 2).
3. Opening settings while composing or saving must preserve editor text, caret and pending saves (Task 3/6).
4. A long page title, deep tree and minimum 800×500 window must remain usable (Task 4).
5. Accent colors must not change semantic error/status colors or reduce text/focus contrast (Task 5).

## File map and shared contracts
- `crates/folio-core/src/appearance.rs`: types, validation, settings access; export from lib.rs.
- `crates/folio-app/src/commands.rs`: appearance commands and generated command-name registration using existing pattern.
- `ui/src/backend/{Backend.ts,tauriBackend.ts,fakeBackend.ts}`: identical storage contract; Rust-generated types live under existing generated/.
- `ui/src/appearance/{appearanceStore.ts,AppearanceProvider.tsx,SettingsDialog.tsx,SettingsDialog.module.css}`: state, resolution, dialog.
- `ui/src/theme.css`: semantic tokens; `ui/src/main.tsx`: provider integration.
- Existing `App.tsx`, sidebar, page, editor and component CSS: visual integration only.
- `ui/e2e/appearance.spec.ts`, focused unit/Rust tests, `docs/manual-checklists/appearance.md`.

## Task 1: Validated appearance persistence
**Files:** create core appearance.rs and integration test `crates/folio-core/tests/appearance.rs`; modify core lib.rs, app commands.rs and command-name generation, Backend.ts, tauriBackend.ts, fakeBackend.ts and corresponding tests.
**Interfaces:** Rust camelCase serde/ts-rs exports: `Appearance { mode: ThemeMode, accent: AccentColor }`; mode values `system|light|dark`; accent values `neutral|blue|olive|purple`. Store methods `appearance_get(&self) -> Result<Appearance>` and `appearance_set(&mut self, appearance: Appearance) -> Result<()>`. Commands `appearance_get` (no args), `appearance_set` (JS args `{ appearance: Appearance }`); UI `appearanceGet(): Promise<Appearance>`, `appearanceSet(value: Appearance): Promise<void>`.
- [ ] Write tests: missing value returns `{mode:'system',accent:'neutral'}`; all 12 combinations round-trip after reopen; invalid stored JSON/enum returns defaults without touching pages; a write failure returns db error and leaves prior value intact. Adapter tests assert exact names/payloads; fake persists across instances and rejects failures consistently.
- [ ] Run focused tests and confirm new tests fail before implementation.
- [ ] Implement using key `appearance.v1`, JSON in the existing settings table, parameterized SQL with UPSERT. A corrupt stored value falls back to defaults; actual database read errors propagate. Persist the entire object atomically. No public raw-SQL access.
- [ ] Generate bindings with the repository's existing export tests; run `bash scripts/check.sh` and adapter tests. All pass, generated diff deterministic.
- [ ] Commit `feat: persist appearance preferences`.

## Task 2: One theme source and reliable immediate updates
**Files:** create appearanceStore.ts, AppearanceProvider.tsx and focused tests; modify main.tsx and Editor.tsx.
**Interfaces:** store exports `useAppearanceStore` with `preferences: Appearance`, `resolvedMode: 'light'|'dark'`, `loaded: boolean`, `saving: boolean`, `error: 'load'|'save'|null`, `load(): Promise<void>`, `setPreferences(patch: Partial<Appearance>): void`, `retry(): Promise<void>`, `flush(): Promise<void>`. Provider sets root `data-theme` and `data-accent`, and Mantine `forceColorScheme`; Editor consumes resolvedMode instead of its independent matchMedia hook.
- [ ] Tests with mocked matchMedia: defaults, stored override, OS changes in System, OS changes ignored under explicit modes, listener cleanup under StrictMode, failed load leaves usable defaults and reports error.
- [ ] Test a delayed initial read after a user edit: local full-object preferences win and late load cannot overwrite them. Test failed initial read never writes defaults, and retry follows spec §3.
- [ ] Tests with deferred promises: select blue then dark before first write resolves; final stored value is dark+blue. Failed earlier write cannot revert newer preview or prevent its save. Reload returns last acknowledged preferences. Flush awaits the latest pending value.
- [ ] Run focused tests red; implement a serialized write queue that coalesces to the latest complete preferences and catches each failure. Preview synchronously; show error and a retry control, retain the latest intent for retry. Do not silently loop forever. Default rendering is System+Neutral while loading.
- [ ] Register appearance flush in `state/quitFlush.ts` using its existing Promise.allSettled pattern; the native 3-second quit deadline stays authoritative (spec §3); add tests so existing title/document flushes still run on appearance failure. Install system listener once with proper cleanup. No separate editor theme state.
- [ ] Run unit tests, typecheck and check.sh; commit `feat: resolve appearance consistently across the app`.

## Task 3: Accessible appearance settings
**Files:** SettingsDialog.tsx/.module.css/tests; Sidebar.tsx, App.tsx, vi.ts; Backend.ts MenuEvent, platform settings shortcut helper, crates/folio-app/src/menu.rs; existing FindBar/Sidebar menu listeners; e2e/appearance.spec.ts.
**Interfaces:** `SettingsDialog({onClose}: {onClose():void})`; one shared modal-open guard used by App/Sidebar/FindBar; sidebar button `data-testid="open-settings"`. Dialog testid `appearance-settings`.
- [ ] Add native `Cài đặt…` / `CmdOrCtrl+,` / `menu:settings` and browser-only shortcut per spec §5. Test composition deferral and deduplication, no-page opening and suppressed new-page/find/search/editor-history while modal is open.
- [ ] Test opening by sidebar button, initial focus, Tab/Shift-Tab focus trap, Escape closing unless composing/keyCode229, focus restored to opener, no body/editor keyboard shortcuts running while inside dialog.
- [ ] Implement with installed Mantine Modal (focus trap/restore, labelled heading); use radio groups: `Giao diện`, `Chế độ`, `Theo hệ thống`, `Sáng`, `Tối`, `Màu nhấn`, `Trung tính`, `Xanh dương`, `Olive`, `Tím`. Include visible color names and selected indicator, not color alone. Error text `Không lưu được giao diện. Thử lại.` plus retry; show saving only while a request is pending. Changes call setPreferences immediately; no Apply button.
- [ ] Tests assert all 12 choices update root state and BlockNote scheme without closing dialog; reopening and browser reload preserve preferences; keyboard selection works. No account section or fake settings controls. Use exact vi.appearance keys, dimensions and test ids from spec §5.
- [ ] Run focused Vitest and appearance e2e; commit `feat: add appearance settings dialog`.

## Task 4: Apply the approved shell and typography
**Files:** App.tsx/.module.css, Sidebar.tsx/.module.css, PageTreeItem CSS, SearchBox CSS, PageView.tsx/.module.css, EmptyState CSS; add `ui/src/page/PageHeader.tsx` and CSS if needed.
**Interfaces:** PageHeader below the 28 px drag strip has min-height 34 px, 28 px horizontal padding and renders real plain-text breadcrumb and existing SaveStatus from live stores; no new backend methods. Sidebar width 248 px; 28 px native drag strips retained, all interactive controls outside drag region.
- [ ] Use existing behavior tests; add layout assertions for sidebar width 248, title/text alignment within 2 px, content maximum 900 px, no main horizontal overflow at 800×500. Long 500-char title and deep tree stay within sidebar; action buttons remain usable.
- [ ] Implement neutral sidebar, small Folio wordmark, cleaner search and tree rows, selected page with subtle accent fill; settings button and new-page control at bottom. Use real page names in breadcrumb; no mock dates, decorative category badges or invented account profile.
- [ ] Move existing save status to PageHeader (one instance), keep FindBar and PageTitle behavior/identifiers intact. Title 40 px desktop, weight 650, line-height 1.2; editor stays 16 px, line-height 1.7; metadata 12 px; tree 13–14 px. No remote fonts. Preserve meaningful focus treatment. If ancestors exceed breadcrumb width, truncate it; active title remains distinguishable.
- [ ] Update existing layout test expectations for new sidebar width/header, preserving 72 px gutters. Verify title focus and menu tests. Commit `style: apply Folio shell and typography`.

## Task 5: Theme all editing surfaces
**Files:** theme.css, editor/editor.css, existing Menu/Toast/ConfirmDialog/FindBar and settings CSS; dictionary untouched except necessary labels.
**Tokens (light/dark respectively):** page `#fcfcfc/#222222`; sidebar `#f3f3f3/#1b1b1b`; text `#292929/#e7e7e7`; muted `#707070/#aaaaaa`; border `#e3e3e3/#3b3b3b`; hover `#e8e8e8/#343434`; popover `#ffffff/#2b2b2b`. `color-scheme` equals resolved mode. Remove conflicting OS-only CSS media rules.
**Accent foreground / selected fill (light, dark):** neutral `#505050,#e5e5e5 / #c4c4c4,#393939`; blue `#3567a0,#e4edf8 / #9cbff0,#29394e`; olive `#536b52,#e3e9dc / #b6cba6,#343f2e`; purple `#76599a,#eee7f6 / #c5ade8,#3c304b`. Keep danger/warn/success tokens independent; do not recolor user-authored text or native selection contents by rewriting document styles.
- [ ] Map tokens to BlockNote/Mantine through supported CSS theme variables and provider props. Cover toolbar, slash menu, drag menus, tables, code block, link popover, find highlights, dialogs and toast. Editor background remains transparent. Focus-visible outline 2 px, offset 2 px. Respect reduced motion; hover transitions 120–160 ms only.
- [ ] Add WebKit assertions for 8 theme/accent combinations (scheme + selected color), explicit light under dark OS and reverse; open a real editor popover and settings in each scheme. Test danger/warning colors unchanged across accents and text contrast ≥4.5:1 for normal text, focus/control indicators ≥3:1 against adjacent surface. Adjust tokens minimally if actual contrast fails and document the change.
- [ ] Capture light/dark screenshots at 1200×800 and 800×500, inspect table scrolling and toolbar clipping. Run targeted tests, full e2e and check.sh. Commit `style: theme editor and overlays with appearance tokens`.

## Task 6: Regression review and owner handoff
**Files:** `docs/manual-checklists/appearance.md`, `docs/decisions.md`; update relevant appearance sections of binding tech spec and Phase 8 settings boundary.
- [ ] Run `bash scripts/check.sh`, `npm run -w ui e2e`, `npm run -w ui build`; record actual totals and commands, not older counts. Reuse existing undo/IME/save tests; add a focused test that opening settings while a document save is pending does not replace the editor or lose its pending content.
- [ ] Manual checklist: System theme switch, all four accents in both modes, reload/relaunch persistence, settings keyboard use, Telex in title/body/table before and after settings, one-step undo, native window drag and double-click, minimum window size, original document colors and error colors preserved. Native IME and OS theme transitions must be labelled manual if not exercised.
- [ ] Record agreed defaults and storage key, save failure policy, color tokens and visual reference in decisions; narrow Phase 8 to the remaining settings/export work. No claim that the mockup's placeholder interactions were shipped.
- [ ] Whole-branch review for layout, accessibility and persistence races. Fix findings and recheck changed paths. Supply before/after screenshots for owner review. Commit documentation and stop before merging.

## Self-review
Coverage: approved layout → Task 4; system/light/dark and accent behavior → Tasks 2/5; settings and persistence → Tasks 1/3; regression and handoff → Task 6. Shared types originate in Rust, preferences are written atomically, and existing editor persistence remains independent. No Phase 4 chip/tab implementation is included.

Spec reconciliation: §2 → Task 1; §3–4 → Task 2; §5 → Task 3; §7 → Task 4; §6 → Task 5; §8 → Task 6. Sidebar collapse and mockup-only controls are explicitly deferred. Appearance spec wins over any repeated shorthand here.

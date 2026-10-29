# Folio — Appearance technical specification

Date: 2026-10-29 · Status: approved product direction; implementation contract prepared for review

## 1. Scope and precedence
Owner decisions: Notion-like layout with restrained Apple Notes refinement; neutral surfaces, wide content, tools on demand. Settings offer System/Light/Dark and Neutral/Blue/Olive/Purple. Default System + Neutral; preview immediately, save automatically.

This supplements `2026-10-28-folio-tauri-tech-spec.md`. For appearance only, it supersedes §5.1 (720 px column and OS-only theme), §5.3 (sidebar styling), §5.12 and §6 Phase 8 (appearance moves before Phase 4). D-019 (900 px content), D-024/D-026 (undo), D-032 (window capabilities) remain binding. Other behavior stays governed by the base spec and recorded decisions.

Reference: `../plans/folio-appearance-reference.html`. Visual direction only: do not ship mock dates, avatar, sample status chips, fake navigation or DOM editing code. Tabs/chips remain Phase 4; mirror/export Phase 8. Sidebar collapse is deferred; this pass retains the existing always-visible sidebar.

## 2. Data contract
Create `crates/folio-core/src/appearance.rs`; export through existing conventions. Boundary types derive serde and ts-rs; no handwritten TS equivalents.

```rust
pub enum ThemeMode { System, Light, Dark }
pub enum AccentColor { Neutral, Blue, Olive, Purple }
pub struct Appearance { pub mode: ThemeMode, pub accent: AccentColor }
```
Enums serialize lowercase; struct fields camelCase. Derive Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS and export. Default System + Neutral. Writes reject unknown enum values and missing required fields; unknown object fields may be ignored.

Existing settings table, key `appearance.v1`, JSON `{"mode":"system","accent":"neutral"}`. No migration.
- `Store::appearance_get(&self) -> Result<Appearance>`: missing/malformed stored JSON, enum or required fields returns defaults without rewriting; actual SQL errors propagate as CoreError::Db.
- `Store::appearance_set(&mut self, appearance: Appearance) -> Result<()>`: atomic full-object UPSERT, failed write preserves old value; no document/other setting changes.

| Tauri command | JS args | Return |
|---|---|---|
| appearance_get | none | Appearance |
| appearance_set | `{ appearance: Appearance }` | void |

Backend methods `appearanceGet(): Promise<Appearance>`, `appearanceSet(appearance: Appearance): Promise<void>`. Use existing spawn_blocking/store-lock/ErrorPayload pattern; generated Commands.appearanceGet/appearanceSet and handler registration. Invalid invoke payloads fail before mutation, never default-write; no raw IPC errors in UI.

Fake backend clones reads/writes and extends its current persistKey envelope. Old envelopes without appearance default; separate keys isolated. Match validation/defaults. Production source of truth is SQLite, not localStorage; preferences are device-local.

## 3. State and load/save ordering
Create `ui/src/appearance/appearanceStore.ts`, export useAppearanceStore:
```ts
preferences: Appearance;
resolvedMode: 'light' | 'dark';
loaded: boolean;
saving: boolean;
error: 'load' | 'save' | null;
load(): Promise<void>;
setPreferences(patch: Partial<Appearance>): void;
retry(): Promise<void>;
flush(): Promise<void>;
```
Internally track local revision, acknowledged revision, latest desired complete value, in-flight request and failed revision. Counters are not persisted.

### Loading
1. Default System + Neutral; resolve System with matchMedia('(prefers-color-scheme: dark)'). AppearanceProvider applies root attributes in layout effect before paint, then loads asynchronously. A default-theme frame during IPC is acceptable; document loading must not wait.
2. Deduplicate load under StrictMode. Capture revision before read; apply response only if unchanged. User edits during load win as the currently visible full object, including unchanged fields. Late reads cannot overwrite newer writes or their error state.
3. Failed read sets loaded=true/error=load, retains current/default preview, never automatically writes defaults. Retry read only if no local edits since failure; otherwise retry saves latest intent. Explicit local edits supersede a stale load error.
4. One effective OS media listener with cleanup. OS changes affect resolvedMode only in System and never write preferences. Explicit modes ignore OS changes.

### Writes
1. Merge patch, no-op unchanged values; otherwise increment revision, preview synchronously and queue full-object write immediately, without debounce.
2. One request in flight; coalesce intervening edits to latest full value. Success acknowledges only its captured revision, then sends newer pending value. Older success cannot revert preview or clear a newer error.
3. Failure retains preview/pending value and sets error=save. Do not auto-retry same failed revision; a newer queued revision gets one attempt. New edits or explicit retry resume work. No endless retries.
4. retry() attempts current pending value once (or retries failed initial read as above). flush() drains in-flight/pending revisions, including newer edits; latest failure rejects. Automatic writes catch failures internally, explicit retry/flush callers handle rejections. saving means request running; latest success clears error.
5. Closing dialog does not cancel writes; reopening shows preview/error. Restart loads last persisted value; failed preview need not survive restart.

### Quit
Add appearance flush to existing flushForQuit Promise.allSettled beside titles/documents. Start all branches even if another fails; do not wait serially for preferences before saving documents. Existing native 3-second deadline remains authoritative, no extra timer. Slow/failed preference writes may leave old appearance after restart, without changing document-save semantics.

## 4. One theme source
AppearanceProvider owns media subscription and renders the existing MantineProvider with forceColorScheme=resolvedMode; no independent nested provider. html attributes data-theme=light|dark and data-accent=neutral|blue|olive|purple; CSS color-scheme follows resolvedMode. Remove conflicting OS-only CSS theme rules.

Editor reads resolvedMode for BlockNoteView, removing its independent useColorScheme/matchMedia. Appearance changes must not remount editor, change tab/key, replace document or create another pipeline. Portalled overlays inherit theme. Never modify authored block styles to theme controls.

## 5. Settings and keyboard behavior
SettingsDialog({onClose}: {onClose():void}) uses installed Mantine Modal, accessible heading, focus trap and returnFocus. App owns one open boolean. Sidebar bottom Cài đặt button works with no page; repeated open idempotent.

Native Folio menu adds Cài đặt… after About/separator, id settings, accelerator `CmdOrCtrl+,`, emits menu:settings. Extend MenuEvent/event-map tests. Browser/fake mode handles Mod+, via a platform helper enabled only by VITE_BACKEND=fake; no duplicate Tauri handler or forbidden @tauri imports.

All owned key handlers skip composing/isComposing/keyCode229. Native settings event during composition defers until compositionend plus one animation frame; cancel deferred listener on unmount, deduplicate. Sidebar uses same open path, allowing normal composition commit.

Dialog width 480 px, max-width calc(100vw - 32px), max-height calc(100vh - 48px), internal scrolling. Title Cài đặt; section Giao diện. Radio groups Chế độ (Theo hệ thống/Sáng/Tối) and Màu nhấn (Trung tính/Xanh dương/Olive/Tím). Immediate preview/save, no Apply. Labels plus selected indicator, not color alone. Backdrop closes; Escape only outside composition; restore opener focus and preserve editor selection for later refocus.

While open, suppress app page creation, find/search and editor menu undo/redo; preserve quit, autosave and native input editing. All shortcut entry points use the same modal-open guard, including existing FindBar/Sidebar listeners, not just App handlers.

Exact vi.appearance keys: settings=Cài đặt; heading=Giao diện; mode=Chế độ; system=Theo hệ thống; light=Sáng; dark=Tối; accent=Màu nhấn; neutral=Trung tính; blue=Xanh dương; olive=Olive; purple=Tím; close=Đóng cài đặt; saving=Đang lưu…; loadError=Không tải được giao diện. Thử lại.; saveError=Không lưu được giao diện. Thử lại.; retry=Thử lại. role=status for saving, role=alert for error.

Test ids: open-settings, appearance-settings, appearance-mode-<system|light|dark>, appearance-accent-<neutral|blue|olive|purple>, appearance-retry, appearance-close.

## 6. Tokens and accessibility
Neutral surfaces for every accent. CSS Modules/current system font, no new packages or remote fonts. Reuse current variables.

| Token | Light | Dark |
|---|---|---|
| --bg | #fcfcfc | #222222 |
| --bg-sidebar | #f3f3f3 | #1b1b1b |
| --bg-popover | #ffffff | #2b2b2b |
| --text | #292929 | #e7e7e7 |
| --text-muted | #666666 | #aaaaaa |
| --border | #e3e3e3 | #3b3b3b |
| --bg-hover | #e8e8e8 | #343434 |

| Accent | Light foreground / selected fill | Dark foreground / selected fill |
|---|---|---|
| Neutral | #505050 / #e5e5e5 | #c4c4c4 / #393939 |
| Blue | #3567a0 / #e4edf8 | #9cbff0 / #29394e |
| Olive | #536b52 / #e3e9dc | #b6cba6 / #343f2e |
| Purple | #76599a / #eee7f6 | #c5ade8 / #3c304b |

--accent/--bg-selected take palette values. Selected text remains --text. Error/warning/success independent, no recoloring authored content/status labels. Text contrast >=4.5:1; meaningful controls/focus >=3:1. Decorative table borders exempt from control threshold. If actual usage fails, adjust minimally and record replacement/reason.

Keyboard control focus outline 2 px/offset 2 px. Writing canvases have no outline or box-shadow; title focus may use only a faint 3% neutral background (owner feedback). Hover 120–160 ms, no layout animation, reduced-motion disables transitions. Shadows only floating controls/dialogs. Map supported BlockNote/Mantine variables for toolbar, slash/link/drag menus, tables, code, find and toast.

## 7. Shell layout
- Sidebar 248 px; retain 28 px top drag strips and D-032 permissions. Interactive elements outside drag regions.
- Wordmark, existing search/section/tree; bottom New page and Settings. No account UI; preserve current search shortcut, do not adopt mockup Cmd+K.
- PageHeader below drag strip: min-height 34 px, padding-inline 28 px, real ancestor breadcrumb plus one existing SaveStatus. Ancestor items are buttons that open that page (D-038); the current title stays plain text; existing untitled fallback; truncate ancestors first, keep errors visible.
- Page width 100%, max 1044 px border-box, 72 px gutters => max text 900 px; top padding 35 px below header, bottom 160 px. Minimum window 800×500.
- Title 40 px/1.2 weight 650; editor 16 px/1.7; sidebar 13 px; metadata 12 px. Preserve heading semantics and title input/flush; title/paragraph x difference <=2 px.
- Transparent editor, no card; handles within gutter and overlays within viewport. Table may scroll in wrapper, not main. Long titles/deep tree ellipsize without hiding actions. Keep test ids and existing controls; sidebar collapse deferred.

## 8. Verification and delivery
Core: 12 combinations across reopen, corrupt/missing defaults, real errors, failed write preserves prior value/documents; adapter payload/command tests; fake cloning/old envelope.

Store: late-load/user-edit race, read failure no auto-write, last revision wins, failed old/new success, retry, flush with in-flight edits, StrictMode cleanup, OS System and explicit overrides.

Integration: sidebar/native/browser shortcut, composition deferral, one dialog, radio keyboard, focus trap/restore, modal guards, no editor remount/text/selection loss, parallel quit flush despite errors.

WebKit: 8 resolved theme/accent combinations and all 12 preference combinations; forced light under dark OS/reverse; live System updates; popover color/contrast. Screenshots 1200×800 and 800×500, long titles/deep tree, no main overflow, table/toolbar clipping. Preserve undo/IME/save/drag regressions.

Run bash scripts/check.sh, full npm run -w ui e2e, npm run -w ui build; no new test skips. Manual checklist separately covers native menu/Cmd+comma, Telex/EVKey before/after settings, drag/double-click, OS theme, relaunch persistence and save-failure recovery. Distinguish automation from manual evidence.

Six tasks in ../plans/2026-10-29-appearance.md, per-task and final review, screenshots and owner checklist. No merge/push during execution. Phase 4 uses these tokens; Phase 8 extends same settings without replacing appearance.v1 or a second theme store.

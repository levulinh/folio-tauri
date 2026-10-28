# Decisions

## D-001 Editor choice (Phase 0 IME gate)
Status: decided (2026-10-28)
Result per item: items 1–10 passed with both input methods (macOS Telex and a third-party method), reported by the owner.
Not covered: tech spec §5.7 "`/` typed while composing" was not tested separately (checklist item 5 types `/` first, then composes the filter). Phase 2 must add the `view.composing` guard for the slash trigger or test this case in its checklist.
Decision: BlockNote 0.56
Why: the owner's Phase 0 checklist passed in full, so the tech spec's default editor stands.

## D-002 Phase 1 Task 1 scaffold deviations
Status: decided (2026-10-28)
- Versions: no pinned version needed substituting. Where §1.2 says "latest N.x", resolved to: `@mantine/*` ^9.7.4, `markdown-it` ^14.3.3 (npm latest is 15; spec says 14.x), `dompurify` ^3.4.17, `eslint` ^9.39.5 + `@eslint/js` ^9.39.5 (spec says eslint 9), `typescript-eslint` ^8.72.1, `jsdom` ^30.1.3, `@testing-library/react` ^16.3.3. `tauri` is pinned `=2.12.5`, `tauri-build` `=2.7.4` (never the 3.0 alpha).
- `tempfile` is a normal dependency of `folio-core` (not dev): a later `Store::open_in_memory` needs it.
- `ui/vite.config.ts` sets `test.passWithNoTests: true` so `scripts/check.sh` passes before any UI test exists.
- `ui` script `tauri` is `cd .. && tauri` (not bare `tauri`): the Tauri CLI finds `crates/folio-app/tauri.conf.json` only from the repo root, and `beforeDevCommand` (`npm run -w ui dev`) must also run from the root, where the npm workspace is defined.
- `scripts/check.sh` uses `git diff --exit-code -- ui/src/backend/generated` (with `--`) so it does not error while the folder does not exist yet.
- `.gitignore`: besides the entries listed in the task, added `crates/folio-app/gen/schemas` (the listed `gen/schemas` is anchored to the repo root, so it did not ignore Tauri's generated schemas) and `*.tsbuildinfo` (written by `tsc -b`).

## D-003 Store accessors and error messages (Phase 1 Task 2)
Status: decided (2026-10-28)
- `Store::conn` / `conn_mut` are `pub`, not `pub(crate)`: integration tests in `crates/folio-core/tests/` are a separate crate and read pragmas and `sqlite_master` through them. `Store::assets_dir()` is added so the field is used and later tasks can resolve asset paths.
- `CoreError` messages (English, for logs) are `#[error(...)]` strings of our own; the UI maps `code` to Vietnamese text.

## D-004 Order key format (Phase 1 Task 3)
Status: decided (2026-10-28)
- The `fractional_index` crate was dropped: v2.0.2 underflows in `new_between` (`right[i] - 1` on a 0x00 byte; repro: 300 prepends, then between two smallest keys), which panics in debug and returns an out-of-bounds key in release. Keys are now generated in `order.rs`, a port of rocicorp's MIT `fractional-indexing` (`generateKeyBetween`).
- Format: base-62 digits `0-9A-Za-z` (ASCII order, so BINARY collation = Rust `str` order). Integer part with a length-encoding head char (`a`-`z` / `A`-`Z`) plus digits, then a fractional part that never ends in `0`. The smallest integer key `A` + 26 zeros is rejected.
- `key_between` rejects `prev >= next` ("order keys out of order") and malformed keys with `CoreError::InvalidOp { index: 0, .. }`, and finally checks the result is strictly between the bounds; it never panics.

## D-005 Pages and tabs edge behaviour (Phase 1 Task 6)
Status: decided (2026-10-28)
- `create_page(parent, after)`: `after_id` must be a child of `parent_id`; otherwise `NotFound { entity: "page" }`. A missing `parent_id` is also `NotFound`.
- `list_pages` orders by `parent_id, order_key`, so top-level pages (NULL parent) come first.
- `move_tab(id, prev)`: `prev` must be another tab of the same page, else `NotFound { entity: "tab" }`. Moving a tab after itself is not supported.
- Tab create/rename/move/delete and page rename bump `pages.updated_at`; tab writes also set `tabs.updated_at`.
- `index_title` stores `fold(title)`; `index_block` folds the plain text it receives.

## D-006 Plain-text and style leniency (Phase 1 Task 7)
Status: decided (2026-10-28)
- `Styles` deserialises leniently: `null`, a non-object, or a wrongly typed field falls back to the default for that field, so a text run (or link run) with bad styles keeps its text.
- `dateChip` text is `dd/MM/yyyy`; an unparsable date contributes `""`.
- Table text: non-empty cell texts joined by one space, row-major. `image`/`file`: non-empty parts of `name`, `caption` joined by one space. Unknown block types contribute their inline content text, else `""`.

## D-007 Block edit semantics (Phase 1 Task 8)
Status: decided (2026-10-28)
- Upsert validation errors (non-UUID id, non-object `props`, unknown/self/descendant parent, `prev_sibling_id` that is the block itself, missing, in another tab or under another parent, `key_between` failure) are `InvalidOp { index: <op index in batch>, reason }`; the whole batch rolls back. `content` may be absent, null (stored as NULL), an array or an object.
- A block id that already exists in another tab is `InvalidOp`: blocks never move across tabs. Parents and prevs are looked up in the transaction, so earlier ops of the same batch count. `Delete` only removes blocks of the given tab.
- Order key lies strictly between prev's key and the next sibling's key, excluding the block itself.
- `apply`, `load_tab` and `replace_tab_blocks` return `NotFound { entity: "tab" }` for an unknown tab. `applied` = number of ops. A failed option-name lookup (database error) fails the whole `apply`.
- `replace_tab_blocks` keeps `created_at` of ids that existed before, rejects non-UUID, duplicate or non-object-props nodes (`InvalidOp { index: 0 }`), and bumps `pages.updated_at`.
- `load_tab` orders siblings by `order_key` (id as tiebreak); orphans go to top level with an `eprintln!`.

## D-008 FTS owner side table (Phase 1 Task 8 fix)
Status: decided (2026-10-28)
- Spec §3.1 declares `search_fts.kind/owner_id/page_id` UNINDEXED, so `DELETE ... WHERE owner_id = ?` is a full FTS scan (measured: 500-op apply ~840 ms with 20k other FTS rows). Migration `0002_search_owner.sql` adds `search_owner(fts_rowid, kind, owner_id, page_id)` with `UNIQUE(kind, owner_id)` and an index on `page_id` (backfilled from existing rows).
- All helpers in `search.rs` go through it and touch `search_fts` by rowid only. Anything that writes `search_fts` directly must also write `search_owner`; counts of the two tables are equal by invariant.
- `replace_tab_blocks` returns `InvalidOp` (not a PK `Db` error) for a node id living in another tab.

## D-009 Search behaviour (Phase 1 Task 9)
Status: decided (2026-10-28)
- Query tokens: `fold(query)` split on every non-alphanumeric char (like the unicode61 tokenizer, so `e-mail`, `don't`, `3.14` become separate AND-ed terms; this also removes all FTS5 syntax), empties dropped; none left (or `limit == 0`) → `[]`. FTS expression: `text : ("a"* "b"*)`. AND is per FTS row (one title or one block), not across blocks of a page.
- Ranking: pages with a title hit first, then lowest `bm25` over all their matching rows, then page title, then page id (deterministic). `limit` caps pages.
- Snippet: original plain text of the best-ranked matching block, 120 chars max centred on the first word-start match of the first token (falls back to any substring, then 0); cut ends get `…` (counted within the 120). Title-only hits use the page's first non-empty block (tabs by order_key, blocks depth-first), cut to 120 chars with a trailing `…` when longer; `""` if the page has none.

## D-010 Command plumbing and quit details (Phase 1 Task 10)
Status: decided (2026-10-28)
- One `command_list!` macro in `commands.rs` feeds both `COMMANDS` (via `stringify!`) and `generate_handler!`, so the names cannot drift from the functions; `commands_match_handler` also compares against a second literal list.
- `blocking` maps a failed blocking task to code `db`; a poisoned store mutex is recovered (see below), not reported.
- Quit: the 3 s timeout runs on a plain `std::thread`; `quit_ready` sets `quitting` before `app.exit(0)` so the final `ExitRequested` is never prevented. `CloseRequested` is always prevented (the flow either starts or is already running).
- Fix round 1: tao 0.37.2's macOS app delegate has no `applicationShouldTerminate:`, so Dock → Quit / logout skip `ExitRequested`. `quit::install_dock_quit_hook` adds that method to the delegate's class at runtime (objc2 `class_addMethod`, called in `setup`): it starts the flush and returns `NSTerminateCancel`, and returns `NSTerminateNow` only once `AppState.exiting` is set by the final `app.exit(0)`. If the method already exists the hook logs and is skipped (then Dock quit would skip the flush; up to the last debounce window could be lost).
- A poisoned store mutex is recovered with `into_inner` (rusqlite rolls back the panicked transaction); a panic inside a command is caught and returned as `db` / "internal error: <message>". Exit (`RunEvent::Exit`, timer, `quit_ready`) waits for the store lock so an in-flight transaction commits first.
- Phase 1 checklist item: "Thoát bằng Dock (chuột phải icon → Thoát) ngay sau khi gõ rồi mở lại — chữ vừa gõ còn nguyên".

## D-011 Fake backend fidelity and platform split (Phase 1 Task 11)
Status: decided (2026-10-28)
- The fake mirrors the core's `apply` validation order and all-or-nothing semantics (works on a copy, commits at the end), search tokenising and matching, and the 50-page search limit. It does not mirror ranking ties or snippet-block choice: the core orders by title hit, then bm25, then title, then id, and snippets the best-ranked matching block; the fake orders by title hit, then page id, and snippets the first matching block. Sibling order is array order; `orderKey` of pages is a synthetic zero-padded index (the UI never interprets it). Dropdown chips contribute no search text in the fake (the core resolves option names; option sets arrive in a later phase).
- `ui/src/platform/menuEvents.ts` and `quit.ts` hold the only `listen`/quit-flow code; `tauriBackend.ts` delegates to them. `listenFlushRequest` always calls `quit_ready` after the flush, even if the flush throws (the shell has its own 3 s timeout, so a failing flush must not block quitting).

## D-012 App shell and page tree (Phase 1 Task 12)
Status: decided (2026-10-28)
- Extra copy keys not in §5.13's table, needed by the shell: `pagesSection` "Trang", `cancel` "Huỷ" (delete dialog), `moreActions` "Tuỳ chọn" (aria/title of the `⋯` button), `expand`/`collapse` "Mở rộng"/"Thu gọn" (disclosure aria-labels).
- Creating a page (sidebar button, `+`, menu, native menu event) always opens it; creating a subpage expands its parent. The native `new-page` / `new-subpage` menu events are wired in `App` (subpage under the open page, else top level).
- Inline rename stores the title exactly as typed (no trimming; "   " and " a " round-trip); a title equal to the stored one makes no backend call; only the empty string shows the greyed `untitled`. Enter and blur commit, Escape cancels.
- Native `new-subpage` does nothing when no page is open. If `load()` fails the shell still renders (toast shown).
- The delete dialog focuses Cancel (destructive action is never the default) and closes on Escape or backdrop click. If the open page (or an ancestor) is deleted the page view closes.
- Page list refresh after `create` re-lists from the backend so order always comes from the backend's `orderKey`; `childrenOf` sorts by `orderKey`, then id.
- Playwright runs a single `webkit` project (the app runs in WKWebView); `npx playwright install webkit` inside `ui/` is a one-time setup step.

## D-013 Editor schema, title and conversion (Phase 1 Task 13)
Status: decided (2026-10-28)
- Schema API (BlockNote 0.56): `BlockNoteSchema.create({ blockSpecs, styleSpecs })` with an explicit pick from `defaultBlockSpecs` (paragraph, bulletListItem, numberedListItem, checkListItem, quote, codeBlock, table) and `heading: createHeadingBlockSpec({ levels: [1, 2, 3], allowToggleHeadings: false })`; styles picked from `defaultStyleSpecs` (bold, italic, underline, strike, code). `divider` does exist in 0.56 and is excluded; `pageBreak` is not in the defaults. Picking (instead of destructuring the removals) keeps eslint's unused-var rule quiet and new BlockNote defaults never leak in.
- Dictionary: 0.56's `placeholders` has the keys `default`, `heading`, `bulletListItem`, `numberedListItem`, `checkListItem` as the brief states; the locale is imported as `viLocale`.
- `toStored` maps `undefined` content to `null`. `toEditorBlocks` maps `null` content to `undefined` so BlockNote uses its default. Ids and nested children are preserved.
- Markdown code-block shortcut in 0.56 needs a trailing space (``` then space), not just three backticks. `#`..`###`, `- `, `1. `, `[] `, `> ` convert as expected; `#### ` stays a paragraph (levels limited to 3).
- The editor is created only after `tabLoad` resolves (`useCreateBlockNote` needs its initial content at creation); `<Editor key={activeTabId}>` remounts per tab. `pageStore.activeEditor` is set on mount and cleared on unmount.
- `PageTitle` is a controlled `<input>`: it follows sidebar renames while it has no unsaved edit, saves 400 ms after the last change, on blur, on Enter and on unmount; no trim; no backend call when unchanged. Enter is ignored during IME composition.
- No jsdom polyfills were needed for the headless-editor round-trip test. `interactive-widget=resizes-content` was added to the viewport meta to silence BlockNote's console warning.
- Fix round 1: the title ignores Enter when `keyCode === 229` as well as `isComposing` (WebKit sends the Telex/VNI commit Enter after `compositionend`). The slash menu dictionary is taken from BlockNote's English locale (§5.7/§5.13); everything else is Vietnamese.
- A failed title rename leaves the typed text in the input until the next store update (a toast is shown). A rename flushed for a page deleted mid-debounce is dropped silently (no call, no toast). BlockNote 0.56 has a single `heading` placeholder key, so "Tiêu đề" is shown for all heading levels.

## D-014 Save pipeline (Phase 1 Task 14)
Status: decided (2026-10-28)
- `invalid_op` (beyond §5.5): retrying the same batch would fail forever, so the pipeline logs it, toasts `saveFailed` once and, on the next backoff retry, performs a FULL resync: `tabLoad(tabId)` → collect stored ids → upsert every document block (document order) + one delete for stored ids the document lacks. Because of this the backend option is `Pick<Backend, "tabApply" | "tabLoad">` (brief said `tabApply` only). If the resync itself fails it stays pending and retries with the normal backoff.
- `not_found`: dirty set dropped, status `saved`, pipeline disposed, no toast. Other errors: ids merged back, status `error`, one toast per failure streak (reset on success), retry after `retryBaseMs × 2^n` capped at `retryMaxMs`. While in `error`, new edits do not schedule the debounce timer (the backoff timer drives retries); explicit `flush()` still tries at once.
- `flush()` calls are serialised on a promise chain; it never rejects. Dirty ids also include descendants of inserted blocks (undo of a delete / paste re-creates whole subtrees); moves add only the moved block.
- Per-tab pipeline (fix round 3, replaces the retire/hand-off/adopt design of rounds 1-2, which kept losing ids in chained hand-offs): ONE `SavePipeline` per tabId, held by `pipelineRegistry` (`getPipeline(tabId, backend)`), outliving editor instances. Editors `attach(editor)` (subscribes, becomes the document source, and every document block not in the pipeline's known-stored id set becomes dirty) and `detach(editor)` (only acts if it is the attached editor, so StrictMode's attach/detach/attach is safe; flushes at once; the editor stays the document source). The dirty set therefore never moves between objects and cannot be dropped.
- A detached pipeline keeps retrying with backoff while it has pending work and disposes itself (leaving the registry) only when detached AND clean (nothing dirty, in flight or failing), or on `not_found`. `flushAll()` flushes every registry pipeline, attached or detached (one attempt each).
- Stored ids: `seedStoredIds(ids)` (from the loaded tree; ignored once seeded), added on successful upserts, removed on successful deletes, reset by a resync. `Editor.tsx` asks `pendingDocumentFor(tabId)` before `tabLoad`: a pipeline with unsaved work gives its current document (same block ids) as the new editor's initial content and its stored ids; otherwise `tabLoad` is used.
- Default block (fix round 1): on attach the pipeline marks every document block whose id is not in the known stored ids (the loaded tree) dirty, so BlockNote's default block on an empty page is saved with the first change (no `invalid_op`). This means opening an empty page writes its default block once.
- Resilience (fix round 1): the flush queue ends in `.catch(log)`; `onError`, status listeners and the toast are wrapped so a throwing callback cannot stop saving; the default `onError` is `console.error`. `fail()` clears the debounce timer (retries follow the backoff only) and keeps the earliest `firstDirtyAt`. Unmount does not overwrite a pending `error` status with `saved`. A disposed pipeline reports `saved`.
- The status shown by `SaveStatus` lives in `pageStore.saveStatus` (set by the mounted editor's pipeline). The `open()` race fix: the `latestOpen` ticket is taken before the same-page early return, so clicking the still-current page cancels an in-flight open of another page (last click wins).
- Headless tests: `BlockNoteEditor.create` in jsdom fires `onChange` for API edits (`updateBlock`, `insertBlocks`, `removeBlocks`, `unnestBlock`, `moveBlocksUp`); only the undo test needs `editor.mount(document.createElement("div"))` (undo needs a view). `onChange` is registered with `includeUpdatesFromRemote = false` as well as the source check.
- WebKit: `Home` scrolls the page on macOS, so e2e uses `Meta+ArrowLeft` to reach the start of a line. All §A3 shortcuts and Enter/Backspace rules behave as specified in BlockNote 0.56; no `test.fixme` needed.

## D-015 Sidebar search (Phase 1 Task 15)
Status: decided (2026-10-28)
- Query state lives in `Sidebar`; `SearchBox` keeps its own input text and reports the query only when not composing (IME): nothing is searched mid-composition, the final text is reported on `compositionend`, and Enter is ignored while composing or when `keyCode === 229` (same rule as `PageTitle`). Enter opens the first result.
- `useSearchResults` debounces 200 ms and uses a request counter: a response is applied only if no newer query (or clear) started since; stale responses and their errors are dropped.
- Escape clears the query and returns to the tree. Clicking a result opens the page and KEEPS the query and results, so the user can click through several results (selected result is highlighted).
- Snippets are plain text (React text node), clamped to 2 lines by CSS. `menu:search` focuses the box (no select-all). A whitespace-only query counts as empty (tree shown).
- Enter acts only on results that belong to the current query: `useSearchResults` returns `{ query, hits, searchNow }`; if `query` differs from the typed text, Enter cancels the debounce, searches the typed text at once and opens its first hit when it arrives (dropped if a newer query started meanwhile). The list is dimmed while it belongs to an older query.
- Results are not refreshed after a rename/delete/create until the next keystroke.

## D-016 Find in page (Phase 1 Task 16)
Status: decided (2026-10-28)
- Registration: BlockNote 0.56's public extension API (`createExtension` + the `extensions` option of `useCreateBlockNote`), not `_tiptapEditor.registerPlugin`. The extension `find` contributes the find plugin plus a tiny mirror plugin whose view pushes the plugin state into the extension's `store`, which `FindBar` reads with `useSyncExternalStore`. Commands are meta-only transactions (`editor.transact(tr => tr.setMeta(findPluginKey, action))`): the document and selection are never touched.
- `foldWithMap` (TS) returns UTF-16 offsets, one map entry per UTF-16 unit of the folded string (an astral char has two equal entries); Rust counts chars. Identical for text without astral chars; UTF-16 is what ProseMirror text offsets need.
- Whitespace in TS fold is an explicit class equal to Rust's `char::is_whitespace` (U+0085 yes, U+FEFF no); the shared fixture got rows for tab, NBSP, NEL and BOM, so Rust runs them too.
- Matches are per textblock (never across blocks), non-overlapping, left to right; non-text inline nodes (hard breaks, ...) are match boundaries: the textblock is split into runs there and a query never matches across one. A match end advances past following combining marks so decomposed (NFD) chars are never split. The query is folded with the same `fold`; a whitespace-only query matches nothing. The current index resets to the first match when the query changes and is clamped when the document changes under an open bar.
- The find bar keeps its text across close; closing clears the decorations, reopening (⌘F) re-applies the query and selects the text. Closing focuses the editor. IME: only committed text is searched, Enter during composition (keyCode 229) is ignored. Navigation and query changes scroll the current match to the centre (`domAtPos` + `scrollIntoView`).
- Added `prosemirror-model/state/view` (exact versions BlockNote already resolves) as direct dependencies of `ui`; new `vi` keys `findNext`, `findPrev`, `findClose` for the bar's button labels.
- Escape closes the bar from its input (ignored while composing / keyCode 229) and from the editor (document capture-phase listener, only while open and only if no BlockNote suggestion menu (`.bn-suggestion-menu`, slash) or grid suggestion menu (`.bn-grid-suggestion-menu`, emoji picker) is open: that Escape belongs to the menu). Escape from the editor closes the bar and leaves the editor blurred: that is BlockNote's own Escape behaviour (its handler runs after the bar's capture listener and blurs; Phase 2 Task 6h). Closing from the bar's input or its close button focuses the editor. The bar resets `findOpen` on unmount.

## D-017 — Quit flush covers pending title renames; new pages focus their title
Status: decided (2026-10-29)
- `App` registers `backend.onFlushRequest(flushForQuit)` once (effect cleanup unsubscribes, so StrictMode's double mount leaves one listener). `flushForQuit` (`ui/src/state/quitFlush.ts`) awaits `flushAll()` (every tab pipeline) and every mounted `PageTitle`'s "save pending rename now", which is registered in a small set and removed on unmount. A title still inside its 400 ms debounce is therefore stored before `quit_ready`.
- A page created from the menu or the sidebar button (`createAndOpenPage`) asks `uiStore.titleFocusPageId` for focus; the matching `PageTitle` takes focus on mount and clears the request. Pages opened by clicking do not steal the caret.
- The fake backend gained `emitFlushRequest()` (awaits all subscribers) so Playwright can simulate the shell's `flush-request`.

## D-018 Debug builds use their own data directory (Phase 1 final review)
Status: decided (2026-10-29)
- `cfg!(debug_assertions)` builds (`npm run dev`, `cargo run`) store the database and assets under `<app_data_dir>/dev/`; release builds use `<app_data_dir>/`. A developer run can therefore never write, migrate or corrupt the installed app's `folio.sqlite`. Consequence: notes made in dev mode are not visible in the installed app and vice versa.

## D-019 Page column: border-box with width 100%, max-width 1044px (Phase 2 Task 1)
The content column is 900 px of text between 72 px gutters. `.page` is `box-sizing: border-box; width: 100%; max-width: 1044px` (900 + 2 x 72) instead of content-box `max-width: 900px`: inside the flex-column `<main>`, `margin: 0 auto` made a content-box block shrink to its content (title was 366 px wide), and border-box + `width: 100%` also lets the column shrink with a narrow window. Gutter stays 72 px; BlockNote's side menu fits at a 900 px viewport. The editor has no background of its own (`editor.css` overrides BlockNote's `--bn-colors-editor-*` on `.bn-container.bn-root`).
Status: accepted. `theme.css` already sets global `box-sizing: border-box`, so the column's border-box is consistent with the rest of the UI.

## D-020 E2E runs on its own port with the fake backend (Phase 2 Task 1 fix)
`playwright.config.ts` starts `npm run dev:e2e` (`VITE_BACKEND=fake vite --port 5199 --strictPort`) and never reuses a running server unless `E2E_REUSE_SERVER=1`. A developer's `npm run dev` (real backend, port 5173) previously got reused and broke every spec. Status: accepted.

## D-021 Formatting toolbar: own show rule, synced into BlockNote's store (Phase 2 Task 2)
BlockNote 0.56's `FormattingToolbarController` takes no show condition; its extension opens the toolbar for any non-empty selection that contains no code block. Folio's rule is `shouldShowToolbar` (`ui/src/editor/toolbar/toolbarVisibility.ts`): hidden for an empty selection, during IME composition (`view.composing`) and when the selection lies entirely in code blocks; shown when it spans a paragraph and a code block. `ToolbarVisibilitySync` (renders nothing) sets the extension's store to that rule after BlockNote's own listeners (change, selection, pointer-up; it stays out of mouse drags), and `FolioFormattingToolbar` renders `null` when the rule says no. The toolbar has six buttons (bold, italic, underline, strike, code, link); the Comment button of tech spec §5.14 arrives with Phase 6.
- BlockNote's `codeBlock` has no inline styles, so ⌘B/I/U inside a code block already do nothing; no keymap guard added (e2e asserts it). In a mixed selection formatting skips the code block.
- BlockNote's toolbar components forward no props, so `data-testid`s (`fmt-toolbar`, `fmt-bold` ... `fmt-link`) are set on their DOM nodes in an effect.
- The composing test forces `view.composing` by defining a getter on the view instance (jsdom cannot start a real composition) and removes it afterwards.
Status: accepted.

## D-022 Slash menu: own items, own composing guard, code blocks suppressed by BlockNote (Phase 2 Task 3)
`slashMenu={false}` + `SuggestionMenuController triggerCharacter="/"` with `getItems = filterSlashItems(slashItems(editor), query)` (`ui/src/editor/slashMenu.ts`; BlockNote's `filterSuggestionItems` and default items are unused). Items apply through `insertOrUpdateBlockForSlashMenu`: the current block is converted when empty (or only the typed `/`), else the new block goes below. Table uses BlockNote's own default shape, 2 rows x 3 columns (the "3x2" of the plan), header row per block default.
- Test ids: BlockNote's Mantine menu primitives reject extra props, so `SlashMenuComponent` renders them and wraps the list in `div[data-testid=slash-menu]` and each item in `div[data-testid=slash-item][data-key]` (no styling on the wrappers).
- IME: BlockNote's suggestion plugin opens from `handleTextInput` without checking `view.composing`. `slashComposingGuard` (extension, `runsBefore: ["suggestionMenu"]`) has a plugin whose `handleTextInput` inserts text that is a LONE `/` itself and reports it handled while `view.composing`, so the suggestion plugin never sees it. The Vitest test fails without the guard. The WebKit e2e composing test (`compositionstart` + typed `/`) passes with or without it, because synthetic typing does not reach `handleTextInput` as a composition; it is a smoke check only.
- The guard intercepts only a lone `/` and uses ProseMirror's own `deflt()` transaction (keeps the `"composition"` meta and DOM-read selection); it also catches a composed `/` flushed after `compositionend` (transaction tagged `"composition"`).
- Table cells: `shouldOpen` = BlockNote's default rule (`!$from.parent.type.isInGroup("tableContent")`), so no slash menu inside cells (e2e).
- Code blocks: no guard needed. BlockNote's suggestion plugin `apply` ignores transactions whose selection parent has `spec.code`, so the menu never opens in a code block (e2e asserts it).
- The English `slash_menu` entry in `dictionary.ts` stays (BlockNote's default items, if ever rendered, stay English); Folio's labels live in `vi.slashMenu`.
Status: accepted.

## D-023 Block handles: BlockNote side menu with a delete-only drag menu; multi-block drag deferred (Phase 2 Task 4)
`sideMenu={false}` + `<SideMenuController sideMenu={FolioSideMenu} />`. `FolioSideMenu` = BlockNote's `AddBlockButton` + `DragHandleButton` with a `dragHandleMenu` holding one `RemoveBlockItem` (`vi.delete`); the colour and table-header items are left out. + inserts a paragraph below (or reuses an empty block) and opens the slash menu, all BlockNote behaviour; dragging a list item moves its nested children because BlockNote nests them.
- Test ids: BlockNote's buttons and menu items forward no props, so `side-add`, `side-drag` (found through the icons' `data-test`) and `drag-menu-delete` are set on the DOM nodes (ref callback for the menu item, whose content mounts only while the menu is open).
- Focus after a drop: the drag starts on the handle button, so focus ends outside the editor and a following ⌘Z reached the webview's native undo, which wiped the document instead of reverting the move. `useFocusAfterDrop` refocuses the editor after a drop inside it, so one ⌘Z reverts the whole move (e2e asserts the stored tree after reload).
- Playwright's `page.mouse` (down on the handle, move in steps, up) does drive BlockNote's HTML5 drag in WebKit, so the drag, undo, drop-onto-itself and Escape tests are real e2e tests (no Vitest fallback needed). Escape and drop-onto-itself assert that no `tabApply` is sent.
- Deferred: dragging a multi-block selection as one unit (allowed by the block-controls spec); a handle drag moves only its own block (with children).
Status: accepted.

## D-024 Native undo/redo guard (Phase 2 Task 4 fix)
WebKit records one native undo step per run of native typing in the contentEditable, and a single native `undo:` (⌘Z with focus outside ProseMirror, or the Edit menu's `document.execCommand("undo")` even with focus inside) fires `beforeinput` `historyUndo` on the editor once per recorded step in the same task. prosemirror-history answers each with a full undo, so N steps were undone and the document was wiped and saved: native undo maps 1:N onto ProseMirror history. `installNativeHistoryGuard` (`ui/src/editor/nativeHistoryGuard.ts`, installed once from `Editor.tsx`) is a capture-phase `beforeinput` listener on `document`: for `historyUndo`/`historyRedo` aimed at the active editor's DOM it calls `preventDefault` + `stopImmediatePropagation`, then at most once per task (flag reset by `setTimeout(0)`) runs `editor.undo()`/`redo()` if focus is inside the editor, and does nothing if focus is outside. Events on ordinary inputs (title, find, search, rename) pass through, so their own undo works. The Edit-menu Undo/Redo items were first kept as predefined native items; superseded by D-026 (they worked only once per typing burst). `useFocusAfterDrop` stays (it keeps ⌘Z working after a drop) and clears its timeout on unmount. `e2e/undo.spec.ts` covers the cases (7 of 8 fail without the guard).
Status: accepted.

## D-025 Vietnamese BlockNote strings (Phase 2 Task 5)
`ui/src/editor/dictionary.ts` = BlockNote 0.56 `vi` locale + English `slash_menu` + Folio overrides. 0.56 key names: `formatting_toolbar.{bold,italic,underline,strike,code,link}.tooltip`, `drag_handle.delete_menuitem`, `placeholders.*`.
- Overrides on `vi`: bold "Đậm" (vi: "In đậm"), italic "Nghiêng" ("In nghiêng"), underline "Gạch chân" ("Gạch dưới"), link "Liên kết" ("Tạo liên kết"), strike "Gạch ngang" (same), code "Code" (same); `drag_handle.delete_menuitem` "Xoá" (vi: "Xóa", Folio spells it "Xoá" everywhere).
- Beyond the brief: `formatting_toolbar.strike.secondary_tooltip` "Mod+Shift+S" (the vi locale shows "Mod+Shift+X", but BlockNote binds strike to Mod+Shift+S, so the hint was wrong); `link_toolbar.delete.tooltip` "Xoá liên kết" (spelling consistency); `side_menu.drag_handle_label` "Mở menu khối" (vi: "Mở trình đơn khối", stiff); `table_handle.delete_column_menuitem`/`delete_row_menuitem` "Xoá cột"/"Xoá hàng" (spelling; Phase 3 shows them).
- Audit: the sections `formatting_toolbar`, `link_toolbar`, `side_menu`, `drag_handle`, `suggestion_menu` have no string left in English (vitest compares with `en`; allow-list: "Code" and the `secondary_tooltip` keyboard hints). The vi locale already covered every shown control; no missing sections.
Status: accepted.

## D-026 Edit-menu Undo/Redo are custom items routed by the UI (Phase 2 Task 6i)
The native `undo:`/`redo:` predefined items ran into the D-024 guard: one native undo fired N `historyUndo` events, the guard keeps one per task and only for focus inside the editor, so the menu item worked once per typing burst. `crates/folio-app/src/menu.rs` now has custom items "Hoàn tác" (⌘Z) and "Làm lại" (⇧⌘Z) with ids `undo`/`redo` that emit `menu:undo` / `menu:redo` (`MenuEvent` gained `"undo" | "redo"`; the fake backend's `emitMenu` takes them). The other Edit items stay predefined.
- `App` routes both through `routeMenuHistory` (`ui/src/editor/menuHistory.ts`): focus inside the active editor -> `editor.undo()`/`redo()` (exactly one ProseMirror step); focus in a text `<input>`/`<textarea>` -> `document.execCommand("undo"|"redo")` (the guard ignores non-editor targets); otherwise nothing. Neither runs under an active composition.
- Real key paths (macOS): wry lets the WKWebView see ⌘Z first (`WryWebView::performKeyEquivalent` -> page keydown); only unhandled events go on to the menu. Editor: BlockNote's Mod-z keymap does one step and the menu is not fired. Text input: not handled by the page, so menu -> router -> `execCommand` (one step). Editor with empty history, or composing: menu -> router (composing: nothing, see below). In the Playwright fake there is no native menu, so ⌘Z there exercises the D-024 native path and `emitMenu("undo")` the menu path (3 undos after 3 typing groups = 3 steps, stored tree checked, then 3 redos).
- IME: the router and the D-024 guard both skip running history while `view.composing` (ProseMirror skips its own keydown then; history under a Telex/VNI composition risks garbled text). The guard still swallows the event.
- Caveats: `execCommand("undo")` shares WebKit's undo stack, so it is not strictly "that field only" (stale editor steps can sit on top). The custom items are always enabled and show no "Undo Typing" title. On Windows/Linux a field may see both its own Ctrl+Z and the menu accelerator (double-step risk), and Ctrl+Y has no accelerator; Folio targets macOS first.
- Rust: a menu cannot be built off the main thread in a unit test, so `menu.rs` tests check the id -> event table and (source scan) that the production code has no predefined undo/redo item.
- Not covered: the native app is untested here (no GUI); the accelerator-intercept behaviour is Tauri/muda's documented behaviour.
Status: accepted.

## D-027 Prettier is not adopted (Phase 2 Task 7f)
Formatting is enforced by `cargo fmt --all --check` for Rust and ESLint for the UI (both run in `scripts/check.sh`). A second formatter would add a config, a CI step and diff churn for no behaviour gain on a one-person codebase. The Phase 1 "add Prettier" carry-over is closed as won't-do; revisit only if UI style drift becomes a review problem.
Status: accepted.

## D-028 BlockNote's emoji picker is disabled (Phase 2 final review)
`emojiPicker={false}` on `BlockNoteView`. The spec does not ask for it, and its `:` trigger opens from `handleTextInput` with no `view.composing` check, the same IME hazard D-022 guards for `/`. `:smile` now stays plain text (e2e). The `.bn-grid-suggestion-menu` selector in `FindBar`'s Escape handling is kept: it is harmless and still covers any grid menu; the find e2e for "Escape closes only the open menu" now uses the slash menu.
Status: accepted.

## D-029 Table handles and menus (Phase 3 Task 1)
`Editor.tsx`: `tables: { headers: true, splitCells: false, cellBackgroundColor: false, cellTextColor: false }`, `tableHandles={false}` on `BlockNoteView` and `<FolioTableHandles />` (`ui/src/editor/table/FolioTableHandles.tsx`) in its place: `TableHandlesController` with BlockNote's `TableHandle` (row and column, wrapped to carry `data-testid="table-handle-row|column"`), BlockNote's `ExtendButton`s, and no cell button (`tableCellHandle` renders nothing; BlockNote hides it anyway when split/colour are off).
- Menu (a Folio `tableHandleMenu`): row handle = Thêm hàng phía trên / Thêm hàng phía dưới / Xoá hàng / Hàng tiêu đề (only on row 0); column handle = Thêm cột bên trái / Thêm cột bên phải / Xoá cột / Cột tiêu đề (only on column 0). No colour, split or merge items. The add items are BlockNote's `AddButton`; delete and the header toggles are Folio components (BlockNote does not export its header buttons and its default menu includes the colour picker).
- Dictionary key names (0.56): `table_handle.{add_above,add_below,add_left,add_right,delete_row,delete_column}_menuitem` and, for the header toggles, `drag_handle.header_row_menuitem` / `drag_handle.header_column_menuitem` (they live in `drag_handle`, not `table_handle`). Overrides: "Thêm hàng phía trên", "Thêm hàng phía dưới", "Thêm cột bên trái", "Thêm cột bên phải", "Xoá hàng", "Xoá cột", "Hàng tiêu đề" (vi: "Tiêu đề hàng"), "Cột tiêu đề" (vi: "Tiêu đề cột"). `table_handle` joins the audited sections in `dictionary.test.ts`.
- Delete of the only row or only column removes the whole table block (`editor.removeBlocks`). BlockNote's `removeRowOrColumn` goes through prosemirror-tables `deleteRow`/`deleteColumn`, which refuse (no-op) when the selection spans the whole table, so the rule is implemented in Folio's delete item.
- The header toggles are BlockNote's own behaviour reproduced: `editor.updateBlock` setting `headerRows` / `headerCols` to 1 or undefined; the item shows a check mark when on.
- Menu items have `role=menuitem` / `menuitemcheckbox` but no `bn-menu-item` class (only the header toggles' original had it); e2e selects `.bn-table-handle-menu [role^="menuitem"]`.
- **Deleting a header row/column (Task 4 follow-up, Notion parity):** BlockNote 0.56 / prosemirror-tables alone leave the table with no header after deleting row 0 (column 0) of a table with `headerRows` (`headerCols`) 1. Folio's delete item restores it: when index 0 is deleted while the header flag is on and more than one row/column remains, the delete and `headerRows`/`headerCols = 1` run in one `editor.transact`, so the new first row/column stays a header and one ⌘Z restores rows and header together (column widths shift with the deleted column). Toggling the header row or column keeps `columnWidths`. Column resize and row/column drag-reorder are BlockNote's own and covered by Playwright WebKit with `page.mouse`; a dragged column carries its width.
Status: accepted.

## D-030 Table cell keyboard navigation (Phase 3 Task 2)
`ui/src/editor/table/tableKeys.ts` (`tableKeysExtension`, registered in `Editor.tsx`). BlockNote 0.56's own table extension already implements **Tab / Shift-Tab** (`goToNextCell`, the first cell stays put), **Enter** (the cell below; nothing in the last row) and **Shift-Enter** (a line break in the cell, stored as `\n`). Missing, and added here: **Tab in the last cell** and **Enter in the last row** append a row and move the caret into it (first cell, resp. the same column), and **IME safety** for all four keys.
- Ordering: a Folio extension has priority 101, above BlockNote's tiptap table shortcuts (100), so its `keyboardShortcuts` run first and return `false` for everything BlockNote already does.
- While composing in a cell (`view.composing`, `event.isComposing` or `keyCode === 229`) the handler returns `true` for Tab, Shift-Tab, Enter and Shift-Enter: the key is consumed and does nothing. Returning `false` would let BlockNote's table shortcut move the caret or add a row on the very key the IME used to confirm its text (Safari delivers that Enter as a keyCode-229 keydown after `compositionend`). Outside a table the handlers always return `false`.
- The row is appended with prosemirror-tables' `addRowAfter` (header rows, cell types and column widths are handled by it) in a custom dispatch that also sets the caret, so row and caret move are **one transaction, one undo step** (e2e: one ⌘Z removes the added row). `prosemirror-tables` is declared in `ui/package.json` at the exact version `1.8.5` (the single hoisted copy, matching `@blocknote/core`'s `^1.8.5`), next to the other pinned prosemirror-* packages. It is imported directly because BlockNote's `addRowOrColumn` only works for the hovered table (it throws for keyboard use). Keep it equal to the copy BlockNote resolves when upgrading BlockNote.
- Moving to a non-last cell keeps BlockNote's behaviour (the target cell's whole content is selected); a newly added row's cell is empty, so the caret is simply placed in it.
- **Selection stays in the cell (Task 3 fix):** in WebKit Shift-Home / Shift-End inside a cell extended the selection across the neighbouring cells (one ⌘B then bolded all of them). `tableKeysExtension` now handles Shift-Home, Shift-End and, for the macOS line selection, Meta-Shift-ArrowLeft / ArrowRight: for a text selection whose anchor and head are in the same cell it extends the head to the start or end of the cell's text and returns `true`; while composing it swallows the key; otherwise (outside a table, anchor in another cell, cell selection) it returns `false`. Meta (not Mod) is bound so Ctrl-Shift-Arrow word selection on Windows/Linux is untouched.
Status: accepted.

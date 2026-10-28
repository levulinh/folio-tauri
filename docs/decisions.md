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
- `blocking` maps a poisoned store mutex to `ErrorPayload { code: "db", message: "store lock poisoned" }` and a failed blocking task to code `db`.
- Quit: the 3 s timeout runs on a plain `std::thread`; `quit_ready` sets `quitting` before `app.exit(0)` so the final `ExitRequested` is never prevented. `CloseRequested` is always prevented (the flow either starts or is already running).
- Fix round 1: tao 0.37.2's macOS app delegate has no `applicationShouldTerminate:`, so Dock → Quit / logout skip `ExitRequested`. `quit::install_dock_quit_hook` adds that method to the delegate's class at runtime (objc2 `class_addMethod`, called in `setup`): it starts the flush and returns `NSTerminateCancel`, and returns `NSTerminateNow` only once `AppState.exiting` is set by the final `app.exit(0)`. If the method already exists the hook logs and is skipped (then Dock quit would skip the flush; up to the last debounce window could be lost).
- A poisoned store mutex is recovered with `into_inner` (rusqlite rolls back the panicked transaction); a panic inside a command is caught and returned as `db` / "internal error: <message>". Exit (`RunEvent::Exit`, timer, `quit_ready`) waits for the store lock so an in-flight transaction commits first.
- Phase 1 checklist item: "Thoát bằng Dock (chuột phải icon → Thoát) ngay sau khi gõ rồi mở lại — chữ vừa gõ còn nguyên".

## D-011 Fake backend fidelity and platform split (Phase 1 Task 11)
Status: decided (2026-10-28)
- The fake mirrors the core's `apply` validation order and all-or-nothing semantics (works on a copy, commits at the end), search tokenising/ranking/snippets and the 50-page search limit. Sibling order is array order; `orderKey` of pages is a synthetic zero-padded index (the UI never interprets it). Dropdown chips contribute no search text in the fake (the core resolves option names; option sets arrive in a later phase).
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
- Unmount (`retirePipeline` in `pipelineRegistry.ts`): unregister, keep the pipeline in a `retired` map by tabId, flush in a loop until nothing is pending (edits made during the final flush are included; `flushAll()` waits for it), then dispose. If it fails it keeps retrying in the background and disposes itself on `saved`, so a transient error while leaving a page cannot lose text.
- Hand-off (fix round 1): a retired, not-yet-saved pipeline must never race a newer editor on the same tab. When an Editor for that tab mounts, `takeOverRetired(tabId)` stops the retired pipeline (`handOff()`: no timers, waits for an in-flight request, returns its dirty ids + resync flag), the new editor is seeded with the retired editor's CURRENT document instead of `tabLoad` content (`tabLoad` is still called for the stored ids), and the new pipeline adopts the ids. `flushAll()` also flushes retired pipelines (one attempt each). Loads are shared per tab so React StrictMode's double effect cannot lose a taken-over state; if the last consumer is cancelled the state goes back under a new retired pipeline.
- Default block (fix round 1): at creation the pipeline marks every document block whose id is not in `storedIds` (the ids of the loaded tree) dirty, so BlockNote's default block on an empty page is saved with the first change (no `invalid_op`). This means opening an empty page writes its default block once.
- Resilience (fix round 1): the flush queue ends in `.catch(log)`; `onError`, status listeners and the toast are wrapped so a throwing callback cannot stop saving; the default `onError` is `console.error`. `fail()` clears the debounce timer (retries follow the backoff only) and keeps the earliest `firstDirtyAt`. Unmount does not overwrite a pending `error` status with `saved`. A disposed pipeline reports `saved`.
- The status shown by `SaveStatus` lives in `pageStore.saveStatus` (set by the mounted editor's pipeline). The `open()` race fix: the `latestOpen` ticket is taken before the same-page early return, so clicking the still-current page cancels an in-flight open of another page (last click wins).
- Headless tests: `BlockNoteEditor.create` in jsdom fires `onChange` for API edits (`updateBlock`, `insertBlocks`, `removeBlocks`, `unnestBlock`, `moveBlocksUp`); only the undo test needs `editor.mount(document.createElement("div"))` (undo needs a view). `onChange` is registered with `includeUpdatesFromRemote = false` as well as the source check.
- WebKit: `Home` scrolls the page on macOS, so e2e uses `Meta+ArrowLeft` to reach the start of a line. All §A3 shortcuts and Enter/Backspace rules behave as specified in BlockNote 0.56; no `test.fixme` needed.

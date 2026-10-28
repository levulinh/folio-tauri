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

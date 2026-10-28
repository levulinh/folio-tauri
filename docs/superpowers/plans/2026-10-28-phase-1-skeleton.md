# Phase 1 — Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Precondition:** `docs/decisions.md` D-001 says "BlockNote 0.56" (Phase 0 passed). If not, stop.

**Goal:** A working Folio on Tauri 2: page tree, one tab per page, BlockNote editor with the default blocks and Markdown shortcuts, autosave to SQLite through the edit API, accent-insensitive search, find in page, safe quit.

**Architecture:** `crates/folio-core` (pure Rust: SQLite store, edit ops, folding, search) ← `crates/folio-app` (Tauri 2 commands, menus, quit flow) ← `ui/` (React + BlockNote) talking only to a `Backend` interface with a Tauri implementation and an in-memory fake used by Vitest and Playwright.

**Tech Stack:** Rust stable, Tauri 2.12.5, rusqlite 0.41 (bundled), ts-rs 12.0.1, React 19.3.1, BlockNote 0.56.0, Mantine 9, zustand 5.0.16, Vite 8.3.5, TypeScript 6.0.3, Vitest 5.0.5, Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-28-folio-tauri-tech-spec.md` (binding) and `docs/superpowers/specs/2026-10-28-folio-tauri-rewrite-design.md` (intent). Read tech spec §0 "Rules for implementing agents" before Task 1. Section references below (§x.y) are to the tech spec.

## Global Constraints

- Exact versions from §1.2; substitutions recorded in `docs/decisions.md`.
- npm workspaces; root scripts proxy to `ui`.
- `folio-core` never depends on `tauri` (`cargo tree -p folio-core | grep -i tauri` prints nothing).
- Only `ui/src/backend/tauriBackend.ts` and `ui/src/platform/*` import `@tauri-apps/*`.
- All UI text from `ui/src/i18n/vi.ts` (§5.13); slash menu labels English (Phase 2).
- Times are epoch milliseconds `i64` in Rust, `number` in TS: every `i64` field gets `#[ts(type = "number")]` (ts-rs maps `i64` to `bigint` otherwise).
- All structs crossing the boundary: `#[serde(rename_all = "camelCase")]`, `#[derive(TS)] #[ts(export)]`; generated into `ui/src/backend/generated/` via `.cargo/config.toml` `TS_RS_EXPORT_DIR` (§4.3).
- Every commit passes `scripts/check.sh`.
- Window: `dragDropEnabled = false`, overlay title bar (§1.1).

## Review Focus

- **Large paste** (500 paragraphs pasted at once) → exactly one `tabApply` call with 500 `upsert` ops and the editor stays responsive. Test in Task 14.
- **Page deleted while its editor has unsaved edits** → the pending flush gets `not_found`; the pipeline drops those ops and stops retrying (no endless retry, no toast loop). Test in Task 14.
- **Search with FTS syntax characters** (`"`, `*`, `-`, `(`, `OR`, `NEAR`, `:`) → no error, treated as plain text. Test in Task 9.
- **Titles: empty, whitespace-only, emoji, 500 characters** → stored as typed, round-trip exactly, sidebar shows `Không có tiêu đề` only for the empty string and ellipsizes long titles. Tests in Tasks 6 and 12.
- **Switching pages while a flush is in flight** → each pipeline writes only to its own `tabId`; nothing lands in the newly opened page. Test in Task 14.

---

## File map (Phase 1)

```
Cargo.toml  rust-toolchain.toml  .cargo/config.toml  package.json  .gitignore  scripts/check.sh
crates/folio-core/src/{lib.rs,error.rs,ids.rs,time.rs,order.rs,fold.rs,text.rs,pages.rs,tabs.rs,blocks.rs,search.rs}
crates/folio-core/src/db/{mod.rs,migrations/0001_init.sql}
crates/folio-core/src/model/{mod.rs,entities.rs,block.rs,ops.rs}
crates/folio-core/tests/{store.rs,pages_tabs.rs,apply.rs,search.rs,bindings.rs}
crates/folio-app/{Cargo.toml,build.rs,tauri.conf.json,capabilities/default.json,icons/}
crates/folio-app/src/{main.rs,state.rs,commands.rs,menu.rs,quit.rs}
ui/{package.json,vite.config.ts,tsconfig.json,index.html,eslint.config.js,playwright.config.ts}
ui/src/{main.tsx,App.tsx,App.module.css,theme.css}
ui/src/i18n/vi.ts
ui/src/backend/{Backend.ts,tauriBackend.ts,fakeBackend.ts,index.ts,generated/}
ui/src/lib/fold.ts
ui/src/platform/{menuEvents.ts,quit.ts}
ui/src/state/{pagesStore.ts,pageStore.ts,uiStore.ts}
ui/src/sidebar/{Sidebar.tsx,PageTree.tsx,PageTreeItem.tsx,SearchBox.tsx,SearchResults.tsx,*.module.css}
ui/src/page/{PageView.tsx,PageTitle.tsx,SaveStatus.tsx,EmptyState.tsx,*.module.css}
ui/src/editor/{schema.ts,convert.ts,dictionary.ts,Editor.tsx,savePipeline.ts,pipelineRegistry.ts}
ui/src/editor/find/{findPlugin.ts,FindBar.tsx,FindBar.module.css}
ui/src/ui/{Toast.tsx,ConfirmDialog.tsx,*.module.css}
ui/e2e/{pages.spec.ts,editor.spec.ts,search.spec.ts,find.spec.ts}
docs/manual-checklists/phase-1.md
```

**Test ids** (use exactly; Playwright depends on them): `sidebar-new-page`, `tree-item` (with `data-page-id`), `tree-item-title`, `tree-item-add-child`, `tree-item-menu`, `menu-rename`, `menu-delete`, `confirm-ok`, `confirm-cancel`, `empty-create-first`, `page-title`, `editor` (wrapper of the active BlockNoteView), `save-status` (with `data-status="saved|saving|error"`), `search-input`, `search-result` (with `data-page-id`), `find-input`, `find-count`, `find-next`, `find-prev`, `find-close`, `toast`.

---

### Task 1: Workspace scaffold and check script

**Files:**
- Create: `Cargo.toml`, `rust-toolchain.toml`, `.cargo/config.toml`, `package.json`, `scripts/check.sh`, `.gitignore` (append `ui/dist`, `ui/test-results`, `ui/playwright-report`)
- Create: `crates/folio-core/Cargo.toml`, `crates/folio-core/src/lib.rs` (empty module list)
- Create: `crates/folio-app/*` (minimal Tauri app that shows `ui/`)
- Create: `ui/*` (Vite React TS app rendering "Folio")
- Create: `docs/decisions.md` (if Phase 0 left it, keep it)

**Interfaces:**
- Produces: `npm run dev` opens a Tauri window loading `http://localhost:5173`; `npm run -w ui dev:web` serves the UI alone; `scripts/check.sh` runs all checks.

- [ ] **Step 1: Root files.** `Cargo.toml`: `[workspace] resolver = "2"`, members `crates/folio-core`, `crates/folio-app`; `[workspace.package] edition = "2021"`; `[workspace.dependencies]` with every Rust crate from §1.2 at its pinned version. `rust-toolchain.toml`: `channel = "stable"`, components `rustfmt`, `clippy`. `.cargo/config.toml`: the `[env] TS_RS_EXPORT_DIR` block from §4.3. Root `package.json`: `"private": true`, `"workspaces": ["ui"]`, scripts `dev` (`npm run -w ui tauri -- dev`), `build` (`npm run -w ui tauri -- build`), `check` (`bash scripts/check.sh`).
- [ ] **Step 2: `folio-core` crate.** Deps (from workspace): rusqlite (bundled), serde, serde_json, uuid, fractional_index, unicode-normalization, thiserror, chrono, ts-rs (feature `serde-json-impl`); dev: tempfile, pretty_assertions. `lib.rs` empty for now.
- [ ] **Step 3: `ui` app.** Create by hand (no generator): `package.json` (name `folio-ui`, `"type": "module"`, deps/devDeps at §1.2 versions incl. `@tauri-apps/cli`), scripts: `dev` (`vite`), `dev:web` (`VITE_BACKEND=fake vite`), `build` (`tsc -b && vite build`), `typecheck` (`tsc -b --noEmit`), `lint` (`eslint .`), `test` (`vitest run`), `e2e` (`playwright test`), `gen` (`cd .. && cargo test --workspace export_`), `tauri` (`tauri`). `vite.config.ts`: react plugin, `server.port = 5173`, `strictPort: true`, `clearScreen: false`, `test: { environment: "jsdom", include: ["src/**/*.test.ts?(x)"] }`. `tsconfig.json`: strict, `noUncheckedIndexedAccess`, `jsx: react-jsx`, `moduleResolution: bundler`. `eslint.config.js`: typescript-eslint recommended + a `no-restricted-imports` rule forbidding `@tauri-apps/*` except in `src/backend/tauriBackend.ts` and `src/platform/**`. `src/main.tsx` renders `<App/>`; `App.tsx` renders `Folio`.
- [ ] **Step 4: `folio-app` crate.** `Cargo.toml` (`name = "folio-app"`, `[[bin]] name = "folio"`, deps tauri 2.12.5, serde, serde_json, folio-core path, ts-rs; build-dep tauri-build 2.7.4). `build.rs`: `tauri_build::build()`. `tauri.conf.json` exactly as §1.1 (incl. `dragDropEnabled: false`, `titleBarStyle: "Overlay"`, `hiddenTitle: true`). `capabilities/default.json`: window `main`, permissions `["core:default"]`. Icons: create a 1024×1024 PNG placeholder (`python3 - <<'EOF'` writing a solid `#2F6FEB` PNG with `zlib`/`struct`) at `crates/folio-app/icons/source.png`, then `npx tauri icon crates/folio-app/icons/source.png -o crates/folio-app/icons`. `main.rs`: builder with no commands yet, `run(tauri::generate_context!())`.
- [ ] **Step 5: `scripts/check.sh`** (`set -euo pipefail`): `cargo fmt --all --check`; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo test --workspace`; `test -n "$(ls ui/src/backend/generated 2>/dev/null)" || [ "${FOLIO_ALLOW_NO_BINDINGS:-0}" = 1 ]`; `git diff --exit-code ui/src/backend/generated`; `! cargo tree -p folio-core | grep -qi tauri`; `npm run -w ui lint`; `npm run -w ui typecheck`; `npm run -w ui test`. (Bindings exist from Task 5 on; until then run with `FOLIO_ALLOW_NO_BINDINGS=1`.)
- [ ] **Step 6: Verify.** `npm install`; `FOLIO_ALLOW_NO_BINDINGS=1 bash scripts/check.sh` → exit 0. `npm run dev` → a window titled Folio showing "Folio". Close it.
- [ ] **Step 7: Commit** — `chore: workspace scaffold (Cargo + npm workspaces, Tauri shell, check script)`.

### Task 2: Core foundation — errors, ids, time, store, migration

**Files:**
- Create: `crates/folio-core/src/{error.rs,ids.rs,time.rs,db/mod.rs,db/migrations/0001_init.sql}`; modify `lib.rs`
- Test: `crates/folio-core/tests/store.rs`

**Interfaces:**
- Produces:
  - `pub type Result<T> = std::result::Result<T, CoreError>;` `CoreError` exactly as §3.10, plus `impl CoreError { pub fn code(&self) -> &'static str; pub fn to_payload(&self) -> ErrorPayload }`; `#[derive(Serialize, TS)] pub struct ErrorPayload { pub code: String, pub message: String }`.
  - `ids::new_id() -> String` (UUID v7, lowercase hyphenated); `ids::is_uuid(s: &str) -> bool` (any version).
  - `time::now_ms() -> i64`.
  - `pub struct Store` with `Store::open(db_path: &Path, assets_dir: &Path) -> Result<Store>` and `Store::open_in_memory() -> Result<Store>` (assets dir = a fresh temp dir kept alive by the Store); `pub(crate) fn conn(&self) -> &Connection`, `pub(crate) fn conn_mut(&mut self) -> &mut Connection`.

- [ ] **Step 1: Write failing tests** in `tests/store.rs`: `open_creates_schema` (after `open_in_memory`, `PRAGMA user_version` = 1 and tables `pages, tabs, blocks, option_sets, comment_threads, comments, assets, page_versions, settings, search_fts` exist in `sqlite_master`); `open_twice_is_idempotent` (open a temp-file db twice, user_version still 1); `foreign_keys_on` (`PRAGMA foreign_keys` = 1); `new_id_is_v7` (`Uuid::parse_str(&new_id()).unwrap().get_version_num() == 7`); `is_uuid_rejects_garbage` (`!is_uuid("abc")`, `is_uuid` true for a v4 string); `error_codes` (`CoreError::LastTab.code() == "last_tab"`, `NotFound{..}.code() == "not_found"`, `InvalidOp{..}.code() == "invalid_op"`, `EmptyComment.code() == "empty_comment"`).
- [ ] **Step 2: Run** `cargo test -p folio-core --test store` → FAIL (unresolved items).
- [ ] **Step 3: Implement.** `0001_init.sql` = the SQL in §3.1 verbatim (with the comment_threads note: no FK on `tab_id`). `db::open` sets the pragmas in §3.1 then runs migrations: read `user_version`; for each migration with index > version run it in a transaction and set `user_version`. Migrations are an array `&[include_str!("migrations/0001_init.sql")]`.
- [ ] **Step 4: Run** `cargo test -p folio-core --test store` → PASS.
- [ ] **Step 5: Commit** — `feat(core): store, schema migration, ids, errors`.

### Task 3: Order keys

**Files:** Create `crates/folio-core/src/order.rs`; tests inside the module (`#[cfg(test)]`).

**Interfaces:**
- Produces: `order::key_between(prev: Option<&str>, next: Option<&str>) -> Result<String>` — returns a key `k` with `prev < k < next` under SQLite's default BINARY text comparison (plain byte order). `None` means open end. `prev >= next` → `CoreError::InvalidOp { index: 0, reason: "order keys out of order" }`.

- [ ] **Step 1: Failing tests:** `between_none_none` returns a non-empty key; `after` (`key_between(Some(a), None) > a`); `before` (`key_between(None, Some(a)) < a`); `between` for 1,000 repeated inserts always between the previous key and a fixed `next` (keys strictly increasing, all `< next`); `byte_order_matches_rust_string_order` (generate 200 random inserts at random positions, sort them by Rust `str` ordering, assert it matches the insertion-defined order); `reversed_is_error`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `fractional_index::FractionalIndex` (`new_before`, `new_after`, `new_between`, `default()`), converting via its string form (`to_string()` / `from_string`). If its string form is not byte-order preserving (the test will show it), encode `as_bytes()` as lowercase hex instead and record that in `docs/decisions.md`.
- [ ] **Step 4: Run** `cargo test -p folio-core order` → PASS.
- [ ] **Step 5: Commit** — `feat(core): fractional order keys`.

### Task 4: Vietnamese folding (Rust + TS twin)

**Files:** Create `crates/folio-core/src/fold.rs` (tests in module); create `ui/src/lib/fold.ts`, `ui/src/lib/fold.test.ts`; create `crates/folio-core/tests/fixtures/fold_cases.json` shared by both test suites.

**Interfaces:**
- Produces: Rust `fold::fold(s: &str) -> String`; `fold::fold_with_map(s: &str) -> (String, Vec<usize>)` where `map[i]` = the char index in `s` of the source of folded char `i` (whitespace collapsing keeps the first whitespace's index). TS `fold(s: string): string` with identical output.

- [ ] **Step 1: Fixture** `fold_cases.json`: `[["Đà Nẵng","da nang"],["ĐƯỜNG","duong"],["  Hà   Nội ","ha noi"],["<NFD form of Đà Nẵng>","da nang"],["Huế","hue"],["người được ở","nguoi duoc o"],["ABC xyz","abc xyz"],["",""],["😀 Ơn","😀 on"]]` (write the NFD entry with `\u` escapes: `"D̀"` is wrong — use `"Đà Nắng"`, which is NFD of "Đà Nẵng").
- [ ] **Step 2: Failing tests:** Rust test iterates the fixture (`include_str!("../tests/fixtures/fold_cases.json")`) asserting `fold`; `map_points_to_source` (`fold_with_map("Hà Nội")` → map `[0,1,2,3,4,5]`); TS test imports the same JSON (`../../../crates/folio-core/tests/fixtures/fold_cases.json`) and asserts `fold`.
- [ ] **Step 3: Run** both → FAIL.
- [ ] **Step 4: Implement** per §3.6: lowercase → NFD → drop combining marks (Rust: `unicode_normalization::char::is_combining_mark`; TS: `/\p{M}/u`) → `đ`→`d` → collapse whitespace → trim.
- [ ] **Step 5: Run** `cargo test -p folio-core fold` and `npm run -w ui test -- fold` → PASS.
- [ ] **Step 6: Commit** — `feat: Vietnamese folding in core and ui`.

### Task 5: Model types and generated bindings

**Files:** Create `crates/folio-core/src/model/{mod.rs,entities.rs,block.rs,ops.rs}`; test `crates/folio-core/tests/bindings.rs`; generated `ui/src/backend/generated/*.ts` (committed).

**Interfaces:**
- Produces (all `#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)] #[serde(rename_all = "camelCase")] #[ts(export)]`):
  - `PageMeta { id: String, parent_id: Option<String>, title: String, order_key: String, created_at: i64, updated_at: i64 }`
  - `TabMeta { id: String, page_id: String, name: String, order_key: String }`
  - `CreatedPage { page: PageMeta, tab: TabMeta }`
  - `SearchHit { page_id: String, page_title: String, snippet: String, title_match: bool }`
  - `ApplyResult { applied: u32, page_updated_at: i64 }`
  - `BlockNode { id: String, r#type: String, props: serde_json::Value, content: Option<serde_json::Value>, children: Vec<BlockNode> }` with `#[ts(type = "Record<string, unknown>")]` on `props` and `#[ts(type = "unknown")]` on `content`; serde name of `r#type` is `type`.
  - `BlockOp` exactly as §3.3 (with `rename_all_fields = "camelCase"`), `content` `#[ts(type = "unknown")]`, `props` `#[ts(type = "Record<string, unknown>")]`.
  - `ErrorPayload` (from Task 2) also exported.
  - Typed reading model in `block.rs` (not exported to TS): `enum Inline { Text { text: String, styles: Styles }, Link { href: String, content: Vec<TextRun> }, DateChip { props: DateProps }, PageLink { props: PageLinkProps }, DropdownChip { props: DropdownProps }, #[serde(other)] Unknown }` (`#[serde(tag = "type", rename_all = "camelCase")]`), `struct TableContent { rows: Vec<TableRow> }`, `struct TableRow { cells: Vec<TableCell> }`, `struct TableCell { content: Vec<Inline> }`, and `fn parse_inline(v: &Value) -> Vec<Inline>` / `fn parse_table(v: &Value) -> Option<TableContent>` that never fail (unknown → skipped).

- [ ] **Step 1: Failing tests** in `tests/bindings.rs`: `block_op_json_shape` — `serde_json::from_str::<BlockOp>(r#"{"op":"upsert","id":"…","parentId":null,"prevSiblingId":"…","type":"paragraph","props":{},"content":[]}"#)` succeeds and serializing back yields `parentId`/`prevSiblingId` keys; `delete_op_json_shape` (`{"op":"delete","ids":["a"]}`); `page_meta_camel_case` (serialized keys `parentId`, `orderKey`, `createdAt`); `export_bindings_written` — call `PageMeta::export_all()` etc. for every exported type (name this test `export_bindings` so `cargo test export_` runs it) then assert `ui/src/backend/generated/PageMeta.ts` exists relative to the workspace root (use `env!("CARGO_MANIFEST_DIR")/../../ui/...`) and contains `createdAt: number`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the types. Every `i64` field `#[ts(type = "number")]`.
- [ ] **Step 4: Run** `cargo test -p folio-core --test bindings` → PASS; `ls ui/src/backend/generated` lists `PageMeta.ts TabMeta.ts CreatedPage.ts SearchHit.ts ApplyResult.ts BlockNode.ts BlockOp.ts ErrorPayload.ts`.
- [ ] **Step 5: Verify** `bash scripts/check.sh` (without the env override) → exit 0.
- [ ] **Step 6: Commit** — `feat(core): model types and generated TS bindings`.

### Task 6: Pages and tabs

**Files:** Create `crates/folio-core/src/{pages.rs,tabs.rs}`; create `search.rs` with only the crate-private index helpers; test `crates/folio-core/tests/pages_tabs.rs`.

**Interfaces:**
- Consumes: Store, ids, time, order (Tasks 2–3), fold (Task 4), model (Task 5).
- Produces (`impl Store`):
  - `list_pages(&self) -> Result<Vec<PageMeta>>` (ordered by parent then order_key)
  - `create_page(&mut self, parent_id: Option<&str>, after_id: Option<&str>) -> Result<CreatedPage>`
  - `rename_page(&mut self, id: &str, title: &str) -> Result<PageMeta>`
  - `delete_page(&mut self, id: &str) -> Result<Vec<String>>` (ids of the page and all descendants)
  - `list_tabs(&self, page_id: &str) -> Result<Vec<TabMeta>>`, `create_tab(&mut self, page_id: &str, name: &str) -> Result<TabMeta>`, `rename_tab(&mut self, id: &str, name: &str) -> Result<TabMeta>`, `move_tab(&mut self, id: &str, prev_sibling_id: Option<&str>) -> Result<Vec<TabMeta>>`, `delete_tab(&mut self, id: &str) -> Result<()>`
  - crate-private in `search.rs`: `index_title(tx: &Transaction, page_id: &str, title: &str) -> Result<()>`, `index_block(tx: &Transaction, block_id: &str, page_id: &str, plain: &str) -> Result<()>` (both replace any existing row for that owner), `unindex_owners(tx: &Transaction, kind: &str, ids: &[String]) -> Result<()>`, `unindex_pages(tx: &Transaction, page_ids: &[String]) -> Result<()>`.

- [ ] **Step 1: Failing tests:** `create_top_level_page_has_one_tab`; `pages_order_after` (create A, B, then C with `after_id = A` → order A, C, B); `subpage_parent`; `rename_roundtrip_exact` (titles `""`, `"   "`, `"Ghi chú 😀"`, a 500-char string, each read back identical); `delete_cascades_descendants` (A > B > C; delete A returns the three ids; `list_pages` empty; `SELECT count(*) FROM search_fts` = 0; blocks/tabs of those pages gone); `delete_missing_is_not_found`; `last_tab_refused` (`delete_tab` on the only tab → `CoreError::LastTab`); `move_tab_reorders`; `delete_tab_moves_threads` (insert a `comment_threads` row by SQL on tab 2, delete tab 2 → the row's `tab_id` = first remaining tab).
- [ ] **Step 2: Run** `cargo test -p folio-core --test pages_tabs` → FAIL.
- [ ] **Step 3: Implement.** New pages go last among siblings (`key_between(last, None)`) unless `after_id` (between it and its next sibling). Every write sets `updated_at`. Use one transaction per public method.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(core): pages and tabs`.

### Task 7: Plain-text extraction

**Files:** Create `crates/folio-core/src/text.rs` (tests in module).

**Interfaces:**
- Produces: `pub trait TextContext { fn option_name(&self, option_set_id: &str, option_id: &str) -> Option<String>; }`; `pub struct NoContext;` (always `None`); `pub fn plain_text(block_type: &str, props: &Value, content: Option<&Value>, ctx: &dyn TextContext) -> String`; `pub(crate) struct DbTextContext<'a>(&'a Connection)` reading `option_sets.options`.

- [ ] **Step 1: Failing tests** (one per rule in §3.6): paragraph with two styled runs → concatenated; link → its text; `dateChip {date:"2026-10-28"}` → `"28/10/2026"`; `pageLink` → `""`; `dropdownChip` with a ctx returning `"Xong"` → `"Xong"`, with `NoContext` → `""`; table 2×2 → cells joined by single spaces in row-major order; `codeBlock` with text run → the text; `mathBlock {source:"x^2"}` → `"x^2"`; `image {name:"a.png", caption:"Ảnh"}` → `"a.png Ảnh"`; unknown inline type → skipped, no panic; malformed content (`content = 42`) → `""`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** using `model::block::parse_inline`/`parse_table`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(core): plain-text extraction for search`.

### Task 8: Blocks — apply, load, replace

**Files:** Create `crates/folio-core/src/blocks.rs`; test `crates/folio-core/tests/apply.rs`.

**Interfaces:**
- Consumes: Tasks 2–7.
- Produces (`impl Store`): `apply(&mut self, tab_id: &str, ops: &[BlockOp]) -> Result<ApplyResult>`; `load_tab(&self, tab_id: &str) -> Result<Vec<BlockNode>>`; `replace_tab_blocks(&mut self, tab_id: &str, tree: &[BlockNode]) -> Result<()>`. Behaviour exactly §3.3 (upsert via `INSERT … ON CONFLICT(id) DO UPDATE`, never `INSERT OR REPLACE`; deletes of unknown ids ignored; search rows maintained in the same transaction).

- [ ] **Step 1: Failing tests** (helper `p(id, text)` builds a paragraph `Upsert`; ids are fixed v4 strings):
  - `insert_three_in_order` → `load_tab` returns them in order.
  - `insert_between` (A, C, then B with `prev = A`) → A, B, C.
  - `update_keeps_created_at` and changes text.
  - `nested_children` (B with `parent = A`) → tree A{B}.
  - `upsert_parent_in_same_batch` (child op after its new parent op in one call) → OK.
  - `upsert_unknown_parent_is_invalid` → `InvalidOp { index: 0, .. }` and **nothing** written (rollback).
  - `delete_cascades` (delete A removes B; `search_fts` rows for both gone).
  - `outdent_then_delete_parent_keeps_child_subtree` — tree D{C{E}}; one batch `[Upsert C (parent None, prev D), Delete [D]]` → result C{E} at top level. (This is the data-loss scenario; it must pass.)
  - `delete_unknown_ids_ignored`.
  - `vietnamese_roundtrip` (text "Đà Nẵng" stored and loaded byte-identical).
  - `apply_updates_page_updated_at`.
  - `replace_tab_blocks_roundtrip` (load → replace with same tree → load equals).
  - `search_row_written` (after upsert, `SELECT text FROM search_fts WHERE owner_id = ?` = `"da nang"`).
- [ ] **Step 2: Run** `cargo test -p folio-core --test apply` → FAIL.
- [ ] **Step 3: Implement.** `load_tab` builds the tree from one ordered query; orphans attached at top level with `eprintln!` (logging crate not needed in Phase 1).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(core): block edit ops, load and replace`.

### Task 9: Search

**Files:** Modify `crates/folio-core/src/search.rs`; test `crates/folio-core/tests/search.rs`.

**Interfaces:**
- Produces: `impl Store { pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchHit>> }` — §3.6.

- [ ] **Step 1: Failing tests:** `accentless_matches_accented_body`; `title_match_ranks_first` (page X has the word only in body, page Y in title → Y first, `title_match` true); `multiple_tokens_and` (`"da nang"` matches "Đà Nẵng" but not a page with only "Đà"); `prefix_match` (`"nan"` matches "Nẵng"); `snippet_is_original_text` (snippet contains `Đà Nẵng` with accents, ≤ 120 chars, around the match for a 500-char block); `title_only_snippet_is_first_block`; `empty_query_returns_empty`; `fts_syntax_is_literal` — for each of `"\""`, `"*"`, `"-a"`, `"(x"`, `"a OR b"`, `"NEAR"`, `"a:b"` the call returns `Ok` (no SQL error); `limit_respected`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**: tokens from `fold(query)` split on spaces; strip from each token every char that is not alphanumeric (Unicode) — this removes FTS syntax; drop empty tokens; build `"tok"*` terms joined by space; query `search_fts`; group by page; order: pages with a title hit first, then by `min(bm25)`; snippet via `fold_with_map`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(core): accent-insensitive search`.

### Task 10: Tauri commands, menus, quit flow

**Files:** Create `crates/folio-app/src/{state.rs,commands.rs,menu.rs,quit.rs}`; modify `main.rs`; test in `commands.rs` (`#[cfg(test)]`).

**Interfaces:**
- Consumes: the `Store` API of Tasks 6–9.
- Produces:
  - Commands (exact names, §4.2, Phase 1 subset): `pages_list`, `page_create(parentId?, afterId?) -> CreatedPage`, `page_rename(id, title) -> PageMeta`, `page_delete(id) -> string[]`, `tabs_list(pageId)`, `tab_create(pageId, name)`, `tab_rename(id, name)`, `tab_move(id, prevSiblingId?)`, `tab_delete(id)`, `tab_load(tabId) -> BlockNode[]`, `tab_apply(tabId, ops) -> ApplyResult`, `search(query) -> SearchHit[]` (limit 50), `quit_ready()`. Errors: `Err(ErrorPayload)`.
  - `pub const COMMANDS: &[&str]` listing the above; test `commands_match_handler` (compares with a second literal array placed directly next to `generate_handler!` — keep both in `commands.rs` via a `macro_rules! command_list` that expands to both, so they cannot drift); test `export_command_names` writing `ui/src/backend/generated/commands.ts` as `export const Commands = { pagesList: "pages_list", … } as const;` (camelCase key from snake_case name).
  - Events emitted to the UI: `menu:new-page`, `menu:new-subpage`, `menu:find`, `menu:search`, `flush-request`.
  - `AppState { store: Arc<Mutex<Store>>, quitting: AtomicBool }`; helper `async fn blocking<T>(state, f: impl FnOnce(&mut Store) -> folio_core::Result<T>) -> Result<T, ErrorPayload>` using `tauri::async_runtime::spawn_blocking`.
- Menus: §4.4 with only these enabled in Phase 1: Folio menu (Giới thiệu, Ẩn, custom Thoát Folio ⌘Q), Tệp → Trang mới ⌘N, Trang con mới ⇧⌘N; Sửa → predefined Hoàn tác/Làm lại/Cắt/Sao chép/Dán/Chọn tất cả, Tìm trong trang ⌘F, Tìm mọi trang ⇧⌘F. Items from later phases are not added yet.
- Quit: §4.5 exactly (custom ⌘Q item, CloseRequested, ExitRequested, `quitting` guard, 3 s timer, `quit_ready`).
- Data paths: `app.path().app_data_dir()` → create dir → `Store::open(dir/"folio.sqlite", dir/"assets")`.

- [ ] **Step 1: Failing tests:** `commands_match_handler`; `export_command_names` (file exists and contains `pagesList: "pages_list"` and `tabApply: "tab_apply"`).
- [ ] **Step 2: Run** `cargo test -p folio-app` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `bash scripts/check.sh` → exit 0.
- [ ] **Step 5: Manual smoke:** `npm run dev`; menu bar shows Folio / Tệp / Sửa with Vietnamese labels; ⌘Q quits within 3 s (the UI does not answer `flush-request` yet, so the timer path is exercised).
- [ ] **Step 6: Commit** — `feat(app): Tauri commands, menus and quit flow`.

### Task 11: UI backend layer

**Files:** Create `ui/src/backend/{Backend.ts,tauriBackend.ts,fakeBackend.ts,index.ts}`, `ui/src/backend/fakeBackend.test.ts`, `ui/src/platform/{menuEvents.ts,quit.ts}`.

**Interfaces:**
- Consumes: generated types and `Commands` (Tasks 5, 10); `fold` (Task 4).
- Produces:
```ts
export type MenuEvent = "new-page" | "new-subpage" | "find" | "search";
export interface Backend {
  pagesList(): Promise<PageMeta[]>;
  pageCreate(parentId?: string, afterId?: string): Promise<CreatedPage>;
  pageRename(id: string, title: string): Promise<PageMeta>;
  pageDelete(id: string): Promise<string[]>;
  tabsList(pageId: string): Promise<TabMeta[]>;
  tabLoad(tabId: string): Promise<BlockNode[]>;
  tabApply(tabId: string, ops: BlockOp[]): Promise<ApplyResult>;
  search(query: string): Promise<SearchHit[]>;
  onMenu(name: MenuEvent, cb: () => void): () => void;        // returns unsubscribe
  onFlushRequest(cb: () => Promise<void>): () => void;
  quitReady(): Promise<void>;
}
export function isErrorPayload(e: unknown): e is ErrorPayload;
```
  (Tab create/rename/move/delete join the interface in Phase 4.)
  - `createFakeBackend(opts?: { persistKey?: string }): Backend & { emitMenu(name: MenuEvent): void }` — in memory; when `persistKey` is set, state is saved to `localStorage[persistKey]` after each write and loaded at creation (wrapped in try/catch). Behaviour mirrors the core: errors as `{ code, message }` (`not_found`, `invalid_op`), `pageCreate` makes one tab, deletes cascade, `tabApply` processes ops in order with the same validation, search uses `fold` with AND-of-prefix tokens and title-first order (snippet: first 120 chars of the matching block's text).
  - `index.ts`: `export const backend: Backend = import.meta.env.VITE_BACKEND === "fake" ? createFakeBackend({ persistKey: "folio.fake.v1" }) : createTauriBackend();` and `window.__folioFake = backend` when fake (used by Playwright to emit menu events).
- [ ] **Step 1: Failing Vitest** `fakeBackend.test.ts`: page create/rename/delete cascade; `tabApply` insert-between order; `outdent_then_delete_parent_keeps_child_subtree` (same scenario as Task 8); unknown parent → rejects with `code: "invalid_op"` and state unchanged; search `"da nang"` finds "Đà Nẵng"; persistence (create with `persistKey`, write, create a second instance with the same key, data present).
- [ ] **Step 2: Run** `npm run -w ui test -- fakeBackend` → FAIL. **Step 3: Implement** (tauriBackend: one line per method with `invoke(Commands.x, {...})`; menu via `listen("menu:" + name)`; flush via `listen("flush-request", async () => { await cb(); await invoke(Commands.quitReady) })`). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(ui): backend interface, Tauri and fake implementations`.

### Task 12: App shell, copy, sidebar tree

**Files:** Create `ui/src/i18n/vi.ts`, `ui/src/theme.css`, `ui/src/App.tsx` (replace), `App.module.css`, `ui/src/state/{pagesStore.ts,pageStore.ts,uiStore.ts}`, `ui/src/sidebar/{Sidebar.tsx,PageTree.tsx,PageTreeItem.tsx}`+css, `ui/src/page/{PageView.tsx,EmptyState.tsx}` (PageView renders only the title placeholder for now), `ui/src/editor/pipelineRegistry.ts` (stub), `ui/src/ui/{Toast.tsx,ConfirmDialog.tsx}`; Playwright `ui/playwright.config.ts`, `ui/e2e/pages.spec.ts`; Vitest `ui/src/state/pagesStore.test.ts`.

**Interfaces:**
- Consumes: `backend` (Task 11).
- Produces:
  - `vi.ts`: `export const vi = { … } as const` with the Phase 1 keys from §5.13: `untitled, newPage, newSubpage, rename, delete, confirmDeletePage(t, n), emptyState, createFirstPage, searchPlaceholder, noResults, saved, saving, saveError, find, findNoMatch, errors.{not_found, invalid_op, last_tab, empty_comment, db, io, json, saveFailed}` — exact texts from §5.13.
  - `usePagesStore` (zustand): `{ pages: PageMeta[]; load(): Promise<void>; create(parentId?: string): Promise<CreatedPage>; rename(id: string, title: string): Promise<void>; remove(id: string): Promise<void>; childrenOf(parentId: string | null): PageMeta[]; descendantCount(id: string): number }`.
  - `usePageStore`: `{ pageId: string | null; tabs: TabMeta[]; activeTabId: string | null; open(pageId: string): Promise<void>; close(): void }` — `open` first awaits `flushAll()` from `editor/pipelineRegistry.ts`. This task creates that file as a stub (`export async function flushAll(): Promise<void> {}` and `export function registerPipeline(): () => void { return () => {}; }`); Task 14 replaces the bodies.
  - `useUiStore`: `{ findOpen: boolean; setFindOpen(v: boolean): void; toasts: { id: string; text: string }[]; toast(text: string): void }`.
  - Tree behaviour §5.3 (expanded state in `localStorage["folio.tree.expanded"]` with try/catch; titles ellipsize with CSS `text-overflow: ellipsis`).
- [ ] **Step 1: Failing tests:** Vitest `pagesStore.test.ts` (with a fake backend instance): create → appears; `childrenOf` order; `descendantCount`. Playwright `pages.spec.ts` (webServer: `npm run dev:web`, baseURL `http://localhost:5173`, each test clears `localStorage` first): `empty state creates first page` (`empty-create-first` → one `tree-item`); `create subpage` (hover item → `tree-item-add-child` → nested item); `rename` (`tree-item-menu` → `menu-rename` → type `Ghi chú 😀` → Enter → title shows it); `delete asks and removes subtree` (`menu-delete` → dialog text contains `và 1 trang con` → `confirm-ok` → items gone); `untitled shows placeholder` (new page shows `Không có tiêu đề`).
- [ ] **Step 2: Run** `npm run -w ui test -- pagesStore` and `npm run -w ui e2e -- pages` → FAIL. **Step 3: Implement** (sidebar 260 px, 28 px drag region with `data-tauri-drag-region`, colours via CSS variables in `theme.css` with light/dark). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(ui): app shell, Vietnamese copy, page tree`.

### Task 13: Editor, page title, conversion

**Files:** Create `ui/src/editor/{schema.ts,convert.ts,dictionary.ts,Editor.tsx}`, `ui/src/editor/convert.test.ts`, `ui/src/page/PageTitle.tsx`; modify `PageView.tsx`, `main.tsx` (import `@blocknote/mantine/style.css` and Mantine provider).

**Interfaces:**
- Consumes: `backend.tabLoad`, page store.
- Produces:
  - `schema.ts`: `export const schema` = `BlockNoteSchema.create` with default block specs **except** `audio`, `video`, `file`, `image`, `toggleListItem`, `divider` (if present) — those return in Phase 5 or never; `heading` limited to levels 1–3; default inline content; default styles minus `textColor`, `backgroundColor`. `export type FolioEditor = typeof schema.BlockNoteEditor`.
  - `convert.ts`: `toEditorBlocks(nodes: BlockNode[]): PartialBlock[]` (recursive; maps `children`) and `toStored(block: Block): { type: string; props: Record<string, unknown>; content: unknown }` (drops `id` and `children`).
  - `dictionary.ts`: `export const dictionary = { ...locales.vi, placeholders: { ...locales.vi.placeholders, default: "Nhập '/' để chọn lệnh", heading: "Tiêu đề", bulletListItem: "Danh sách", numberedListItem: "Danh sách", checkListItem: "Việc cần làm" } }` (use the exact key names BlockNote 0.56 exposes; if a key differs, keep the text and record the key in `docs/decisions.md`).
  - `<Editor tabId={string} />`: loads blocks with `backend.tabLoad`, creates the editor with `useCreateBlockNote({ schema, dictionary, initialContent: blocks.length ? toEditorBlocks(blocks) : undefined, trailingBlock: true, animations: false })`, renders `<BlockNoteView theme={colorScheme} data-testid="editor" />`. Recreated when `tabId` changes (`key={tabId}`).
  - `<PageTitle pageId />` per §5.4 (400 ms debounce + blur save; Enter focuses the editor's first block via `editor.setTextCursorPosition(editor.document[0], "start"); editor.focus()` — expose the editor through `pageStore.activeEditor`).
- [ ] **Step 1: Failing Vitest** `convert.test.ts`: round trip of a tree with heading(2), nested bullet, check item (checked), quote, code block, and Vietnamese text — `toEditorBlocks` then create a headless editor (`BlockNoteEditor.create({ schema, initialContent })`) then `editor.document.map(toStored)` equals the input's fields (ignore BlockNote default props added, compare `type`, the props we set, and text).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. Visual check in `dev:web`: Markdown shortcuts `# `, `## `, `### `, `- `, `1. `, `[] `, `> `, ```` ``` ```` convert blocks.
- [ ] **Step 5: Commit** — `feat(ui): BlockNote editor with page title`.

### Task 14: Save pipeline

**Files:** Create `ui/src/editor/{savePipeline.ts,pipelineRegistry.ts,savePipeline.test.ts}`, `ui/src/page/SaveStatus.tsx`; modify `Editor.tsx`, `pageStore.ts`.

**Interfaces:**
- Consumes: `backend.tabApply`, `convert.toStored`, `isErrorPayload`.
- Produces:
```ts
export type SaveStatus = "saved" | "saving" | "error";
export interface SavePipeline { flush(): Promise<void>; dispose(): void; status(): SaveStatus; onStatus(cb: (s: SaveStatus) => void): () => void; }
export function createSavePipeline(o: { tabId: string; editor: FolioEditor; backend: Pick<Backend, "tabApply">;
  debounceMs?: number /*600*/; maxWaitMs?: number /*3000*/; retryBaseMs?: number /*2000*/; retryMaxMs?: number /*30000*/;
  onError?: (e: unknown) => void }): SavePipeline;
// pipelineRegistry.ts
export function registerPipeline(p: SavePipeline): () => void;
export function flushAll(): Promise<void>;
```
- Algorithm: §5.5 steps 1–3, **upserts first in document order, one `delete` op last**. Error handling: `not_found` (the tab or page was deleted) → drop the dirty set, set status `saved`, call `dispose()`, no retry, no toast; any other error → put ids back, status `error`, toast `vi.errors.saveFailed` once per failure streak, retry with backoff `retryBaseMs × 2^n` capped at `retryMaxMs`.
- [ ] **Step 1: Failing Vitest** (headless editor + mock `tabApply` recording calls, `vi.useFakeTimers()`):
  - `typing_one_block_sends_one_upsert`
  - `insert_between_sets_prevSiblingId`
  - `delete_nested_item_sends_one_delete_with_children`
  - `move_block_with_children_upserts_only_moved_block`
  - `undo_after_delete_restores_with_upserts`
  - `vietnamese_text_roundtrip`
  - `burst_of_50_changes_in_600ms_is_one_call`
  - `continuous_typing_flushes_by_3s`
  - `paste_500_blocks_is_one_call_with_500_upserts`
  - `outdent_then_delete_parent_order` (ops: `upsert C` before `delete [D]`)
  - `not_found_drops_and_stops` (mock rejects `{code:"not_found"}` → no further calls after 60 s of fake time, status `saved`)
  - `other_error_retries_with_backoff` (calls at +2 s, +4 s, +8 s; status `error`, then `saved` after a success)
  - `pipelines_write_only_their_tab` (two editors/pipelines on tabs T1, T2; edit both; every recorded call's tabId matches its pipeline; flushing T1 while T2's flush is in flight sends nothing for T1 to T2)
  - `flushAll_flushes_every_registered_pipeline`
- [ ] **Step 2: Run** `npm run -w ui test -- savePipeline` → FAIL. **Step 3: Implement**; wire into `Editor.tsx` (create on mount, register, dispose on unmount after a final `flush()`); `SaveStatus` shows `vi.saved`/`vi.saving`/`vi.saveError` with `data-testid="save-status"` and `data-status`. **Step 4: Run** → PASS.
- [ ] **Step 5: Playwright** `editor.spec.ts`: `content survives reload` (type in a new page, wait for `save-status[data-status=saved]`, reload, text present); `markdown shortcuts` (each shortcut in §A3 produces the right block — assert via `.bn-block-content[data-content-type=…]`); `enter on empty list item makes paragraph`; `backspace at start of heading makes paragraph`; `nesting survives reload` (Tab under a bullet). Run `npm run -w ui e2e -- editor` → PASS. (If a Notion rule differs in BlockNote, record it in `docs/decisions.md` and mark the test `test.fixme` with a link to the entry — do not patch BlockNote.)
- [ ] **Step 6: Commit** — `feat(ui): debounced save pipeline with ordered edit ops`.

### Task 15: Search UI

**Files:** Create `ui/src/sidebar/{SearchBox.tsx,SearchResults.tsx}`+css; modify `Sidebar.tsx`; Playwright `ui/e2e/search.spec.ts`.

**Interfaces:**
- Consumes: `backend.search`, `usePageStore.open`.
- Produces: search box at the top of the sidebar (`search-input`, placeholder `vi.searchPlaceholder`); 200 ms debounce; while the query is non-empty the tree is replaced by results (`search-result`: title or `vi.untitled`, snippet below, 2 lines max); Enter opens the first result; Escape clears; empty results → `vi.noResults`; `menu:search` (⇧⌘F) focuses the box.
- [ ] **Step 1: Failing Playwright:** `accentless query finds accented body` (page body "Hôm nay đi Đà Nẵng", query `da nang` → one result whose snippet contains `Đà Nẵng`); `title match first`; `click opens page`; `no results message`; `shift-cmd-f focuses` (trigger via `window.__folioFake.emitMenu("search")`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(ui): sidebar search`.

### Task 16: Find in page

**Files:** Create `ui/src/editor/find/{findPlugin.ts,FindBar.tsx,FindBar.module.css,findPlugin.test.ts}`; modify `Editor.tsx`, `PageView.tsx`; Playwright `ui/e2e/find.spec.ts`.

**Interfaces:**
- Produces:
  - `findMatches(doc: ProseMirrorNode, query: string): { from: number; to: number }[]` — folds each text block's text with a TS `foldWithMap` (add `foldWithMap(s): { folded: string; map: number[] }` to `ui/src/lib/fold.ts`, same contract as the Rust one, tested against the same fixture) and maps folded match ranges back to document positions. Every text-bearing block is searched, code blocks included (the Phase 5 source blocks will be excluded then).
  - `findPluginKey` + `createFindPlugin()` — a ProseMirror plugin holding `{ query, matches, current }` and rendering `Decoration.inline` with classes `find-match` / `find-match-current`; registered through BlockNote's extension API (`_tiptapEditor.registerPlugin` if no public API exists in 0.56; record which in `docs/decisions.md`).
  - `<FindBar />`: opened by ⌘F (`menu:find`), `find-input` with placeholder `vi.find`, `find-count` "n/m" or `vi.findNoMatch`, Enter / `find-next` → next, ⇧Enter / `find-prev` → previous (scroll into view via `view.domAtPos` + `scrollIntoView({ block: "center" })`), Escape / `find-close` → close and clear. Typing in the input never changes the editor selection.
- [ ] **Step 1: Failing tests:** Vitest `findPlugin.test.ts`: `finds accentless in accented text` (doc "Đà Nẵng và đà nẵng", query "da nang" → 2 matches with correct `from/to` covering the accented words); `empty query no matches`; `match across styled runs` ("Đà" bold + " Nẵng" plain → 1 match). Playwright `find.spec.ts`: open with `emitMenu("find")`, type `nang`, `find-count` = `1/2`, `find-next` → `2/2`, Escape closes and no `.find-match` remains.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(ui): find in page`.

### Task 17: Menu wiring, quit flush, Phase 1 checklist

**Files:** Modify `ui/src/App.tsx`, `ui/src/platform/{menuEvents.ts,quit.ts}`; create `docs/manual-checklists/phase-1.md`; Playwright additions in `pages.spec.ts`.

**Interfaces:**
- Consumes: `backend.onMenu`, `backend.onFlushRequest`, `flushAll`, stores.
- Produces: `new-page` → create top-level page and open it, focus its title; `new-subpage` → create a child of the open page (no-op if none) and open it; `find` → open the find bar; `search` → focus search; `onFlushRequest(async () => { await flushAll(); })`.
- [ ] **Step 1: Failing Playwright:** `menu new page creates and focuses title`; `menu new subpage nests under open page`; `switching pages flushes` (type in page A, immediately click page B, reload, page A text present).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm run -w ui e2e` (all specs) → PASS; `bash scripts/check.sh` → exit 0.
- [ ] **Step 5: Write `docs/manual-checklists/phase-1.md`** (Vietnamese, checkbox per line), covering in the real app (`npm run dev`): tạo trang / trang con / đổi tên / xoá (có hỏi xác nhận); gõ từng phím tắt Markdown; Enter và Backspace theo quy tắc Notion; lồng danh sách bằng Tab / Shift-Tab; thoát bằng ⌘Q ngay sau khi gõ rồi mở lại — chữ vừa gõ còn nguyên; đóng cửa sổ bằng nút đỏ — như trên; tìm `da nang` ra `Đà Nẵng`; ⌘F tìm trong trang; thanh menu tiếng Việt; chế độ sáng/tối theo hệ thống; **the Vietnamese-typing block from tech spec §6** for: tiêu đề trang, đoạn văn, tiêu đề H1–H3, danh sách, ô tìm kiếm, ô tìm trong trang.
- [ ] **Step 6: Commit** — `feat(ui): menu actions and quit flush; Phase 1 checklist`.
- [ ] **Step 7: STOP.** Report to the owner: Phase 1 done, all automated checks green, please run `docs/manual-checklists/phase-1.md`. Phases 2–8 get their own plans after this one is accepted.

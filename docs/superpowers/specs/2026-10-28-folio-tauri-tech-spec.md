# Folio (Rust + Tauri 2) — technical specification

Date: 2026-10-28 · Status: draft, awaiting owner approval
Product design (the *what* and *why*): `2026-10-28-folio-tauri-rewrite-design.md`. Read it first.
This document is the *how*. It is written for implementing agents that have not seen the conversation: **follow it literally**. Where it says "my call", the decision was made by the spec author, not the owner; it is still binding. If something here is impossible or contradicts the design doc, stop and record the problem in `docs/decisions.md` (create it if missing) instead of improvising silently.

---

Appearance addendum (2026-10-29): `2026-10-29-folio-appearance-tech-spec.md` is binding for the appearance pass before Phase 4. It supersedes appearance-only details in §5.1/§5.3/§5.12 and the Phase 8 appearance scope: content width 900 px, explicit System/Light/Dark preferences, four accents, and shared theme state. Historical phase plans must also be read with `docs/decisions.md`; they are not instructions to restore superseded implementations.

## 0. Rules for implementing agents

1. **Do not change scope.** Build only what the phase you are on asks for. No extra features, no "nice to have" refactors of other phases.
2. **Test first** for every core function and every UI logic module (write the failing test, see it fail, make it pass). UI visuals are verified by Playwright flows and the owner's manual checklist.
3. **One task = one commit**, conventional message (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`). Never commit failing tests.
4. **Exact versions** from §1.2. If a pinned version cannot be installed, use the nearest patch release of the same minor, and write the substitution in `docs/decisions.md`.
5. **All user-visible text comes from `ui/src/i18n/vi.ts`** (§5.13). Never inline a Vietnamese or English string in a component. The slash menu labels are the only English UI and live in the same file under `slashMenu`.
6. **Never** hand-write a type that crosses the Rust ↔ TypeScript boundary; it is generated (§4.3).
7. **Never** call `@tauri-apps/api` outside `ui/src/backend/tauriBackend.ts` and `ui/src/platform/`. Everything else talks to the `Backend` interface (§5.2).
8. **`folio-core` must not depend on `tauri`** or anything UI. CI check: `cargo tree -p folio-core | grep -i tauri` must print nothing.
9. Before marking a task done run: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `npm run -w ui lint`, `npm run -w ui typecheck`, `npm run -w ui test`. The phase's Playwright suite must pass at the end of each phase.
10. When the spec does not cover a detail that changes observable behaviour, write your choice and reason in `docs/decisions.md` in the same commit.

---

## 1. Repository and tooling

### 1.1 Layout

**Location (owner's decision): new repository `~/Workspace/personal/folio-tauri`, branch `main`.** The Swift app stays untouched in `~/Workspace/personal/folio`. Paths below are relative to the `folio-tauri` root.

```
.
├─ Cargo.toml                    workspace: members = ["crates/folio-core", "crates/folio-app"]
├─ package.json                  npm workspaces: ["ui"]; scripts proxy to ui
├─ rust-toolchain.toml           channel = "stable"
├─ crates/
│  ├─ folio-core/
│  │  ├─ Cargo.toml
│  │  ├─ src/
│  │  │  ├─ lib.rs               pub mod + Store re-export
│  │  │  ├─ error.rs             CoreError
│  │  │  ├─ ids.rs               new_id(), is_uuid()
│  │  │  ├─ time.rs              now_ms()
│  │  │  ├─ db/mod.rs            open(), migrations
│  │  │  ├─ db/migrations/0001_init.sql
│  │  │  ├─ model/               serde types (§3.2–3.4)
│  │  │  ├─ order.rs             fractional keys
│  │  │  ├─ fold.rs              Vietnamese folding
│  │  │  ├─ text.rs              plain-text extraction from blocks
│  │  │  ├─ pages.rs  tabs.rs  blocks.rs  option_sets.rs  comments.rs  assets.rs  settings.rs
│  │  │  ├─ search.rs
│  │  │  ├─ history.rs
│  │  │  ├─ markdown/            render.rs (page → md), escape.rs
│  │  │  └─ mirror.rs
│  │  └─ tests/                  integration tests + golden files (tests/golden/*.md)
│  └─ folio-app/                 Tauri 2 app crate (src-tauri equivalent)
│     ├─ Cargo.toml  build.rs  tauri.conf.json  capabilities/default.json  icons/
│     └─ src/ main.rs  commands.rs  state.rs  menu.rs  asset_protocol.rs  quit.rs  mirror_worker.rs
├─ ui/
│  ├─ package.json  vite.config.ts  tsconfig.json  index.html  playwright.config.ts  eslint.config.js
│  ├─ src/            (§5.1)
│  └─ e2e/            Playwright specs
└─ docs/  decisions.md  manual-checklists/phase-N.md
```

`folio-app/tauri.conf.json`: `build.frontendDist = "../../ui/dist"`, `build.devUrl = "http://localhost:5173"`, `build.beforeDevCommand = "npm run -w ui dev"`, `build.beforeBuildCommand = "npm run -w ui build"`, `identifier = "io.folio.app"`, `productName = "Folio"`, one window `main`, title "Folio", 1200×800, min 800×500, `titleBarStyle = "Overlay"`, `hiddenTitle = true`, **`dragDropEnabled = false`** (otherwise the native window swallows OS file drops before BlockNote's drop handler sees them, and HTML5 drag breaks on Windows) (sidebar sits under the traffic lights; leave 78 px left padding / 28 px top drag region, `data-tauri-drag-region`).

### 1.2 Pinned versions (checked 2026-10-28)

Rust (Cargo): `tauri 2.12.5`, `tauri-build 2.7.4` (do **not** use the 3.0 alpha), `tauri-plugin-dialog 2` (latest 2.x), `tauri-plugin-opener 2` (latest 2.x), `rusqlite 0.41` with features `["bundled"]` (bundled SQLite includes FTS5), `serde 1` + `derive`, `serde_json 1.0.154`, `uuid 1.29` features `["v7","v4"]`, `fractional_index 2.0.2`, `unicode-normalization 0.1.26`, `zstd 0.14.3`, `thiserror 2.0.21`, `chrono 0.4.45`, `ts-rs 12.0.1` (feature `serde-json-impl`), `sha2 0.10` (latest), `tempfile 3` (dev), `pretty_assertions 1` (dev). MSRV is whatever Tauri requires (1.90).

npm (ui): `react 19.3.1`, `react-dom 19.3.1`, `@blocknote/core 0.56.0`, `@blocknote/react 0.56.0`, `@blocknote/mantine 0.56.0`, `@blocknote/code-block 0.56.0`, `@mantine/core` 9.x + `@mantine/hooks` 9.x (latest 9.x; `@blocknote/mantine 0.56.0` accepts `^8.3.11 || ^9.0.2`), `@tauri-apps/api 2.12.4`, `@tauri-apps/plugin-dialog 2.8.4`, `@tauri-apps/plugin-opener 2.7.2`, `zustand 5.0.16`, `katex 0.19.1`, `papaparse 5.7.0`, `markdown-it` (latest 14.x), `dompurify` (latest 3.x). Dev: `@tauri-apps/cli 2.12.4`, `vite 8.3.5`, `@vitejs/plugin-react 6.1.2`, `typescript 6.0.3` (my call: not 7.x, to avoid tooling gaps), `vitest 5.0.5`, `@testing-library/react` (latest), `jsdom` (latest), `@playwright/test 1.64.1`, `eslint` 9 + `typescript-eslint` (latest compatible).

Package manager: **npm** (pnpm is not installed on the owner's machine). Node: the LTS already installed via fnm.

### 1.3 Commands

- `npm run dev` → `cargo tauri dev` via `@tauri-apps/cli` (`npm run -w ui tauri dev` equivalent; wire it so root `npm run dev` works).
- `npm run build` → release `.app` + `.dmg`.
- `npm run -w ui dev:web` → Vite only, with `VITE_BACKEND=fake` (the in-memory backend, §5.2) for browser work and Playwright.
- `npm run -w ui e2e` → Playwright against `dev:web`.
- `npm run -w ui gen` → runs `cargo test --workspace export_`, which writes TS types and command names to `ui/src/backend/generated/` (§4.3).

---

## 2. Data location

- Database: `<app_data_dir>/folio.sqlite` (`app_data_dir` from Tauri's path resolver, i.e. `~/Library/Application Support/io.folio.app/`).
- Assets: `<app_data_dir>/assets/<asset_id>.<ext>`.
- Markdown mirror: default `~/Documents/Folio Markdown`, stored in `settings` (§3.1).
- `folio-core` receives these paths as arguments; it never resolves OS paths itself.

---

## 3. Core: data model

### 3.1 SQL schema — `0001_init.sql`

All ids are lowercase UUID strings. All times are Unix epoch **milliseconds** (`INTEGER`). Connection pragmas on open: `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`. Migrations: `PRAGMA user_version`; migration *n* runs inside a transaction and sets `user_version = n`. Forward-only.

```sql
CREATE TABLE pages (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT REFERENCES pages(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  order_key   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX pages_parent ON pages(parent_id, order_key);

CREATE TABLE tabs (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  order_key   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX tabs_page ON tabs(page_id, order_key);

CREATE TABLE blocks (
  id          TEXT PRIMARY KEY,                  -- generated by the editor (UUID v4), accepted as-is
  tab_id      TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  parent_id   TEXT REFERENCES blocks(id) ON DELETE CASCADE,  -- NULL = top level
  order_key   TEXT NOT NULL,
  type        TEXT NOT NULL,
  props       TEXT NOT NULL DEFAULT '{}',        -- JSON object, BlockNote props verbatim
  content     TEXT,                              -- JSON: inline array, tableContent object, or NULL
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX blocks_tree ON blocks(tab_id, parent_id, order_key);

CREATE TABLE option_sets (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  options     TEXT NOT NULL,                     -- JSON array of {id, name, color}
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE comment_threads (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tab_id      TEXT NOT NULL,   -- no FK on purpose: when a tab is deleted (by the user or by a restore),
                               -- its threads are moved to the page's first remaining tab and show as detached
  quote       TEXT NOT NULL,                     -- the anchored text at creation time
  resolved    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE comments (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,                     -- plain text, newlines allowed
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE assets (
  id          TEXT PRIMARY KEY,
  file_name   TEXT NOT NULL,                     -- original name, for display and export
  ext         TEXT NOT NULL,                     -- lowercase, no dot, '' if none
  mime        TEXT NOT NULL,
  byte_size   INTEGER NOT NULL,
  sha256      TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE page_versions (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  reason      TEXT NOT NULL,                     -- 'idle' | 'leave' | 'quit' | 'before_restore'
  data        BLOB NOT NULL                      -- zstd(level 3) of JSON PageSnapshot (§3.5)
);
CREATE INDEX versions_page ON page_versions(page_id, created_at);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE VIRTUAL TABLE search_fts USING fts5(
  kind UNINDEXED,        -- 'title' | 'block'
  owner_id UNINDEXED,    -- page id for 'title', block id for 'block'
  page_id UNINDEXED,
  text,                  -- folded text (§3.6)
  tokenize = 'unicode61 remove_diacritics 0'
);
```

FTS rows have no foreign keys: **every function that deletes pages, tabs or blocks deletes the matching `search_fts` rows in the same transaction** (for pages: `DELETE FROM search_fts WHERE page_id IN (…all descendant page ids…)`).

### 3.2 Block JSON (the shape stored in `blocks.props` / `blocks.content` and exchanged with the UI)

It is exactly BlockNote's `Block` shape (BlockNote 0.56) with our custom types added. Rust models it in `model/block.rs` with `serde` so the core can read text; unknown fields must be preserved (use `#[serde(flatten)] extra: serde_json::Map` on props and keep `content` as `serde_json::Value` at storage boundaries, parsing into typed structs only in `text.rs` and `markdown/`).

```ts
// Tree form, used by tab_load and snapshots
type BlockNode = { id: string; type: BlockType; props: Record<string, unknown>;
                   content: InlineContent[] | TableContent | null; children: BlockNode[] };

type BlockType =
  | "paragraph" | "heading" | "bulletListItem" | "numberedListItem" | "checkListItem"
  | "quote" | "codeBlock" | "table" | "image" | "file"
  | "mathBlock" | "csvBlock" | "markdownBlock";            // custom (§5.6)

// props by type (BlockNote defaults kept as they are; listed fields are the ones Folio reads)
heading:        { level: 1 | 2 | 3 }
checkListItem:  { checked: boolean }
codeBlock:      { language: string }                       // "" or a shiki language id
image:          { url: string /* "folio-asset:<asset id>" */, name: string, caption: string, previewWidth?: number }
file:           { url: string /* "folio-asset:<asset id>" */, name: string, caption: string }
mathBlock / csvBlock / markdownBlock: { source: string }   // content: null

type InlineContent =
  | { type: "text"; text: string; styles: Styles }
  | { type: "link"; href: string; content: { type: "text"; text: string; styles: Styles }[] }
  | { type: "dateChip"; props: { date: string /* YYYY-MM-DD */ } }
  | { type: "pageLink"; props: { pageId: string; tabId: string /* "" = whole page */ } }
  | { type: "dropdownChip"; props: { optionSetId: string; optionId: string /* "" = empty */ } };

type Styles = { bold?: true; italic?: true; underline?: true; strike?: true; code?: true;
                comment?: string /* space-separated thread ids, §5.9 */ };

type TableContent = { type: "tableContent"; columnWidths: (number | null)[]; headerRows?: number;
  rows: { cells: { type: "tableCell"; props: {...BlockNote defaults}; content: InlineContent[] }[] }[] };
```

`text` strings are stored exactly as the editor produced them (NFC in practice). **Offsets:** the core never stores character offsets; styles live on text runs, so no offset unit is needed (my call; this removes the UTF-16 problem the Swift app had).

### 3.3 Edit operations (`model/ops.rs`)

```rust
#[serde(tag = "op", rename_all = "camelCase", rename_all_fields = "camelCase")]  // fields too: parentId, prevSiblingId
pub enum BlockOp {
    /// Insert or replace one block's own fields (not its children).
    /// Position: after `prev_sibling_id` under `parent_id` (prev = None → first child).
    Upsert { id: String, parent_id: Option<String>, prev_sibling_id: Option<String>,
             r#type: String, props: Value, content: Option<Value> },
    /// Delete blocks and all their descendants.
    Delete { ids: Vec<String> },
}
```

`blocks::apply(tab_id, ops: &[BlockOp]) -> Result<ApplyResult>` runs **all ops in one transaction**, in the given order. The UI always sends **all `Upsert`s first (in document order) and one `Delete` last** (§5.5); `apply` must also be correct for any order a future caller uses, but this order is the one that is safe with cascading deletes: a block moved out of a parent that is deleted in the same batch is re-parented by its `Upsert` before the parent's `Delete` cascades.

- `Upsert`: validate `id` is a UUID, `parent_id` (if any) exists in the same tab **or is upserted earlier in this batch**, `prev_sibling_id` (if any) has the same parent. Compute `order_key` = key strictly between `prev_sibling`'s key (or start) and the key of the sibling currently right after `prev_sibling` (or end), excluding the block itself. Write with `INSERT … ON CONFLICT(id) DO UPDATE SET …` (**never** `INSERT OR REPLACE`: REPLACE deletes the row first and the cascade would delete its children). `created_at` kept on update, `updated_at` set, re-index the block's search row.
- `Delete`: ids that do not exist are ignored (a block created and deleted within one debounce window was never stored). Delete rows (cascade removes descendants) and their FTS rows (collect descendant ids first with a recursive CTE).
- After all ops: set `pages.updated_at` for the tab's page.
- `ApplyResult { applied: u32, page_updated_at: i64 }`.
- Any validation failure → rollback, `CoreError::InvalidOp { index, reason }`.

This same function is the API a future AI uses. Do not add a second write path for blocks except `history::restore` (§3.7), which calls `replace_tab_blocks`.

`blocks::replace_tab_blocks(tab_id, tree: &[BlockNode])`: in one transaction, delete all blocks of the tab, insert the tree depth-first with fresh order keys, reindex. Used by restore and tests.

`blocks::load_tab(tab_id) -> Vec<BlockNode>`: one `SELECT … WHERE tab_id=? ORDER BY parent_id, order_key`, build the tree in memory. Orphans (parent missing) are attached at top level and logged.

### 3.4 Other entities

```rust
pub struct PageMeta { id, parent_id: Option<String>, title, order_key, created_at, updated_at }
pub struct TabMeta  { id, page_id, name, order_key }
pub struct OptionSet { id, page_id, name, options: Vec<DropdownOption> }
pub struct DropdownOption { id: String, name: String, color: OptionColor }
pub enum OptionColor { Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, Red }   // serialized lowercase
pub struct CommentThread { id, page_id, tab_id, quote, resolved: bool, created_at, updated_at, comments: Vec<Comment> }
pub struct Comment { id, thread_id, body, created_at, updated_at }
pub struct AssetMeta { id, file_name, ext, mime, byte_size }
pub struct VersionMeta { id, page_id, created_at, reason }
pub struct SearchHit { page_id, page_title, snippet: String /* ≤ 120 chars, original (unfolded) text */, title_match: bool }
```

Functions (module → signature; all return `Result<_, CoreError>`; `Store` owns a `rusqlite::Connection` and the data paths):

| Module | Function | Behaviour |
|---|---|---|
| pages | `list_pages()` | All pages, ordered by (parent, order_key). |
| pages | `create_page(parent_id: Option, after_id: Option) -> (PageMeta, TabMeta)` | New page last among siblings unless `after_id`; title `""`; creates one tab (`name ""`) with no blocks; indexes empty title. |
| pages | `rename_page(id, title)` | Trims nothing; stores as typed; reindexes title row. |
| pages | `delete_page(id)` | Deletes page + descendants (cascade) + FTS rows + returns `Vec<String>` of deleted page ids (for the mirror). |
| tabs | `list_tabs(page_id)`, `create_tab(page_id, name) -> TabMeta` (appended), `rename_tab(id, name)`, `move_tab(id, prev_sibling_id: Option)`, `delete_tab(id)` | Deleting the **last** tab of a page is refused (`CoreError::LastTab`). In the same transaction as a tab delete, `UPDATE comment_threads SET tab_id = <first remaining tab> WHERE tab_id = <deleted>` (threads are never lost; they show as detached). `history::restore` does the same for tabs it removes. |
| option_sets | `list(page_id)`, `create(page_id, name, options)`, `update(id, name, options)`, `delete(id)` | `update`/`delete` re-index every block of that page (option names are in search text). Deleting a set leaves chips pointing at it; they render as "—". |
| comments | `list_threads(page_id)`, `create_thread(page_id, tab_id, quote, body) -> CommentThread`, `add_comment(thread_id, body)`, `edit_comment(id, body)`, `delete_comment(id)` (deleting the last comment deletes the thread), `set_resolved(thread_id, bool)`, `delete_thread(id)` | Body must be non-empty after trim (`CoreError::EmptyComment`). |
| assets | `import(file_name, bytes) -> AssetMeta` | ext from file name; mime from ext (small table: png jpg jpeg gif webp heic svg pdf txt md csv zip; else `application/octet-stream`); sha256; if an asset with the same sha256 exists return it; else write file atomically (temp + rename) then insert row. |
| assets | `path_of(id) -> PathBuf`, `get(id) -> AssetMeta` | |
| assets | `collect_garbage()` | Delete assets referenced by no block **and** no snapshot (scan `url` props in blocks and in decompressed snapshots). Runs at app start, at most once per 24 h (`settings.last_asset_gc`). |
| settings | `get(key) -> Option<String>`, `set(key, value)` | Keys: `mirror_folder`, `last_asset_gc`, `last_history_prune`. |
| search | `search(query, limit=50) -> Vec<SearchHit>` | §3.6. |
| history | §3.7 | |
| markdown | `render_page(page_id, link_resolver) -> RenderedPage` | §3.8. |
| mirror | §3.9 | |

### 3.5 PageSnapshot (JSON inside `page_versions.data`)

```json
{ "schema": 1, "page": { "id": "…", "title": "…" },
  "tabs": [ { "id": "…", "name": "…", "orderKey": "…", "blocks": [BlockNode, …] } ],
  "optionSets": [OptionSet, …] }
```

Comment threads are **not** in snapshots (my call): restoring keeps all threads; a restored text that no longer has a thread's mark makes that thread "detached" (§5.9).

### 3.6 Folding and search

`fold(s)`: lowercase → NFD → drop chars in Unicode category Mn → replace `đ` with `d` → collapse whitespace runs to one space → trim. Tests must include: `fold("Đà Nẵng") == "da nang"`, `fold("ĐƯỜNG") == "duong"`, `fold("  Hà   Nội ") == "ha noi"`, and an already-decomposed input (NFD "Đà Nẵng") giving the same result.

Indexed text per block = `fold(text::plain_text(block))`. `plain_text`: text runs concatenated; link → its text; `dateChip` → `dd/MM/yyyy`; `pageLink` → `""` (titles change; not indexed); `dropdownChip` → current option name (or `""`); table → all cells' plain text joined with `" "`; `codeBlock`, `mathBlock`, `csvBlock`, `markdownBlock` → their text/source; `image`/`file` → `name + " " + caption`. Title row = `fold(title)`.

`search(query)`: `tokens = fold(query).split(' ')`, drop empties; empty → `[]`. Each token → `"tok"*` with `"` removed from tok; joined by space (AND). SQL: match against `search_fts`, group by `page_id`; a page ranks first if any `title` row matched, then by best `bm25`. Snippet: plain (unfolded) text of the best-matching block, cut to 120 chars around the first token's position (by folded-text char index mapped back 1:1 — folding keeps one output char per input base char after NFD/Mn removal; compute the mapping while folding). If only the title matched, snippet = first 120 chars of the page's first non-empty block.

### 3.7 History

- `history::checkpoint(page_id, reason) -> Option<VersionMeta>`: build the snapshot; if it is byte-identical to the latest snapshot's JSON → return `None`. If `reason == "idle"` and the latest snapshot is younger than 10 minutes → `None`. `leave`/`quit` ignore the 10-minute rule but still skip identical content. Store with zstd level 3.
- `history::list(page_id) -> Vec<VersionMeta>` newest first. `history::get(version_id) -> PageSnapshot`.
- `history::restore(version_id)`: (1) `checkpoint(page_id, "before_restore")` ignoring both skip rules except identical content; (2) in one transaction: set page title; for each tab in the snapshot: recreate if missing (same id), set name/order, `replace_tab_blocks`; delete tabs that exist now but not in the snapshot; replace option sets with the snapshot's; (3) return the new `Vec<TabMeta>`.
- `history::prune(now)`: keep everything younger than 7 days; between 7 and 90 days keep the newest snapshot per calendar day (local time); older than 90 days keep the newest per ISO week. Never delete the newest snapshot of a page. Runs at app start, at most once per 24 h.

### 3.8 Markdown rendering (`markdown/render.rs`)

Pure function of stored data. Input: page id; a `LinkResolver` trait `fn page_link(&self, page_id, tab_id) -> Option<String>` (returns a relative path or `None`), and `fn asset_link(&self, asset_id) -> String`.

Output `RenderedPage { files: Vec<(String /*file stem*/, String /*markdown*/)> }`: one file per tab. File content:

```
# <page title or "Không có tiêu đề">            (only in the first tab's file and in export)
<blocks>
```

Block rules (each top-level block separated by one blank line; children of list items indented 4 spaces per depth; children of other block types rendered after the parent at the same indent):

| Block | Markdown |
|---|---|
| paragraph | inline |
| heading n | `#`×n + space + inline (one level deeper than the title is **not** applied; my call) |
| bulletListItem | `- ` inline |
| numberedListItem | `1. ` inline (Markdown renumbers) |
| checkListItem | `- [ ] ` / `- [x] ` inline |
| quote | `> ` inline (every line prefixed) |
| codeBlock | ```` ```<language> ```` newline text newline ```` ``` ```` (fence lengthened if text contains ```` ``` ````) |
| mathBlock / csvBlock / markdownBlock | fenced with `latex` / `csv` / `markdown` |
| table | GFM table if every cell's rendered inline has no newline and the table has ≥ 1 row; first row is the header row (if `headerRows` is 0 or absent an empty header row of `   ` cells is emitted); `|` escaped as `\|`. Otherwise an HTML `<table>` with `<th>` for header rows and inline Markdown converted to HTML for cells (bold→`<strong>` etc., newline→`<br>`). |
| image | `![<caption or name>](<asset link>)` |
| file | `[<name>](<asset link>)` |

Inline: `bold` → `**x**`, `italic` → `*x*`, `strike` → `~~x~~`, `underline` → `<u>x</u>`, `code` → `` `x` `` (backtick count increased if needed; no other escaping inside), nested in that order (code innermost). Adjacent runs with identical styles are merged before rendering. Markdown-escape plain text: backslash before `\ * _ ` [ ] < > ~ |`, and before `#`, `-`, `+`, `>` or `N.` at the start of a line. `link` → `[text](href)`. `dateChip` → `dd/MM/yyyy`. `pageLink` → `[<target title>](<resolver path>)`, or the title alone if the resolver returns `None`, or `[liên kết hỏng]` if the target no longer exists. `dropdownChip` → option name or `—`. The `comment` style is ignored.

Golden-file tests in `crates/folio-core/tests/golden/`: one per block type, one for nested lists, one table (GFM) and one table (HTML fallback), one with all inline styles and Vietnamese text, one multi-tab page.

### 3.9 Markdown mirror (`mirror.rs`)

- Root = `settings.mirror_folder` (default supplied by the app). Manifest `<root>/.folio-mirror.json`: `{ "version": 1, "pages": { "<page id>": { "dir": "<relative dir>", "files": ["<relative file>", …] } } }`.
- **Paths:** each page is a directory named `sanitize(title)` inside its parent page's directory (top-level pages directly in root). Files: single-tab page → `<dir>/<sanitize(title)>.md`; multi-tab page → `<dir>/<sanitize(title)> — <sanitize(tab name or "Tab N")>.md` (N = 1-based position). Assets used by the page → `<dir>/assets/<asset id>.<ext>` (copied, not linked).
- `sanitize(s)`: replace `/ \ : * ? " < > |` and control chars with `-`; trim spaces and dots at both ends; empty → `Không có tiêu đề`; cut to 100 chars (on a char boundary). Sibling collisions (case-insensitive, after sanitizing) get ` (2)`, ` (3)`… in page order.
- `mirror::sync_page(page_id)`: compute the page's dir and files; if the manifest has a different dir for it, move the old dir to the new place (`fs::rename`; on failure, write fresh and delete old); write each file only if content differs (write temp + rename); delete files listed in the manifest for this page that are no longer produced; copy missing assets; update the manifest.
- `mirror::remove_pages(ids)`: delete their dirs (only paths recorded in the manifest, never anything else) and manifest entries.
- `mirror::full_sync()`: sync every page (parents before children), then remove manifest entries for pages that no longer exist. Runs at app start and when the mirror folder changes.
- Link resolver for the mirror: relative path from the current file to the target page's (first-tab or given tab) file, using `/`, each segment percent-encoded for spaces (`%20`) only.
- The mirror never reads `.md` files. It deletes only paths recorded in its manifest.

### 3.10 Errors

```rust
#[derive(thiserror::Error, Debug)]
pub enum CoreError {
  NotFound { entity: &'static str, id: String },
  InvalidOp { index: usize, reason: String },
  LastTab, EmptyComment,
  Db(#[from] rusqlite::Error), Io(#[from] std::io::Error), Json(#[from] serde_json::Error),
}
```

Serialized to the UI as `{ code: "not_found" | "invalid_op" | "last_tab" | "empty_comment" | "db" | "io" | "json", message: string }` (`message` is English, for logs; the UI maps `code` to Vietnamese text, §5.13).

---

## 4. Tauri app (`crates/folio-app`)

### 4.1 State and threading

`AppState { store: Mutex<folio_core::Store>, mirror_tx: Sender<MirrorJob> }`. Every command is `async` and runs its core call inside `tauri::async_runtime::spawn_blocking`, locking the mutex there. Never hold the lock across an `await`.

`MirrorJob = SyncPage(id) | RemovePages(ids) | FullSync`. `mirror_worker.rs` owns its own `Store` connection (second connection to the same file; WAL allows this), coalesces jobs for 2 s (a page synced at most once per window), runs them, and on error emits event `mirror-error` `{ message }` to the window (UI shows a non-blocking toast once per 10 minutes).

Commands that change a page's content (`tab_apply`, page/tab rename/create/delete/move, option set changes, history restore) enqueue `SyncPage(page_id)` (or `RemovePages`) after success.

### 4.2 Commands

Names are the exact `invoke` names. Arguments are camelCase in JS (Tauri default).

| Command | Args | Returns |
|---|---|---|
| `pages_list` | – | `PageMeta[]` |
| `page_create` | `parentId?: string, afterId?: string` | `{ page: PageMeta, tab: TabMeta }` |
| `page_rename` | `id, title` | `PageMeta` |
| `page_delete` | `id` | `string[]` (deleted ids) |
| `tabs_list` | `pageId` | `TabMeta[]` |
| `tab_create` | `pageId, name` | `TabMeta` |
| `tab_rename` | `id, name` | `TabMeta` |
| `tab_move` | `id, prevSiblingId?: string` | `TabMeta[]` (page's tabs, new order) |
| `tab_delete` | `id` | `void` |
| `tab_load` | `tabId` | `BlockNode[]` |
| `tab_apply` | `tabId, ops: BlockOp[]` | `ApplyResult` |
| `option_sets_list` / `option_set_create` / `option_set_update` / `option_set_delete` | as §3.4 | |
| `threads_list` | `pageId` | `CommentThread[]` |
| `thread_create` | `pageId, tabId, quote, body` | `CommentThread` |
| `comment_add` / `comment_edit` / `comment_delete` | as §3.4 | `CommentThread` (whole updated thread; `null` if deleted) |
| `thread_set_resolved` / `thread_delete` | | `CommentThread` / `void` |
| `asset_import` | raw body = file bytes; header `x-file-name` = `encodeURIComponent(name)` | `AssetMeta` |
| `search` | `query` | `SearchHit[]` |
| `history_checkpoint` | `pageId, reason` | `VersionMeta \| null` |
| `history_list` | `pageId` | `VersionMeta[]` |
| `history_get` | `versionId` | `PageSnapshot` |
| `history_restore` | `versionId` | `TabMeta[]` |
| `settings_get_mirror_folder` | – | `string` |
| `settings_choose_mirror_folder` | – | `string \| null` (opens a folder picker; on choice saves, enqueues `FullSync`) |
| `export_markdown` | `pageId` | `string \| null` (opens a save dialog; writes `<Title>.md` + `<Title> assets/`; returns path) |
| `print_page` | – | `void` (calls `WebviewWindow::print()`) |
| `asset_open` | `id` | `void` (opens the asset file with the default app via `tauri-plugin-opener`) |
| `open_url` | `url` | `void` (opens in the default browser via `tauri-plugin-opener`; only `http:`, `https:`, `mailto:` accepted, else `invalid_op`) |
| `quit_ready` | – | `void` (see §4.5) |

`asset_import` uses `tauri::ipc::Request` and reads `InvokeBody::Raw`; any other body → error `invalid_op`.

### 4.3 Generated TypeScript types

All structs/enums crossing the boundary derive `ts_rs::TS` with plain `#[ts(export)]` (no `export_to`) and serde `rename_all = "camelCase"` (enums with struct variants also `rename_all_fields = "camelCase"`). The output folder is set once in the workspace root `.cargo/config.toml`:

```toml
[env]
TS_RS_EXPORT_DIR = { value = "ui/src/backend/generated", relative = true }
```

(ts-rs resolves `export_to` relative to `TS_RS_EXPORT_DIR`, which otherwise defaults to `./bindings` inside the crate.) `BlockNode.props`/`content` are typed on the Rust side with `#[ts(type = "Record<string, unknown>")]` / `#[ts(type = "unknown")]`; the UI casts them to BlockNote types in one place (`ui/src/editor/convert.ts`).

**Command names are generated too.** `folio-app` has one `pub const COMMANDS: &[&str]` listing every command in §4.2, a test asserting it equals the list passed to `generate_handler!` (keep both in `commands.rs`, next to each other), and a test `export_commands_ts_file` that writes `ui/src/backend/generated/commands.ts` as `export const Commands = { pagesList: "pages_list", … } as const;`. `tauriBackend.ts` uses only `Commands.x`, never a string literal.

**The one way to regenerate:** `cargo test --workspace export_` (ts-rs exports during `cargo test`; the command-names test has the same prefix). `npm run -w ui gen` runs exactly that. `scripts/check.sh` runs it and then `git diff --exit-code ui/src/backend/generated` — and first asserts the folder is non-empty, so a wrong path fails instead of passing silently. Remove the `gen-bindings` example mentioned in §1.3.

### 4.4 Menus (Vietnamese) and shortcuts

macOS menu bar built in `menu.rs`. **The Edit menu must use Tauri's predefined items for Cut, Copy, Paste and Select All** — without them ⌘C/⌘V do not work in the webview on macOS. Undo/Redo are the exception: they are custom items "Hoàn tác" `⌘Z` / "Làm lại" `⇧⌘Z` emitting `menu:undo`/`menu:redo`, routed by the UI (D-024, D-026), because native undo maps 1:N onto ProseMirror history and wiped documents.

| Menu | Items (label → accelerator → action) |
|---|---|
| Folio | Giới thiệu Folio; Cài đặt… `⌘,` → event `menu:settings`; Ẩn Folio `⌘H`; Thoát Folio `⌘Q` — a **custom** item (not the predefined Quit, which may exit without a preventable `ExitRequested`) that starts the quit flow in §4.5 |
| Tệp | Trang mới `⌘N` → `menu:new-page`; Trang con mới `⇧⌘N` → `menu:new-subpage`; Tab mới `⌥⌘T` → `menu:new-tab`; Xuất Markdown… `⇧⌘E` → `menu:export-md`; In / Xuất PDF… `⌘P` → `menu:print` |
| Sửa | custom Hoàn tác `⌘Z` → `menu:undo`, Làm lại `⇧⌘Z` → `menu:redo`; predefined Cắt, Sao chép, Dán, Chọn tất cả; separator; Tìm trong trang `⌘F` → `menu:find`; Tìm mọi trang `⇧⌘F` → `menu:search` |
| Xem | Bình luận `⌥⌘C` → `menu:toggle-comments`; Lịch sử phiên bản `⌥⌘H` → `menu:toggle-history` |

Menu actions are emitted as events with those names; the UI subscribes in `ui/src/platform/menuEvents.ts`.

### 4.4b Asset protocol

Register URI scheme `folio-asset` (`register_asynchronous_uri_scheme_protocol`). Request path `/<asset id>` → stream the file with its `mime`, `Cache-Control: max-age=31536000, immutable`; unknown id → 404. In the UI, the stored URL `folio-asset:<id>` is resolved to a display URL with `convertFileSrc(id, "folio-asset")` from `@tauri-apps/api/core` (gives the right form on macOS and Windows), via BlockNote's `resolveFileUrl` option (§5.6).

### 4.5 Quit and close (no data loss)

- Triggers: the custom "Thoát Folio" menu item (⌘Q), `WindowEvent::CloseRequested`, and `RunEvent::ExitRequested` (Dock → Quit, logout). On the last two call `prevent_close()` / `api.prevent_exit()`. Then emit `flush-request` to the UI and start a 3-second timer.
- Re-entry guard: an `AtomicBool quitting` in `AppState`. If already set, a trigger does nothing; `ExitRequested` while `quitting` is set is **not** prevented (so the final `app.exit(0)` goes through).
- UI on `flush-request`: flush the save pipeline (§5.5), call `history_checkpoint(currentPageId, "quit")` if a page is open, then invoke `quit_ready`.
- `quit_ready` or the timer firing (whichever first) → flush the mirror queue synchronously (max 2 s) → `app.exit(0)`.
- Closing the only window quits the app (my call: single-window app).

---

## 5. UI (`ui/`)

### 5.1 Source layout

```
ui/src/
  main.tsx               mounts <App/>, imports global CSS, BlockNote + Mantine CSS, KaTeX CSS
  App.tsx                layout: <Sidebar/> | <PageView/> | <RightPanel/>
  i18n/vi.ts             all strings (§5.13)
  backend/
    generated/           ts-rs output (do not edit)
    Backend.ts           interface (§5.2)
    tauriBackend.ts      the only file calling invoke()
    fakeBackend.ts       in-memory implementation for tests and dev:web
    index.ts             picks implementation: VITE_BACKEND=fake → fake, else tauri
  platform/              menuEvents.ts, quit.ts, assetUrl.ts (the only other files allowed to import @tauri-apps)
  state/                 pagesStore.ts, pageStore.ts (open page, tabs, active tab), uiStore.ts (panels, find bar), optionSetsStore.ts, threadsStore.ts
  sidebar/               Sidebar.tsx, PageTree.tsx, PageTreeItem.tsx, SearchBox.tsx, SearchResults.tsx
  page/                  PageView.tsx, PageTitle.tsx, TabStrip.tsx, EmptyState.tsx
  editor/
    schema.ts            BlockNoteSchema with custom blocks/inline/styles
    convert.ts           BlockNode <-> BlockNote Block
    Editor.tsx           one BlockNoteView per tab
    savePipeline.ts      §5.5
    slashMenu.ts         items and filter
    dictionary.ts        BlockNote dictionary: English base + Vietnamese overrides except slash menu
    blocks/              MathBlock.tsx, CsvBlock.tsx, MarkdownBlock.tsx
    inline/              DateChip.tsx, PageLinkChip.tsx, DropdownChip.tsx, chipPickers/*
    styles/commentStyle.tsx
    find/                FindBar.tsx, findPlugin.ts
    tables/              dropdownColumn.ts
  comments/              CommentsPanel.tsx, ThreadCard.tsx, addComment.ts
  history/               HistoryPanel.tsx, VersionPreview.tsx
  settings/              SettingsDialog.tsx
  ui/                    Toast.tsx, ConfirmDialog.tsx, Menu.tsx (shared bits)
  theme.css              CSS tokens, shared resolved theme (appearance addendum)
```

Styling: **CSS Modules** (`*.module.css`) + CSS variables in `theme.css`; font `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`; body text 16 px / line-height 1.7; page text column max-width 900 px, centered (1044 px border-box with 72 px gutters). Appearance addendum governs explicit mode/accent preferences and shared Mantine/BlockNote theme. No Tailwind (my call: fewer moving parts).

### 5.2 Backend interface

`Backend.ts` declares one async method per command in §4.2 (same names in camelCase, e.g. `pagesList()`, `tabApply(tabId, ops)`), plus `assetImport(file: File)`, `assetDisplayUrl(storedUrl: string): string`, `onMenu(name, cb)`, `onFlushRequest(cb)`, `onMirrorError(cb)`. `tauriBackend.ts` implements it with `invoke`/`listen`. `fakeBackend.ts` implements it fully in memory (pages, tabs, blocks as `BlockNode` trees, threads, option sets, versions as JSON copies, search with a TS port of `fold`), so Playwright tests run in a browser. Fake `printPage` and `exportMarkdown` record calls only.

Errors: every Backend method rejects with `{ code, message }`; callers show `vi.errors[code]` in a toast.

**Links and files:** a capture-phase `click` listener on the document (`ui/src/platform/links.ts`) intercepts every click on an `<a href>` (editor links, rendered Markdown blocks): `http(s):`/`mailto:` → `backend.openUrl(href)`; anything else → ignored. `preventDefault()` always, so the webview never navigates away. In the editor, a plain click on a link opens the link toolbar (BlockNote default) and ⌘-click opens it. The file block's "Mở" action and a double-click on it call `backend.assetOpen(assetId)`.

### 5.3 Layout and page tree

- Sidebar 260 px fixed, top 28 px drag region. Contents: search box; "Trang" section with the tree; "+ Trang mới" button at the bottom.
- Tree items: disclosure triangle (if children), title (or `vi.untitled` greyed), on hover a `+` (new subpage) and `⋯` menu (Đổi tên, Thêm trang con, Xoá). Rename is inline. Delete asks `vi.confirmDeletePage(title, descendantCount)`.
- Expanded/collapsed state per page is kept in `localStorage` (`folio.tree.expanded`), wrapped in try/catch.
- Selecting a page: flush the current page's save pipeline, `history_checkpoint(oldPage, "leave")`, then load the new page.
- No drag-and-drop of pages (non-goal).
- Empty app: centered `vi.emptyState` with a button "Tạo trang đầu tiên".

### 5.4 Page view and tabs

- `PageTitle`: a single-line `<input>` styled as a 40 px heading, placeholder `vi.untitled`. Saves via `page_rename` 400 ms after the last change and on blur. Enter → focus the editor's first block (create an empty paragraph if none).
- `TabStrip` under the title: hidden when the page has exactly one tab **and** its name is empty; then a small "+ Tab" ghost button appears on hover of the title area. Otherwise shows tabs (name or `vi.tabFallback(n)`), click to switch, double-click to rename inline, drag to reorder (HTML5 drag; on drop `tab_move`), `⋯` menu: Đổi tên, Xoá tab (confirm; disabled with tooltip `vi.errors.last_tab` when only one tab). "+" at the end creates a tab named `""` and switches to it.
- Each tab has its own BlockNote editor instance. Instances for tabs of the open page are kept mounted but hidden (`display:none`) once visited, so undo history survives tab switches while the page stays open (my call). Leaving the page destroys them.

### 5.5 Save pipeline (`editor/savePipeline.ts`) — the most important module

Create one pipeline per editor instance: `createSavePipeline({ tabId, editor, backend, debounceMs = 600, maxWaitMs = 3000 })`.

1. `editor.onChange((editor, { getChanges }) => …)`: for each change, add `change.block.id` to `dirty: Set<string>`; for `"delete"` changes also add every descendant id of `change.block` (walk `children`). Ignore changes whose `source.type` is `"yjs-remote"` (never happens now; future-proof). Schedule a flush: debounce `debounceMs`, but never later than `maxWaitMs` after the first unflushed change.
2. `flush()` (also called directly on tab hide, page leave, quit):
   - If `dirty` is empty, resolve.
   - Walk `editor.document` depth-first once, recording for each block: `parentId` (null at top), `prevSiblingId`, and its position index.
   - `ops = []`. For each dirty id in **document order** that still exists: push `Upsert` with `id`, `parentId`, `prevSiblingId`, `type`, `props`, `content` (via `convert.toStored(block)`, which drops `children` and maps nothing else). Then for every dirty id that no longer exists in the document: collect into one `Delete { ids }` pushed **last** (upserts before deletes — see §3.3 for why; required test: outdent child C, which has children, out of block D, then delete D, within one debounce window → C and its children survive).
   - Also mark the **next sibling** of every upserted-and-moved block as needing no action (order keys are computed relative to the previous sibling only, so no extra ops are needed).
   - Clear `dirty` before awaiting; call `backend.tabApply(tabId, ops)`. On failure: put the ids back into `dirty`, show toast `vi.errors.saveFailed`, retry after 2 s (exponential up to 30 s), keep the editor usable.
   - Only one flush in flight; a flush requested during one runs right after it.
3. A status dot in the page header: grey "Đã lưu" when clean, amber "Đang lưu…" while dirty or in flight, red "Lỗi lưu — đang thử lại" after a failure.

Unit tests (Vitest, with a real headless `BlockNoteEditor` in jsdom and a mock backend) must cover: typing in one block sends exactly one `Upsert`; inserting a block between two sends one `Upsert` with the right `prevSiblingId`; deleting a nested list item sends one `Delete` with it and its children; moving a block with children (via `editor.moveBlocksUp`/drag API) sends an `Upsert` for the moved block only (children keep their parent id); undo after a delete restores via `Upsert`s; Vietnamese text "Đà Nẵng" round-trips through `convert`; 50 keystrokes within 600 ms produce one call; continuous typing for 5 s produces ≥ 1 call by 3 s.

Integration test (Rust, `folio-core/tests/apply.rs`) feeding the same op sequences and asserting `load_tab` returns the expected tree.

### 5.6 Editor schema (`editor/schema.ts`)

```ts
BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs (minus: audio, video, toggleListItem, divider if present),
                codeBlock: createCodeBlockSpec(codeBlockOptions /* @blocknote/code-block, shiki */),
                mathBlock, csvBlock, markdownBlock },
  inlineContentSpecs: { ...defaultInlineContentSpecs, dateChip, pageLink, dropdownChip },
  styleSpecs: { ...defaultStyleSpecs (minus textColor, backgroundColor), comment },
})
```

The `heading` block is configured for levels 1–3 only (BlockNote allows more by default; pass the levels option to its heading spec). Editor options: `tables: { headers: true, splitCells: false, cellBackgroundColor: false, cellTextColor: false }`, `uploadFile: (file) => backend.assetImport(file).then(a => "folio-asset:" + a.id)`, `resolveFileUrl: async (url) => backend.assetDisplayUrl(url)`, `dictionary` from `dictionary.ts`, `trailingBlock: true`, `animations: false`.

Custom blocks `mathBlock`, `csvBlock`, `markdownBlock` (`createReactBlockSpec`, `content: "none"`, `propSchema: { source: { default: "" } }`):
- **View mode** (default, and whenever the block is not being edited): math → KaTeX `renderToString(source, { displayMode: true, throwOnError: false })`; csv → Papa.parse (header: false) into an HTML table, max 500 rows shown then `vi.csvTruncated(n)`; markdown → markdown-it (html: false, linkify: true) → DOMPurify → HTML. Empty source → placeholder `vi.mathPlaceholder` / `vi.csvPlaceholder` / `vi.markdownPlaceholder`.
- **Edit mode**: clicking the rendered view (or pressing Enter when the block is selected) shows a monospace `<textarea>` (auto-height) with the source; changes call `editor.updateBlock(block, { props: { source } })` debounced 300 ms; Escape or blur returns to view mode. **IME:** never update props while `compositionstart` … `compositionend` is active; flush on `compositionend` (test this in the manual checklist).
- **Event isolation (learned in Phase 0):** React's `stopPropagation` on the textarea does not stop native events from reaching ProseMirror; rely on the node view's `stopEvent` (return `true` for events whose target is the textarea) and test ⌘Enter, Escape and Tab inside it. Track the composing flag with a `useRef`, not `useState` (state reads can be stale inside `onChange`).
- Keyboard: ⌘Enter in the textarea leaves edit mode.

Inline content (`createReactInlineContentSpec`, `content: "none"`):
- `dateChip` `{ date }`: renders `dd/MM/yyyy` in a pill; click opens a small popover with `<input type="date">`; change updates props.
- `pageLink` `{ pageId, tabId }`: renders "↗ " + current title of the page (and " › tab name" if `tabId`), from `pagesStore`; missing page → `vi.brokenLink` in red, not clickable. Click navigates (flush first).
- `dropdownChip` `{ optionSetId, optionId }`: pill with the option's name and colour; empty → `vi.dropdownEmpty` in grey; click → popover listing the set's options, plus "Sửa danh sách…" opening the option set editor (rename set, add/rename/recolour/reorder/delete options; changes call `option_set_update`).

Insertion: slash-menu items (§5.7). Also typing `@` opens a page-link picker (fuzzy over page titles; Enter inserts `pageLink`) — the only typed chip shortcut (my call).

Style `comment` (`createReactStyleSpec`, `propSchema: "string"`): renders `<span class="comment-mark" data-threads="…">` with a yellow background (stronger when its thread is active, none when every listed thread is resolved).

### 5.7 Slash menu (`editor/slashMenu.ts`)

Use BlockNote's `SuggestionMenuController` with `triggerCharacter="/"` and our own `getItems`. Items in this order, English labels from `vi.slashMenu`: Text, Heading 1, Heading 2, Heading 3, Bulleted list, Numbered list, To-do list, Quote, Code, Table, Image, 2 columns, 3 columns, Subpage (implemented, D-039), then Math (LaTeX), CSV, Markdown, File, Date, Page link, Dropdown in later phases. Filter: case-insensitive substring on the label and aliases (`h1`, `todo`, `latex`, `img`, …). Block items convert the current block if it is empty, otherwise insert below (BlockNote 0.56's `insertOrUpdateBlockForSlashMenu`). Subpage creates a child of the open page and links it (D-039). Chip items insert inline at the caret (Date → today; Page link → opens the picker; Dropdown → picker of the page's option sets with "Tạo danh sách mới…"). Image/File open the file picker (BlockNote file panel).

Suppress during IME composition: BlockNote's suggestion plugin ignores `/` typed while `view.composing` — verify in Phase 0; if it does not, wrap the trigger in a ProseMirror plugin that checks `view.composing`.

### 5.8 Tables

BlockNote table with `headers: true`. Row/column add, delete and drag-reorder use BlockNote's table handles; their menu labels are overridden in `dictionary.ts` with: Thêm hàng phía trên / Thêm hàng phía dưới / Thêm cột bên trái / Thêm cột bên phải / Xoá hàng / Xoá cột / Hàng tiêu đề / Cột tiêu đề. "Xoá bảng" is the block's ⋮⋮ menu "Xoá" (my call: the Swift spec's right-click menu is replaced by BlockNote's handle menus). Column width: BlockNote's built-in resize (ships in Phase 3).

Keyboard in cells: Tab → next cell, Shift-Tab → previous cell, **Tab in the last cell appends a row and moves into its first cell** (if BlockNote 0.56 does not do this, add a keyboard handler in `tables/tabAddsRow.ts`; Playwright test required).

**Dropdown column** (`tables/dropdownColumn.ts`), added to the column handle menu as "Chuyển thành cột lựa chọn…": pick (or create) an option set → every body cell (not header rows) in that column is replaced by a single `dropdownChip` with `optionId` = the option whose name equals the cell's folded plain text, else `""`. A column "is a dropdown column" when every body cell contains exactly one `dropdownChip` of the same set. When a row is added to a table (detected in the save pipeline's onChange: a table block update whose row count grew), each dropdown column's new cell gets an empty chip of that set. "Bỏ cột lựa chọn" turns chips back into plain text of the option name.

### 5.9 Comments

- Add: select text (non-empty, inside one or several blocks, not in code/math/csv/markdown blocks) → toolbar button "Bình luận" or `⌘⌥M` → the right panel opens with a draft card; on "Gửi" (⌘Enter): `thread_create(pageId, tabId, quote = selected plain text, body)`, then add the thread id to the `comment` style on the selected range (append to existing ids, space-separated). Cancel → nothing changes.
- Panel lists threads of the **current tab** in document order of their first mark; detached threads (id appears in no mark of the tab) after them under "Đoạn văn đã bị xoá"; resolved threads hidden behind a toggle "Hiện đã xử lý (n)". Card: quote (one line, ellipsis), comments with relative time ("5 phút trước"), reply box, buttons Xử lý / Mở lại, ⋯ (Sửa, Xoá).
- Clicking a card scrolls to and highlights its mark; clicking a mark opens the panel on its card.
- Resolve does not remove the mark (it just stops highlighting). Delete thread removes its id from all marks in the tab (an editor transaction, saved normally).
- Undo of the mark insertion leaves the thread detached (acceptable).

### 5.10 Find in page (`editor/find/`)

`⌘F` opens a find bar at the top-right of the page: input, "n/m" counter, ↑ ↓, close. Matching is on folded text (TS `fold`, identical to Rust) within the active tab's text nodes (paragraph-like blocks and table cells; not inside math/csv/markdown sources). Implemented as a ProseMirror plugin (via BlockNote's `_tiptapEditor` / extension API) producing decorations; Enter / ⇧Enter cycle and scroll into view; Escape closes and clears decorations. Never moves the editor selection while typing in the find input.

### 5.11 History panel

`⌥⌘H` toggles the right panel to "Lịch sử phiên bản": list from `history_list` grouped by day ("Hôm nay", "Hôm qua", dd/MM/yyyy), each row time + reason label. Clicking a row shows a read-only preview (`history_get` → a non-editable BlockNote view of the first tab, with a tab picker if several) over the page with a banner: "Đang xem phiên bản lúc HH:mm dd/MM/yyyy" + buttons "Khôi phục phiên bản này" and "Đóng". Restore: flush, `history_restore`, reload the page (all tabs), toast `vi.restored`.

Idle checkpoint: the page view starts a 2-minute timer after each save; when it fires, `history_checkpoint(pageId, "idle")`.

### 5.12 Settings, export, print

Appearance settings are implemented before Phase 4 under `2026-10-29-folio-appearance-tech-spec.md`. Phase 8 extends the same settings dialog with Markdown mirror controls; it must preserve `appearance.v1`, the shared theme store and existing CmdOrCtrl+, entry point.

- Settings dialog (`⌘,`): "Thư mục Markdown" showing the path + button "Đổi thư mục…" (`settings_choose_mirror_folder`) + note `vi.mirrorNote` ("Folio tự ghi các trang ra đây dưới dạng Markdown. Sửa file ở đây sẽ không cập nhật lại vào Folio.").
- Export Markdown (`⇧⌘E`): flush, `export_markdown(pageId)`, toast with the path.
- Print (`⌘P`): flush, add `printing` class to `<html>` (print CSS hides sidebar, panels, tab strip handles, toolbars; shows the page title and the active tab only), call `print_page`, remove the class after 1 s.

### 5.13 Vietnamese copy (`i18n/vi.ts`)

Must contain at least these keys (exact text):

| Key | Text |
|---|---|
| `untitled` | Không có tiêu đề |
| `newPage` | Trang mới |
| `newSubpage` | Thêm trang con |
| `rename` | Đổi tên |
| `delete` | Xoá |
| `confirmDeletePage(t, n)` | Xoá trang “{t}”{n > 0 ? ` và ${n} trang con` : ""}? Không thể hoàn tác. |
| `emptyState` | Chưa có trang nào. |
| `createFirstPage` | Tạo trang đầu tiên |
| `searchPlaceholder` | Tìm kiếm |
| `noResults` | Không tìm thấy kết quả |
| `tabFallback(n)` | Tab {n} |
| `deleteTabConfirm(name)` | Xoá tab “{name}”? |
| `saved` / `saving` / `saveError` | Đã lưu / Đang lưu… / Lỗi lưu — đang thử lại |
| `brokenLink` | liên kết hỏng |
| `dropdownEmpty` | Chọn… |
| `editOptions` | Sửa danh sách… |
| `newOptionSet` | Tạo danh sách mới… |
| `mathPlaceholder` / `csvPlaceholder` / `markdownPlaceholder` | Nhấn để nhập công thức LaTeX / Nhấn để nhập dữ liệu CSV / Nhấn để nhập Markdown |
| `csvTruncated(n)` | Đang hiện 500 / {n} dòng |
| `comment` / `send` / `resolve` / `reopen` / `showResolved(n)` / `detached` / `you` | Bình luận / Gửi / Xử lý / Mở lại / Hiện đã xử lý ({n}) / Đoạn văn đã bị xoá / Bạn |
| `history` / `today` / `yesterday` / `viewingVersion(t)` / `restore` / `close` / `restored` | Lịch sử phiên bản / Hôm nay / Hôm qua / Đang xem phiên bản lúc {t} / Khôi phục phiên bản này / Đóng / Đã khôi phục phiên bản |
| `reason.idle` / `reason.leave` / `reason.quit` / `reason.before_restore` | Tự động / Khi rời trang / Khi thoát / Trước khi khôi phục |
| `find` / `findNoMatch` | Tìm trong trang / Không có kết quả |
| `settings` / `mirrorFolder` / `changeFolder` / `mirrorNote` | Cài đặt / Thư mục Markdown / Đổi thư mục… / (text in §5.12) |
| `exported(path)` | Đã xuất ra {path} |
| `mirrorError` | Không ghi được thư mục Markdown. Ghi chú của bạn vẫn an toàn. |
| `errors.not_found` / `invalid_op` / `last_tab` / `empty_comment` / `db` / `io` / `json` / `saveFailed` | Không tìm thấy mục này / Thao tác không hợp lệ / Trang phải có ít nhất một tab / Bình luận không được để trống / Lỗi cơ sở dữ liệu / Lỗi đọc ghi file / Dữ liệu bị lỗi / Chưa lưu được, đang thử lại |
| `slashMenu.*` | the English labels in §5.7 |

BlockNote's own UI strings (formatting toolbar tooltips, block ⋮⋮ menu, table handles, file panel, placeholders) come from BlockNote 0.56's bundled Vietnamese locale (`import { vi } from "@blocknote/core/locales"`) as the base, with the slash-menu entries kept in English and the overrides listed in this spec applied on top; the block placeholder is "Nhập '/' để chọn lệnh"; heading placeholders "Tiêu đề 1/2/3"; list placeholder "Danh sách".

### 5.14 Behaviour parity notes (BlockNote vs the Swift spec)

- Nesting: BlockNote nests any block under any block with Tab / Shift-Tab. Accept it; no 0–6 cap (my call).
- Markdown shortcuts, Enter/Backspace rules, ⌘B/I/U toggles, formatting toolbar, side menu (+ and ⋮⋮) and drag: use BlockNote's built-ins. Playwright tests assert each rule from design §A3–A7; where BlockNote differs, record it in `docs/decisions.md` and show it to the owner in that phase's checklist rather than patching BlockNote internals.
- The formatting toolbar shows only: Bold, Italic, Underline, Strike, Code, Link, Comment (custom button). Hide colour, alignment, nesting and block-type buttons.

---

## 6. Phases, tasks and acceptance

Each phase ends with: all automated checks green; `docs/manual-checklists/phase-N.md` written by the agent (concrete steps, expected result, a checkbox each, always including the Vietnamese-typing block below); the owner ticks it.

**Vietnamese-typing block (in every checklist):** with macOS Telex and with one third-party method (EVKey or OpenKey), type `Tiếng Việt có dấu: Đà Nẵng, Huế, người, được, ở` in each place the phase added; no lost/doubled letters, no menu or toolbar opening mid-word, undo removes whole words not single tone marks (or record what it does).

### Phase 0 — IME gate (throwaway, `spikes/ime/`)
Minimal Tauri 2 + BlockNote 0.56 app (no core). Checklist: typing block above in paragraph, heading, bullet, table cell, slash-menu filter text, the find input (plain input), a `<textarea>` inside a custom block; ⌘B mid-word; `/` typed while composing. **Gate:** owner reports pass/fail per item. Fail on core editor items → repeat with Tiptap 3 (`@tiptap/react` + StarterKit + tables), then Lexical; record results in `docs/decisions.md`; the rest of this spec assumes BlockNote and must be revised by the spec author if another editor wins. Delete `spikes/` after the decision.

### Phase 1 — Skeleton (design A1–A4, A8–A9)
Tasks, in order: workspace + toolchain + CI script `scripts/check.sh` running rule 9; core `db` + migrations; `ids`, `time`, `order`, `fold` (+ tests); pages; tabs; blocks `apply`/`load_tab`/`replace_tab_blocks`; `text::plain_text`; search; Tauri shell (window, state, commands for the above, menus §4.4 with only implemented items enabled, quit flow §4.5); ts-rs bindings; UI backend interface + tauri + fake backends; sidebar tree + page title + single-tab editor with default blocks; save pipeline; search UI; find bar.
Acceptance: Playwright — create page/subpage, rename, delete with confirm, type each block kind via Markdown shortcuts, reload keeps content and nesting, search `da nang` finds `Đà Nẵng` in title and body, ⌘F highlights matches. Rust — every function in §3.3–3.6 has tests.

### Phase 2 — Editing controls (A5–A7)
Formatting toolbar config, ⌘B/I/U, slash menu (only block items available so far), side menu and drag, dictionary overrides. Playwright: each item in A5–A7; drag a list item with children; one ⌘Z undoes a move.

### Phase 3 — Rich tables (B3 minus dropdown column)
Header rows, handles, Vietnamese labels, resize, Tab/Shift-Tab, styled text and line breaks in cells, search indexes cells. Playwright for each.

### Phase 4 — Tabs and chips (B1, B2, dropdown column)
Core option sets; TabStrip; dateChip, pageLink (+ `@` picker), dropdownChip + option-set editor; dropdown column. Playwright for each; Rust tests for option-set reindexing and `LastTab`.

### Phase 5 — Special code blocks, images, files (B4, B5)
Core assets + GC; asset protocol; codeBlock with shiki; math/csv/markdown blocks; image/file blocks; slash items. Tests: Rust asset dedupe and GC; Vitest for view rendering (KaTeX error → shows error text, CSV truncation, Markdown sanitising strips `<script>`).

### Phase 6 — Comments (B6)
Core threads; comment style; panel; flows in §5.9. Playwright: add, reply, resolve, reopen, delete, detached after deleting text, reload keeps everything.

### Phase 7 — Version history (B7)
Core snapshots, retention, restore; panel; idle/leave/quit checkpoints. Rust: identical-content skip, 10-minute rule, prune with fake clock (pass `now` explicitly), restore round-trip incl. tabs added/removed. Playwright on fake backend: edit, checkpoint, edit, restore.

### Phase 8 — Markdown mirror and export (C, B8)
Core renderer (golden files) + mirror (temp-dir tests: create, rename moves dir, delete removes only manifest paths, collision suffixes, asset copy, link paths); mirror worker; settings dialog; export; print CSS. Manual checklist: open the mirror folder in Obsidian and check links and images.

---

## 7. Open — owner decides
Nothing open. (Code location decided: new repository `folio-tauri`, §1.1.)

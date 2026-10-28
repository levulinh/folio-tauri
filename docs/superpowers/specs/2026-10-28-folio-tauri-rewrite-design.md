# Folio — rewrite on Rust + Tauri 2 (design)

Date: 2026-10-28 · Status: agreed in chat, awaiting written approval
Replaces: the Swift app described in `2026-10-28-folio-notes-design.md` (MVP) and `2026-10-28-folio-block-controls-design.md` (block controls). Those two specs remain the reference for *behaviour*; this one changes the *stack* and adds the Claude Docs editing features.

## Why

- **Tables would not come right on TextKit 2.** Folio is the owner's daily, lighter Notion. Simple tables were never stable in the TextKit 2 editor (the latest fix was the grid sitting in the page's top-left corner). Web block editors already ship tables, drag handles and slash menus.
- **Reuse.** The owner wants one Rust core and one web UI that later become Folio for **Windows** and a **web** version. Those later versions show the same UI, and the data syncs between them. Both are future work, but nothing built now may block them.
- **AI later.** The owner will connect AI to Folio later. The document model and the edit API must be something an AI can drive without rewriting the core.
- **Richer editing.** The owner wants all the basic editing features of Claude Docs (list below), beyond what the Swift app does.

## Decided by the owner

| Topic | Decision |
|---|---|
| Stack | Rust core + Tauri 2 shell + web UI |
| Existing data | **No migration.** The new app starts empty; the Swift app's database is ignored. |
| Feature scope | Everything the Swift app does, **plus** the Claude Docs editing features listed under Goals |
| Charts and diagrams | Later, not this project |
| Storage | **SQLite is the source of truth**; the app also writes a **Markdown mirror folder** that is read-only from Folio's point of view (option 2 in chat). Editing the mirror files does not flow back. |
| Sync, web, Windows | Future. Design must not block them. |
| AI | Future. Design must make it easy (edit API below). |

## Goals

### A. Parity with the Swift app (behaviour as in the two earlier specs)
1. **Page tree** in a sidebar: nested pages, create page / subpage, rename, delete with confirmation (deletes descendants).
2. **Blocks:** paragraph, heading 1/2/3, bulleted, numbered, to-do (checkable), quote, code. Lists nest 0–6 levels (Tab / Shift-Tab).
3. **Markdown shortcuts** at the start of a block: `# `, `## `, `### `, `- ` / `* `, `1. `, `[] ` / `[ ] `, `> `, ```` ``` ````.
4. **Notion editing rules:** Return on an empty list item → paragraph; Return after a heading → paragraph; Backspace at the start of a non-paragraph block → paragraph.
5. **Inline formatting:** ⌘B / ⌘I / ⌘U toggle on the selection (or for the next typed text); a floating toolbar above a non-empty selection with B, I, U, S, inline code; not inside code blocks.
6. **Slash menu** (English labels, the only English UI): Text, Heading 1, Heading 2, Heading 3, Bulleted list, Numbered list, To-do list, Quote, Code, Table, plus the new block types from section B.
7. **Block handles** + and ⋮⋮ on hover; drag ⋮⋮ moves the block (with its nested children); one undo step per move.
8. **Autosave:** no Save button; persisted shortly after typing stops, immediately on page switch and on quit.
9. **Search:** sidebar search over titles and contents (all tabs, table cells, comments excluded); accent- and case-insensitive for Vietnamese (`da nang` → `Đà Nẵng`, `đ` ↔ `d`). In-page find with ⌘F.

### B. Claude Docs editing features (new)
1. **Tabs inside a page.** A page has one or more tabs (default one, unnamed tab bar hidden while there is only one). Add, rename, reorder (drag), delete (with confirmation). Each tab is its own document body. The page tree shows pages; tabs show as a strip at the top of the page.
2. **Inline chips** inserted from the slash menu (and typed shortcuts are the builder's call):
   - **Date chip** — picks a date; shown in Vietnamese date format; clickable to change.
   - **Link chip** — link to another page or a specific tab; shows the target's current title; clicking navigates; a link to a deleted target shows as broken, never crashes.
   - **Dropdown chip** — one value from a named option set (e.g. Status: Chưa làm / Đang làm / Xong). Option sets are defined per page and reused by every dropdown chip in that page; editing an option's name or colour updates every chip using it.
   - Ordinary **web links** (`[text](url)`, pasted URLs) open in the default browser.
3. **Rich tables** (supersedes "plain text cells"):
   - Cells hold styled inline text (B/I/U/S/code, links, chips); line breaks inside a cell allowed.
   - Optional header row (toggle).
   - Add / delete / reorder rows and columns (handles or right-click; Vietnamese menu copy as in the block-controls spec, extended for reorder); Tab / Shift-Tab between cells, Tab in the last cell adds a row.
   - **Dropdown column:** a column whose cells each hold a dropdown chip bound to one option set.
   - Column width is adjustable *(builder may defer if costly; say so in the plan)*.
4. **Special code blocks** (code block with a language):
   - `latex` → renders the formula (display math), click to edit the source.
   - `csv` → renders a read-only grid of the CSV, click to edit the text.
   - `markdown` → renders the Markdown, click to edit the text.
   - Any other language → syntax-highlighted code.
5. **Images and files:** drop or paste an image → image block (resizable width); drop any other file → file block (name, size, opens with the default app). Assets are copied into Folio's data folder; deleting the block does not delete the asset until the page's history no longer references it.
6. **Comments (personal):** select text → add a comment; the anchored text is highlighted; comments show in a side panel; reply in a thread; resolve / reopen; resolved threads hidden by default. Single user, no names shown beyond "Bạn". A comment whose anchored text is fully deleted becomes "detached" and stays in the panel.
7. **Version history per page:** automatic snapshots (rules below); a panel lists versions by time; preview a version read-only; restore it (the restore itself becomes a new version, so it can be undone by restoring the one before).
8. **Export:** current page → Markdown file (all tabs, one section per tab, assets copied next to it); current tab → PDF via the system print dialog.

### C. Markdown mirror
- A folder (default `~/Documents/Folio Markdown`, changeable in Settings) that mirrors every page as Markdown, updated after each save (debounced).
- Layout: one folder per page following the page tree, one `.md` per tab (single-tab pages: one `<title>.md`), an `assets/` folder per page. Titles are sanitised for the file system; renames and moves rename the files; deletes remove them.
- Chips and features Markdown can't hold are written as the closest readable form (date as text, link chip as a relative Markdown link, dropdown as its option name, rich table as a GFM table when it fits, otherwise an HTML table). Comments and history are not mirrored.
- The mirror is output only. Folio never reads it back. If a mirror write fails, the app shows a non-blocking warning and keeps working; the database is never affected.

## Non-goals (this project)
Sync, multi-user, sharing, mentioning people, charts, diagrams, AI features, a web build, Windows testing, importing from Markdown or from the Swift app, database/kanban views, formulas in tables, backlinks, iOS.

## Anti-goals (a failure even if it "works")
- **Any Vietnamese IME regression** (Telex/VNI, macOS built-in or third-party such as EVKey/OpenKey): lost or doubled characters, broken composition in paragraphs, table cells, chips' text fields or comments, or menus/toolbars popping up mid-composition.
- **Losing data:** an edit that is on screen after the autosave delay must be in SQLite; a quit or crash loses at most the last debounce window; version restore never destroys a version.
- **Per-keystroke whole-document work** on either side (re-sending, re-saving, re-indexing or re-rendering the whole page per keystroke).
- **Floating UI stealing focus** from the editor or covering the text being typed.
- **The core depending on Tauri or the UI depending on Tauri directly** — that would block the web version.

## Architecture (decided in chat as the builder's proposal; owner did not object)

```
folio/                      (Cargo workspace + pnpm workspace)
  crates/
    folio-core/             pure Rust library: model, SQLite storage, edit ops, search, history,
                            Markdown export/mirror. No Tauri, no UI. Reused later by a server.
    folio-app/              Tauri 2 app: thin command layer over folio-core, menus, file dialogs, print.
  ui/                       React + TypeScript + Vite app (the editor and all screens)
    src/backend/            Backend interface + TauriBackend (invoke). A later HttpBackend
                            implements the same interface for the web version.
```

- **Typed bridge:** Rust commands and their types generate the TypeScript bindings (`tauri-specta` or equivalent). The UI never hand-writes command names or payload types.
- **Editor:** **BlockNote** (built on Tiptap / ProseMirror), configured with custom blocks (special code blocks, file/image as needed) and custom inline content (date, link, dropdown chips). **This choice is gated by Phase 0.**
- **Storage (SQLite via `rusqlite`, bundled, FTS5 on):**
  - Every page, tab, block, comment thread, comment, option set and asset has a **UUID v7** and `created_at` / `updated_at`.
  - Blocks are rows: `id, tab_id, parent_id (nesting), order key (fractional index), type, props (JSON), content (JSON: styled inline runs, chips, or table cells)`. One row per block, so edits touch only the changed rows and future sync can work per block.
  - Text offsets anywhere in stored data use one documented unit; tests use composed Vietnamese text (“Đà Nẵng”).
  - Schema versioned with forward-only migrations from day one.
- **Edit API in the core** (the one surface both the UI and future AI use): `insert_blocks`, `update_block`, `delete_blocks`, `move_blocks`, plus page/tab/comment/option-set/asset operations. Each call is one transaction and returns the new state of what it touched. The UI turns editor changes into these calls by diffing BlockNote's block tree by block id (only changed blocks are sent), debounced.
- **Undo** lives in the editor (ProseMirror history, per tab). The core does not keep an undo stack.
- **Search:** the core keeps an FTS5 index of folded text (lowercase, NFD, strip combining marks, `đ`/`Đ` → `d`) per block, updated with each block write.
- **History snapshots** *(my call)*: the core snapshots the whole page (all tabs, as JSON, compressed) when the page has been edited and then left idle for 2 minutes, when the user leaves the page, and on quit — at most one snapshot per 10 minutes of editing per page. Keep every snapshot for 7 days, then one per day for 90 days, then one per week. Restore writes the snapshot back through the edit API.
- **Markdown** export and mirror are produced by the core from the stored model (not from the editor), so the web version and AI get the same output.
- **App feel:** native macOS menus with the usual shortcuts, standard window controls, system font, follows light/dark mode. Vietnamese UI copy everywhere except the slash menu.

## Delivery order (each phase ships on its own, tests green, owner's manual checklist done, before the next starts)

0. **IME gate (throwaway spike).** BlockNote inside a Tauri 2 window on macOS. The owner types Telex and VNI (macOS built-in and at least one third-party input method) into a paragraph, a heading, a list, a table cell and the slash-menu filter, and uses ⌘B mid-word. Pass = no lost/doubled characters, no menu popping during composition. **Fail →** try Tiptap directly, then Lexical, with the same checklist; record the result in the plan before Phase 1. The spike code is thrown away.
1. **Skeleton:** workspace, core with storage + migrations + edit API + search, Tauri shell, typed bridge, page tree, editor with parity blocks (A1–A4), autosave, search (A8–A9).
2. **Editing controls:** inline formatting + toolbar, slash menu, handles and drag (A5–A7).
3. **Rich tables** (B3, except dropdown column).
4. **Tabs and chips** (B1, B2) + dropdown column (B3).
5. **Special code blocks, images and files** (B4, B5).
6. **Comments** (B6).
7. **Version history** (B7).
8. **Markdown mirror and export** (C, B8).

## Testing
- Core: `cargo test`, including Vietnamese text, edit-op transactions, migrations, search folding, snapshot retention, Markdown output (golden files).
- UI: Vitest for logic (block diffing → edit ops, adapters); Playwright against the UI running in a browser with an in-memory fake backend for flows (create page, type, drag, table editing, tabs, comments). Tauri's WebDriver does not run on macOS, so the real-app check is the owner's manual checklist per phase, always including Vietnamese typing.

## Constraints
- macOS first (current macOS, Apple Silicon). Code must stay buildable for Windows (no macOS-only APIs in the core; platform specifics behind the Tauri layer), but Windows is not tested this project.
- Rust stable; TypeScript strict; pnpm.
- No network access at runtime; all data local.
- All dependencies open source with licences compatible with a personal project. Note: some BlockNote add-on packages (`@blocknote/xl-*`, e.g. PDF/DOCX export, multi-column) are GPL/commercial — avoid them; PDF goes through the print dialog instead.

## Technical decisions
The owner will implement with several Sonnet agents, so nothing technical is left open: every builder decision (schema, JSON shapes, edit ops, save pipeline, comments mechanism, chips, libraries and versions, UI structure, copy, phases and acceptance) is fixed in `2026-10-28-folio-tauri-tech-spec.md`. **On any conflict the tech spec wins.** Known refinements: special code blocks are separate block types; table menus use BlockNote's handles instead of right-click; comments are a custom text style; leave/quit snapshots skip the 10-minute rule (they still skip identical content); nesting has no 0–6 cap; npm instead of pnpm; block ids are the editor's UUID v4 (other entities use v7); command names are generated from Rust as constants (not via tauri-specta); deleting a tab never deletes its comment threads.

## Code location (owner's decision)
New repository `~/Workspace/personal/folio-tauri`. The Swift app in `~/Workspace/personal/folio` is left as it is; its two specs are copied into this repository's `docs/superpowers/specs/` as the behaviour reference.

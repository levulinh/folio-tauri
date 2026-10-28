# Phase 3 — Rich tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Precondition:** branch `feat/phase-3-rich-tables` is cut from `feat/phase-2-editing-controls` after its final review. `scripts/check.sh` and `npm run -w ui e2e` are green.

**Goal:** Tables that feel like Notion's: header row, row/column handles with Vietnamese menus, add/delete/reorder rows and columns, column resize, Tab/Shift-Tab/Enter navigation, styled text and line breaks in cells, all saved and searchable — plus the store hardening carried from Phase 1.

**Architecture:** BlockNote 0.56's built-in table block, configured (`tables` editor option) and with its handle UI replaced by a Folio `TableHandlesController` component; a small keyboard extension (same `createExtension` pattern as `findExtension`, `slashComposingGuard`) for the cell navigation rules BlockNote does not already provide. Core already stores `tableContent` and indexes cell text (`text::plain_text`); this phase adds tests, not new core features, except the migration hardening task.

**Tech Stack:** BlockNote 0.56.0 (`@blocknote/react` `TableHandlesController`, `TableHandle`, `ExtendButton`, `TableCellButton`), React 19.3.1, Rust core (rusqlite 0.41), Vitest 5.0.5, Playwright 1.64.1 (WebKit, port 5199).

**Spec:** tech spec `docs/superpowers/specs/2026-10-28-folio-tauri-tech-spec.md` §5.8 and §6 Phase 3; design `2026-10-28-folio-tauri-rewrite-design.md` §B3; behaviour reference `2026-10-28-folio-block-controls-design.md` Phase 4. Decisions D-001 … D-027 bind; read D-014 (save pipeline), D-022 (no slash menu in table cells), D-024/D-026 (undo), D-025 (dictionary).

## Global Constraints

- Tech spec §0 rules; `bash scripts/check.sh` green on every commit; `npm run -w ui e2e` (own server, port **5199**) green at the end of each task; never touch port 5173 (the owner's dev server).
- No new npm or crate dependencies.
- All Folio-owned UI text in `ui/src/i18n/vi.ts`; BlockNote's own table strings through `ui/src/editor/dictionary.ts` (Vietnamese).
- IME rule: no navigation key handler (Tab, Enter) may act while composing (`view.composing`, `isComposing`, `keyCode === 229`).
- The save pipeline is not modified. Every table edit must be an ordinary BlockNote transaction (the pipeline upserts the whole table block).
- Dropdown columns are Phase 4 — not here. Cell background/text colours, merged/split cells: not offered (`splitCells: false`, colour options off).
- Spelling "Xoá" (not "Xóa"), consistent with `vi.ts`.

## Review Focus

- **Typing Vietnamese with Telex/EVKey inside a cell, then Tab** — the composed word is committed intact and focus moves; no doubled or lost letters. Test in Task 2 (`tab while composing does nothing; tab after compositionend moves`), plus the checklist.
- **Deleting the last remaining row or column** — the table never ends up with 0 rows or 0 columns that cannot be edited; deleting the last row/column deletes the table block (my call) and the deletion is saved. Test in Task 1.
- **A large paste into a table cell (e.g. 30 lines of text)** — stays inside the cell as line breaks, the page stays responsive, it is saved and found by search. Test in Task 3.
- **Undo of a structure change (add/delete/reorder row or column)** — one ⌘Z reverts exactly that change and the stored table matches. Test in Task 1 and Task 4.
- **A table as the last block** — there is always an editable paragraph after it (BlockNote `trailingBlock: true`), so the caret can leave the table. Test in Task 2.

---

## File map (Phase 3)

```
ui/src/editor/Editor.tsx                      (Tasks 1–2: tables option, controller, extension)
ui/src/editor/table/FolioTableHandles.tsx     (Task 1)
ui/src/editor/table/tableKeys.ts              (Task 2: keyboard extension)
ui/src/editor/table/tableKeys.test.ts         (Task 2)
ui/src/editor/dictionary.ts (+ test)          (Task 1)
ui/src/editor/savePipeline.property.test.ts   (Task 5: table actions)
ui/e2e/table.spec.ts                          (Tasks 1–4)
crates/folio-core/src/db/mod.rs, tests/store.rs, tests/apply.rs   (Tasks 5–6)
docs/manual-checklists/phase-3.md             (Task 7)
```

**Test ids added:** `table-row-handle`, `table-col-handle`, `table-add-row` (bottom extend button), `table-add-col` (right extend button), `table-menu-<action>` for menu items (`add-above`, `add-below`, `add-left`, `add-right`, `delete-row`, `delete-col`, `header-row`, `header-col`). Set them on DOM nodes by BlockNote's own `data-test` attributes where present (as Phase 2 Task 2 did), never by position.

---

### Task 0: Phase 2 carry-overs

One commit per item (from the Phase 2 final review triage):
- [ ] **0a** Probe: after ⌘Z removes the `/` that opened the slash menu, the menu stays open (BlockNote). Test (Vitest or e2e): type "abc /", ⌘Z, then apply an item from the still-open menu → the text "abc" must be untouched. If text is deleted, fix by closing the suggestion menu on history transactions (`tr.getMeta("history$")` / `addToHistory`), and keep the test.
- [ ] **0b** Tests for the toolbar's Escape memory: an Escape with keyCode 229 and an Escape whose target is outside the editor (e.g. the find input) do not record a dismissal.
- [ ] **0c** `ui/src/editor/convert.test.ts`: the null-content round-trip asserts `toEqual([])` (not `not.toBeUndefined()`); `crates/folio-core/src/model/block.rs` comment: a failure on an element with a string `type` maps to `Unknown`, others are dropped.
- [ ] **0d** `ui/src/sidebar/Sidebar.test.tsx`: drop the inert native `search` event (or add a handler test if Sidebar ever handles it) so the test says what it checks.
- [ ] **0e** `ui/src/editor/dictionary.test.ts`: tighten the `secondary_tooltip` exemption to shortcut-looking values (`/^(Mod\+|Shift\+|Tab$|$)/`); assert `link_toolbar.delete.tooltip` = "Xoá liên kết" by name (table_handle names are asserted in Task 1).
- [ ] **0f** Watch: run Vitest 5× and report whether the intermittent "Errors 1" (prosemirror-view timer, `findPlugin.test.ts`) recurs; if it does, find and fix the leaking timer.

### Task 1: Table configuration, handles and Vietnamese menus

**Files:** Modify `ui/src/editor/Editor.tsx`, `ui/src/editor/dictionary.ts`, `ui/src/editor/dictionary.test.ts`; create `ui/src/editor/table/FolioTableHandles.tsx`, `ui/e2e/table.spec.ts`.

**Interfaces:**
- Produces: editor option `tables: { headers: true, splitCells: false, cellBackgroundColor: false, cellTextColor: false }`; `BlockNoteView tableHandles={false}` + `<TableHandlesController … />` rendering BlockNote's `TableHandle` (row and column) and `ExtendButton`s, with a menu that contains only: Thêm hàng phía trên, Thêm hàng phía dưới (row handle); Thêm cột bên trái, Thêm cột bên phải (column handle); Xoá hàng / Xoá cột; Hàng tiêu đề (row handle of row 0) / Cột tiêu đề (column handle of column 0) as toggles. No colour, split or merge items.
- Dictionary `table_handle` overrides (exact): `add_above_menuitem` "Thêm hàng phía trên", `add_below_menuitem` "Thêm hàng phía dưới", `add_left_menuitem` "Thêm cột bên trái", `add_right_menuitem` "Thêm cột bên phải", `delete_row_menuitem` "Xoá hàng", `delete_column_menuitem` "Xoá cột", and the header toggle keys of 0.56 (find their names) "Hàng tiêu đề" / "Cột tiêu đề". Record key names in a D-entry.
- Rule (my call): deleting the only row or only column removes the whole table block.

- [ ] **Step 1: Failing tests.** Vitest (dictionary): the eight texts above. Playwright `table.spec.ts`: `slash table inserts a 2x3 table with a header toggle off`; `hovering a cell shows row and column handles`; `row menu has exactly the four row items` / `column menu has exactly the four column items` (labels as above, no colour/split/merge); `add row below and column right` (counts change, saved, reload keeps them); `extend buttons add a row and a column`; `delete row and delete column`; `deleting the last row removes the table and saves`; `header row toggle persists` (row 0 renders as `th` after reload); `one undo reverts an added row and the store matches` (Meta/ControlOrMeta+Z, wait saved, reload).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** focused + full e2e + check.sh → green.
- [ ] **Step 5: Commit** — `feat(ui): table handles and Vietnamese table menus`.

### Task 2: Cell keyboard navigation

**Files:** Create `ui/src/editor/table/tableKeys.ts`, `ui/src/editor/table/tableKeys.test.ts`; modify `ui/src/editor/Editor.tsx`, `ui/e2e/table.spec.ts`.

**Interfaces:**
- Produces: `tableKeysExtension()` (BlockNote `createExtension` + ProseMirror keymap/plugin, priority above BlockNote's defaults only where needed) implementing, inside a table cell:
  - **Tab** → next cell (row-major); in the last cell → append a row and move into its first cell.
  - **Shift-Tab** → previous cell; in the first cell → nothing.
  - **Enter** → the cell directly below; in the last row → append a row and move into the same column of it (block-controls spec Phase 4).
  - **Shift-Enter** → a line break inside the cell.
  - All four do nothing while composing (`view.composing`, `isComposing`, `keyCode === 229`) — ProseMirror then handles the key normally.
  - First use what BlockNote 0.56 already does (it may already implement Tab/Shift-Tab and Tab-adds-row); add handlers only for what is missing and record which in the D-entry.

- [ ] **Step 1: Failing tests.** Vitest (mounted editor harness as in `toolbarVisibility.test.ts`): `tab moves to the next cell`, `tab in the last cell adds a row`, `shift-tab moves back`, `enter moves down`, `enter in the last row adds a row`, `shift-enter inserts a line break`, `tab while composing does nothing; tab after compositionend moves` (stub `view.composing`, as Phase 2 did). Playwright: the same flows by keyboard in WebKit, each followed by wait-saved + reload asserting the stored table shape and the caret cell (`document.getSelection()` inside the expected `td`); `table as last block keeps a paragraph after it` (click below the table → caret in a paragraph after it).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → green.
- [ ] **Step 5: Commit** — `feat(ui): table cell navigation with Tab, Shift-Tab and Enter`.

### Task 3: Rich text in cells and search

**Files:** `ui/e2e/table.spec.ts`; `crates/folio-core/tests/search.rs`; `crates/folio-core/src/text.rs` (only if a gap is found).

**Interfaces:**
- Consumes: Phase 2 formatting toolbar (works in cells — `shouldShowToolbar` treats table cell text as non-code text), core `text::plain_text` table rule (cells joined by single spaces, row-major).

- [ ] **Step 1: Failing tests.**
  - Playwright: `bold, italic, code and link in a cell persist` (select cell text, ⌘B/⌘I, toolbar code and link; reload; marks present inside the `td`); `toolbar appears for a selection inside a cell`; `line breaks in a cell persist` (Shift-Enter twice; reload; three lines in one cell); `pasting 30 lines into a cell keeps them in the cell` (clipboard via `page.evaluate` + a synthetic paste event or `insertText` of `"\n"`-joined lines — record the method; assert one table cell holds the text, block count unchanged, save completes within 3 s); `search finds text typed in a cell` (sidebar search for an accent-free form of a Vietnamese cell word → the page).
  - Rust `tests/search.rs`: `table_cell_text_is_searchable` (apply a table block whose cell contains "Hà Nội" with a bold run and a line break; search "ha noi" → the page; snippet contains "Hà Nội").
- [ ] **Step 2: Run** → FAIL where behaviour is missing (some may already pass — record which). **Step 3: Implement only what fails.** **Step 4: Run** → green.
- [ ] **Step 5: Commit** — `test: rich text, line breaks and search in table cells`.

### Task 4: Column resize and row/column reorder

**Files:** `ui/e2e/table.spec.ts`; `ui/src/editor/table/FolioTableHandles.tsx` (only if needed).

- [ ] **Step 1: Failing tests** (Playwright, `page.mouse` drag as Phase 2 Task 4 did): `dragging a column border resizes it and the width persists` (stored `columnWidths[0]` changes; reload → the `col`/cell width matches within 2 px); `dragging a row handle reorders rows` (stored row order after reload); `dragging a column handle reorders columns`; `one undo reverts a row reorder and the store matches`. If WebKit cannot drive BlockNote's table drag via `page.mouse`, mark only those drag tests `test.fixme` with a D-entry, cover the stored-shape assertions in Vitest through BlockNote's table API (e.g. `editor.updateBlock` with reordered rows + undo), and add the steps to the Task 7 checklist.
- [ ] **Step 2–4:** Run → FAIL; implement only what is missing; run → green.
- [ ] **Step 5: Commit** — `test(ui): table column resize and row/column reorder`.

### Task 5: Save-pipeline property test covers tables

**Files:** `ui/src/editor/savePipeline.property.test.ts`; `crates/folio-core/tests/apply.rs`.

- [ ] **Step 1: Extend** the property test's action set with: insert a table (2×3), add a row, add a column, delete a row (never the last), edit a cell's text (with Vietnamese text), move a table block up/down. All seeds must still end with stored tree == `editor.document` (tables compared by `content.rows[*].cells[*]` text and shape) and no `invalid_op`.
- [ ] **Step 2:** Rust `apply.rs`: `table_block_roundtrip_with_styles_and_breaks` (upsert a table block with styled runs and `"\n"` in cell text; `load_tab` returns it byte-identical in `content`).
- [ ] **Step 3: Run** (Vitest 3 times, Rust once) → green; fix only real defects found.
- [ ] **Step 4: Commit** — `test: property and round-trip coverage for tables`.

### Task 6: Store hardening carried from Phase 1

**Files:** `crates/folio-core/src/db/mod.rs`, `crates/folio-core/Cargo.toml`, `crates/folio-core/tests/store.rs`, `docs/decisions.md`.

One commit per item:
- [ ] **6a** Migrations read `user_version` inside an IMMEDIATE transaction (so two processes opening a fresh DB cannot both migrate); a DB whose `user_version` is greater than the number of known migrations fails to open with a clear `CoreError` (new variant `SchemaTooNew { found: i64, known: i64 }`, code `"db"`) instead of being used; `busy_timeout` is set before `journal_mode`. Tests: `newer_schema_is_refused`, `open_creates_schema` asserts `user_version == MIGRATIONS.len()`, `two_connections_migrating_a_fresh_db_both_succeed` (two `Store::open` on the same temp file from two threads).
- [ ] **6b** `Store::conn` / `conn_mut` are no longer public API: gate them behind `#[cfg(any(test, feature = "test-support"))]` and enable the feature for folio-core's own integration tests via `[dev-dependencies] folio-core = { path = ".", features = ["test-support"] }` (record in D-003 that folio-app must never use them). `cargo build -p folio-app` must not see them.

### Task 7: Phase 3 checklist and full run

**Files:** `docs/manual-checklists/phase-3.md`

- [ ] **Step 1: Write the checklist** (Vietnamese, phase-1 style, how to run + dev data path) covering: chèn bảng bằng `/table`; tay cầm hàng/cột, menu tiếng Việt đúng chữ, không có mục màu/tách/gộp ô; thêm/xoá/kéo đổi chỗ hàng và cột; kéo giãn cột; hàng tiêu đề, cột tiêu đề; Tab, Shift-Tab, Enter, Shift-Enter trong ô (Tab ở ô cuối thêm hàng, Enter ở hàng cuối thêm hàng); chữ đậm/nghiêng/link trong ô; dán nhiều dòng vào một ô; ⌘Z sau mỗi thao tác cấu trúc chỉ lùi một bước; xoá hàng/cột cuối cùng thì xoá cả bảng; tìm kiếm ra chữ trong ô; slash menu không mở trong ô (D-022); bảng là block cuối vẫn bấm được xuống dưới; and the §6 Vietnamese-typing block for: gõ trong ô bảng, gõ rồi Tab ngay, gõ rồi Enter ngay, gõ trong hàng tiêu đề.
- [ ] **Step 2: Run** `bash scripts/check.sh` and `npm run -w ui e2e` → green (smoke `npm run dev` only if port 5173 is free).
- [ ] **Step 3: Commit** — `docs: Phase 3 manual checklist`.
- [ ] **Step 4: STOP.** Report: Phase 3 done; next is the UI design pass with the owner (before Phase 4).

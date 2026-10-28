# Phase 2 — Layout and editing controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Precondition:** branch `feat/phase-2-editing-controls` is cut from `feat/phase-1-skeleton` (or from `main` once Phase 1 is merged). Phase 1's `scripts/check.sh` and `npm run -w ui e2e` are green.

**Goal:** A balanced page layout, then the editing controls of design §A5–A7: a trimmed formatting toolbar with ⌘B/I/U, the English slash menu, block handles (+ and ⋮⋮) with drag, Vietnamese BlockNote UI strings — plus the Phase 1 review items carried to Phase 2.

**Architecture:** All work is in `ui/`. BlockNote's built-in UI is replaced by our own controllers: `BlockNoteView` gets `formattingToolbar={false} slashMenu={false} sideMenu={false}` and renders `FormattingToolbarController`, `SuggestionMenuController` and `SideMenuController` with Folio components. No Rust changes except doc/test cleanups.

**Tech Stack:** React 19.3.1, BlockNote 0.56.0 (`@blocknote/react` exports `FormattingToolbarController`, `FormattingToolbar`, `BasicTextStyleButton`, `CreateLinkButton`, `SuggestionMenuController`, `getDefaultReactSlashMenuItems`, `SideMenuController`, `SideMenu`, `AddBlockButton`, `DragHandleButton`; `@blocknote/core` exports `insertOrUpdateBlockForSlashMenu`, `filterSuggestionItems`), Vitest 5.0.5, Playwright 1.64.1 (WebKit).

**Spec:** `docs/superpowers/specs/2026-10-28-folio-tauri-tech-spec.md` §5.6 (toolbar part), §5.7, §5.13, §5.14, §6 Phase 2; design `2026-10-28-folio-tauri-rewrite-design.md` §A5–A7; behaviour reference `2026-10-28-folio-block-controls-design.md` Phases 1–3. Phase 1 decisions in `docs/decisions.md` (D-001 … D-018) still bind — read D-001 (composing `/` note), D-013, D-014, D-016.

## Global Constraints

- Tech spec §0 rules apply (test first, one task = one commit, `bash scripts/check.sh` green on every commit, `npm run -w ui e2e` green at the end of each task, decisions recorded in `docs/decisions.md` with the next free D-number).
- All UI text from `ui/src/i18n/vi.ts`; the slash menu is the only English UI (labels in `vi.slashMenu`).
- Never import `@tauri-apps/*` outside `ui/src/backend/tauriBackend.ts` and `ui/src/platform/**`.
- No new npm dependencies (everything needed ships with BlockNote 0.56 / Mantine 9).
- IME rule (anti-goal): no menu, toolbar or handle may open, move focus or change the document while a composition is active (`view.composing`, `KeyboardEvent.isComposing`, or `keyCode === 229`).
- The save pipeline (`ui/src/editor/savePipeline.ts`, `pipelineRegistry.ts`) is not modified in this phase. Every editing control must produce ordinary BlockNote transactions that the pipeline already saves.
- Playwright test ids already used by Phase 1 keep working (`editor`, `page-title`, `save-status`, `find-*`, `search-*`, `tree-*`).

## Review Focus

- **`/` arriving during an IME composition** (third-party Vietnamese methods can emit it) → the slash menu must not open mid-word. Test in Task 3 (`slash menu does not open while composing`).
- **Toolbar flicker during composition over a selection** (EVKey/OpenKey replace text through a temporary selection) → the formatting toolbar never shows while composing. Test in Task 2 (`toolbar hidden while composing`).
- **Undo right after a drag** → one ⌘Z restores the exact previous structure (children included) and the restored structure is what gets saved. Test in Task 4 (`one undo reverts a drag and the store matches`).
- **Slash command at the end of a non-empty block** → the typed `/query` text is removed and the new block is inserted below; the original text is untouched. Test in Task 3.
- **Formatting a selection that spans a paragraph and a code block** → styles apply to the non-code part only; the code text is unchanged. Test in Task 2.

---

## File map (Phase 2)

```
ui/src/page/PageView.module.css            (Task 1)
ui/src/editor/Editor.tsx                   (Tasks 1–4: view props + controllers)
ui/src/editor/editor.css                   (Task 1, new: BlockNote overrides)
ui/src/editor/toolbar/FolioFormattingToolbar.tsx   (Task 2)
ui/src/editor/toolbar/toolbarVisibility.ts         (Task 2)
ui/src/editor/slashMenu.ts                 (Task 3)
ui/src/editor/slashComposingGuard.ts       (Task 3)
ui/src/editor/sideMenu/FolioSideMenu.tsx   (Task 4)
ui/src/editor/dictionary.ts                (Task 5)
ui/src/i18n/vi.ts                          (Tasks 2–5)
ui/e2e/layout.spec.ts, toolbar.spec.ts, slash.spec.ts, sidemenu.spec.ts  (Tasks 1–4)
docs/manual-checklists/phase-2.md          (Task 8)
```

**Test ids added in this phase:** `fmt-toolbar` (toolbar root), `fmt-bold`, `fmt-italic`, `fmt-underline`, `fmt-strike`, `fmt-code`, `fmt-link`; `slash-menu` (menu root), `slash-item` (with `data-key`), `side-add`, `side-drag`, `drag-menu-delete`.

---

### Task 1: Balanced page layout

**Files:**
- Modify: `ui/src/page/PageView.module.css`, `ui/src/editor/Editor.tsx` (import `./editor.css`), `ui/src/theme.css` (only if a token is missing)
- Create: `ui/src/editor/editor.css`, `ui/e2e/layout.spec.ts`

**Interfaces:**
- Produces: the page column used by every later task: content box max 900 px wide, centred, 72 px side gutters, editor text left edge == title left edge.

Decisions (owner asked for a wider column and no separate editor background; values are the plan author's call): `.page` → `box-sizing: content-box; max-width: 900px; margin: 0 auto; padding: 48px 72px 160px;`. Editor overrides in `editor.css`, scoped under `.bn-container`:
- editor background transparent (set BlockNote's CSS variables `--bn-colors-editor-background` and `--bn-colors-editor-text` to `transparent` / `var(--text)` for both light and dark; remove border-radius);
- `.bn-editor { padding-inline: 0; }` so block text starts at the column's left edge (the side menu is positioned outside the block by BlockNote's floating UI and lands in the 72 px gutter);
- body text 16 px / line-height 1.6, font from `theme.css`.

- [ ] **Step 1: Write failing Playwright tests** in `layout.spec.ts` (viewport 1400×900 unless stated; create a page, type "Một đoạn văn" in the editor):
  - `editor has no own background`: the computed `background-color` of `.bn-editor` and of `.bn-container` is `rgba(0, 0, 0, 0)` or equal to the page's.
  - `text aligns with the title`: `|titleInput.boundingBox().x − firstBlockText.boundingBox().x| ≤ 2` (first block text = `.bn-inline-content` of the first block).
  - `column is 900px on a wide window`: width of the title input == 900 ± 1.
  - `column shrinks on a narrow window`: at viewport 900×800, the page has no horizontal scrollbar (`document.documentElement.scrollWidth <= clientWidth`) and title width == main-area width − 144 ± 1.
  - `side menu fits in the gutter`: hover the first block at 900×800 → the side-menu element's left edge ≥ the main area's left edge (not clipped under the sidebar).
- [ ] **Step 2: Run** `npm run -w ui e2e -- layout` → FAIL.
- [ ] **Step 3: Implement** the CSS above. Check light and dark (`page.emulateMedia({ colorScheme })` in one test each).
- [ ] **Step 4: Run** the layout spec and the full e2e suite → PASS; `bash scripts/check.sh` → 0.
- [ ] **Step 5: Commit** — `feat(ui): wider page column, editor without its own background, text aligned with title`.

### Task 2: Formatting toolbar and ⌘B/I/U

**Files:**
- Create: `ui/src/editor/toolbar/FolioFormattingToolbar.tsx`, `ui/src/editor/toolbar/toolbarVisibility.ts`, `ui/src/editor/toolbar/toolbarVisibility.test.ts`, `ui/e2e/toolbar.spec.ts`
- Modify: `ui/src/editor/Editor.tsx`, `ui/src/i18n/vi.ts`

**Interfaces:**
- Consumes: `FolioEditor`, `schema` (`ui/src/editor/schema.ts`).
- Produces: `shouldShowToolbar(editor: FolioEditor): boolean` (false when the selection is empty, entirely inside `codeBlock` blocks, or `editor.prosemirrorView?.composing` is true); `<FolioFormattingToolbar />` rendered via `<FormattingToolbarController formattingToolbar={FolioFormattingToolbar} />`.

Toolbar content, in order (spec §5.14): `BasicTextStyleButton` bold, italic, underline, strike, code, then `CreateLinkButton`. Nothing else (no block-type select, colours, alignment, nesting, file buttons). Add `data-testid` per the list above (wrap each button in a span if the BlockNote component does not forward props). Tooltips come from the dictionary (Task 5 audits them). The toolbar never takes focus from the editor (BlockNote default; assert in e2e).

- [ ] **Step 1: Failing tests.**
  - Vitest `toolbarVisibility.test.ts` (headless editor, mounted in jsdom like `savePipeline.property.test.ts`): `hidden for an empty selection`; `shown for a text selection in a paragraph`; `hidden when the whole selection is inside a code block`; `shown when the selection spans a paragraph and a code block`; `toolbar hidden while composing` (set `view.composing` via a `compositionstart` event on `view.dom` or by stubbing the getter; record which in decisions).
  - Playwright `toolbar.spec.ts`: `toolbar shows exactly six buttons` (select a word → `fmt-toolbar` visible with `fmt-bold, fmt-italic, fmt-underline, fmt-strike, fmt-code, fmt-link` and no other button); `bold button toggles and survives reload` (wait for `save-status[data-status=saved]`, reload, word is inside `strong`); `cmd b i u toggle on a selection` (Meta+B, Meta+I, Meta+U → `strong`, `em`, `u`; pressing again removes); `cmd b with no selection styles the next typed text` (caret at end, Meta+B, type "đậm" → only "đậm" is bold); `no toolbar in a code block` and `cmd b in a code block does nothing` (code text has no `strong`); `formatting a paragraph-plus-code selection styles only the paragraph`; `toolbar hides when typing` (select word, type a letter → toolbar hidden); `focus stays in the editor` (after clicking `fmt-bold`, `document.activeElement` is inside `.bn-editor`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `Editor.tsx`: `<BlockNoteView … formattingToolbar={false}>` + controller. Visibility: pass `shouldShowToolbar` through the controller's show condition if 0.56 supports one; otherwise render `null` from `FolioFormattingToolbar` when it returns false (re-evaluated on `useEditorSelectionChange`/`useEditorContentOrSelectionChange`). If ⌘B inside a code block applies a mark (BlockNote's `codeBlock` may allow none), add a keymap guard that returns true (handled, no-op) for Mod-b/i/u when the selection is entirely in a code block.
- [ ] **Step 4: Run** focused tests, full e2e, `check.sh` → green.
- [ ] **Step 5: Commit** — `feat(ui): trimmed formatting toolbar; bold/italic/underline shortcuts`.

### Task 3: Slash menu

**Files:**
- Create: `ui/src/editor/slashMenu.ts`, `ui/src/editor/slashMenu.test.ts`, `ui/src/editor/slashComposingGuard.ts`, `ui/src/editor/slashComposingGuard.test.ts`, `ui/e2e/slash.spec.ts`
- Modify: `ui/src/editor/Editor.tsx`, `ui/src/i18n/vi.ts`

**Interfaces:**
- Produces:
  - `type SlashKey = "text" | "heading1" | "heading2" | "heading3" | "bulletedList" | "numberedList" | "todoList" | "quote" | "code" | "table"`.
  - `SLASH_ORDER: readonly SlashKey[]` (exactly that order — spec §5.7 items available in Phase 2; Math, CSV, Markdown, Image, File, Date, Page link, Dropdown arrive in Phases 4–5 and are appended then).
  - `slashItems(editor: FolioEditor): FolioSlashItem[]` where `FolioSlashItem = { key: SlashKey; title: string; aliases: string[]; onItemClick: () => void }`.
  - `filterSlashItems(items: FolioSlashItem[], query: string): FolioSlashItem[]` — case-insensitive substring match on `title` and each alias; empty query → all; keeps `SLASH_ORDER`.
  - `vi.slashMenu` = `{ text: "Text", heading1: "Heading 1", heading2: "Heading 2", heading3: "Heading 3", bulletedList: "Bulleted list", numberedList: "Numbered list", todoList: "To-do list", quote: "Quote", code: "Code", table: "Table" }` (exact English labels from the block-controls spec).
  - Aliases: text `["paragraph","p"]`, heading1 `["h1","title"]`, heading2 `["h2"]`, heading3 `["h3"]`, bulletedList `["ul","bullet","-"]`, numberedList `["ol","number","1."]`, todoList `["todo","checkbox","check","[]"]`, quote `["blockquote",">"]`, code `["codeblock","```"]`, table `["grid"]`.
  - `slashComposingGuard(): ` a BlockNote extension (`createExtension`, same mechanism as `findExtension` — D-016) whose ProseMirror plugin closes / prevents the slash suggestion menu while `view.composing` is true, and ignores a `/` that was inserted as part of a composition.

Behaviour (block-controls spec Phase 2, design A6): `/` anywhere in a non-code block opens the menu at the caret; typing filters; ↑/↓ moves; Enter applies; Escape or deleting the `/` closes; click applies. Applying deletes the typed `/query` and converts the current block if it is empty, otherwise inserts the new block below (`insertOrUpdateBlockForSlashMenu`). Table: if the current block is empty the table replaces it, otherwise it is inserted below. No menu inside code blocks.

- [ ] **Step 1: Failing tests.**
  - Vitest `slashMenu.test.ts`: `items follow SLASH_ORDER with English labels`; `filter matches title substring case-insensitively` (`"head"` → heading1–3; `"LIST"` → bulleted, numbered, to-do); `filter matches aliases` (`"h2"` → heading2; `"todo"` → todoList); `empty query returns all`; `applying heading2 on an empty paragraph converts it` and `applying quote at the end of a non-empty paragraph inserts below and keeps the text` (headless editor; call `onItemClick` after setting the caret).
  - Vitest `slashComposingGuard.test.ts`: `slash menu does not open while composing` (mounted editor; start a composition; insert "/" through the view; assert `editor.getExtension`/suggestion state reports no open menu — record the exact API used).
  - Playwright `slash.spec.ts`: `slash opens the menu with English labels` (items in order); `typing filters` (`/head` → 3 items); `enter applies to an empty block`; `slash at end of non-empty block inserts below and removes the query`; `escape closes and keeps the slash text`; `backspacing the slash closes`; `no menu in a code block`; `table item inserts a 3x2 table` (header row per BlockNote default is fine).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `Editor.tsx`: `slashMenu={false}` + `<SuggestionMenuController triggerCharacter="/" getItems={async (q) => filterSlashItems(slashItems(editor), q)} />`; add `slashComposingGuard()` to `extensions`. Use BlockNote's default menu component (styled by Mantine) with `data-testid="slash-menu"` / `slash-item` via a custom `suggestionMenuComponent` only if the default cannot carry test ids — otherwise select by role/text and document it. Record in decisions how the menu is suppressed in code blocks.
- [ ] **Step 4: Run** focused, full e2e, `check.sh` → green.
- [ ] **Step 5: Commit** — `feat(ui): English slash menu with filtering; IME-safe trigger`.

### Task 4: Block handles and drag

**Files:**
- Create: `ui/src/editor/sideMenu/FolioSideMenu.tsx`, `ui/e2e/sidemenu.spec.ts`
- Modify: `ui/src/editor/Editor.tsx`, `ui/src/i18n/vi.ts`

**Interfaces:**
- Consumes: Task 3 (the + button opens the slash menu).
- Produces: `<FolioSideMenu />` via `<SideMenuController sideMenu={FolioSideMenu} />` = `AddBlockButton` (`data-testid="side-add"`) + `DragHandleButton` (`data-testid="side-drag"`) whose drag-handle menu contains only **Xoá** (`data-testid="drag-menu-delete"`, label `vi.delete`). No colour items.

Not in this phase: dragging a multi-block selection as one unit (the block-controls spec allowed deferring it); record it as deferred in decisions.

Behaviour (design A7, block-controls spec Phase 3): hovering a block shows + and ⋮⋮ in its left gutter; they hide when the mouse leaves and while typing (BlockNote default). + inserts an empty Text block below (or reuses the block if it is empty) and opens the slash menu. Dragging ⋮⋮ moves the block with its nested children (BlockNote nests children, so they move with the parent). Dropping onto itself cancels; Escape cancels a drag. One ⌘Z undoes the whole move.

- [ ] **Step 1: Failing tests** (Playwright, WebKit):
  - `hover shows plus and drag handle` / `they hide after typing`.
  - `plus inserts a text block below and opens the slash menu` (block count +1, caret in the new block, slash menu visible).
  - `plus on an empty block reuses it` (block count unchanged).
  - `drag moves a list item with its children` — blocks: A, B (bullet) with child B1, C; drag B's handle below C → order A, C, B{B1}; wait for saved; reload → same.
  - `one undo reverts a drag and the store matches` — after the drag, Meta+Z → A, B{B1}, C; wait for saved; reload → A, B{B1}, C.
  - `drop onto itself does nothing` and `escape cancels a drag` (order unchanged, no save triggered: `save-status` stays `saved`).
  - `drag menu has only delete` / `delete removes the block and its children`.
  If Playwright's `dragTo` cannot drive BlockNote's HTML5 drag in WebKit, simulate with `page.mouse` (down on handle, move in steps, up) and, failing that, mark the drag tests `test.fixme` with a decisions entry and add them to the manual checklist — but the undo/structure assertions must then be covered in Vitest by calling `editor.moveBlocksDown()`/`moveBlocksUp()` + undo on a mounted editor with the fake backend (same harness as the Phase 1 property test).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (`sideMenu={false}` + controller; `DragHandleMenu` with only the delete item).
- [ ] **Step 4: Run** focused, full e2e, `check.sh` → green.
- [ ] **Step 5: Commit** — `feat(ui): block handles with add and drag`.

### Task 5: Vietnamese BlockNote strings

**Files:**
- Modify: `ui/src/editor/dictionary.ts`, `ui/src/editor/dictionary.test.ts`, `ui/src/i18n/vi.ts` (only if Folio-owned copy is added)

**Interfaces:**
- Consumes: the BlockNote 0.56 `vi` and `en` locales (`@blocknote/core/locales`).
- Produces: `dictionary` = Vietnamese locale + `slash_menu` from `en` + Folio overrides listed below.

Overrides (exact): `placeholders.default` = "Nhập '/' để chọn lệnh"; `placeholders.heading` = "Tiêu đề"; `placeholders.bulletListItem` = `placeholders.numberedListItem` = "Danh sách"; `placeholders.checkListItem` = "Việc cần làm" (already set in Phase 1 — keep); `drag_handle.delete_menuitem` = "Xoá"; formatting-toolbar tooltips: bold "Đậm", italic "Nghiêng", underline "Gạch chân", strike "Gạch ngang", code "Code", link "Liên kết" (use the 0.56 key names; record them). Any section of the `vi` locale that is missing or still English for the controls shown in Phases 1–2 (formatting toolbar, link toolbar, side menu, drag-handle menu, suggestion-menu "no items" text) gets a Vietnamese override; list them in the decisions entry.

- [ ] **Step 1: Failing tests** in `dictionary.test.ts`: `slash menu stays English` (`dictionary.slash_menu` toEqual `en.slash_menu`); `toolbar tooltips are Vietnamese` (each of the six keys equals the text above); `drag menu delete is Xoá`; `no shown section is left in English` — for the sections `formatting_toolbar`, `link_toolbar`, `side_menu`, `drag_handle`, `suggestion_menu`: every string value differs from `en`'s, except values that are identical in both languages (allow-list `["Code"]`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; full e2e green.
- [ ] **Step 5: Commit** — `feat(ui): Vietnamese labels for BlockNote controls`.

### Task 6: UI carry-overs from the Phase 1 review

**Files:** `ui/src/sidebar/SearchResults.tsx`, `ui/src/ui/Menu.tsx`, `ui/src/App.tsx`, `ui/src/state/pageActions.ts`, `ui/src/sidebar/expanded.ts`, `ui/src/page/PageView.module.css`, `ui/src/state/titleFocus.ts` (or wherever `requestTitleFocus`/`clearTitleFocus` live), `ui/src/state/quitFlush.ts`, `ui/src/editor/find/FindBar.tsx`, `docs/decisions.md` (D-016), tests next to each.

One commit per item (`fix(ui): …`), each with its test:
- [ ] **6a** `SearchResults` opens a page through `openPage` (the path that refreshes the tree when the page vanished). Test: clicking a result whose page was deleted shows the toast and the tree no longer lists it.
- [ ] **6b** Only one row menu open at a time: opening ⋯ on row B closes row A's menu (the outside-mousedown skip applies only to the menu's own trigger). E2E test.
- [ ] **6c** A failed initial `load()` still renders the shell and shows the toast. Vitest with a rejecting `pagesList`.
- [ ] **6d** Layering: `state/pageActions.ts` no longer imports from `sidebar/`; it accepts an `onCreated(parentId)` callback (or the expanded store moves to `state/`). Existing tests stay green.
- [ ] **6e** Title input gets a visible focus style (`:focus-visible` underline or caret-only is acceptable — must be visible in light and dark; e2e screenshot not required, assert a computed style difference on focus).
- [ ] **6f** `clearTitleFocus(pageId)` only clears the request if it is for that page. Unit test with two concurrent creates.
- [ ] **6g** `titleFlushCount` moves out of production exports (e.g. `quitFlush.testing.ts` re-exporting an internal accessor); tests import it from there.
- [ ] **6h** Find bar: the editor-level Escape also skips when `.bn-grid-suggestion-menu` (emoji picker) is open; update D-016 to say Escape from the editor closes the bar and leaves the editor blurred (BlockNote's own Escape behaviour). Test the emoji-picker case.

### Task 7: Test and doc carry-overs

One commit per item (`test: …` / `docs: …`):
- [ ] **7a** `ui/src/backend/tauriBackend.test.ts`: table-driven test over every `Backend` method → asserts the `Commands.x` name and the exact camelCase argument object passed to `invoke`, including `undefined` optional args.
- [ ] **7b** `ui/src/editor/convert.test.ts`: deepen — nested children three levels, styled runs (bold+italic+code), a link run, a check item with `checked: true`, null content round-trip both directions.
- [ ] **7c** `crates/folio-core/tests/bindings.rs`: `BlockNode.ts` also asserts `content: unknown` and `children: Array<BlockNode>`; fix the inaccurate `serde(other)` doc comment in `crates/folio-core/src/model/block.rs`.
- [ ] **7d** `ui/src/sidebar/Sidebar.test.tsx`: restore the mocked `usePageStore.open` after each test; add a test that the WebKit search clear (`type="search"` input set to "" via the native clear event / `fill("")`) returns to the tree.
- [ ] **7e** Docs: replace `export_command_names` with `export_commands_ts_file` in the tech spec §4.3 and the Phase 1 plan; fix the property-test comment about the skipped "remove last block" case (BlockNote's `getChanges()` throws only on an unmounted editor) and, since the test editor is mounted, remove the skip if the test stays green across all seeds.
- [ ] **7f** Prettier: record in decisions that Prettier is not adopted (ESLint + `cargo fmt` are the formatters) and close the Phase 1 item.

### Task 8: Phase 2 checklist and full run

**Files:** `docs/manual-checklists/phase-2.md`

- [ ] **Step 1: Write the checklist** (Vietnamese, one checkbox per line, concrete steps and expected results) covering: bố cục mới (cột chữ rộng, không có nền riêng, chữ thẳng hàng tiêu đề, cửa sổ hẹp vẫn ổn); thanh định dạng (chỉ 6 nút, không lấy mất con trỏ, ẩn khi gõ, không hiện trong code); ⌘B/⌘I/⌘U có và không có vùng chọn; slash menu (nhãn tiếng Anh, lọc, Enter, Escape, chèn bảng); nút + và ⋮⋮ (hiện khi rê chuột, ẩn khi gõ); kéo một danh sách có mục con xuống dưới, ⌘Z một lần hoàn tác, thoát rồi mở lại vẫn đúng; menu ⋮⋮ chỉ có Xoá; chữ tiếng Việt trên tooltip và menu; and the tech spec §6 Vietnamese-typing block for: gõ trong đoạn văn rồi bôi đen chữ có dấu và bấm ⌘B; gõ `/` ngay sau một chữ đang ghép dở (Telex và EVKey/OpenKey) — menu không được bật giữa chữ; lọc slash menu bằng chữ có dấu không làm vỡ bộ gõ; gõ ngay sau khi kéo thả.
- [ ] **Step 2: Run** `bash scripts/check.sh` and `npm run -w ui e2e` (all specs) → green; smoke `npm run dev` (start, wait for the binary, kill everything).
- [ ] **Step 3: Commit** — `docs: Phase 2 manual checklist`.
- [ ] **Step 4: STOP.** Report to the owner: Phase 2 done, please run `docs/manual-checklists/phase-2.md`.

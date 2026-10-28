# Folio — inline formatting, slash menu, block handles, simple tables

Date: 2026-10-28 · Status: agreed in chat, awaiting written approval
Builds on: `docs/superpowers/specs/2026-10-28-folio-notes-design.md` (MVP, shipped on `main`)

## Why

The owner uses Folio daily as a lighter Notion. After trying the MVP they want the four Notion habits they use most:
moving a line by dragging its handle, adding formatting from a `/` menu, styling words with ⌘B/⌘I/⌘U, and simple tables.
Success = these feel like Notion while Folio stays native, light, and correct with Vietnamese input.

## Goals (in delivery order — each phase ships on its own, tests green, before the next starts)

### Phase 1 — Inline formatting + selection toolbar
- Select text, press **⌘B / ⌘I / ⌘U** to toggle **bold / italic / underline** on the selection. Pressing again removes it (toggle is "all of the selection has it → remove; otherwise → add").
- With nothing selected, ⌘B/⌘I/⌘U toggles the style for the text typed next (typing attributes), like TextEdit.
- When a non-empty selection exists, a **floating toolbar** appears just above the selection with buttons **B, I, U, S (strikethrough), `</>` (inline code)**; active styles show as highlighted. It hides when the selection collapses, the editor loses focus, or the user starts typing. Strikethrough and inline code exist only via the toolbar (no new shortcuts). *(Builder's call — S and code were shown in the mockup the owner picked; drop them only if they cost disproportionately.)*
- Styles apply to every block kind except **code** blocks (toolbar disabled / shortcuts no-op inside code blocks).
- Styles persist across quit/relaunch. Search keeps matching on plain text (styles never affect search).
- Telex/VNI: text being composed takes the currently active style; the toolbar never steals focus or breaks composition.

### Phase 2 — Slash menu (English)
- Typing **`/`** anywhere in a non-code block opens a menu anchored at the caret. Typing more filters it (case-insensitive prefix/substring on the English names); ↑/↓ moves, Return applies, Esc or deleting the `/` closes it, clicking an item applies it.
- Items, in this order, with these exact labels: **Text, Heading 1, Heading 2, Heading 3, Bulleted list, Numbered list, To-do list, Quote, Code, Table** (Table arrives with Phase 4; until then it is absent).
- Applying an item deletes the typed `/query` and converts the current block to that kind (keeping its text). For **Table**: if the current block is empty the table replaces it, otherwise the table is inserted below.
- No menu while the IME has marked text; a `/` typed as part of composition does nothing special.
- Only this menu is English; all other UI copy stays Vietnamese.

### Phase 3 — Block handles: + and ⋮⋮
- Hovering a block shows, in its left margin, **+** and **⋮⋮** (Notion layout). They hide when the mouse leaves the block/gutter and while typing.
- **+** inserts an empty Text block below that block, puts the caret there and opens the slash menu.
- **Drag ⋮⋮** moves the block: the block follows the pointer (ghost), a blue horizontal insertion line shows where it will land, releasing moves it and saves. Dragging a list item (bullet / numbered / to-do) also moves the contiguous blocks below it with a deeper indent (its children). Dropping onto itself or Esc cancels. One ⌘Z undoes the whole move.
- If a multi-block selection exists and the drag starts on a handle inside it, the whole selection moves. *(Owner said "if hard, later" — builder may defer this one bullet; say so in the plan.)*

### Phase 4 — Simple tables
- A **Table** is one block. Created via `/table`: empty **3 columns × 2 rows**.
- Cells hold **plain single-line text** only (no inline styles, no line breaks in a cell).
- Keyboard: **Tab** → next cell, **Shift-Tab** → previous cell; Tab in the last cell adds a new row and moves into it; **Return** in a cell moves to the cell below (adds a row from the last row).
- Hovering the table shows **+** at the right edge (add column) and bottom edge (add row). Right-click in a cell: **Thêm hàng phía trên / Thêm hàng phía dưới / Thêm cột bên trái / Thêm cột bên phải / Xoá hàng / Xoá cột / Xoá bảng** (Vietnamese UI copy, exact).
- The whole table moves with its ⋮⋮ handle like any block; search finds text inside cells; Telex works inside cells; ⌘Z undoes cell edits and structure changes.

## Non-goals (this round)
- Styled text or multiple lines inside table cells; header rows, column resize, sorting, formulas, database views.
- Links, colours/highlights, mentions, dates, images, dividers, toggles, callouts in the slash menu.
- Markdown-style inline shortcuts (`**bold**`), a right-click formatting menu.
- Dragging blocks between pages or into the sidebar.

## Anti-goals (would be a failure even if it "works")
- Any regression in Vietnamese IME typing (lost/doubled characters, menu or toolbar popping during composition).
- Losing or corrupting existing notes: MVP data must open unchanged after the storage upgrade, and every save path must keep inline styles and table contents.
- Per-keystroke whole-document work (layout, restyle, decode, or save) — the MVP's performance rule still holds.
- Floating UI that steals keyboard focus from the editor or covers the text being typed.

## Constraints
- Everything in the MVP spec's Global Constraints still applies (macOS 26, Swift 6 strict concurrency, GRDB only dependency, `FolioCore` has no AppKit/SwiftUI, Vietnamese UI copy, autosave rules, Xcode 27.1 toolchain).
- **Storage upgrade** is a new GRDB migration (`v2`) that is additive: existing blocks get "no inline styles"; nothing is dropped or rewritten destructively. Inline style ranges must survive Vietnamese text (store offsets in a unit that matches how the text is stored, and test with composed characters like "Đà Nẵng").
- Search index keeps folding the plain text only; table cell text is included in the page body for search.
- Editor stays one TextKit 2 `NSTextView` per page (MVP architecture); undo goes through the text system.
- Each phase adds headless tests in `FolioAppTests`/`FolioCoreTests` in the MVP's style, plus a short manual GUI checklist for the owner (nobody else can click the app).

## Decided by the owner
- Handle style: **+ and ⋮⋮** like Notion (option B).
- Formatting entry: **select + ⌘B/⌘I/⌘U**, plus a **floating toolbar above the selection** (option A).
- Tables: **plain text cells for now**.
- Slash menu: **English labels**.
- Delivery order: inline formatting → slash menu → handles/drag → tables.

## Clarifications (from the builder check — "my call" = decided by Claude, not the owner)
- **Owner's data is real.** The owner already uses the MVP daily, so the `v2` migration is forward-only but must be tested against a database created by the MVP schema (fixture) — nothing lost, styles empty.
- **Code blocks drag as a unit** *(my call)*: a contiguous run of `.code` lines is one visual code block. Handles show on its first line only; dragging moves the whole run; `/code` converts only the current line (it joins an adjacent run naturally).
- **Drag children** *(my call)*: a dragged bullet / numbered / to-do item carries the contiguous following blocks whose `indent` is greater than its own. Quotes, headings, paragraphs and code carry no children. Moved children keep their indent *relative* to the dragged item (re-based to the drop position's indent, clamped to 0…6). Numbered lists renumber automatically (numbering is positional).
- **Undo** *(my call)*: one block move = one undo step (grouped in the text view's undo manager). Table structure changes (add/remove row/column, delete table) are undoable steps on the same stack. Typing inside a cell may have its own per-cell undo while the cell is being edited; a single unified stack across cells and paragraphs is not required.
- **Inline style anchoring** *(my call)*: styles are attributes on the characters in the editor, so they follow text through split (Return), merge (Backspace), kind changes and moves without extra bookkeeping. On save they are stored per block as ranges in UTF-16 offsets of exactly the stored string (the same unit the codec already uses); load re-applies them. Tests must cover "Đà Nẵng"-style text, Return in the middle of a styled word, and Backspace-merge of two styled blocks.
- **Headings + ⌘B** *(my call)*: only user-applied flags are stored. Headings keep their own semibold weight; a bold flag on heading text renders it bold (heavier). The toggle rule looks only at user flags.
- **Mixed selections** *(my call)*: ⌘B/⌘I/⌘U and the toolbar apply to the non-code parts of a selection and skip code lines. The toolbar is hidden when the selection is entirely in code, and inside table cells.
- **Tables in the text view** *(builder's call on mechanics)*: a table occupies one block position. The page always keeps an editable empty paragraph after a table that is the last block, so there is always somewhere to put the caret. Blocks can be dropped above or below a table, never into a cell.
- **Find in page** *(my call)*: in-page ⌘F is not required to find text inside table cells this round; sidebar search does find it (cell text is indexed).

## Builder's calls (decide in the plan, record why)
- Exact data model for inline styles (e.g. a JSON column of ranges per block vs. a separate table) and for tables (e.g. a JSON grid in the block row).
- How a table renders inside the single `NSTextView` (e.g. a TextKit 2 attachment hosting a native grid view) — must keep IME, focus, undo and save behaviour intact.
- Drag mechanics (AppKit dragging session vs. custom tracking), animation, exact hit areas and hover timing.
- Toolbar and slash-menu implementation (child window/popover vs. overlay view), as long as focus stays in the editor.
- Whether the multi-block-selection drag ships in Phase 3 or later.

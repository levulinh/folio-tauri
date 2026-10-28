# Phase 0 — Vietnamese IME gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A throwaway Tauri 2 + BlockNote 0.56 window that lets the owner prove (or disprove) that Vietnamese Telex/VNI typing works before any real code is written.

**Architecture:** One standalone Vite + React app with a Tauri 2 shell under `spikes/ime/`. No Rust core, no persistence. The owner types and reports results; the result is recorded in `docs/decisions.md`; `spikes/` is then deleted.

**Tech Stack:** Tauri 2.12.5, React 19.3.1, Vite 8.3.5, TypeScript 6.0.3, BlockNote 0.56.0 (+ Mantine 9).

**Spec:** `docs/superpowers/specs/2026-10-28-folio-tauri-tech-spec.md` §6 "Phase 0", and design anti-goal "Any Vietnamese IME regression".

## Global Constraints

- Everything lives in `spikes/ime/`; nothing outside it except `docs/manual-checklists/phase-0.md` and `docs/decisions.md`.
- Pinned versions: `tauri 2.12.5`, `tauri-build 2.7.4`, `@tauri-apps/cli 2.12.4`, `@tauri-apps/api 2.12.4`, `react`/`react-dom 19.3.1`, `vite 8.3.5`, `@vitejs/plugin-react 6.1.2`, `typescript 6.0.3`, `@blocknote/core|react|mantine 0.56.0`, `@mantine/core` + `@mantine/hooks` latest 9.x.
- npm, not pnpm.
- No tests required (throwaway spike), but it must build and launch with one command.

## Review Focus

- Composition inside a table cell: BlockNote tables are a separate ProseMirror node view path; this is the most likely place to drop characters.
- `/` typed as part of a composition (VNI uses digits, Telex uses letters, but some third-party keyboards emit `/` combos): the slash menu must not open mid-word.
- ⌘B pressed while a word is still being composed: must not split or double the word.
- A plain `<textarea>` inside a custom block (the future Math/CSV/Markdown editors): ProseMirror must not steal its key events.
- Third-party input methods (EVKey/OpenKey) use the macOS accessibility "backspace + retype" trick rather than marked text; they behave differently from the built-in Telex and must be tested separately.

Each of these is an item in the checklist of Task 2.

---

### Task 1: Spike app

**Files:**
- Create: `spikes/ime/package.json`, `spikes/ime/index.html`, `spikes/ime/vite.config.ts`, `spikes/ime/tsconfig.json`, `spikes/ime/src/main.tsx`, `spikes/ime/src/App.tsx`, `spikes/ime/src/TextareaBlock.tsx`
- Create: `spikes/ime/src-tauri/` (`Cargo.toml`, `build.rs`, `tauri.conf.json`, `capabilities/default.json`, `src/main.rs`, `icons/`)
- Create: `.gitignore` at repo root (`node_modules/`, `target/`, `dist/`, `.DS_Store`)

**Interfaces:**
- Consumes: nothing.
- Produces: `cd spikes/ime && npm install && npm run tauri dev` opens a window titled "Folio IME spike".

- [ ] **Step 1: Scaffold.** Run `npm create tauri-app@4.7.5 -- ime --template react-ts --manager npm --identifier io.folio.imespike --yes` inside `spikes/` (if the flags differ in that version, run it interactively with: project name `ime`, frontend React, language TypeScript, package manager npm). Then pin the versions in Global Constraints in `package.json` and `src-tauri/Cargo.toml` and run `npm install`.

- [ ] **Step 2: Install BlockNote.** `npm install @blocknote/core@0.56.0 @blocknote/react@0.56.0 @blocknote/mantine@0.56.0 @mantine/core@9 @mantine/hooks@9`.

- [ ] **Step 3: Write `TextareaBlock.tsx`** — a custom block `textareaBlock` made with `createReactBlockSpec({ type: "textareaBlock", propSchema: { source: { default: "" } }, content: "none" }, { render })`. `render` returns a `<textarea>` (monospace, 4 rows, full width) whose value is `props.block.props.source`. On `onChange`, keep the text in local state; call `editor.updateBlock(block, { props: { source } })` only when no composition is active (track `onCompositionStart`/`onCompositionEnd`; on `compositionend` update). Stop propagation of `keydown` events from the textarea so ProseMirror does not handle them.

- [ ] **Step 4: Write `App.tsx`.** Create the editor with `useCreateBlockNote({ schema, dictionary: { ...locales.vi }, initialContent })`, where `schema = BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, textareaBlock } })` and `initialContent` is, in order: heading level 1 "Kiểm tra gõ tiếng Việt"; an empty paragraph; heading level 2 "Tiêu đề"; a bullet list item with text "Danh sách"; a 3×2 table with empty cells; a `textareaBlock`. Render `<BlockNoteView editor={editor} />` (from `@blocknote/mantine`, with its CSS imported), and below it a plain `<input placeholder="Ô tìm kiếm thử" />` styled full width. Window title "Folio IME spike" (set in `tauri.conf.json`), size 1000×800.

- [ ] **Step 5: Launch and smoke-test.** Run `npm run tauri dev` in `spikes/ime`. Expected: the window opens, the editor shows the six blocks, typing `/` in the empty paragraph opens the slash menu, ⌘B toggles bold. If the window does not open, fix the build before continuing.

- [ ] **Step 6: Commit**

```bash
git add .gitignore spikes/ime
git commit -m "chore: Phase 0 IME spike app (throwaway)"
```

### Task 2: Owner checklist and decision record

**Files:**
- Create: `docs/manual-checklists/phase-0.md`
- Create: `docs/decisions.md`

**Interfaces:**
- Consumes: the spike from Task 1.
- Produces: `docs/decisions.md` with a "D-001 Editor choice" entry, filled in after the owner runs the checklist.

- [ ] **Step 1: Write `docs/manual-checklists/phase-0.md`** with this content (Vietnamese, for the owner):

```markdown
# Giai đoạn 0 — Kiểm tra gõ tiếng Việt

Chạy: `cd spikes/ime && npm install && npm run tauri dev`

Câu thử: `Tiếng Việt có dấu: Đà Nẵng, Huế, người, được, ở`

Làm mỗi mục với **hai** bộ gõ: (A) Telex có sẵn của macOS, (B) EVKey hoặc OpenKey (ghi tên bộ gõ).
Đạt = không mất chữ, không lặp chữ, không có menu/thanh công cụ bật lên giữa chữ.

| # | Việc | A | B | Ghi chú |
|---|---|---|---|---|
| 1 | Gõ câu thử vào đoạn văn trống | ☐ | ☐ | |
| 2 | Gõ câu thử vào dòng "Tiêu đề" | ☐ | ☐ | |
| 3 | Gõ câu thử vào dòng "Danh sách", Enter, gõ tiếp ở dòng mới | ☐ | ☐ | |
| 4 | Gõ câu thử vào một ô bảng, Tab sang ô kế, gõ tiếp | ☐ | ☐ | |
| 5 | Gõ `/` rồi gõ `tiêu đề` để lọc menu (menu phải lọc đúng, không đóng/mở lung tung) | ☐ | ☐ | |
| 6 | Đang gõ dở chữ `người` thì bấm ⌘B, gõ tiếp | ☐ | ☐ | |
| 7 | Gõ câu thử vào ô textarea cuối trang | ☐ | ☐ | |
| 8 | Gõ câu thử vào ô "Ô tìm kiếm thử" | ☐ | ☐ | |
| 9 | Gõ `Đà Nẵng` rồi ⌘Z: ghi lại ⌘Z xoá cả chữ hay từng dấu | ☐ | ☐ | |
| 10 | Bôi đen chữ có dấu, bấm ⌘B, ⌘I, ⌘U | ☐ | ☐ | |

Kết luận: ☐ Đạt hết  ☐ Có mục hỏng (ghi số mục): ____
```

- [ ] **Step 2: Write `docs/decisions.md`** with a header `# Decisions` and an entry:

```markdown
## D-001 Editor choice (Phase 0 IME gate)
Status: pending owner checklist
Result per item: (copy from phase-0.md)
Decision: BlockNote 0.56 | Tiptap 3 | Lexical
Why:
```

- [ ] **Step 3: Commit**

```bash
git add docs/manual-checklists/phase-0.md docs/decisions.md
git commit -m "docs: Phase 0 IME checklist and decision record"
```

- [ ] **Step 4: STOP and hand over to the owner.** Report: "Phase 0 spike is ready; please run `docs/manual-checklists/phase-0.md` and send me the results." Do not start Phase 1.

### Task 3: Record the gate result (after the owner reports)

**Files:**
- Modify: `docs/decisions.md` (D-001)
- Delete: `spikes/`

- [ ] **Step 1:** Fill D-001 with the owner's results. If every item passed with both input methods → Decision "BlockNote 0.56", Status "decided".
- [ ] **Step 2 (only if any of items 1–6 or 10 failed):** do **not** continue. Report the failing items to the spec author; the fallback order is Tiptap 3, then Lexical (tech spec §6), and the tech spec must be revised before Phase 1. Items 7–9 failing alone are recorded as known issues for the custom-block and find-bar work, not a gate failure.
- [ ] **Step 3:** `git rm -r spikes && git commit -m "chore: remove Phase 0 spike; record editor decision"` (include `docs/decisions.md`).

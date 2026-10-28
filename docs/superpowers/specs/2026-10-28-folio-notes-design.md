# Folio — lightweight native notes app (MVP design)

Date: 2026-10-28 · Status: agreed in chat

## Goal

A Notion-like notes app for macOS that is native, fast and light: no Electron,
no network, all data on this Mac.

## Decisions

| Topic | Decision |
|---|---|
| Language | Swift only (Rust considered and rejected for MVP: no user-visible speed gain, adds FFI + second build system) |
| Platform | macOS 26 (Tahoe) minimum |
| UI | SwiftUI shell (`NavigationSplitView`), AppKit `NSTextView` on TextKit 2 for the editor |
| Storage | SQLite via GRDB 7, local only, no sync |
| Search | SQLite FTS5 over folded (diacritic- and case-insensitive) text |
| Build | Swift Package (opens directly in Xcode 26); `scripts/bundle.sh` wraps the binary into `Folio.app` |

## MVP features

1. **Page tree** — nested pages in a sidebar; create page, create subpage, rename, delete (deletes all descendants after confirmation).
2. **Block editor** — one page = ordered list of blocks. Kinds: paragraph, heading 1/2/3, bulleted item, numbered item, to-do (checkable), quote, code line. List items indent 0–6 levels with Tab / Shift-Tab.
3. **Markdown shortcuts** at the start of a paragraph: `# `, `## `, `### `, `- ` / `* `, `1. `, `[] ` / `[ ] `, `> `, ```` ``` ````+space.
4. **Editing rules** like Notion: Return on an empty list item turns it into a paragraph; Return after a heading starts a paragraph; Backspace at the start of a non-paragraph block turns it into a paragraph.
5. **Autosave** — no Save button; edits are persisted shortly after typing stops and immediately on page switch or quit.
6. **Search** — sidebar search across page titles and contents; Vietnamese queries without accents match accented text (`da nang` → `Đà Nẵng`). In-page find with ⌘F.

## Out of scope (later)

Database/table views, sync (iCloud or multi-user), images/attachments, drag-to-reorder pages, backlinks, AI, export, iOS.
The schema keeps stable UUIDs on pages and blocks so sync can be added later.

## Non-negotiables

- Vietnamese input methods (Telex/VNI, macOS or third-party) must work exactly as in TextEdit.
- Typing must never re-layout or re-save the whole document per keystroke.

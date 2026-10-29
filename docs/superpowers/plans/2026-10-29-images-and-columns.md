# Images and Side-by-Side Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Import raster images into Folio's own asset store and lay ordinary blocks out in two or three independent side-by-side columns, both saved by the existing tree pipeline and searchable.

**Architecture:** SQLite keeps asset metadata and a SHA-256; bytes are written atomically under the app-data `assets` directory and blocks store only `folio-asset:<id>` URLs. A dedicated asynchronous Tauri protocol resolves those IDs, never filesystem paths. Columns are original BlockNote layout specs (`folioColumns` / `folioColumn`) in the normal block tree, inserted by slash commands; no nested editors and no content in props.

**Tech Stack:** Rust core (rusqlite 0.41, sha2 0.10), Tauri 2.12 custom URI scheme, React 19.3.1, BlockNote 0.56.0 layout API, `prosemirror-history` 1.5.1, Vitest 5.0.5, Playwright 1.64.1 (WebKit, port 5199).

**Spec:** `docs/superpowers/specs/2026-10-29-images-and-columns.md` is binding; read it before each task. Decisions D-014 (save pipeline), D-024/D-026 (undo), D-025 (dictionary) and D-037 bind.

## Global Constraints

- Work in `/Users/levulinh/Workspace/personal/folio-tauri`, branch `codex/appearance`. Do not touch the Swift repo.
- Raster only: PNG, JPEG, GIF and WebP, maximum 20 MiB, signature must match the extension. SVG and every other format are rejected.
- Files live under the existing app-data `assets` directory; the database is the source of truth for metadata and SHA-256. Duplicate content reuses the stored asset.
- Blocks store `folio-asset:<id>` only. The protocol resolves database IDs; it never accepts a filesystem path and returns 404 for missing or invalid IDs.
- Asset GC stays deferred until history snapshots can be checked; deleting a block never destroys its file.
- Columns use BlockNote's public layout API, share the editor and normal block tree, and never nest layouts. No column resizing or count conversion UI in this increment.
- 24 px gaps, equal widths, and stacking in document order below 600 px of available layout width.
- The save pipeline, history routing, IME guards and existing block behaviour are unchanged.
- New visible strings belong in `ui/src/i18n/vi.ts`. Slash labels stay English, matching the other items.
- Commits follow repository conventions. Do not merge or push as part of execution.

## Review Focus

1. An import with the wrong extension, a mismatched signature or more than 20 MiB is rejected and the note is unchanged.
2. Identical bytes reuse the first asset; closing and reopening the app finds the same file and metadata.
3. Insertion keeps text before the slash query, consumes the query, puts the caret in the first column and undoes in one step.
4. Removing a column leaves `count` equal to the child count without adding a history step.
5. Images inside a column survive reload, and image file name and caption are found by search.

## File map and shared contracts

- `crates/folio-core/src/assets.rs`: validation, hashing, atomic write, dedupe, lookup and safe path resolution.
- `crates/folio-core/src/model/entities.rs`: `AssetMeta` exported by ts-rs to `ui/src/backend/generated/AssetMeta.ts`.
- `crates/folio-core/tests/assets.rs`: persistence, dedupe, reopen and rejection cases.
- `crates/folio-app/src/commands.rs`: raw-body `asset_import` with percent-decoded `x-file-name`; registered in the command macro and the generated list.
- `crates/folio-app/src/assets.rs`, `main.rs`: asynchronous `folio-asset` protocol returning bytes or 404.
- `ui/src/backend/{Backend.ts,tauriBackend.ts,fakeBackend.ts,fakeSearch.ts,imageValidation.ts}`: identical import/display contract; the fake persists data separately from block URLs and rejects a full store.
- `ui/src/editor/{schema.ts,Editor.tsx,slashMenu.ts}`, `ui/src/editor/images/FolioImagePanel.tsx`: image block, upload panel, `uploadFile` / `resolveFileUrl` wiring.
- `ui/src/editor/columns/{index.tsx,columns.css,columns.test.ts,README.md}`: layout specs, insertion, count reconciliation, responsive CSS.
- `ui/e2e/{images.spec.ts,columns.spec.ts}`: WebKit integration.
- `docs/manual-checklists/images-and-columns.md`: native paste/drop, macOS picker and relaunch checks.

## Task 1: Asset storage, validation and dedupe

- [x] Add `sha2` to the workspace and `folio-core`. Validate name (non-empty, ≤255 bytes, no separators or control characters), size (1 byte–20 MiB) and signature against the lowercase extension. Derive the MIME type from the validated pair.
- [x] Hash the bytes, reuse an existing row on a SHA-256 hit inside a `BEGIN IMMEDIATE` transaction, otherwise write a synced temp file and `persist_noclobber` under `assets/<uuid>.<ext>` before inserting metadata.
- [x] Resolve reads through `get_asset` and a canonicalized path that must stay inside the assets directory; reject non-UUID ids and unexpected extensions.
- [x] Export `AssetMeta` (camelCase) and assert `byteSize: number` in the bindings test.
- [x] Cover persistence across reopen, dedupe, every accepted signature, invalid names/bytes/sizes, corrupt stored extensions and traversal attempts.

## Task 2: Import command and asset protocol

- [x] Add `asset_import` taking raw bytes plus a percent-encoded `x-file-name` header; reject non-raw bodies, oversized bodies, malformed escapes, invalid UTF-8 and invalid names before touching the store.
- [x] Register the command in the macro list and the literal test list, and assert the generated `assetImport` name.
- [x] Register `folio-asset` as an asynchronous URI-scheme protocol that reads through the store and responds with the stored MIME type, immutable caching and `nosniff`; every failure is a 404.
- [x] Test the decoder, the oversized-body rejection, percent-encoded Vietnamese names, and protocol responses for valid, missing and traversal-like paths.

## Task 3: Image block, upload panel and search

- [x] Re-enable BlockNote's `image` spec and add an `Image` slash item; keep audio, video, files and colour controls out of the schema.
- [x] Route imports through `uploadFile` to `assetImport` and display stored URLs through `resolveFileUrl`; replace the default panel with an upload-only panel so the editor never embeds a local-file URL.
- [x] Keep captions and resizing (BlockNote defaults) and report import failures without changing the note.
- [x] Persist fake-backend bytes separately from block URLs, dedupe by SHA-256, and fail the import (and ordinary saves) with `io` when storage is full instead of silently keeping an unsaved state.
- [x] Index image `name` and `caption` in both Rust `plain_text` and the fake search.
- [x] Test validation in Vitest, quota failure in the fake backend, and WebKit upload → reload → search by name.

## Task 4: Column layout specs and slash insertion

- [x] Define `folioColumns` (`count` prop, `layoutOnly`, children `folioColumn` with `min: 2` and `dissolve`) and `folioColumn` (ordinary blocks, no nested layouts) with frame renderers and test ids.
- [x] Implement `insertColumns`: reject counts other than 2/3 and any layout ancestor, clear and close the slash menu, keep preceding text, seed one paragraph per column, focus the first paragraph, and close the history group before and after.
- [x] Add `2 columns` / `3 columns` slash items with English labels, Vietnamese aliases and Lucide icons.
- [x] Style equal-width columns with 24 px gaps and stack them below 600 px using a container query.
- [x] Cover 2/3 insertion, slash clearing, preceding text, refusal inside a layout, undo/redo, save-pipeline round-trip and count reconciliation.

## Task 5: Count reconciliation wiring

- [x] Install `installColumnsCountSync` once per editor and return its cleanup, so a removed column updates the persisted `count` without a history step.
- [x] Document that a raw transaction can leave an emptied column with BlockNote's implicit paragraph, while `removeBlocks` dissolves a layout left with fewer than two columns.

## Task 6: Regression and verification

- [x] Run `bash scripts/check.sh`; commit the regenerated bindings so its cleanliness gate passes.
- [x] Run the full WebKit suite, including the new image and column specs.
- [x] Run `npm run -w ui build`.
- [x] Keep the manual checklist for native paste/drop, the macOS file picker and relaunch.

## Task 7: Owner handoff

- [x] Record the storage, protocol, search, fake-backend and layout decisions in `docs/decisions.md`.
- [x] Update the project README and the columns module README; keep the mockup-free, shipped-feature wording.
- [x] Leave native OS checks unchecked in `docs/manual-checklists/images-and-columns.md`; they are not exercised by WebKit automation.

## Self-review

Coverage: storage and dedupe → Task 1; command and protocol → Task 2; images, panel and search → Task 3; layout and insertion → Task 4; count consistency → Task 5; regression → Task 6; handoff → Task 7. The spec's deferred items (asset GC, column resizing, count conversion, nested layouts, attachments) are not implemented. The only behaviour change outside the new features is the fake backend now rejecting a failed persistence write, which the spec requires for image imports and which a regression test covers.

## Completion evidence

Implemented on `codex/appearance`; no merge or push. `bash scripts/check.sh` passed: **129 Rust tests**, **265 Vitest tests**, plus formatting, clippy, lint, typecheck, binding and dependency checks. `npm run -w ui build` passed (existing large-chunk advisory). Full WebKit run: **154 passed**, including `e2e/images.spec.ts` and `e2e/columns.spec.ts`. Native image paste/drop, the macOS file picker and relaunch remain unchecked in `docs/manual-checklists/images-and-columns.md`.

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

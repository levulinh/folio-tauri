# Folio

A local-first notes app built with **Rust, Tauri 2, React and BlockNote**. Folio combines a nested page sidebar with a block editor, rich tables and a quiet writing interface.

**Status:** early development, currently focused on macOS. Windows, a production web app, sync and AI integration are future work.

## Features available today

- Nested pages: create, rename, delete and search, with Vietnamese accent-insensitive matching.
- Block editing: paragraphs, three heading levels, nested lists, checklists, quotes and code blocks.
- Inline formatting: bold, italic, underline, strikethrough, inline code and links.
- Slash commands, block handles and drag-and-drop reordering.
- Rich tables: add/delete/reorder rows and columns, resize columns, toggle headers and navigate cells with the keyboard.
- Find within a page, autosave, undo/redo and guarded save-on-quit handling.
- System, light and dark appearance, with neutral, blue, olive and purple accents.
- Consistent Lucide icons throughout the interface.

SQLite is the source of truth. A Markdown mirror, attachments, comments, version history and export are planned; they are not shipped features yet.

## Run locally

The desktop app currently targets macOS development. You will need Git, a current stable Rust toolchain, Node.js 22.12+ with npm, and Xcode Command Line Tools.

```sh
git clone https://github.com/levulinh/folio-tauri.git
cd folio-tauri
npm ci
npm run dev
```

`npm run dev` launches the Vite server on port **5173** and opens the Tauri desktop window. The first run also compiles the Rust dependencies.

To build the desktop application and bundles:

```sh
npm run build
```

Build output is under `target/release/`, with application bundles under `target/release/bundle/`.

### Browser preview

```sh
npm run -w ui dev:web
```

The browser preview uses a fake backend persisted in browser localStorage. It does **not** read or write the desktop SQLite database and is intended for UI development.

## Data storage

On macOS, the desktop database lives at:

| Build | Database |
| --- | --- |
| Development/debug | `~/Library/Application Support/io.folio.app/dev/folio.sqlite` |
| Release | `~/Library/Application Support/io.folio.app/folio.sqlite` |

Debug builds use a separate directory from release builds. Appearance preferences are also stored in SQLite. Folio does not currently sync data across devices.

## Checks and tests

Run the Rust and UI checks together:

```sh
npm run check
```

This runs Rust formatting, Clippy, workspace tests, app compilation, generated-binding checks, the core dependency boundary check, ESLint, TypeScript and Vitest. End-to-end tests run separately:

```sh
cd ui
npx playwright install webkit
npm run e2e
```

Playwright starts its own fake-backend server on port **5199**, separate from the desktop dev server. Browser tests do not replace native macOS testing, especially for input methods, window behavior and quitting. Manual checklists live in [docs/manual-checklists](docs/manual-checklists).

## Architecture

| Location | Responsibility |
| --- | --- |
| `crates/folio-core` | Pure Rust storage, migrations, page/block operations and search; no Tauri dependency |
| `crates/folio-app` | Tauri commands, native menus, application lifecycle and quit handling |
| `ui` | React interface, BlockNote editor and real/fake backend adapters |
| `ui/src/backend/generated` | TypeScript bindings generated from Rust with ts-rs |
| `scripts/check.sh` | Repository checks |
| `docs` | Specifications, implementation plans, decisions and manual checklists |

The UI talks to a backend interface, keeping desktop integration separate from editor and interface code. This structure supports future reuse of the Rust core and web UI.

## Project documentation

- [Technical specification](docs/superpowers/specs/2026-10-28-folio-tauri-tech-spec.md)
- [Appearance specification](docs/superpowers/specs/2026-10-29-folio-appearance-tech-spec.md)
- [Architecture and implementation decisions](docs/decisions.md)
- [Implementation plans](docs/superpowers/plans)
- [Repository instructions](AGENTS.md)

## Commit identity

Commits in this repository must use `levulinh <levulinhkr@gmail.com>` as both author and committer. For an authorized local checkout, configure this repository only:

```sh
git config --local user.name levulinh
git config --local user.email levulinhkr@gmail.com
git config --local user.useConfigOnly true
git config --local core.hooksPath .githooks
```

The included pre-commit hook rejects a different author or committer identity. Hooks must be enabled locally after cloning.

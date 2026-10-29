# Images and side-by-side columns

Owner request: image content and 2/3 columns. Owner confirmed columns mean independent content side-by-side, not table columns.

## Images

- Add `image` to the existing BlockNote schema and an `Image` slash command.
- Import PNG/JPEG/GIF/WebP through the upload panel, paste or drop via BlockNote's upload callback. Maximum 20 MiB; backend validates file extension and signature. SVG and other formats are not accepted.
- SQLite stores asset metadata and SHA-256; files are atomically written under the existing app-data `assets` directory. Duplicate content reuses an existing asset.
- Blocks store `folio-asset:<id>` URLs; UI resolves them through the backend. Tauri uses a dedicated asynchronous protocol; requests resolve database asset IDs, never arbitrary filesystem paths. Missing assets return 404.
- File name and caption participate in search. Existing image resizing/caption controls and editor undo remain available.
- Fake backend persists image data separately from block URLs in its localStorage state and rejects an image import if storage is full. This is a UI test/preview backend, not desktop storage.
- Asset GC remains deferred until history snapshot references are supported; deleting a block never destroys its file prematurely.

## Columns

- Slash commands `2 columns` and `3 columns` insert equal-width side-by-side content areas. Each contains ordinary editable blocks, including images.
- Original `folioColumns` and `folioColumn` layout specs use BlockNote's public layout API. They share the existing editor and normal block tree, with no nested editors or content encoded in props.
- Outer props contain `count: 2 | 3`; outer children are column containers; each column begins with one paragraph. Existing save pipeline and SQLite block hierarchy persist descendants.
- Insertion consumes the slash query, focuses the first paragraph and creates an undo boundary. Ordinary content before insertion is retained.
- 24 px gaps; equal widths; below 600 px available layout width, columns stack in document order.
- No column resizing or count conversion UI in this increment. Slash insertion avoids nested layouts.

## Verification

Rust: dedupe, atomic file persistence/reopen, invalid files/limits/paths, protocol responses and command exports. UI: column insertion/history/tree round-trip; existing unit tests. WebKit: image upload/reload/search, 2/3 columns independently editable/reload/responsive layout/undo, plus editor regression suite. Native image paste/drop and macOS file picker remain manual checks.

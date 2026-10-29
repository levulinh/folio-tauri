# Folio columns

Independent layout specs built on the installed MIT BlockNote core/React layout API. No XL import or copied XL source.

`columnsSpec` (`folioColumns`) and `columnSpec` (`folioColumn`) are registered in `ui/src/editor/schema.ts`; the `2 columns` and `3 columns` slash items in `ui/src/editor/slashMenu.ts` call `insertColumns`. Importing this directory loads its scoped CSS, and `installColumnsCountSync` is installed once per editor in `Editor.tsx`.

The outer layout has a numeric `count` prop (2 or 3). Its children are column containers whose children are normal blocks in the same editor. The existing tree save pipeline requires no alternate serialization. Insertion consumes an active slash query (also accepts a query already cleared by BlockNote's menu wrapper), seeds one paragraph per column, and focuses the first paragraph. Nonempty text is preserved, with the layout inserted after it. Insertion refuses existing layout ancestors and uses ordinary editor history.

`installColumnsCountSync` reconciles `count` with the child count after a column is removed, without adding a history step, so a saved page never carries a stale prop. Removing a column through `removeBlocks` dissolves a layout left with fewer than two columns; a raw transaction can instead leave the emptied column with BlockNote's implicit empty paragraph.

Limits: the insertion guard does not enforce a global structural invariant: paste, drag/drop, direct API writes, or imported documents can still create malformed/nested layouts or mismatch count and children. There is no resize, column count editor, custom cross-column navigation, drag/drop policy, or HTML/Markdown import/export fidelity guarantee. Narrow containers stack below 600px using container queries; browsers without container queries retain the equal-column grid. Existing wide content such as tables may still require its normal overflow handling.

Tests: `npx vitest run src/editor/columns` covers real tree edits, slash clearing, insertion boundaries, undo/redo, count reconciliation and save-pipeline round trips. `npx playwright test e2e/columns.spec.ts` covers insertion, independent editing, persistence, stacking and undo in WebKit.

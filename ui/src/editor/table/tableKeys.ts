import { createExtension, type BlockNoteEditor } from "@blocknote/core";
import { TextSelection, type EditorState } from "prosemirror-state";
import type { Node, ResolvedPos } from "prosemirror-model";
import { addRowAfter } from "prosemirror-tables";

/**
 * Cell keyboard navigation (D-030). BlockNote already moves with Tab / Shift-Tab / Enter inside
 * a table; what it lacks is adding a row from the last cell (Tab) or the last row (Enter), and
 * any respect for IME composition. This extension runs before BlockNote's table shortcuts (a
 * Folio extension has a higher priority than BlockNote's tiptap ones) and
 *   - swallows Tab, Shift-Tab, Enter and Shift-Enter in a cell while composing, so the key the
 *     IME consumed does not also move the caret or add a row;
 *   - appends a row for Tab in the last cell and Enter in the last row, and moves into it.
 *   - keeps Shift-Home / Shift-End (and Meta-Shift-ArrowLeft / ArrowRight, the macOS line
 *     selection) inside the cell: WebKit would otherwise extend the selection over the
 *     neighbouring cells, and one bold would format them all.
 * Everything else is left to BlockNote (it returns false).
 */

interface CellPosition {
  row: number;
  col: number;
  rows: number;
  cols: number;
  /** Doc position just inside the table node (where its first row starts). */
  tableStart: number;
}

const CELL_TYPES = new Set(["tableCell", "tableHeader"]);

/** Depth of the table cell around a resolved position, or null outside a table cell. */
function cellDepthOf($pos: ResolvedPos): number | null {
  for (let depth = $pos.depth; depth >= 2; depth--) {
    if (CELL_TYPES.has($pos.node(depth).type.name)) return depth;
  }
  return null;
}

/** Where the selection head sits in a table: its row and column and the table's size. */
function cellPosition(state: EditorState): CellPosition | null {
  const { $head } = state.selection;
  for (let depth = $head.depth; depth >= 2; depth--) {
    if (!CELL_TYPES.has($head.node(depth).type.name)) continue;
    const table = $head.node(depth - 2);
    if (table.type.name !== "table") return null;
    return {
      row: $head.index(depth - 2),
      col: $head.index(depth - 1),
      rows: table.childCount,
      cols: $head.node(depth - 1).childCount,
      tableStart: $head.start(depth - 2),
    };
  }
  return null;
}

/** Doc position at the start of the text of cell (row, col) of the table that starts at `tableStart`. */
function cellTextStart(doc: Node, tableStart: number, row: number, col: number): number {
  const table = doc.nodeAt(tableStart - 1)!;
  let pos = tableStart;
  for (let r = 0; r < row; r++) pos += table.child(r).nodeSize;
  const rowNode = table.child(row);
  pos += 1; // into the row
  for (let c = 0; c < col; c++) pos += rowNode.child(c).nodeSize;
  return pos + 1; // into the cell: its first paragraph starts here
}

function isComposingKey(editor: BlockNoteEditor, event: KeyboardEvent): boolean {
  return Boolean(editor.prosemirrorView?.composing) || event.isComposing || event.keyCode === 229;
}

/**
 * Appends a row below the table the head is in (prosemirror-tables' own command, so header
 * rows and column widths are handled) and puts the caret in column `col` of it, all in the
 * one transaction: one undo step removes the row and brings the caret back.
 */
function addRowAndEnter(editor: BlockNoteEditor, at: CellPosition, col: number): boolean {
  const view = editor.prosemirrorView;
  if (!view) return false;
  return addRowAfter(view.state, (tr) => {
    const start = cellTextStart(tr.doc, at.tableStart, at.rows, col);
    view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(start))).scrollIntoView());
  });
}

type Shortcut = (ctx: { editor: BlockNoteEditor; event: KeyboardEvent }) => boolean;

/** Wraps a shortcut: outside a table it passes, while composing in a table it swallows the key. */
function inCell(handler: (editor: BlockNoteEditor, at: CellPosition) => boolean): Shortcut {
  return ({ editor, event }) => {
    const at = cellPosition(editor.prosemirrorState);
    if (!at) return false;
    if (isComposingKey(editor, event)) return true;
    return handler(editor, at);
  };
}

/**
 * Extends the selection from its anchor to the start or end of the cell text the head is in.
 * Only for a text selection whose anchor sits in the same cell; anything else is left alone.
 */
function selectWithinCell(edge: "start" | "end"): Shortcut {
  return inCell((editor) => {
    const view = editor.prosemirrorView;
    if (!view) return false;
    const { selection, doc } = view.state;
    if (!(selection instanceof TextSelection)) return false;
    const { $head, $anchor } = selection;
    const cellDepth = cellDepthOf($head);
    if (cellDepth === null || $anchor.depth < cellDepth || $anchor.before(cellDepth) !== $head.before(cellDepth)) return false;
    const target = edge === "start" ? $head.start() : $head.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, selection.anchor, target)).scrollIntoView());
    return true;
  });
}

export const tableKeysExtension = createExtension(() => ({
  key: "tableKeys",
  keyboardShortcuts: {
    Tab: inCell((editor, at) => {
      if (at.row !== at.rows - 1 || at.col !== at.cols - 1) return false;
      return addRowAndEnter(editor, at, 0);
    }),
    "Shift-Tab": inCell(() => false),
    Enter: inCell((editor, at) => {
      if (at.row !== at.rows - 1) return false;
      return addRowAndEnter(editor, at, at.col);
    }),
    "Shift-Enter": inCell(() => false),
    "Shift-Home": selectWithinCell("start"),
    "Shift-End": selectWithinCell("end"),
    "Meta-Shift-ArrowLeft": selectWithinCell("start"),
    "Meta-Shift-ArrowRight": selectWithinCell("end"),
  },
}));

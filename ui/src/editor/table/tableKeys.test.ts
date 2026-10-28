import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "prosemirror-state";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema } from "../schema";
import { tableKeysExtension } from "./tableKeys";

type TestEditor = BlockNoteEditor<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;
let editor: TestEditor;
let host: HTMLElement;

const cellText = (row: number, col: number) => `r${row}c${col}`;

beforeEach(() => {
  editor = BlockNoteEditor.create({
    schema,
    tables: { headers: true, splitCells: false, cellBackgroundColor: false, cellTextColor: false },
    extensions: [tableKeysExtension()],
  });
  host = document.createElement("div");
  document.body.append(host);
  editor.mount(host);
  editor.replaceBlocks(editor.document, [
    {
      id: "t",
      type: "table",
      content: { type: "tableContent", rows: [0, 1].map((r) => ({ cells: [0, 1, 2].map((c) => cellText(r, c)) })) },
    },
    { id: "after", type: "paragraph", content: "after" },
  ]);
});
afterEach(() => {
  editor.unmount();
  host.remove();
});

/** Doc position of the start of the text of cell (row, col). */
function cellStart(row: number, col: number): number {
  let found = -1;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "table") return found < 0;
    let rowPos = pos + 1;
    node.forEach((rowNode, _o, ri) => {
      if (ri === row) {
        let cellPos = rowPos + 1;
        rowNode.forEach((cellNode, _co, ci) => {
          if (ci === col) found = cellPos + 2; // tableCell open + tableParagraph open
          cellPos += cellNode.nodeSize;
        });
      }
      rowPos += rowNode.nodeSize;
    });
    return false;
  });
  return found;
}

function caretAt(row: number, col: number, offset = 0): void {
  const at = cellStart(row, col) + offset;
  editor.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, at)));
}

/** [row, col] of the cell holding the selection head. */
function caretCell(): [number, number] {
  const { $head } = editor.prosemirrorState.selection;
  let depth = $head.depth;
  while (depth > 0 && $head.node(depth).type.name !== "tableCell" && $head.node(depth).type.name !== "tableHeader") depth--;
  expect(depth).toBeGreaterThan(0);
  return [$head.index(depth - 2), $head.index(depth - 1)];
}

function press(key: string, init: KeyboardEventInit = {}): boolean {
  const view = editor.prosemirrorView!;
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  return !!view.someProp("handleKeyDown", (f) => f(view, event));
}

const rowCount = () => (editor.document[0]!.content as { rows: unknown[] }).rows.length;
const setComposing = (on: boolean) => {
  (editor.prosemirrorView as unknown as { input: { composing: boolean } }).input.composing = on;
};

describe("tableKeysExtension", () => {
  it("tab moves to the next cell", () => {
    caretAt(0, 0);
    expect(press("Tab")).toBe(true);
    expect(caretCell()).toEqual([0, 1]);
    press("Tab");
    press("Tab");
    expect(caretCell()).toEqual([1, 0]); // row-major
  });

  it("tab in the last cell adds a row and moves into its first cell", () => {
    caretAt(1, 2);
    expect(press("Tab")).toBe(true);
    expect(rowCount()).toBe(3);
    expect(caretCell()).toEqual([2, 0]);
  });

  it("shift-tab moves back and does nothing in the first cell", () => {
    caretAt(1, 0);
    press("Tab", { shiftKey: true });
    expect(caretCell()).toEqual([0, 2]);
    caretAt(0, 0);
    expect(press("Tab", { shiftKey: true })).toBe(true);
    expect(caretCell()).toEqual([0, 0]);
    expect(rowCount()).toBe(2);
  });

  it("enter moves down", () => {
    caretAt(0, 1, 1);
    expect(press("Enter")).toBe(true);
    expect(caretCell()).toEqual([1, 1]);
  });

  it("enter in the last row adds a row and moves into the same column of it", () => {
    caretAt(1, 1);
    expect(press("Enter")).toBe(true);
    expect(rowCount()).toBe(3);
    expect(caretCell()).toEqual([2, 1]);
  });

  it("shift-enter inserts a line break", () => {
    caretAt(0, 0, 2);
    press("Enter", { shiftKey: true });
    expect(rowCount()).toBe(2);
    expect(caretCell()).toEqual([0, 0]);
    const first = (editor.document[0]!.content as { rows: { cells: { content: { text?: string }[] }[] }[] }).rows[0]!.cells[0]!;
    expect(first.content.map((c) => c.text ?? "").join("")).toBe("r0\nc0");
  });

  it("tab while composing does nothing; tab after compositionend moves", () => {
    caretAt(0, 0);
    setComposing(true);
    expect(editor.prosemirrorView!.composing).toBe(true);
    press("Tab");
    expect(caretCell()).toEqual([0, 0]);
    setComposing(false);
    press("Tab");
    expect(caretCell()).toEqual([0, 1]);
  });

  it("enter, shift-enter and a keyCode-229 key do nothing while composing", () => {
    caretAt(1, 2);
    setComposing(true);
    press("Enter");
    press("Enter", { shiftKey: true });
    expect(rowCount()).toBe(2);
    setComposing(false);
    press("Enter", { keyCode: 229 });
    press("Tab", { isComposing: true });
    expect(rowCount()).toBe(2);
    expect(caretCell()).toEqual([1, 2]);
  });

  it("keys outside a table are left alone", () => {
    editor.setTextCursorPosition("after", "end");
    press("Tab");
    expect(rowCount()).toBe(2); // a Tab in the paragraph after the table adds no row
  });
});

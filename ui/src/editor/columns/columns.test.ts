import { BlockNoteEditor, BlockNoteSchema, getNodeById, type PartialBlock } from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BlockNoteViewRaw } from "@blocknote/react";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { createFakeBackend } from "../../backend/fakeBackend";
import { toEditorBlocks } from "../convert";
import { createSavePipeline } from "../savePipeline";
import type { FolioEditor } from "../schema";
import { columnSpec, columnsSpec, insertColumns, installColumnsCountSync } from "./index";

// Register the production specs in a small, independent core schema.
const schema = BlockNoteSchema.create().extend({
  blockSpecs: { folioColumns: columnsSpec, folioColumn: columnSpec },
});
type Editor = typeof schema.BlockNoteEditor;
const editors: Editor[] = [];
const roots: Root[] = [];
const realRect = Element.prototype.getBoundingClientRect;
// jsdom has no layout engine. ProseMirror's scrollToSelection asks text nodes and ranges for
// rects during history transactions, so give them empty rects instead of throwing.
const noRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    return Object.assign(realRect.call(this), { toJSON: () => ({}) });
  };
  Object.assign(Node.prototype, { getClientRects: noRects, getBoundingClientRect: () => new DOMRect() });
  Object.assign(Range.prototype, { getClientRects: noRects, getBoundingClientRect: () => new DOMRect() });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  for (const proto of [Node.prototype, Range.prototype]) {
    Reflect.deleteProperty(proto, "getClientRects");
    Reflect.deleteProperty(proto, "getBoundingClientRect");
  }
});
function create(initialContent: PartialBlock<typeof schema.blockSchema>[] = [{ id: "start", type: "paragraph" }]) {
  const editor = BlockNoteEditor.create({ schema, initialContent, trailingBlock: false });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(createElement(BlockNoteViewRaw, {
    editor: editor as never,
    theme: "light",
    formattingToolbar: false,
    linkToolbar: false,
    slashMenu: false,
    emojiPicker: false,
    sideMenu: false,
    filePanel: false,
    tableHandles: false,
  })));
  editor._tiptapEditor.isEditorContentInitialized = true;
  editors.push(editor);
  return editor;
}
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  for (const editor of editors.splice(0)) editor._tiptapEditor.destroy();
  document.body.replaceChildren();
});

for (const count of [2, 3] as const) {
  it(`inserts ${count} real child containers and focuses the first paragraph`, () => {
    const editor = create([{ id: "start", type: "paragraph", content: "/" }]);
    editor.setTextCursorPosition("start", "end");
    const layout = insertColumns(editor, count)!;
    expect(editor.document).toHaveLength(1);
    expect(layout.type).toBe("folioColumns");
    expect(layout.props).toMatchObject({ count });
    expect(layout.children).toHaveLength(count);
    for (const column of layout.children) {
      expect(column.type).toBe("folioColumn");
      expect(column.content).toBeUndefined();
      expect(column.children).toHaveLength(1);
      expect(column.children[0]).toMatchObject({ type: "paragraph", content: [] });
    }
    expect(editor.getTextCursorPosition().block.id).toBe(layout.children[0]!.children[0]!.id);
    expect(editor.prosemirrorState.doc.textContent).toBe("");
    editor.updateBlock(layout.children[0]!.children[0]!.id, { content: "Left" });
    expect(editor.getBlock(layout.id)!.children[0]!.children[0]!.content).toEqual([
      { type: "text", text: "Left", styles: {} },
    ]);
  });
}

describe("column insertion boundaries", () => {
  it("preserves existing text and inserts below it", () => {
    const editor = create([{ id: "start", type: "paragraph", content: "Keep me" }]);
    editor.setTextCursorPosition("start", "end");
    insertColumns(editor, 2);
    expect(editor.document.map((b) => b.type)).toEqual(["paragraph", "folioColumns"]);
    expect(editor.prosemirrorState.doc.textContent).toBe("Keep me");
  });

  it("inserts after the slash menu clears its query without removing preceding text", () => {
    const editor = create();
    editor.getExtension(SuggestionMenu)!.addSuggestionMenu({ triggerCharacter: "/" });
    editor.setTextCursorPosition("start", "end");
    const type = (text: string) => {
      const view = editor.prosemirrorView;
      const { from, to } = view.state.selection;
      const deflt = () => view.state.tr.insertText(text, from, to);
      if (!view.someProp("handleTextInput", (f) => f(view, from, to, text, deflt))) view.dispatch(deflt());
    };
    type("Keep ");
    type("/");
    type("2 columns");
    const menu = editor.getExtension(SuggestionMenu)!;
    expect(menu.shown()).toBe(true);
    // Match SuggestionMenuWrapper's real selection sequence before onItemClick.
    // Calling the helper with an uncleared active query exercises a different API path.
    menu.closeMenu();
    menu.clearQuery();
    insertColumns(editor, 2);
    expect(editor.prosemirrorState.doc.textContent).toBe("Keep ");
    expect(editor.document[1]!.type).toBe("folioColumns");
    expect(editor.getExtension(SuggestionMenu)!.shown()).toBe(false);
  });

  it("refuses nested layouts even inside a nested list in a column", () => {
    const editor = create();
    editor.setTextCursorPosition("start", "end");
    const layout = insertColumns(editor, 2)!;
    const paragraph = layout.children[0]!.children[0]!;
    editor.updateBlock(paragraph.id, {
      type: "bulletListItem", children: [{ id: "nested", type: "paragraph", content: "/" }],
    });
    editor.setTextCursorPosition("nested", "end");
    const before = editor.document;
    expect(insertColumns(editor, 3)).toBeUndefined();
    expect(editor.document).toEqual(before);
  });

  it("undoes the entire insertion and redoes the same tree", () => {
    const editor = create();
    editor.setTextCursorPosition("start", "end");
    insertColumns(editor, 3);
    const inserted = editor.document;
    editor.undo();
    expect(editor.document).toEqual([expect.objectContaining({ id: "start", type: "paragraph", children: [] })]);
    editor.redo();
    expect(editor.document).toEqual(inserted);
  });

  it("rejects unsupported counts before changing the document", () => {
    const editor = create();
    const before = editor.document;
    expect(() => insertColumns(editor, 4 as 2)).toThrow();
    expect(editor.document).toEqual(before);
  });
});

it("persists and reloads column children through the existing save pipeline", async () => {
  const backend = createFakeBackend();
  const { tab } = await backend.pageCreate();
  const initialId = crypto.randomUUID();
  const editor = create([{ id: initialId, type: "paragraph" }]);
  editor.setTextCursorPosition(initialId, "end");
  const layout = insertColumns(editor, 2)!;
  editor.updateBlock(layout.children[1]!.children[0]!.id, { type: "heading", content: "Right heading" });
  // Bridge the independent test schema to the production pipeline type.
  const pipeline = createSavePipeline({ tabId: tab.id, backend, editor: editor as unknown as FolioEditor, storedIds: [] });
  try {
    await pipeline.flush();
    const stored = await backend.tabLoad(tab.id);
    expect(stored[0]).toMatchObject({
      type: "folioColumns", props: { count: 2 }, content: null,
      children: [
        { type: "folioColumn", children: [{ type: "paragraph" }] },
        { type: "folioColumn", children: [{ type: "heading", content: [{ text: "Right heading" }] }] },
      ],
    });
    const restored = create(toEditorBlocks(stored) as unknown as PartialBlock<typeof schema.blockSchema>[]);
    expect(restored.document).toEqual(editor.document);
  } finally {
    pipeline.dispose();
  }
});

function populated(count: 2 | 3 = 2) {
  const editor = create();
  editor.setTextCursorPosition("start", "end");
  const layout = insertColumns(editor, count)!;
  layout.children.forEach((column, index) => {
    editor.updateBlock(column.children[0]!.id, { content: `Content ${index}` });
  });
  return { editor, layout: editor.getBlock(layout.id)! };
}

it("unwraps the surviving content when a two-column layout loses a column", () => {
  const { editor, layout } = populated();
  editor.removeBlocks([layout.children[0]!]);
  expect(editor.document.map((b) => b.type)).toEqual(["paragraph"]);
  expect(editor.prosemirrorState.doc.textContent).toBe("Content 1");
  expect(() => editor.prosemirrorState.doc.check()).not.toThrow();
});

it("removing a sole paragraph dissolves empty ancestors without orphan columns", () => {
  const { editor, layout } = populated();
  editor.removeBlocks([layout.children[0]!.children[0]!]);
  expect(editor.document.map((b) => b.type)).toEqual(["paragraph"]);
  expect(editor.prosemirrorState.doc.textContent).toBe("Content 1");
  expect(() => editor.prosemirrorState.doc.check()).not.toThrow();
});

it("moving the sole paragraph out preserves its text and a valid tree", () => {
  const { editor, layout } = populated();
  const paragraph = layout.children[0]!.children[0]!;
  const source = getNodeById(paragraph.id, editor.prosemirrorState.doc)!;
  // Same delete/map/insert document operation as moving a node by drag/drop. The doc is
  // `doc > blockGroup`, so the block must land inside the block group, not at doc.content.size.
  editor.transact((tr) => {
    tr.delete(source.posBeforeNode, source.posBeforeNode + source.node.nodeSize);
    tr.insert(tr.doc.content.size - 1, source.node);
  });
  expect(editor.getParentBlock(paragraph.id)).toBeUndefined();
  expect(editor.getBlock(paragraph.id)!.content).toEqual([{ type: "text", text: "Content 0", styles: {} }]);
  expect(editor.document.map((b) => b.type)).toEqual(["folioColumns", "paragraph"]);
  // The emptied column keeps BlockNote's implicit empty paragraph; the moved text is not lost.
  expect(editor.prosemirrorState.doc.textContent).toBe("Content 1Content 0");
  expect(() => editor.prosemirrorState.doc.check()).not.toThrow();
});

it("rejects an orphan column at root and a layout directly inside a column", () => {
  const { editor, layout } = populated();
  expect(() => editor.insertBlocks([{ type: "folioColumn", children: [{ type: "paragraph" }] }], layout, "after")).toThrow();
  expect(() => editor.updateBlock(layout.children[0]!, { children: [
    { type: "folioColumns", children: layout.children },
  ] })).toThrow();
  expect(() => editor.prosemirrorState.doc.check()).not.toThrow();
});

it("reconciles three columns to two after removal, retaining ordinary undo", async () => {
  const { editor, layout } = populated(3);
  const stop = installColumnsCountSync(editor);
  try {
    editor.removeBlocks([layout.children[2]!]);
    await Promise.resolve();
    expect(editor.getBlock(layout.id)).toMatchObject({ props: { count: 2 }, children: [{}, {}] });
    editor.undo();
    await Promise.resolve();
    expect(editor.getBlock(layout.id)).toMatchObject({ props: { count: 3 }, children: [{}, {}, {}] });
  } finally { stop(); }
});

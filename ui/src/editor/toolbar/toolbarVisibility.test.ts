import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "prosemirror-state";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema } from "../schema";
import { shouldShowToolbar } from "./toolbarVisibility";

let editor: BlockNoteEditor<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

beforeEach(() => {
  editor = BlockNoteEditor.create({ schema });
  editor.mount(document.createElement("div"));
  editor.replaceBlocks(editor.document, [
    { id: "p", type: "paragraph", content: "hello world" },
    { id: "c", type: "codeBlock", content: "let x = 1" },
  ]);
});
afterEach(() => editor.unmount());

/** Start (in doc positions) of the text of the block with `id`. */
function textStart(id: string): number {
  let found = -1;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.attrs?.id === id) found = pos + 2; // blockContainer open + blockContent open
    return found < 0;
  });
  return found;
}

function select(from: number, to: number): void {
  editor.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, from, to)));
}

describe("shouldShowToolbar", () => {
  it("hidden for an empty selection", () => {
    select(textStart("p") + 2, textStart("p") + 2);
    expect(shouldShowToolbar(editor)).toBe(false);
  });

  it("shown for a text selection in a paragraph", () => {
    select(textStart("p"), textStart("p") + 5);
    expect(shouldShowToolbar(editor)).toBe(true);
  });

  it("hidden when the whole selection is inside a code block", () => {
    select(textStart("c"), textStart("c") + 3);
    expect(shouldShowToolbar(editor)).toBe(false);
  });

  it("shown when the selection spans a paragraph and a code block", () => {
    select(textStart("p") + 2, textStart("c") + 3);
    expect(shouldShowToolbar(editor)).toBe(true);
  });

  it("toolbar hidden while composing", () => {
    select(textStart("p"), textStart("p") + 5);
    const view = editor.prosemirrorView!;
    expect(shouldShowToolbar(editor)).toBe(true);
    Object.defineProperty(view, "composing", { get: () => true, configurable: true });
    try {
      expect(shouldShowToolbar(editor)).toBe(false);
    } finally {
      delete (view as unknown as Record<string, unknown>).composing;
    }
    expect(shouldShowToolbar(editor)).toBe(true);
  });
});

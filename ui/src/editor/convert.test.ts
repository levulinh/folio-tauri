import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import type { BlockNode } from "../backend/generated/BlockNode";
import { toEditorBlocks, toStored } from "./convert";
import { schema } from "./schema";

const text = (t: string) => [{ type: "text", text: t, styles: {} }];

const tree: BlockNode[] = [
  { id: "h", type: "heading", props: { level: 2 }, content: text("Tiêu đề phụ"), children: [] },
  {
    id: "b1",
    type: "bulletListItem",
    props: {},
    content: text("Mục cha"),
    children: [{ id: "b2", type: "bulletListItem", props: {}, content: text("Mục con ạ"), children: [] }],
  },
  { id: "c", type: "checkListItem", props: { checked: true }, content: text("Xong rồi"), children: [] },
  { id: "q", type: "quote", props: {}, content: text("Trích dẫn"), children: [] },
  { id: "k", type: "codeBlock", props: { language: "text" }, content: text("let x = 1;"), children: [] },
];

function roundTrip(nodes: BlockNode[]) {
  const editor = BlockNoteEditor.create({ schema, initialContent: toEditorBlocks(nodes) });
  return editor.document;
}

describe("convert", () => {
  it("keeps block ids and nested children", () => {
    const doc = roundTrip(tree);
    expect(doc.slice(0, 5).map((b) => b.id)).toEqual(["h", "b1", "c", "q", "k"]);
    expect(doc[1]!.children.map((b) => b.id)).toEqual(["b2"]);
  });

  it("round-trips type, set props and text", () => {
    const doc = roundTrip(tree);
    const stored = doc.slice(0, 5).map(toStored);
    expect(stored.map((s) => s.type)).toEqual(tree.map((n) => n.type));
    expect(stored[0]!.props).toMatchObject({ level: 2 });
    expect(stored[2]!.props).toMatchObject({ checked: true });
    expect(stored[4]!.props).toMatchObject({ language: "text" });
    expect(stored.map((s) => (s.content as { text: string }[])[0]!.text)).toEqual(
      tree.map((n) => (n.content as { text: string }[])[0]!.text),
    );
    expect(Object.keys(stored[0]!)).toEqual(["type", "props", "content"]);
  });

  it("toStored maps missing content to null", () => {
    expect(toStored({ id: "x", type: "table", props: {}, content: undefined, children: [] } as never).content).toBeNull();
  });

  it("toStored makes strings well-formed UTF-16 (a lone surrogate would make the tab unsaveable)", () => {
    const block = { id: "x", type: "paragraph", props: { note: "\ud83d" }, content: [{ type: "text", text: "a\ud83db", styles: {} }], children: [] };
    const json = JSON.stringify(toStored(block as never));
    expect(json).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(toStored(block as never).content).toEqual([{ type: "text", text: "a\uFFFDb", styles: {} }]);
  });

  it("only offers heading levels 1-3 and drops unsupported blocks", () => {
    const blocks = Object.keys(schema.blockSchema);
    for (const gone of ["audio", "video", "file", "image", "toggleListItem", "divider"]) {
      expect(blocks).not.toContain(gone);
    }
    expect(schema.blockSchema.heading.propSchema.level.values).toEqual([1, 2, 3]);
    expect(Object.keys(schema.styleSchema)).not.toContain("textColor");
    expect(Object.keys(schema.styleSchema)).not.toContain("backgroundColor");
  });
});

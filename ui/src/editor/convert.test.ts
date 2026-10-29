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

  it("keeps ids and order through three levels of children", () => {
    const deep: BlockNode[] = [
      {
        id: "l1",
        type: "bulletListItem",
        props: {},
        content: text("một"),
        children: [
          {
            id: "l2",
            type: "bulletListItem",
            props: {},
            content: text("hai"),
            children: [{ id: "l3", type: "bulletListItem", props: {}, content: text("ba"), children: [] }],
          },
          { id: "l2b", type: "bulletListItem", props: {}, content: text("hai b"), children: [] },
        ],
      },
    ];
    const doc = roundTrip(deep);
    expect(doc[0]!.children.map((b) => b.id)).toEqual(["l2", "l2b"]);
    expect(doc[0]!.children[0]!.children.map((b) => b.id)).toEqual(["l3"]);
    expect((doc[0]!.children[0]!.children[0]!.content as { text: string }[])[0]!.text).toBe("ba");
  });

  // The code mark excludes every other mark in the schema, so bold+italic+code on one run is not representable.
  it("keeps bold+italic and code runs and a link run", () => {
    const styled: BlockNode[] = [
      {
        id: "s",
        type: "paragraph",
        props: {},
        content: [
          { type: "text", text: "đậm nghiêng", styles: { bold: true, italic: true } },
          { type: "text", text: "mã", styles: { code: true } },
          { type: "text", text: " rồi ", styles: {} },
          { type: "link", href: "https://example.com/a?b=1", content: [{ type: "text", text: "liên kết", styles: { bold: true } }] },
        ],
        children: [],
      },
    ];
    const content = toStored(roundTrip(styled)[0]!).content as Record<string, unknown>[];
    expect(content[0]).toMatchObject({ type: "text", text: "đậm nghiêng", styles: { bold: true, italic: true } });
    expect(content[1]).toMatchObject({ type: "text", text: "mã", styles: { code: true } });
    expect(content[2]).toMatchObject({ type: "text", text: " rồi " });
    expect(content[3]).toMatchObject({
      type: "link",
      href: "https://example.com/a?b=1",
      content: [{ type: "text", text: "liên kết", styles: { bold: true } }],
    });
  });

  it("keeps a checked check item checked and an unchecked one unchecked", () => {
    const doc = roundTrip([
      { id: "on", type: "checkListItem", props: { checked: true }, content: text("xong"), children: [] },
      { id: "off", type: "checkListItem", props: { checked: false }, content: text("chưa"), children: [] },
    ]);
    expect(toStored(doc[0]!).props).toMatchObject({ checked: true });
    expect(toStored(doc[1]!).props).toMatchObject({ checked: false });
  });

  it("maps null stored content to undefined for the editor and back to an empty array", () => {
    const blocks = toEditorBlocks([{ id: "n", type: "paragraph", props: {}, content: null, children: [] }]);
    expect(blocks[0]!.content).toBeUndefined();
    const stored = toStored(roundTrip([{ id: "n", type: "paragraph", props: {}, content: null, children: [] }])[0]!);
    expect(stored.content).toEqual([]);
    expect(toStored({ id: "x", type: "paragraph", props: {}, content: null, children: [] } as never).content).toBeNull();
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
    for (const gone of ["audio", "video", "file", "toggleListItem", "divider"]) {
      expect(blocks).not.toContain(gone);
    }
    expect(schema.blockSchema.heading.propSchema.level.values).toEqual([1, 2, 3]);
    expect(Object.keys(schema.styleSchema)).not.toContain("textColor");
    expect(Object.keys(schema.styleSchema)).not.toContain("backgroundColor");
  });
});

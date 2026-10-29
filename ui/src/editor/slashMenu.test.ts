import { BlockNoteEditor } from "@blocknote/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema } from "./schema";
import { filterSlashItems, SLASH_ORDER, slashItems } from "./slashMenu";

let editor: BlockNoteEditor<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

beforeEach(() => {
  editor = BlockNoteEditor.create({ schema });
  editor.mount(document.createElement("div"));
});
afterEach(() => editor.unmount());

const keys = (items: { key: string }[]) => items.map((i) => i.key);

describe("slashItems", () => {
  it("items follow SLASH_ORDER with English labels", () => {
    const items = slashItems(editor);
    expect(keys(items)).toEqual([...SLASH_ORDER]);
    expect(items.map((i) => i.title)).toEqual([
      "Text", "Heading 1", "Heading 2", "Heading 3", "Bulleted list",
      "Numbered list", "To-do list", "Quote", "Code", "Table", "Image", "2 columns", "3 columns",
      "Subpage",
    ]);
  });

  it("filter matches title substring case-insensitively", () => {
    const items = slashItems(editor);
    expect(keys(filterSlashItems(items, "head"))).toEqual(["heading1", "heading2", "heading3"]);
    expect(keys(filterSlashItems(items, "LIST"))).toEqual(["bulletedList", "numberedList", "todoList"]);
  });

  it("filter matches aliases", () => {
    const items = slashItems(editor);
    expect(keys(filterSlashItems(items, "h2"))).toEqual(["heading2"]);
    expect(keys(filterSlashItems(items, "todo"))).toEqual(["todoList"]);
    expect(keys(filterSlashItems(items, "subpage"))).toEqual(["page"]);
    expect(keys(filterSlashItems(items, "trang con"))).toEqual(["page"]);
  });

  it("empty query returns all", () => {
    const items = slashItems(editor);
    expect(filterSlashItems(items, "")).toEqual(items);
  });
});

function apply(key: string): void {
  slashItems(editor).find((i) => i.key === key)!.onItemClick();
}

describe("applying an item", () => {
  it("applying heading2 on an empty paragraph converts it", () => {
    editor.replaceBlocks(editor.document, [{ id: "p", type: "paragraph" }]);
    editor.setTextCursorPosition("p", "end");
    apply("heading2");
    const doc = editor.document;
    expect(doc[0]).toMatchObject({ id: "p", type: "heading", props: { level: 2 } });
  });

  it("applying quote at the end of a non-empty paragraph inserts below and keeps the text", () => {
    editor.replaceBlocks(editor.document, [{ id: "p", type: "paragraph", content: "hello" }]);
    editor.setTextCursorPosition("p", "end");
    apply("quote");
    const doc = editor.document;
    expect(doc[0]).toMatchObject({ id: "p", type: "paragraph" });
    expect(doc[0]!.content).toEqual([{ type: "text", text: "hello", styles: {} }]);
    expect(doc[1]).toMatchObject({ type: "quote" });
  });

  it("applying table on an empty paragraph replaces it with a 2-row, 3-column table", () => {
    editor.replaceBlocks(editor.document, [{ id: "p", type: "paragraph" }]);
    editor.setTextCursorPosition("p", "end");
    apply("table");
    const table = editor.document[0] as { type: string; content: { rows: { cells: unknown[] }[] } };
    expect(table.type).toBe("table");
    expect(table.content.rows.map((r) => r.cells.length)).toEqual([3, 3]);
  });
});

import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { BlockNoteViewRaw } from "@blocknote/react";
import { act, fireEvent, screen } from "@testing-library/react";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageMeta } from "../../backend/generated/PageMeta";
import { useExpandedStore } from "../../state/expanded";
import { usePageStore } from "../../state/pageStore";
import { usePagesStore } from "../../state/pagesStore";
import { useUiStore } from "../../state/uiStore";
import { schema } from "../schema";
import { insertSubpage } from "./index";

const mocks = vi.hoisted(() => ({ opened: [] as string[] }));
vi.mock("../../state/pageActions", () => ({ openPage: (id: string) => { mocks.opened.push(id); } }));

type Editor = typeof schema.BlockNoteEditor;
const editors: Editor[] = [];
const roots: Root[] = [];

const page = (id: string, parentId: string | null, title: string): PageMeta => ({
  id, parentId, title, orderKey: id, createdAt: 0, updatedAt: 0,
});

function create(initialContent: PartialBlock<typeof schema.blockSchema>[]): Editor {
  const editor = BlockNoteEditor.create({ schema, initialContent, trailingBlock: false });
  editor.mount(document.createElement("div"));
  editors.push(editor);
  return editor;
}

function render(initialContent: PartialBlock<typeof schema.blockSchema>[]) {
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
  editors.push(editor);
  return editor;
}

const parent = page("parent", null, "Cha");
const child = page("child", "parent", "");

beforeEach(() => {
  mocks.opened.length = 0;
  localStorage.clear();
  usePagesStore.setState({
    pages: [parent],
    create: async (parentId) => {
      const created = { ...child, parentId: parentId ?? null };
      usePagesStore.setState((s) => ({ pages: [...s.pages, created] }));
      return { page: created, tab: { id: "tab", pageId: created.id, name: "", orderKey: "a0" } };
    },
  });
  usePageStore.setState({ pageId: "parent", tabs: [], activeTabId: null, activeEditor: null, saveStatus: "saved" });
  useExpandedStore.setState({ expanded: new Set() });
  useUiStore.setState({ titleFocusPageId: null, toasts: [] });
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  for (const editor of editors.splice(0)) editor._tiptapEditor.destroy();
  document.body.replaceChildren();
});

describe("insertSubpage", () => {
  it("replaces the slash block with a row for a new child page and opens the child", async () => {
    const editor = create([{ id: "start", type: "paragraph", content: "/" }]);
    editor.setTextCursorPosition("start", "end");

    await expect(insertSubpage(editor)).resolves.toBe("child");

    const [row, trailing] = editor.document;
    expect(row).toMatchObject({ type: "folioSubpage", props: { pageId: "child" } });
    expect(row!.content).toBeUndefined();
    expect(trailing).toMatchObject({ type: "paragraph" });
    expect(mocks.opened).toEqual(["child"]);
    expect(useExpandedStore.getState().expanded.has("parent")).toBe(true);
    expect(useUiStore.getState().titleFocusPageId).toBe("child");
  });

  it("inserts below existing text instead of overwriting it", async () => {
    const editor = create([{ id: "start", type: "paragraph", content: "Giữ nguyên" }]);
    editor.setTextCursorPosition("start", "end");

    await insertSubpage(editor);

    expect(editor.document.map((b) => b.type)).toEqual(["paragraph", "folioSubpage", "paragraph"]);
    expect(editor.prosemirrorState.doc.textContent).toContain("Giữ nguyên");
  });

  it("does nothing when no page is open", async () => {
    usePageStore.setState({ pageId: null });
    const editor = create([{ id: "start", type: "paragraph", content: "/" }]);
    editor.setTextCursorPosition("start", "end");

    await expect(insertSubpage(editor)).resolves.toBeNull();
    expect(editor.document.map((b) => b.type)).toEqual(["paragraph"]);
    expect(mocks.opened).toEqual([]);
  });

  it("keeps the created page but inserts nothing when the user left the page first", async () => {
    const editor = create([{ id: "start", type: "paragraph", content: "/" }]);
    editor.setTextCursorPosition("start", "end");
    usePagesStore.setState({
      create: async () => {
        usePageStore.setState({ pageId: "elsewhere" });
        return { page: child, tab: { id: "tab", pageId: child.id, name: "", orderKey: "a0" } };
      },
    });

    await expect(insertSubpage(editor)).resolves.toBe("child");
    expect(editor.document.map((b) => b.type)).toEqual(["paragraph"]);
    expect(mocks.opened).toEqual(["child"]);
  });
});

describe("the subpage row", () => {
  it("shows the child's live title and opens it on click", () => {
    usePagesStore.setState({ pages: [parent, page("child", "parent", "Ghi chú")] });
    render([{ id: "row", type: "folioSubpage", props: { pageId: "child" } }]);

    const row = screen.getByTestId("subpage-row");
    expect(row.textContent).toBe("Ghi chú");
    expect((row as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(row);
    expect(mocks.opened).toEqual(["child"]);

    act(() => usePagesStore.setState({ pages: [parent, page("child", "parent", "Tên mới")] }));
    expect(row.textContent).toBe("Tên mới");
  });

  it("falls back to the untitled placeholder for an empty title", () => {
    usePagesStore.setState({ pages: [parent, child] });
    render([{ id: "row", type: "folioSubpage", props: { pageId: "child" } }]);
    expect(screen.getByTestId("subpage-row").textContent).toBe("Không có tiêu đề");
  });

  it("is disabled when the page is gone and never opens anything", () => {
    render([{ id: "row", type: "folioSubpage", props: { pageId: "deleted" } }]);
    const row = screen.getByTestId("subpage-row");
    expect(row.textContent).toBe("Trang đã bị xoá");
    expect((row as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(row);
    expect(mocks.opened).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockOp } from "./generated/BlockOp";
import { createFakeBackend } from "./fakeBackend";
import { isErrorPayload } from "./Backend";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const text = (t: string) => [{ type: "text", text: t, styles: {} }];
const up = (
  n: number,
  parent: number | null,
  prev: number | null,
  t = "",
  type = "paragraph",
): BlockOp => ({
  op: "upsert",
  id: uid(n),
  parentId: parent === null ? null : uid(parent),
  prevSiblingId: prev === null ? null : uid(prev),
  type,
  props: {},
  content: text(t),
});
const del = (...ns: number[]): BlockOp => ({ op: "delete", ids: ns.map(uid) });

async function newTab(b = createFakeBackend()) {
  const { page, tab } = await b.pageCreate();
  return { b, page, tab };
}
const ids = (nodes: { id: string }[]) => nodes.map((n) => n.id);

beforeEach(() => localStorage.clear());

describe("pages", () => {
  it("creates, renames and lists pages with one empty tab", async () => {
    const b = createFakeBackend();
    const { page, tab } = await b.pageCreate();
    expect(page.title).toBe("");
    expect(tab.name).toBe("");
    expect(await b.tabsList(page.id)).toEqual([tab]);
    const renamed = await b.pageRename(page.id, "Đà Nẵng");
    expect(renamed.title).toBe("Đà Nẵng");
    expect((await b.pagesList()).map((p) => p.title)).toEqual(["Đà Nẵng"]);
  });

  it("places new pages last, or after afterId", async () => {
    const b = createFakeBackend();
    const a = (await b.pageCreate()).page;
    const c = (await b.pageCreate()).page;
    const mid = (await b.pageCreate(undefined, a.id)).page;
    expect(ids(await b.pagesList())).toEqual([a.id, mid.id, c.id]);
  });

  it("rejects unknown parent and foreign afterId with not_found", async () => {
    const b = createFakeBackend();
    const a = (await b.pageCreate()).page;
    const child = (await b.pageCreate(a.id)).page;
    await expect(b.pageCreate(uid(9))).rejects.toMatchObject({ code: "not_found" });
    await expect(b.pageCreate(undefined, child.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await b.pagesList()).toHaveLength(2);
  });

  it("delete cascades to descendants, tabs and blocks", async () => {
    const b = createFakeBackend();
    const root = await b.pageCreate();
    const child = await b.pageCreate(root.page.id);
    const other = await b.pageCreate();
    await b.tabApply(child.tab.id, [up(1, null, null, "x")]);
    const gone = await b.pageDelete(root.page.id);
    expect(gone.sort()).toEqual([root.page.id, child.page.id].sort());
    expect(ids(await b.pagesList())).toEqual([other.page.id]);
    await expect(b.tabLoad(child.tab.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(b.pageDelete(root.page.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("tabApply", () => {
  it("inserts between siblings in order", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null, "a"), up(2, null, 1, "c")]);
    await b.tabApply(tab.id, [up(3, null, 1, "b")]);
    expect(ids(await b.tabLoad(tab.id))).toEqual([uid(1), uid(3), uid(2)]);
  });

  it("returns applied count and a page timestamp", async () => {
    const { b, tab } = await newTab();
    const r = await b.tabApply(tab.id, [up(1, null, null), up(2, null, 1)]);
    expect(r.applied).toBe(2);
    expect(r.pageUpdatedAt).toBeGreaterThan(0);
  });

  it("outdent_then_delete_parent_keeps_child_subtree", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(4, null, null, "d"), up(3, 4, null, "c"), up(5, 3, null, "e")]);
    await b.tabApply(tab.id, [up(3, null, 4, "c"), del(4)]);
    const tree = await b.tabLoad(tab.id);
    expect(ids(tree)).toEqual([uid(3)]);
    expect(ids(tree[0]!.children)).toEqual([uid(5)]);
  });

  it("delete removes descendants and ignores unknown ids", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null), up(2, 1, null)]);
    const r = await b.tabApply(tab.id, [del(1, 77)]);
    expect(r.applied).toBe(1);
    expect(await b.tabLoad(tab.id)).toEqual([]);
  });

  it("unknown parent rejects with invalid_op and leaves state unchanged", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null, "a")]);
    await expect(b.tabApply(tab.id, [up(2, 99, null)])).rejects.toMatchObject({
      code: "invalid_op",
    });
    expect(ids(await b.tabLoad(tab.id))).toEqual([uid(1)]);
  });

  it("invalid_op_rolls_back", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null, "a")]);
    const before = structuredClone(await b.tabLoad(tab.id));
    await expect(
      b.tabApply(tab.id, [up(2, null, 1, "b"), del(1), up(3, 42, null)]),
    ).rejects.toMatchObject({ code: "invalid_op" });
    expect(await b.tabLoad(tab.id)).toEqual(before);
  });

  it("does not alias caller data or loaded trees with its state", async () => {
    const { b, tab } = await newTab();
    const op = up(1, null, null, "gốc");
    await b.tabApply(tab.id, [op]);
    (op as { content: { text: string }[] }).content[0]!.text = "đổi";
    const loaded = await b.tabLoad(tab.id);
    (loaded[0]!.content as { text: string }[])[0]!.text = "đổi nữa";
    expect(((await b.tabLoad(tab.id))[0]!.content as { text: string }[])[0]!.text).toBe("gốc");
  });

  it("accepts a parent upserted earlier in the same batch", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null), up(2, 1, null)]);
    expect((await b.tabLoad(tab.id))[0]!.children).toHaveLength(1);
  });

  it.each([
    ["non-UUID id", { ...up(1, null, null), id: "nope" }],
    ["props not an object", { ...up(1, null, null), props: [] as unknown as Record<string, unknown> }],
    ["prev sibling is itself", up(1, null, 1)],
    ["parent is itself", up(1, 1, null)],
  ])("rejects %s", async (_n, op) => {
    const { b, tab } = await newTab();
    await expect(b.tabApply(tab.id, [op])).rejects.toMatchObject({ code: "invalid_op" });
  });

  it("rejects a prev sibling under another parent", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null), up(2, 1, null)]);
    await expect(b.tabApply(tab.id, [up(3, null, 2)])).rejects.toMatchObject({
      code: "invalid_op",
    });
  });

  it("rejects a parent cycle", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null), up(2, 1, null)]);
    await expect(b.tabApply(tab.id, [up(1, 2, null)])).rejects.toMatchObject({
      code: "invalid_op",
    });
  });

  it("rejects a block id living in another tab", async () => {
    const b = createFakeBackend();
    const one = await b.pageCreate();
    const two = await b.pageCreate();
    await b.tabApply(one.tab.id, [up(1, null, null)]);
    await expect(b.tabApply(two.tab.id, [up(1, null, null)])).rejects.toMatchObject({
      code: "invalid_op",
    });
  });

  it("deleted_tab_apply_is_not_found", async () => {
    const { b, page, tab } = await newTab();
    await b.pageDelete(page.id);
    await expect(b.tabApply(tab.id, [up(1, null, null)])).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("throws plain ErrorPayload objects", async () => {
    const { b } = await newTab();
    const e = await b.tabLoad(uid(5)).catch((x: unknown) => x);
    expect(isErrorPayload(e)).toBe(true);
    expect(isErrorPayload(new Error("x"))).toBe(false);
  });
});

describe("search", () => {
  it('finds "Đà Nẵng" with "da nang"', async () => {
    const { b, page } = await newTab();
    await b.pageRename(page.id, "Đà Nẵng");
    const hits = await b.search("da nang");
    expect(hits).toEqual([
      { pageId: page.id, pageTitle: "Đà Nẵng", snippet: "", titleMatch: true },
    ]);
  });

  it("matches word prefixes, ANDed within one block", async () => {
    const b = createFakeBackend();
    const one = await b.pageCreate();
    const two = await b.pageCreate();
    await b.tabApply(one.tab.id, [up(1, null, null, "Chuyến đi Đà Nẵng")]);
    await b.tabApply(two.tab.id, [up(2, null, null, "Đà"), up(3, null, 2, "Nẵng")]);
    const hits = await b.search("da nan");
    expect(hits.map((h) => h.pageId)).toEqual([one.page.id]);
    expect(hits[0]).toMatchObject({ snippet: "Chuyến đi Đà Nẵng", titleMatch: false });
    expect(await b.search("hen")).toEqual([]); // mid-word is not a prefix
    expect(await b.search("  ")).toEqual([]);
  });

  it("search_splits_punctuation", async () => {
    const { b, tab, page } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null, "Gửi e-mail cho Lan")]);
    expect((await b.search("e-mail")).map((h) => h.pageId)).toEqual([page.id]);
  });

  it("lists title matches first and uses the first non-empty block as snippet", async () => {
    const b = createFakeBackend();
    const body = await b.pageCreate();
    const titled = await b.pageCreate();
    await b.tabApply(body.tab.id, [up(1, null, null, "kế hoạch")]);
    await b.tabApply(titled.tab.id, [up(2, null, null, ""), up(3, null, 2, "nội dung")]);
    await b.pageRename(titled.page.id, "Kế hoạch");
    const hits = await b.search("ke hoach");
    expect(hits.map((h) => [h.pageId, h.titleMatch])).toEqual([
      [titled.page.id, true],
      [body.page.id, false],
    ]);
    expect(hits[0]!.snippet).toBe("nội dung");
  });

  it("cuts long snippets to 120 chars around the match with ellipses", async () => {
    const { b, tab } = await newTab();
    await b.tabApply(tab.id, [up(1, null, null, `${"a ".repeat(100)}needle${" b".repeat(100)}`)]);
    const [hit] = await b.search("needle");
    expect(hit!.snippet).toHaveLength(120);
    expect(hit!.snippet.startsWith("…")).toBe(true);
    expect(hit!.snippet.endsWith("…")).toBe(true);
    expect(hit!.snippet).toContain("needle");
  });

  it("indexes table cell text and link runs", async () => {
    const { b, tab, page } = await newTab();
    await b.tabApply(tab.id, [
      {
        op: "upsert",
        id: uid(1),
        parentId: null,
        prevSiblingId: null,
        type: "table",
        props: {},
        content: { type: "tableContent", rows: [{ cells: [text("xin"), { content: text("chào") }] }] },
      },
      {
        op: "upsert",
        id: uid(2),
        parentId: null,
        prevSiblingId: uid(1),
        type: "paragraph",
        props: {},
        content: [{ type: "link", href: "https://x", content: text("liên kết") }],
      },
    ]);
    expect((await b.search("xin chao"))[0]!.pageId).toBe(page.id);
    expect((await b.search("lien ket"))[0]!.pageId).toBe(page.id);
  });
});

describe("persistence and events", () => {
  it("persists across instances with the same key", async () => {
    const first = createFakeBackend({ persistKey: "k" });
    const { page, tab } = await first.pageCreate();
    await first.pageRename(page.id, "Giữ lại");
    await first.tabApply(tab.id, [
      {
        ...(up(1, null, null) as Extract<BlockOp, { op: "upsert" }>),
        content: [
          { type: "text", text: "đậm ", styles: { bold: true, textColor: "red" } },
          { type: "link", href: "https://x", content: [{ type: "text", text: "nối", styles: { italic: true } }] },
        ],
      },
    ]);
    const second = createFakeBackend({ persistKey: "k" });
    expect((await second.pagesList()).map((p) => p.title)).toEqual(["Giữ lại"]);
    expect(await second.tabLoad(tab.id)).toEqual(await first.tabLoad(tab.id));
    expect(ids(await second.tabLoad(tab.id))).toEqual([uid(1)]);
    expect(await createFakeBackend({ persistKey: "other" }).pagesList()).toEqual([]);
  });

  it("survives corrupt persisted data", async () => {
    localStorage.setItem("k", "{not json");
    expect(await createFakeBackend({ persistKey: "k" }).pagesList()).toEqual([]);
  });

  it("emitMenu notifies subscribers until unsubscribed", () => {
    const b = createFakeBackend();
    const cb = vi.fn();
    const off = b.onMenu("find", cb);
    b.emitMenu("find");
    b.emitMenu("search");
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    b.emitMenu("find");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("flush request and quitReady are safe in the fake", async () => {
    const b = createFakeBackend();
    const off = b.onFlushRequest(async () => {});
    off();
    await expect(b.quitReady()).resolves.toBeUndefined();
  });
});

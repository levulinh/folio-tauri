import { beforeEach, describe, expect, it } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";
import { createPagesStore } from "./pagesStore";

let store: ReturnType<typeof createPagesStore>;
beforeEach(() => {
  store = createPagesStore(createFakeBackend());
});

const titles = (ps: { title: string }[]) => ps.map((p) => p.title);

describe("pagesStore", () => {
  it("create makes the page appear", async () => {
    expect(store.getState().pages).toEqual([]);
    const { page } = await store.getState().create();
    expect(store.getState().pages.map((p) => p.id)).toEqual([page.id]);
    expect(store.getState().loaded).toBe(false);
    await store.getState().load();
    expect(store.getState().loaded).toBe(true);
  });

  it("childrenOf returns siblings in creation order", async () => {
    const a = (await store.getState().create()).page;
    const b = (await store.getState().create()).page;
    const c = (await store.getState().create(a.id)).page;
    const d = (await store.getState().create(a.id)).page;
    await store.getState().rename(a.id, "A");
    await store.getState().rename(c.id, "C");
    await store.getState().rename(d.id, "D");
    expect(store.getState().childrenOf(null).map((p) => p.id)).toEqual([a.id, b.id]);
    expect(titles(store.getState().childrenOf(a.id))).toEqual(["C", "D"]);
    expect(store.getState().childrenOf(b.id)).toEqual([]);
  });

  it("descendantCount counts the whole subtree", async () => {
    const a = (await store.getState().create()).page;
    const b = (await store.getState().create(a.id)).page;
    await store.getState().create(b.id);
    await store.getState().create(b.id);
    expect(store.getState().descendantCount(a.id)).toBe(3);
    expect(store.getState().descendantCount(b.id)).toBe(2);
  });

  it("remove drops the subtree, rename updates the title", async () => {
    const a = (await store.getState().create()).page;
    const b = (await store.getState().create(a.id)).page;
    const keep = (await store.getState().create()).page;
    await store.getState().rename(keep.id, "Giữ");
    await store.getState().remove(a.id);
    expect(store.getState().pages.map((p) => p.id)).toEqual([keep.id]);
    expect(store.getState().pages[0]!.title).toBe("Giữ");
    expect(store.getState().pages.some((p) => p.id === b.id)).toBe(false);
  });

  it("renames of one page are serialized: a slow earlier rename cannot overwrite a later one", async () => {
    const fake = createFakeBackend();
    const slowFirst: typeof fake.pageRename = async (id, title) => {
      if (title === "first") await new Promise((r) => setTimeout(r, 30));
      return fake.pageRename(id, title);
    };
    const racing = createPagesStore({ ...fake, pageRename: slowFirst });
    const { page } = await racing.getState().create();
    const first = racing.getState().rename(page.id, "first");
    const second = racing.getState().rename(page.id, "second");
    await Promise.all([first, second]);
    expect(racing.getState().pages[0]!.title).toBe("second");
    expect((await fake.pagesList())[0]!.title).toBe("second");
  });

  it("a failed rename does not block the next one for that page", async () => {
    const fake = createFakeBackend();
    let calls = 0;
    const flaky: typeof fake.pageRename = (id, title) =>
      ++calls === 1 ? Promise.reject({ code: "db", message: "x" }) : fake.pageRename(id, title);
    const flakyStore = createPagesStore({ ...fake, pageRename: flaky });
    const { page } = await flakyStore.getState().create();
    const first = flakyStore.getState().rename(page.id, "a");
    const second = flakyStore.getState().rename(page.id, "b");
    await expect(first).rejects.toMatchObject({ code: "db" });
    await second;
    expect(flakyStore.getState().pages[0]!.title).toBe("b");
  });
});

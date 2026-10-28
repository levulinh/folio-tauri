import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";

const fake = createFakeBackend();
vi.mock("../backend", () => ({ backend: fake }));

const { createAndOpenPage } = await import("./pageActions");
const { usePageStore } = await import("./pageStore");
const { usePagesStore } = await import("./pagesStore");
const { useUiStore } = await import("./uiStore");

beforeEach(async () => {
  usePageStore.getState().close();
  useUiStore.getState().clearTitleFocus();
  await usePagesStore.getState().load();
});

describe("createAndOpenPage title focus request", () => {
  it("leaves the request for the new page's title while it opens", async () => {
    const id = await createAndOpenPage();
    expect(usePageStore.getState().pageId).toBe(id);
    expect(useUiStore.getState().titleFocusPageId).toBe(id);
  });

  it("drops the request when a newer open() supersedes it", async () => {
    const other = (await fake.pageCreate()).page;
    await usePagesStore.getState().load();
    const realOpen = usePageStore.getState().open;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // The new page's open() is slow; a click on another page lands (and wins) meanwhile.
    const spy = vi.spyOn(usePageStore.getState(), "open").mockImplementationOnce(async (id) => {
      const ticketTaken = realOpen(id);
      await gate;
      await ticketTaken;
    });
    const creating = createAndOpenPage();
    await vi.waitFor(() => expect(useUiStore.getState().titleFocusPageId).not.toBeNull());
    await realOpen(other.id);
    release();
    await creating;
    spy.mockRestore();
    expect(usePageStore.getState().pageId).toBe(other.id);
    expect(useUiStore.getState().titleFocusPageId).toBeNull();
  });

  it("drops the request when open() throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi.spyOn(usePageStore.getState(), "open").mockRejectedValueOnce(new Error("x"));
    expect(await createAndOpenPage()).toBeNull();
    expect(useUiStore.getState().titleFocusPageId).toBeNull();
    spy.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";

const fake = createFakeBackend();
vi.mock("../backend", () => ({ backend: fake }));

const { createAndOpenPage, openPage } = await import("./pageActions");
const { usePageStore } = await import("./pageStore");
const { usePagesStore } = await import("./pagesStore");
const { useUiStore } = await import("./uiStore");

beforeEach(async () => {
  usePageStore.getState().close();
  useUiStore.setState({ titleFocusPageId: null });
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

  it("a superseded create does not clear the request of the newer create", async () => {
    const realOpen = usePageStore.getState().open;
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => (releaseFirst = r));
    // First create's open() is slow (and loses); the second create is requested meanwhile.
    const spy = vi.spyOn(usePageStore.getState(), "open").mockImplementationOnce(async (id) => {
      const ticketTaken = realOpen(id);
      await gate;
      await ticketTaken;
    });
    const first = createAndOpenPage();
    await vi.waitFor(() => expect(useUiStore.getState().titleFocusPageId).not.toBeNull());
    const firstId = useUiStore.getState().titleFocusPageId;
    const second = await createAndOpenPage();
    expect(useUiStore.getState().titleFocusPageId).toBe(second);
    releaseFirst();
    await first;
    spy.mockRestore();
    expect(second).not.toBe(firstId);
    expect(usePageStore.getState().pageId).toBe(second);
    expect(useUiStore.getState().titleFocusPageId).toBe(second);
  });

  it("drops the request when open() throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi.spyOn(usePageStore.getState(), "open").mockRejectedValueOnce(new Error("x"));
    expect(await createAndOpenPage()).toBeNull();
    expect(useUiStore.getState().titleFocusPageId).toBeNull();
    spy.mockRestore();
  });
});

describe("openPage of a page that vanished", () => {
  it("toasts, keeps the current page (no blank pane) and refreshes the sidebar list", async () => {
    const keep = (await fake.pageCreate()).page;
    const gone = (await fake.pageCreate()).page;
    await usePagesStore.getState().load();
    await usePageStore.getState().open(keep.id);
    await fake.pageDelete(gone.id);
    useUiStore.setState({ toasts: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    openPage(gone.id);
    await vi.waitFor(() => expect(useUiStore.getState().toasts).toHaveLength(1));
    expect(usePageStore.getState().pageId).toBe(keep.id);
    await vi.waitFor(() => expect(usePagesStore.getState().pages.some((p) => p.id === gone.id)).toBe(false));
  });
});

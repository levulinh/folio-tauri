import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ appearanceGet: vi.fn(), appearanceSet: vi.fn() }));
vi.mock("../backend", () => ({ backend: api }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.resetModules();
  api.appearanceGet.mockReset().mockResolvedValue({ mode: "system", accent: "neutral" });
  api.appearanceSet.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false }) });
});

describe("appearance ordering", () => {
  it("keeps the full local edit when the initial read arrives late", async () => {
    const read = deferred<{ mode: "dark"; accent: "olive" }>();
    api.appearanceGet.mockReturnValue(read.promise);
    const { useAppearanceStore: store } = await import("./appearanceStore");
    const loading = store.getState().load();
    store.getState().setPreferences({ accent: "blue" });
    read.resolve({ mode: "dark", accent: "olive" });
    await loading;
    await store.getState().flush();
    expect(store.getState().preferences).toEqual({ mode: "system", accent: "blue" });
    expect(api.appearanceSet).toHaveBeenLastCalledWith({ mode: "system", accent: "blue" });
  });

  it("coalesces edits and continues after an older write fails", async () => {
    const first = deferred<void>();
    api.appearanceSet.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const { useAppearanceStore: store } = await import("./appearanceStore");
    store.getState().setPreferences({ accent: "blue" });
    store.getState().setPreferences({ mode: "dark" });
    const flushing = store.getState().flush();
    await tick();
    expect(api.appearanceSet).toHaveBeenCalledTimes(1);
    first.reject(new Error("old failed"));
    await flushing;
    expect(api.appearanceSet).toHaveBeenLastCalledWith({ mode: "dark", accent: "blue" });
    expect(store.getState()).toMatchObject({ preferences: { mode: "dark", accent: "blue" }, error: null, saving: false });
  });

  it("does not write defaults after a read failure and retries the read", async () => {
    api.appearanceGet.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ mode: "dark", accent: "olive" });
    const { useAppearanceStore: store } = await import("./appearanceStore");
    await store.getState().load();
    expect(store.getState()).toMatchObject({ loaded: true, error: "load" });
    expect(api.appearanceSet).not.toHaveBeenCalled();
    await store.getState().retry();
    expect(store.getState()).toMatchObject({ preferences: { mode: "dark", accent: "olive" }, error: null });
  });

  it("retains a failed preview and retries it once on demand", async () => {
    api.appearanceSet.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const { useAppearanceStore: store } = await import("./appearanceStore");
    store.getState().setPreferences({ mode: "dark" });
    await expect(store.getState().flush()).rejects.toThrow("offline");
    expect(store.getState()).toMatchObject({ preferences: { mode: "dark", accent: "neutral" }, error: "save" });
    expect(api.appearanceSet).toHaveBeenCalledTimes(1);
    await store.getState().retry();
    expect(store.getState().error).toBeNull();
    expect(api.appearanceSet).toHaveBeenCalledTimes(2);
  });
  it("flush waits for an edit made while another write is in flight and reload sees it", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    let saved = { mode: "system", accent: "neutral" };
    api.appearanceSet.mockImplementationOnce(async (value) => { await first.promise; saved = value; })
      .mockImplementationOnce(async (value) => { await second.promise; saved = value; });
    api.appearanceGet.mockImplementation(async () => saved);
    const { useAppearanceStore: store } = await import("./appearanceStore");
    store.getState().setPreferences({ accent: "blue" });
    let done = false;
    const flushing = store.getState().flush().then(() => { done = true; });
    store.getState().setPreferences({ mode: "dark" });
    first.resolve();
    await vi.waitFor(() => expect(api.appearanceSet).toHaveBeenCalledTimes(2));
    expect(done).toBe(false);
    second.resolve();
    await flushing;
    vi.resetModules();
    const { useAppearanceStore: reopened } = await import("./appearanceStore");
    await reopened.getState().load();
    expect(reopened.getState().preferences).toEqual({ mode: "dark", accent: "blue" });
  });

  it("a local edit after a load failure supersedes the error and saves intent", async () => {
    api.appearanceGet.mockRejectedValue(new Error("offline"));
    const { useAppearanceStore: store } = await import("./appearanceStore");
    await store.getState().load();
    store.getState().setPreferences({ accent: "purple" });
    await store.getState().retry();
    expect(api.appearanceGet).toHaveBeenCalledTimes(1);
    expect(api.appearanceSet).toHaveBeenLastCalledWith({ mode: "system", accent: "purple" });
    expect(store.getState().error).toBeNull();
  });

  it("reports a failed explicit read retry while keeping usable defaults", async () => {
    api.appearanceGet.mockRejectedValue(new Error("still offline"));
    const { useAppearanceStore: store } = await import("./appearanceStore");
    await store.getState().load();
    await expect(store.getState().retry()).rejects.toThrow("still offline");
    expect(store.getState()).toMatchObject({ loaded: true, error: "load", preferences: { mode: "system", accent: "neutral" } });
    expect(api.appearanceSet).not.toHaveBeenCalled();
  });

});

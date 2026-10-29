import { describe, expect, it, vi } from "vitest";

const flushAll = vi.fn();
const appearanceFlush = vi.fn();
vi.mock("../appearance/appearanceStore", () => ({ useAppearanceStore: { getState: () => ({ flush: appearanceFlush }) } }));
vi.mock("../editor/pipelineRegistry", () => ({ flushAll: () => flushAll() }));

import { flushForQuit, registerTitleFlush, trackRename } from "./quitFlush";

describe("flushForQuit", () => {
  it("still waits for flushAll when a tracked rename rejects", async () => {
    let finishFlush!: () => void;
    let flushDone = false;
    flushAll.mockReturnValue(
      new Promise<void>((resolve) => {
        finishFlush = () => {
          flushDone = true;
          resolve();
        };
      }),
    );
    void trackRename(Promise.reject(new Error("rename failed"))).catch(() => {});
    let settled = false;
    const quit = flushForQuit().then(
      () => (settled = true),
      () => (settled = true),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
    finishFlush();
    await quit;
    expect(flushDone).toBe(true);
    expect(settled).toBe(true);
  });
  it("starts title and document saves even when appearance fails", async () => {
    let finish!: () => void;
    flushAll.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    appearanceFlush.mockRejectedValueOnce(new Error("appearance failed"));
    const title = vi.fn().mockResolvedValue(undefined);
    const off = registerTitleFlush(title);
    let done = false;
    const result = flushForQuit().catch((error: Error) => { done = true; return error; });
    await Promise.resolve();
    expect(title).toHaveBeenCalled();
    expect(flushAll).toHaveBeenCalled();
    expect(done).toBe(false);
    finish();
    expect(await result).toEqual(new Error("appearance failed"));
    off();
  });

});

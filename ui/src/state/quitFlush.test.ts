import { describe, expect, it, vi } from "vitest";

const flushAll = vi.fn();
vi.mock("../editor/pipelineRegistry", () => ({ flushAll: () => flushAll() }));

import { flushForQuit, trackRename } from "./quitFlush";

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
});

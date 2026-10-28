import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listen = vi.fn();
const invoke = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({ listen: (...a: unknown[]) => listen(...a) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

import { listenFlushRequest } from "./quit";
import { listenMenu } from "./menuEvents";

let handler: () => Promise<void>;
const off = vi.fn();

beforeEach(() => {
  listen.mockReset().mockImplementation(async (_n: string, cb: () => Promise<void>) => {
    handler = cb;
    return off;
  });
  invoke.mockReset().mockResolvedValue(undefined);
  off.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("listenFlushRequest", () => {
  it("calls quit_ready after a resolving flush", async () => {
    listenFlushRequest(async () => {});
    await handler();
    expect(invoke).toHaveBeenCalledWith("quit_ready");
  });

  it("logs a rejecting flush and still calls quit_ready", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    listenFlushRequest(() => Promise.reject(new Error("boom")));
    await handler();
    expect(err).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith("quit_ready");
  });

  it("unsubscribes at most once", async () => {
    const stop = listenFlushRequest(async () => {});
    stop();
    stop();
    await new Promise((r) => setTimeout(r, 0));
    expect(off).toHaveBeenCalledTimes(1);
  });

  it("survives a rejected listen when unsubscribing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    listen.mockRejectedValueOnce(new Error("no ipc"));
    const stop = listenFlushRequest(async () => {});
    stop();
    await new Promise((r) => setTimeout(r, 0));
    expect(err).toHaveBeenCalled();
  });
});

describe("listenMenu", () => {
  it("unsubscribes at most once and tolerates a rejected listen", async () => {
    const stop = listenMenu("find", () => {});
    stop();
    stop();
    await new Promise((r) => setTimeout(r, 0));
    expect(off).toHaveBeenCalledTimes(1);

    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    listen.mockRejectedValueOnce(new Error("no ipc"));
    listenMenu("find", () => {})();
    await new Promise((r) => setTimeout(r, 0));
    expect(err).toHaveBeenCalled();
  });
});

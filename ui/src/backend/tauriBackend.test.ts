import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import { createTauriBackend } from "./tauriBackend";
import { Commands } from "./generated/commands";
import type { Backend } from "./Backend";

beforeEach(() => {
  invoke.mockReset();
});

describe("tauriBackend", () => {
  it("calls invoke with camelCase args", async () => {
    invoke.mockResolvedValue({ applied: 0, pageUpdatedAt: 1 });
    await createTauriBackend().tabApply("t1", []);
    expect(invoke).toHaveBeenCalledWith(Commands.tabApply, { tabId: "t1", ops: [] });
  });

  it("rethrows the ErrorPayload unchanged", async () => {
    const payload = { code: "invalid_op", message: "bad" };
    invoke.mockImplementation(() => Promise.reject(payload));
    const caught = await createTauriBackend().tabApply("t1", []).then(() => null, (e: unknown) => e);
    expect(caught).toBe(payload);
  });

  it("maps a plain string rejection to invalid_op and logs it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    invoke.mockImplementation(() => Promise.reject("invalid args `ops` for command `tab_apply`"));
    const caught = await createTauriBackend().tabApply("t1", []).then(() => null, (e: unknown) => e);
    expect(caught).toEqual({ code: "invalid_op", message: "invalid args `ops` for command `tab_apply`" });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("sends well-formed titles and queries", async () => {
    invoke.mockResolvedValue({});
    const be = createTauriBackend();
    await be.pageRename("p", "a\ud83d");
    await be.search("b\ude00");
    expect(invoke).toHaveBeenCalledWith(Commands.pageRename, { id: "p", title: "a\uFFFD" });
    expect(invoke).toHaveBeenCalledWith(Commands.search, { query: "b\uFFFD" });
  });

  describe("invoke mapping", () => {
    const cases: [string, (be: Backend) => Promise<unknown>, string, Record<string, unknown> | undefined][] = [
      ["pagesList", (be) => be.pagesList(), Commands.pagesList, undefined],
      ["pageCreate (no args)", (be) => be.pageCreate(), Commands.pageCreate, { parentId: undefined, afterId: undefined }],
      ["pageCreate (parent only)", (be) => be.pageCreate("p1"), Commands.pageCreate, { parentId: "p1", afterId: undefined }],
      ["pageCreate (both)", (be) => be.pageCreate("p1", "p2"), Commands.pageCreate, { parentId: "p1", afterId: "p2" }],
      ["pageRename", (be) => be.pageRename("p1", "Title"), Commands.pageRename, { id: "p1", title: "Title" }],
      ["pageDelete", (be) => be.pageDelete("p1"), Commands.pageDelete, { id: "p1" }],
      ["tabsList", (be) => be.tabsList("p1"), Commands.tabsList, { pageId: "p1" }],
      ["tabLoad", (be) => be.tabLoad("t1"), Commands.tabLoad, { tabId: "t1" }],
      ["tabApply", (be) => be.tabApply("t1", [{ op: "remove", id: "b1" }] as never), Commands.tabApply, { tabId: "t1", ops: [{ op: "remove", id: "b1" }] }],
      ["search", (be) => be.search("needle"), Commands.search, { query: "needle" }],
      ["quitReady", (be) => be.quitReady(), Commands.quitReady, undefined],
    ];

    it.each(cases)("%s", async (_name, run, command, args) => {
      invoke.mockResolvedValue(null);
      await run(createTauriBackend());
      expect(invoke).toHaveBeenCalledTimes(1);
      const call = invoke.mock.calls[0] ?? [];
      expect(call[0]).toBe(command);
      expect(call[1]).toStrictEqual(args);
      expect(call).toHaveLength(2);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import { createTauriBackend } from "./tauriBackend";
import { Commands } from "./generated/commands";

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
});

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
});

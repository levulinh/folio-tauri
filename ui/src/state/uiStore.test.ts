import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vi as copy } from "../i18n/vi";
import { reportError, useUiStore } from "./uiStore";

beforeEach(() => {
  useUiStore.setState({ toasts: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const texts = () => useUiStore.getState().toasts.map((t) => t.text);

describe("reportError", () => {
  it.each(Object.entries(copy.errors))("shows vi.errors.%s for that code", (code, text) => {
    reportError({ code, message: "english" });
    expect(texts()).toEqual([text]);
  });

  it("falls back to vi.errors.db for unknown codes and non-payload errors", () => {
    reportError({ code: "weird", message: "x" });
    reportError(new Error("boom"));
    reportError({ code: "toString", message: "x" });
    expect(texts()).toEqual([copy.errors.db, copy.errors.db, copy.errors.db]);
  });
});

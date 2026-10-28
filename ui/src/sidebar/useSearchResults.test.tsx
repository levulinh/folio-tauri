import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchHit } from "../backend/generated/SearchHit";

const search = vi.fn<(q: string) => Promise<SearchHit[]>>();
vi.mock("../backend", () => ({ backend: { search: (q: string) => search(q) } }));
vi.mock("../state/uiStore", () => ({ reportError: vi.fn() }));

import { useSearchResults } from "./useSearchResults";

const hit = (id: string): SearchHit => ({ pageId: id, pageTitle: id, snippet: "", titleMatch: true });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  search.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("useSearchResults", () => {
  it("debounces 200 ms and returns hits", async () => {
    search.mockResolvedValue([hit("a")]);
    const { result, rerender } = renderHook(({ q }) => useSearchResults(q), { initialProps: { q: "" } });
    expect(result.current).toBeNull();
    rerender({ q: "a" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(search).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current?.map((h) => h.pageId)).toEqual(["a"]);
  });

  it("ignores a slower earlier response once a later query has been answered", async () => {
    const slow = deferred<SearchHit[]>();
    search.mockImplementation((q) => (q === "a" ? slow.promise : Promise.resolve([hit("b")])));
    const { result, rerender } = renderHook(({ q }) => useSearchResults(q), { initialProps: { q: "a" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(search).toHaveBeenCalledWith("a");
    rerender({ q: "b" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current?.map((h) => h.pageId)).toEqual(["b"]);
    await act(async () => {
      slow.resolve([hit("stale")]);
      await Promise.resolve();
    });
    expect(result.current?.map((h) => h.pageId)).toEqual(["b"]);
  });

  it("clears results when the query becomes empty, even if a response is in flight", async () => {
    const slow = deferred<SearchHit[]>();
    search.mockReturnValue(slow.promise);
    const { result, rerender } = renderHook(({ q }) => useSearchResults(q), { initialProps: { q: "a" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    rerender({ q: "" });
    await act(async () => {
      slow.resolve([hit("late")]);
      await Promise.resolve();
    });
    expect(result.current).toBeNull();
  });
});

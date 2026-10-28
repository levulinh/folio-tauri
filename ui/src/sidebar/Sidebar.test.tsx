import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchHit } from "../backend/generated/SearchHit";

const search = vi.fn<(q: string) => Promise<SearchHit[]>>();
const open = vi.fn<(id: string) => Promise<void>>(() => Promise.resolve());
vi.mock("../backend", () => ({ backend: { search: (q: string) => search(q), onMenu: () => () => {} } }));
vi.mock("../state/pageActions", () => ({
  createAndOpenPage: vi.fn(),
  openPage: (id: string) => void open(id),
}));
vi.mock("./PageTree", () => ({ PageTree: () => <div data-testid="tree" /> }));

import { usePageStore } from "../state/pageStore";
const realOpen = usePageStore.getState().open;
import { Sidebar } from "./Sidebar";

const hit = (id: string): SearchHit => ({ pageId: id, pageTitle: id, snippet: "", titleMatch: true });
const input = () => screen.getByTestId("search-input");

beforeEach(() => {
  vi.useFakeTimers();
  search.mockReset();
  open.mockClear();
  search.mockImplementation((q) => Promise.resolve([hit(`hit:${q}`)]));
  usePageStore.setState({ open } as never);
});
afterEach(() => {
  usePageStore.setState({ open: realOpen } as never);
  cleanup();
  vi.useRealTimers();
});

describe("Sidebar Enter", () => {
  it("opens the first hit of the typed query, not of a prefix, when pressed before the debounce", async () => {
    render(<Sidebar />);
    fireEvent.change(input(), { target: { value: "da na" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    fireEvent.change(input(), { target: { value: "da nang" } });
    await act(async () => {
      fireEvent.keyDown(input(), { key: "Enter", keyCode: 13 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("hit:da nang");
  });

  it("opens the first hit when pressed before any result arrived", async () => {
    render(<Sidebar />);
    fireEvent.change(input(), { target: { value: "abc" } });
    await act(async () => {
      fireEvent.keyDown(input(), { key: "Enter", keyCode: 13 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(open).toHaveBeenCalledWith("hit:abc");
  });

  it("does not open a hit if the query changed while the Enter search was running", async () => {
    let resolve!: (h: SearchHit[]) => void;
    search.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    render(<Sidebar />);
    fireEvent.change(input(), { target: { value: "abc" } });
    await act(async () => {
      fireEvent.keyDown(input(), { key: "Enter", keyCode: 13 });
    });
    fireEvent.change(input(), { target: { value: "abcd" } });
    await act(async () => {
      resolve([hit("old")]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(open).not.toHaveBeenCalled();
  });
});

describe("Sidebar search clear", () => {
  it("returns to the page tree when a type=search input is cleared natively (WebKit clear button)", async () => {
    render(<Sidebar />);
    expect(input().getAttribute("type")).toBe("search");
    fireEvent.change(input(), { target: { value: "abc" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.queryByTestId("tree")).toBeNull();

    // WebKit's clear button empties the field through an `input` event, no key events.
    await act(async () => {
      fireEvent.change(input(), { target: { value: "" } });
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByTestId("tree")).toBeTruthy();
  });
});

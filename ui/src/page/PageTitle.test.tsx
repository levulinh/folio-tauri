import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FolioEditor } from "../editor/schema";
import { usePageStore } from "../state/pageStore";
import { usePagesStore } from "../state/pagesStore";
import { flushForQuit } from "../state/quitFlush";
import { useUiStore } from "../state/uiStore";
import { PageTitle } from "./PageTitle";

const page = (id: string, title = "") => ({ id, title }) as never;
const rename = vi.fn<(id: string, title: string) => Promise<void>>(() => Promise.resolve());
const editor = { document: [{ id: "b" }], setTextCursorPosition: vi.fn(), focus: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers();
  rename.mockClear();
  editor.setTextCursorPosition.mockClear();
  editor.focus.mockClear();
  usePagesStore.setState({ pages: [page("p1"), page("p2")], rename } as never);
  usePageStore.setState({ activeEditor: editor as unknown as FolioEditor });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const input = () => screen.getByTestId("page-title");
const type = (v: string) => fireEvent.change(input(), { target: { value: v } });

describe("PageTitle Enter", () => {
  it("ignores the IME-commit Enter (keyCode 229)", () => {
    render(<PageTitle pageId="p1" />);
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 });
    expect(editor.focus).not.toHaveBeenCalled();
    expect(editor.setTextCursorPosition).not.toHaveBeenCalled();
  });

  it("a normal Enter focuses the editor's first block", () => {
    render(<PageTitle pageId="p1" />);
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 13 });
    expect(editor.setTextCursorPosition).toHaveBeenCalledWith(editor.document[0], "start");
    expect(editor.focus).toHaveBeenCalled();
  });
});

describe("PageTitle saving", () => {
  it("saves 400 ms after the last change", () => {
    render(<PageTitle pageId="p1" />);
    type("a");
    act(() => void vi.advanceTimersByTime(399));
    expect(rename).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(rename).toHaveBeenCalledExactlyOnceWith("p1", "a");
  });

  it("unmounting before the debounce flushes to the old page id", () => {
    const { unmount } = render(<PageTitle pageId="p1" />);
    type(" Ghi chú ");
    unmount();
    expect(rename).toHaveBeenCalledExactlyOnceWith("p1", " Ghi chú ");
    act(() => void vi.advanceTimersByTime(1000));
    expect(rename).toHaveBeenCalledTimes(1);
  });

  it("blur saves immediately", () => {
    render(<PageTitle pageId="p1" />);
    type("x");
    fireEvent.blur(input());
    expect(rename).toHaveBeenCalledExactlyOnceWith("p1", "x");
  });

  it("switching page never renames the new page with the old text", () => {
    const { rerender } = render(<PageTitle key="p1" pageId="p1" />);
    type("old text");
    rerender(<PageTitle key="p2" pageId="p2" />);
    expect(rename).toHaveBeenCalledExactlyOnceWith("p1", "old text");
    act(() => void vi.advanceTimersByTime(1000));
    expect(rename).toHaveBeenCalledTimes(1);
    expect(input()).toHaveProperty("value", "");
  });

  it("drops the save when the page was deleted mid-debounce", () => {
    const { unmount } = render(<PageTitle pageId="p1" />);
    type("gone");
    usePagesStore.setState({ pages: [page("p2")] });
    unmount();
    expect(rename).not.toHaveBeenCalled();
  });
});

describe("PageTitle quit flush", () => {
  it("flushForQuit saves a rename that is still inside its debounce and waits for it", async () => {
    let finish!: () => void;
    rename.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
    render(<PageTitle pageId="p1" />);
    type("Đà Nẵng");
    expect(rename).not.toHaveBeenCalled();
    let done = false;
    const flushing = flushForQuit().then(() => (done = true));
    expect(rename).toHaveBeenCalledExactlyOnceWith("p1", "Đà Nẵng");
    await Promise.resolve();
    expect(done).toBe(false);
    finish();
    await flushing;
    expect(done).toBe(true);
    act(() => void vi.advanceTimersByTime(1000));
    expect(rename).toHaveBeenCalledTimes(1);
  });

  it("stops flushing a title once it is unmounted", async () => {
    const { unmount } = render(<PageTitle pageId="p1" />);
    unmount();
    await flushForQuit();
    expect(rename).not.toHaveBeenCalled();
  });
});

describe("PageTitle focus on creation", () => {
  it("takes focus when the page was just created, once", () => {
    useUiStore.getState().requestTitleFocus("p1");
    render(<PageTitle pageId="p1" />);
    expect(input()).toBe(document.activeElement);
    expect(useUiStore.getState().titleFocusPageId).toBeNull();
  });

  it("does not take focus for an ordinarily opened page", () => {
    render(<PageTitle pageId="p1" />);
    expect(input()).not.toBe(document.activeElement);
  });
});

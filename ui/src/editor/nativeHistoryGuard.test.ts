import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageStore } from "../state/pageStore";
import { installNativeHistoryGuard } from "./nativeHistoryGuard";

const editor = { undo: vi.fn(), redo: vi.fn(), prosemirrorView: { dom: null as HTMLElement | null, composing: false } };
let inEditor: HTMLElement;

beforeEach(() => {
  installNativeHistoryGuard();
  const dom = document.body.appendChild(document.createElement("div"));
  inEditor = dom.appendChild(document.createElement("p"));
  inEditor.tabIndex = 0;
  editor.prosemirrorView.dom = dom;
  editor.prosemirrorView.composing = false;
  editor.undo.mockClear();
  editor.redo.mockClear();
  usePageStore.setState({ activeEditor: editor as never });
  inEditor.focus();
});
afterEach(async () => {
  document.body.innerHTML = "";
  usePageStore.setState({ activeEditor: null });
  await new Promise((r) => setTimeout(r, 1)); // let the once-per-task flag reset
});

const fire = (inputType: string) => {
  const e = new InputEvent("beforeinput", { inputType, bubbles: true, cancelable: true });
  inEditor.dispatchEvent(e);
  return e;
};

describe("nativeHistoryGuard", () => {
  it("runs one editor.undo for a native historyUndo and swallows the event", () => {
    const e = fire("historyUndo");
    expect(e.defaultPrevented).toBe(true);
    expect(editor.undo).toHaveBeenCalledTimes(1);
  });

  it("swallows the event but runs no history while composing", () => {
    editor.prosemirrorView.composing = true;
    const e = fire("historyRedo");
    expect(e.defaultPrevented).toBe(true);
    expect(editor.undo).not.toHaveBeenCalled();
    expect(editor.redo).not.toHaveBeenCalled();
  });
});

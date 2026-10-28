import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageStore } from "../state/pageStore";
import { routeMenuHistory } from "./menuHistory";

let editorDom: HTMLElement;
let inEditor: HTMLElement;
const editor = { undo: vi.fn(), redo: vi.fn(), prosemirrorView: { dom: null as HTMLElement | null } };
let exec: ReturnType<typeof vi.fn>;

beforeEach(() => {
  editorDom = document.body.appendChild(document.createElement("div"));
  editorDom.contentEditable = "true";
  inEditor = editorDom.appendChild(document.createElement("p"));
  inEditor.tabIndex = 0;
  editor.prosemirrorView.dom = editorDom;
  editor.undo.mockClear();
  editor.redo.mockClear();
  usePageStore.setState({ activeEditor: editor as never });
  exec = vi.fn(() => true);
  (document as { execCommand: unknown }).execCommand = exec;
});
afterEach(() => {
  document.body.innerHTML = "";
  usePageStore.setState({ activeEditor: null });
});

describe("routeMenuHistory", () => {
  it("focus in the editor: one editor.undo / editor.redo, no execCommand", () => {
    inEditor.focus();
    routeMenuHistory("undo");
    expect(editor.undo).toHaveBeenCalledTimes(1);
    expect(editor.redo).not.toHaveBeenCalled();
    routeMenuHistory("redo");
    expect(editor.redo).toHaveBeenCalledTimes(1);
    expect(exec).not.toHaveBeenCalled();
  });

  it.each([["input"], ["textarea"]])("focus in a text %s: execCommand on it, editor untouched", (tag) => {
    const field = document.body.appendChild(document.createElement(tag));
    field.focus();
    routeMenuHistory("undo");
    routeMenuHistory("redo");
    expect(exec.mock.calls).toEqual([["undo"], ["redo"]]);
    expect(editor.undo).not.toHaveBeenCalled();
    expect(editor.redo).not.toHaveBeenCalled();
  });

  it("nothing focused (or a non-text control): does nothing", () => {
    routeMenuHistory("undo");
    const box = document.body.appendChild(document.createElement("input"));
    box.type = "checkbox";
    box.focus();
    routeMenuHistory("redo");
    const button = document.body.appendChild(document.createElement("button"));
    button.focus();
    routeMenuHistory("undo");
    expect(exec).not.toHaveBeenCalled();
    expect(editor.undo).not.toHaveBeenCalled();
    expect(editor.redo).not.toHaveBeenCalled();
  });

  it("focus in an input inside no editor while no editor is active still uses execCommand", () => {
    usePageStore.setState({ activeEditor: null });
    const field = document.body.appendChild(document.createElement("input"));
    field.focus();
    routeMenuHistory("undo");
    expect(exec).toHaveBeenCalledWith("undo");
  });
});

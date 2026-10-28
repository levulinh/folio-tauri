import { BlockNoteEditor } from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schema } from "./schema";
import { slashComposingGuard } from "./slashComposingGuard";

let editor: BlockNoteEditor<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

let host: HTMLElement;

// jsdom's rects have no toJSON(), which the suggestion menu calls to position itself.
const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    const rect = realRect.call(this);
    return Object.assign(rect, { toJSON: () => ({}) });
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

beforeEach(() => {
  editor = BlockNoteEditor.create({ schema, extensions: [slashComposingGuard()] });
  host = document.createElement("div");
  document.body.append(host); // the suggestion view finds its decoration through the document
  editor.mount(host);
  editor.getExtension(SuggestionMenu)!.addSuggestionMenu({ triggerCharacter: "/" });
  editor.replaceBlocks(editor.document, [{ id: "p", type: "paragraph" }]);
  editor.setTextCursorPosition("p", "end");
});
afterEach(() => {
  editor.unmount();
  host.remove();
});

/** Feeds `text` to ProseMirror's text-input handlers exactly as a typed (or composed) character is. */
function typeText(text: string, compositionMeta?: number): boolean {
  const view = editor.prosemirrorView!;
  const { from, to } = view.state.selection;
  const deflt = () => {
    const tr = view.state.tr.insertText(text, from, to);
    return compositionMeta === undefined ? tr : tr.setMeta("composition", compositionMeta);
  };
  const handled = !!view.someProp("handleTextInput", (f) => f(view, from, to, text, deflt));
  if (!handled) view.dispatch(deflt());
  return handled;
}

const setComposing = (on: boolean) => {
  (editor.prosemirrorView as unknown as { input: { composing: boolean } }).input.composing = on;
};

const menuOpen = () => editor.getExtension(SuggestionMenu)!.shown();
const paragraphText = () => editor.prosemirrorState.doc.textContent;

describe("slashComposingGuard", () => {
  it("slash menu opens for a plain typed slash (control)", () => {
    typeText("/");
    expect(paragraphText()).toBe("/");
    expect(menuOpen()).toBe(true);
  });

  it("slash menu does not open while composing", () => {
    const view = editor.prosemirrorView!;
    setComposing(true);
    expect(view.composing).toBe(true);
    typeText("/");
    expect(paragraphText()).toBe("/"); // the character still lands
    expect(menuOpen()).toBe(false);
    expect(host.querySelector(".bn-suggestion-decorator")).toBeNull();
  });

  it("composition flushed after compositionend does not open the menu", () => {
    expect(editor.prosemirrorView!.composing).toBe(false);
    typeText("/", 7);
    expect(paragraphText()).toBe("/"); // inserted once
    expect(menuOpen()).toBe(false);
  });

  it("only a lone slash is intercepted", () => {
    setComposing(true);
    expect(typeText("a/")).toBe(false);
  });

  it("slash opens normally after a composition ends", () => {
    setComposing(true);
    setComposing(false);
    typeText("/");
    expect(menuOpen()).toBe(true);
  });
});

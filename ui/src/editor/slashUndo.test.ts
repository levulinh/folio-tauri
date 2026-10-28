import { BlockNoteEditor } from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schema } from "./schema";
import { slashComposingGuard } from "./slashComposingGuard";
import { slashItems } from "./slashMenu";

let editor: BlockNoteEditor<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;
let host: HTMLElement;

const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    return Object.assign(realRect.call(this), { toJSON: () => ({}) });
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

beforeEach(() => {
  editor = BlockNoteEditor.create({ schema, extensions: [slashComposingGuard()] });
  host = document.createElement("div");
  document.body.append(host);
  editor.mount(host);
  editor.getExtension(SuggestionMenu)!.addSuggestionMenu({ triggerCharacter: "/" });
  editor.replaceBlocks(editor.document, [{ id: "p", type: "paragraph" }]);
  editor.setTextCursorPosition("p", "end");
});
afterEach(() => {
  editor.unmount();
  host.remove();
});

function typeText(text: string) {
  const view = editor.prosemirrorView!;
  const { from, to } = view.state.selection;
  const deflt = () => view.state.tr.insertText(text, from, to);
  if (!view.someProp("handleTextInput", (f) => f(view, from, to, text, deflt))) view.dispatch(deflt());
}

const text = () => editor.prosemirrorState.doc.textContent;
const menu = () => editor.getExtension(SuggestionMenu)!;

describe("slash menu after undo of the slash", () => {
  it("applying a slash item right after undoing the slash leaves the text untouched", async () => {
    typeText("abc ");
    await new Promise((r) => setTimeout(r, 600)); // history groups typing inside 500 ms; the slash must be its own step
    typeText("/");
    expect(menu().shown()).toBe(true);
    editor.undo();
    expect(text()).toBe("abc ");
    // The caret lands before the tracked trigger position, so BlockNote closes the menu itself.
    expect(menu().shown()).toBe(false);
    // What BlockNote's SuggestionMenuWrapper does on click, whether or not the menu survived the undo.
    menu().closeMenu();
    menu().clearQuery();
    slashItems(editor as never)
      .find((i) => i.key === "heading1")!
      .onItemClick();
    expect(editor.document[0]!.type).toBe("paragraph");
    expect(editor.document[0]!.content).toEqual([{ type: "text", text: "abc ", styles: {} }]);
  });
});

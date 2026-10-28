import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { act, cleanup, render } from "@testing-library/react";
import { TextSelection } from "prosemirror-state";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { schema, type FolioEditor } from "../schema";
import { ToolbarVisibilitySync } from "./ToolbarVisibilitySync";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
});
afterEach(cleanup);

let editor: FolioEditor;
function Harness() {
  editor = useCreateBlockNote({
    schema,
    initialContent: [{ type: "paragraph", content: "xin chào" }] as never,
  }) as unknown as FolioEditor;
  return (
    <BlockNoteView editor={editor as never} formattingToolbar={false}>
      <ToolbarVisibilitySync />
    </BlockNoteView>
  );
}

const store = () => editor.getExtension(FormattingToolbarExtension)!.store;
const dom = () => editor.prosemirrorView!.dom as HTMLElement;

/** Selects "chào" with the editor focused so the sync opens the toolbar. */
async function openToolbar() {
  const view = render(<Harness />);
  await act(async () => {
    editor.focus();
  });
  await act(async () => {
    const { state } = editor.prosemirrorView!;
    const end = state.doc.firstChild!.firstChild!.content.size; // text of the first block
    const start = state.doc.resolve(1).start() ; // inside the first paragraph
    editor.prosemirrorView!.dispatch(state.tr.setSelection(TextSelection.create(state.doc, start + end - 4, start + end)));
  });
  return view;
}

/** Drops the toolbar by hand, fires a sync (compositionend) and returns whether it came back. */
async function reopensAfter(escape: KeyboardEvent, target: EventTarget) {
  expect(store().state).toBe(true);
  await act(async () => {
    target.dispatchEvent(escape);
  });
  await act(async () => {
    editor.focus(); // BlockNote's own Escape binding blurs the editor
    store().setState(false);
    dom().dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  });
  return store().state;
}

const escape = (init: KeyboardEventInit & { keyCode?: number } = {}) =>
  new KeyboardEvent("keydown", { key: "Escape", bubbles: true, ...init });

describe("ToolbarVisibilitySync escape memory", () => {
  it("control: a plain Escape in the editor records a dismissal", async () => {
    await openToolbar();
    expect(await reopensAfter(escape(), dom())).toBe(false);
  });

  it("an Escape with keyCode 229 (IME) does not record a dismissal", async () => {
    await openToolbar();
    expect(await reopensAfter(escape({ keyCode: 229 }), dom())).toBe(true);
  });

  it("an Escape from outside the editor (find input) does not record a dismissal", async () => {
    await openToolbar();
    const input = document.createElement("input");
    document.body.append(input);
    try {
      expect(await reopensAfter(escape(), input)).toBe(true);
    } finally {
      input.remove();
    }
  });
});

import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import { useBlockNoteEditor } from "@blocknote/react";
import { useEffect } from "react";
import type { FolioEditor } from "../schema";
import { shouldShowToolbar } from "./toolbarVisibility";

/**
 * BlockNote opens its formatting toolbar from a fixed rule that also hides it for any selection
 * that touches a code block. Ours is `shouldShowToolbar`: a selection that spans a paragraph and
 * a code block shows the toolbar, and a running IME composition hides it. This renders nothing and
 * keeps BlockNote's open/closed store in line with our rule after BlockNote's own listeners ran
 * (they were registered first). Mouse drags are left to BlockNote: it keeps the toolbar closed
 * until the pointer is released, and so do we.
 */
export function ToolbarVisibilitySync() {
  const editor = useBlockNoteEditor() as unknown as FolioEditor;
  useEffect(() => {
    const view = editor.prosemirrorView;
    if (!view) return;
    const { store } = editor.getExtension(FormattingToolbarExtension)!;
    let pointerDown = false;
    const sync = () => {
      if (pointerDown || !editor.isFocused()) return;
      const want = shouldShowToolbar(editor);
      if (want !== store.state) store.setState(want);
    };
    const onDown = () => {
      pointerDown = true;
    };
    const onUp = () => {
      pointerDown = false;
      sync();
    };
    view.dom.addEventListener("pointerdown", onDown);
    view.root.addEventListener("pointerup", onUp, { capture: true });
    const offChange = editor.onChange(sync);
    const offSelection = editor.onSelectionChange(sync);
    return () => {
      view.dom.removeEventListener("pointerdown", onDown);
      view.root.removeEventListener("pointerup", onUp, { capture: true });
      offChange?.();
      offSelection?.();
    };
  }, [editor]);
  return null;
}

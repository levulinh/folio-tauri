import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import { useBlockNoteEditor } from "@blocknote/react";
import { useEffect } from "react";
import type { FolioEditor } from "../schema";
import { shouldShowToolbar } from "./toolbarVisibility";

/**
 * BlockNote opens its formatting toolbar from a fixed rule that also hides it for any selection
 * that touches a code block. Ours is `shouldShowToolbar`: a selection that spans a paragraph and
 * a code block shows the toolbar, and a running IME composition hides it. This renders nothing and
 * keeps BlockNote's open/closed store in line with our rule on change, selection, focus,
 * pointer-up and composition end. Mouse drags are left to BlockNote: it keeps the toolbar closed
 * until the pointer is released, and so do we.
 *
 * Upgrade risk: this relies on (a) the `formattingToolbar` extension's store being the toolbar's
 * open state, (b) BlockNote's own change/selection listeners being registered before ours, so ours
 * run last, and (c) the view being mounted before this effect runs. All three are re-checked
 * by the e2e tests; (c) is reported with console.error instead of failing silently.
 */
export function ToolbarVisibilitySync() {
  const editor = useBlockNoteEditor() as unknown as FolioEditor;
  useEffect(() => {
    const extension = editor.getExtension(FormattingToolbarExtension);
    if (!extension) {
      console.error("ToolbarVisibilitySync: the formattingToolbar extension is missing; the toolbar rule is not applied");
      return;
    }
    const { store } = extension;
    let pointerDown = false;
    // Escape closes the toolbar while the editor keeps focus. Remember the selection it was
    // dismissed for, so the focus event that follows does not reopen it; any other selection
    // clears the memory.
    let dismissedFor: string | null = null;
    const selectionKey = () => {
      const { from, to } = editor.prosemirrorState.selection;
      return `${from}-${to}`;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && store.state) dismissedFor = selectionKey();
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    const sync = () => {
      if (pointerDown || !editor.isFocused()) return;
      if (dismissedFor !== null && dismissedFor === selectionKey()) return;
      dismissedFor = null;
      const want = shouldShowToolbar(editor);
      if (want !== store.state) store.setState(want);
    };
    const offChange = editor.onChange(sync);
    const offSelection = editor.onSelectionChange(sync);
    const offFocus = editor.onFocusChange(sync);

    let detachDom: (() => void) | undefined;
    const attachDom = () => {
      const view = editor.prosemirrorView;
      if (!view) return false;
      const onDown = () => {
        pointerDown = true;
      };
      const onUp = () => {
        pointerDown = false;
        sync();
      };
      view.dom.addEventListener("pointerdown", onDown);
      view.dom.addEventListener("compositionend", sync);
      view.root.addEventListener("pointerup", onUp, { capture: true });
      detachDom = () => {
        view.dom.removeEventListener("pointerdown", onDown);
        view.dom.removeEventListener("compositionend", sync);
        view.root.removeEventListener("pointerup", onUp, { capture: true });
      };
      return true;
    };
    // The view may mount just after this effect (BlockNoteView mounts it in its own effect).
    let retry: number | undefined;
    if (!attachDom()) {
      let attempts = 0;
      retry = window.setInterval(() => {
        attempts += 1;
        if (attachDom()) window.clearInterval(retry);
        else if (attempts >= 50) {
          window.clearInterval(retry);
          console.error("ToolbarVisibilitySync: the editor view never mounted; pointer and IME sync are off");
        }
      }, 50);
    }
    return () => {
      window.clearInterval(retry);
      detachDom?.();
      offChange?.();
      offSelection?.();
      offFocus?.();
      document.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [editor]);
  return null;
}

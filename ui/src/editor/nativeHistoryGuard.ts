import { usePageStore } from "../state/pageStore";

let installed = false;

/**
 * WebKit records one native undo step per run of native typing in the contentEditable. A single
 * native `undo:` (⌘Z with focus outside the editor, or the Edit menu's `execCommand("undo")`)
 * fires `beforeinput` `historyUndo` on the editor once per recorded step in the same task, and
 * prosemirror-history answers each with a full undo: N steps undone, the document wiped and saved.
 *
 * This capture-phase listener swallows those events when they target the editor and runs the
 * editor's own history at most once per task, and only when focus is inside the editor. Events on
 * ordinary inputs (title, find, search) pass through so their own undo keeps working.
 */
export function installNativeHistoryGuard(): void {
  if (installed) return;
  installed = true;
  let handled = false;
  document.addEventListener(
    "beforeinput",
    (e) => {
      if (e.inputType !== "historyUndo" && e.inputType !== "historyRedo") return;
      const editor = usePageStore.getState().activeEditor;
      const dom = editor?.prosemirrorView?.dom;
      if (!editor || !dom || !(e.target instanceof Node) || !dom.contains(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (handled) return;
      handled = true;
      setTimeout(() => {
        handled = false;
      }, 0);
      if (!(document.activeElement && dom.contains(document.activeElement))) return;
      if (editor.prosemirrorView.composing) return; // never run history under an IME composition
      if (e.inputType === "historyUndo") editor.undo();
      else editor.redo();
    },
    true,
  );
}

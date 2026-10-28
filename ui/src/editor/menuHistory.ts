import { usePageStore } from "../state/pageStore";

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email"]);

/**
 * The Edit menu's Undo / Redo (custom items, not the native `undo:`/`redo:`, D-026) and their
 * ⌘Z / ⇧⌘Z accelerators land here. Focus in the editor: exactly one ProseMirror history step.
 * Focus in a text field: the field's own undo (`execCommand` targets it only; the native-history
 * guard ignores non-editor targets). Anything else: nothing.
 */
export function routeMenuHistory(kind: "undo" | "redo"): void {
  const active = document.activeElement;
  const editor = usePageStore.getState().activeEditor;
  const dom = editor?.prosemirrorView?.dom;
  if (editor && dom && active && dom.contains(active)) {
    if (kind === "undo") editor.undo();
    else editor.redo();
    return;
  }
  const isTextField =
    active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(active.type));
  if (isTextField) document.execCommand(kind);
}

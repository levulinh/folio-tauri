import { usePageStore } from "../state/pageStore";

const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email"]);

/**
 * The Edit menu's Undo / Redo (custom items, not the native `undo:`/`redo:`, D-026) land here.
 * On macOS wry lets the WKWebView see ⌘Z first (`performKeyEquivalent` -> page keydown); only
 * unhandled events go on to the menu. So in practice: editor -> BlockNote's Mod-z keymap handles
 * it (menu not fired); a text field -> menu -> here; editor with empty history or mid-composition
 * -> menu -> here.
 * Editor focus: exactly one ProseMirror step, skipped while composing. Text field: `execCommand`
 * (shares WebKit's undo stack, so stale editor steps may sit on top; not strictly "that field
 * only"). Anything else: nothing. The custom items are always enabled and have no "Undo Typing"
 * title. Windows/Linux: a field may see both its own ⌘Z and the menu (double step risk), and
 * Ctrl+Y has no accelerator.
 */
export function routeMenuHistory(kind: "undo" | "redo"): void {
  const active = document.activeElement;
  const editor = usePageStore.getState().activeEditor;
  const dom = editor?.prosemirrorView?.dom;
  if (editor && dom && active && dom.contains(active)) {
    // Never run history under an active IME (Telex/VNI) composition: ProseMirror skips its own keydown then.
    if (editor.prosemirrorView.composing) return;
    if (kind === "undo") editor.undo();
    else editor.redo();
    return;
  }
  const isTextField =
    active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(active.type));
  if (isTextField) document.execCommand(kind);
}

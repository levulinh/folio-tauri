import type { FolioEditor } from "../schema";

const CODE_BLOCK = "codeBlock";

/**
 * Whether the formatting toolbar may show for the editor's current selection: false for an empty
 * selection, while an IME composition is running, and when every text block the selection touches
 * is a code block (code has no inline styles). A selection that also covers other text blocks
 * shows the toolbar; formatting then skips the code blocks (see `codeBlockStyleGuard`).
 */
export function shouldShowToolbar(editor: FolioEditor): boolean {
  const view = editor.prosemirrorView;
  if (view?.composing) return false;
  const { selection, doc } = editor.prosemirrorState;
  if (selection.empty) return false;
  let textBlocks = 0;
  let nonCode = 0;
  doc.nodesBetween(selection.from, selection.to, (node) => {
    if (!node.isTextblock) return true;
    textBlocks += 1;
    if (node.type.name !== CODE_BLOCK) nonCode += 1;
    return false;
  });
  return textBlocks > 0 && nonCode > 0;
}

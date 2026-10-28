import { TextSelection } from "prosemirror-state";
import type { FolioEditor } from "../schema";

const CODE_BLOCK = "codeBlock";

/**
 * Whether the formatting toolbar may show for the editor's current selection: false for an empty
 * selection, while an IME composition is running, when the selection contains no text (it only
 * crosses block boundaries) and when every text block that contributes text to the selection is a
 * code block (code has no inline styles). A selection that also covers text of other blocks shows
 * the toolbar; formatting then skips the code blocks.
 */
export function shouldShowToolbar(editor: FolioEditor): boolean {
  if (editor.prosemirrorView?.composing) return false;
  const { selection, doc } = editor.prosemirrorState;
  if (selection.empty) return false;
  if (selection instanceof TextSelection && doc.textBetween(selection.from, selection.to).length === 0) return false;
  let styleableText = false;
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.name !== CODE_BLOCK) {
      const from = Math.max(selection.from, pos + 1);
      const to = Math.min(selection.to, pos + 1 + node.content.size);
      if (to > from && doc.textBetween(from, to).length > 0) styleableText = true;
    }
    return false;
  });
  return styleableText;
}

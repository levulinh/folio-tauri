import type { FolioEditor } from "../schema";
import { useEffect } from "react";

/**
 * A block drag starts on the handle button, so focus ends up outside the editor after the drop and
 * a following ⌘Z would reach the webview's native undo instead of the editor's history. Give the
 * focus back once BlockNote has handled a drop inside the editor.
 */
export function useFocusAfterDrop(editor: FolioEditor): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onDrop = (e: DragEvent) => {
      const dom = editor.prosemirrorView?.dom;
      if (!dom || !(e.target instanceof Node) || !dom.contains(e.target)) return;
      timer = setTimeout(() => editor.focus(), 0); // after BlockNote's own drop handler
    };
    document.addEventListener("drop", onDrop);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("drop", onDrop);
    };
  }, [editor]);
}

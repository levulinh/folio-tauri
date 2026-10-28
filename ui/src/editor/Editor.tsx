import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useState } from "react";
import { backend } from "../backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import { usePageStore } from "../state/pageStore";
import { reportError } from "../state/uiStore";
import { toEditorBlocks } from "./convert";
import { dictionary } from "./dictionary";
import { schema } from "./schema";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function useColorScheme(): "light" | "dark" {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return dark ? "dark" : "light";
}

function EditorInstance({ blocks }: { blocks: BlockNode[] }) {
  const colorScheme = useColorScheme();
  const editor = useCreateBlockNote({
    schema,
    dictionary,
    initialContent: blocks.length ? toEditorBlocks(blocks) : undefined,
    trailingBlock: true,
    animations: false,
  });
  const setActiveEditor = usePageStore((s) => s.setActiveEditor);
  useEffect(() => {
    setActiveEditor(editor);
    return () => setActiveEditor(null);
  }, [editor, setActiveEditor]);
  return <BlockNoteView editor={editor} theme={colorScheme} data-testid="editor" />;
}

/** Loads the tab's blocks, then mounts a fresh editor. Remounted per tab via `key`. */
export function Editor({ tabId }: { tabId: string }) {
  const [blocks, setBlocks] = useState<BlockNode[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    backend
      .tabLoad(tabId)
      .then((loaded) => {
        if (!cancelled) setBlocks(loaded);
      })
      .catch(reportError);
    return () => {
      cancelled = true;
    };
  }, [tabId]);
  if (blocks === null) return null;
  return <EditorInstance blocks={blocks} />;
}

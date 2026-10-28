import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useMemo, useState } from "react";
import { backend } from "../backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import { usePageStore } from "../state/pageStore";
import { reportError } from "../state/uiStore";
import { registerPipeline, retirePipeline } from "./pipelineRegistry";
import { createSavePipeline } from "./savePipeline";
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

function EditorInstance({ tabId, blocks }: { tabId: string; blocks: BlockNode[] }) {
  const colorScheme = useColorScheme();
  const initialContent = useMemo(() => (blocks.length ? toEditorBlocks(blocks) : undefined), [blocks]);
  const editor = useCreateBlockNote({
    schema,
    dictionary,
    initialContent,
    trailingBlock: true,
    animations: false,
  });
  const setActiveEditor = usePageStore((s) => s.setActiveEditor);
  useEffect(() => {
    setActiveEditor(editor);
    return () => setActiveEditor(null);
  }, [editor, setActiveEditor]);
  const setSaveStatus = usePageStore((s) => s.setSaveStatus);
  useEffect(() => {
    const pipeline = createSavePipeline({ tabId, editor, backend });
    const unregister = registerPipeline(pipeline);
    const offStatus = pipeline.onStatus(setSaveStatus);
    setSaveStatus(pipeline.status());
    return () => {
      offStatus();
      setSaveStatus("saved");
      // Not awaited: the registry tracks the final flush so flushAll() still waits for it.
      retirePipeline(pipeline, unregister);
    };
  }, [tabId, editor, setSaveStatus]);
  return <BlockNoteView editor={editor} theme={colorScheme} data-testid="editor" />;
}

/**
 * Loads the tab's blocks, then mounts a fresh editor. Parents also pass `key={tabId}`, but this
 * component is correct without it: loaded blocks are tagged with their tab and the instance is
 * keyed by it, so a tabId change never shows (or edits) another tab's content.
 */
export function Editor({ tabId }: { tabId: string }) {
  const [loaded, setLoaded] = useState<{ tabId: string; blocks: BlockNode[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    backend
      .tabLoad(tabId)
      .then((blocks) => {
        if (!cancelled) setLoaded({ tabId, blocks });
      })
      .catch(reportError);
    return () => {
      cancelled = true;
    };
  }, [tabId]);
  if (loaded === null || loaded.tabId !== tabId) return null;
  return <EditorInstance key={tabId} tabId={tabId} blocks={loaded.blocks} />;
}

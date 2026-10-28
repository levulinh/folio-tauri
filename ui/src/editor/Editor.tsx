import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import { useEffect, useState } from "react";
import { backend } from "../backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import { usePageStore } from "../state/pageStore";
import { reportError } from "../state/uiStore";
import { adoptRetired, peekRetiredEditor, registerPipeline, retirePipeline } from "./pipelineRegistry";
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

interface Loaded {
  tabId: string;
  /** What the editor starts with: the stored tree, or the document of a retired unsaved editor. */
  initial: PartialBlock[] | undefined;
  storedIds: string[];
}

function EditorInstance({ loaded }: { loaded: Loaded }) {
  const { tabId, initial, storedIds } = loaded;
  const colorScheme = useColorScheme();
  const editor = useCreateBlockNote({
    schema,
    dictionary,
    initialContent: initial as never,
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
    const pipeline = createSavePipeline({ tabId, editor, backend, storedIds });
    const unregister = registerPipeline(pipeline);
    adoptRetired(tabId, pipeline); // a retired pipeline of this tab hands its unsaved work over
    const offStatus = pipeline.onStatus(setSaveStatus);
    setSaveStatus(pipeline.status());
    return () => {
      offStatus();
      // Not awaited: the registry tracks the final flush so flushAll() still waits for it.
      retirePipeline(pipeline, unregister, tabId, editor);
      if (pipeline.status() !== "error") setSaveStatus("saved"); // never hide a pending error
    };
  }, [tabId, editor, storedIds, setSaveStatus]);
  return <BlockNoteView editor={editor} theme={colorScheme} data-testid="editor" />;
}

async function loadTab(tabId: string): Promise<Loaded> {
  // An unmounted editor that has not saved yet is newer than the database: start from its document.
  // Peek before loading: if it saves meanwhile, its document is still the newest content.
  const retiredEditor = peekRetiredEditor(tabId);
  const stored = await backend.tabLoad(tabId);
  const storedIds = collectIds(stored);
  if (retiredEditor) return { tabId, initial: retiredEditor.document as PartialBlock[], storedIds };
  return { tabId, initial: stored.length ? toEditorBlocks(stored) : undefined, storedIds };
}

function collectIds(nodes: BlockNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...collectIds(n.children)]);
}

/**
 * Loads the tab's blocks, then mounts a fresh editor. Parents also pass `key={tabId}`, but this
 * component is correct without it: loaded blocks are tagged with their tab and the instance is
 * keyed by it, so a tabId change never shows (or edits) another tab's content.
 */
export function Editor({ tabId }: { tabId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadTab(tabId)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((e) => {
        if (!cancelled) reportError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [tabId]);
  if (loaded === null || loaded.tabId !== tabId) return null;
  return <EditorInstance key={tabId} loaded={loaded} />;
}

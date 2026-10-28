import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import { useEffect, useState } from "react";
import { backend } from "../backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import { usePageStore } from "../state/pageStore";
import { reportError } from "../state/uiStore";
import { registerPipeline, retirePipeline, takeOverRetired, type TakenOver } from "./pipelineRegistry";
import { createSavePipeline, type PipelineHandOff } from "./savePipeline";
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
  adopt: PipelineHandOff | undefined;
  taken: TakenOver | null;
}

function EditorInstance({ loaded }: { loaded: Loaded }) {
  const { tabId, initial, storedIds, adopt } = loaded;
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
    const pipeline = createSavePipeline({ tabId, editor, backend, storedIds, adopt });
    const unregister = registerPipeline(pipeline);
    const offStatus = pipeline.onStatus(setSaveStatus);
    setSaveStatus(pipeline.status());
    return () => {
      offStatus();
      // Not awaited: the registry tracks the final flush so flushAll() still waits for it.
      retirePipeline(pipeline, unregister, tabId, editor);
      if (pipeline.status() !== "error") setSaveStatus("saved"); // never hide a pending error
    };
  }, [tabId, editor, storedIds, adopt, setSaveStatus]);
  return <BlockNoteView editor={editor} theme={colorScheme} data-testid="editor" />;
}

/** Puts a taken-over state back under a pipeline of its own (the mount that took it was cancelled). */
function restoreRetired(tabId: string, taken: TakenOver): void {
  const pipeline = createSavePipeline({ tabId, editor: taken.editor, backend, adopt: taken.handOff });
  retirePipeline(pipeline, () => {}, tabId, taken.editor);
}

async function loadTab(tabId: string): Promise<Loaded> {
  const taken = await takeOverRetired(tabId);
  try {
    const stored = await backend.tabLoad(tabId);
    const storedIds = collectIds(stored);
    if (taken) {
      return { tabId, initial: taken.editor.document as PartialBlock[], storedIds, adopt: taken.handOff, taken };
    }
    return { tabId, initial: stored.length ? toEditorBlocks(stored) : undefined, storedIds, adopt: undefined, taken: null };
  } catch (e) {
    if (taken) restoreRetired(tabId, taken);
    throw e;
  }
}

/**
 * One load per tab at a time, shared by every effect run waiting for it (React StrictMode runs
 * effects twice). If the last consumer was cancelled (user left before the load ended) and the
 * load had taken over a retired pipeline, that unsaved state goes back under a pipeline of its own.
 */
const loads = new Map<string, { promise: Promise<Loaded>; users: number }>();

function acquireLoad(tabId: string) {
  let entry = loads.get(tabId);
  if (!entry) {
    entry = { promise: loadTab(tabId), users: 0 };
    loads.set(tabId, entry);
  }
  entry.users += 1;
  return entry;
}

function releaseLoad(tabId: string, entry: { users: number }, cancelled: boolean, result: Loaded | null): void {
  entry.users -= 1;
  if (entry.users > 0) return;
  loads.delete(tabId);
  if (cancelled && result?.taken) restoreRetired(tabId, result.taken);
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
    const entry = acquireLoad(tabId);
    entry.promise
      .then((result) => {
        releaseLoad(tabId, entry, cancelled, result);
        if (!cancelled) setLoaded(result);
      })
      .catch((e) => {
        releaseLoad(tabId, entry, cancelled, null);
        if (!cancelled) reportError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [tabId]);
  if (loaded === null || loaded.tabId !== tabId) return null;
  return <EditorInstance key={tabId} loaded={loaded} />;
}

import { BlockNoteView } from "@blocknote/mantine";
import {
  FormattingToolbarController,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import type { Transaction } from "prosemirror-state";
import { useCallback, useEffect, useState } from "react";
import { backend } from "../backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import { usePageStore } from "../state/pageStore";
import { reportError } from "../state/uiStore";
import { getPipeline, pendingDocumentFor } from "./pipelineRegistry";
import { toEditorBlocks } from "./convert";
import { dictionary } from "./dictionary";
import { findExtension } from "./find/findPlugin";
import { schema } from "./schema";
import { SlashMenuComponent } from "./SlashMenuComponent";
import { slashComposingGuard } from "./slashComposingGuard";
import { filterSlashItems, slashItems } from "./slashMenu";
import { ToolbarVisibilitySync } from "./toolbar/ToolbarVisibilitySync";
import { FolioFormattingToolbar } from "./toolbar/FolioFormattingToolbar";
import "./editor.css";

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

/** BlockNote's default rule: no slash menu inside table cells. */
const shouldOpenSlash = (tr: Transaction) => !tr.selection.$from.parent.type.isInGroup("tableContent");
const runSlashItem = (item: DefaultReactSuggestionItem) => item.onItemClick();

interface Loaded {
  tabId: string;
  /** What the editor starts with: the stored tree, or the document of the tab's unsaved pipeline. */
  initial: PartialBlock[] | undefined;
  /** Ids the backend has, to seed the tab's pipeline. */
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
    extensions: [findExtension(), slashComposingGuard()],
  });
  const getSlashItems = useCallback(
    async (query: string): Promise<DefaultReactSuggestionItem[]> => filterSlashItems(slashItems(editor), query),
    [editor],
  );
  const setActiveEditor = usePageStore((s) => s.setActiveEditor);
  useEffect(() => {
    setActiveEditor(editor);
    return () => setActiveEditor(null);
  }, [editor, setActiveEditor]);
  const setSaveStatus = usePageStore((s) => s.setSaveStatus);
  useEffect(() => {
    const pipeline = getPipeline(tabId, backend);
    pipeline.seedStoredIds(storedIds); // ignored if the pipeline already knows better
    pipeline.attach(editor);
    const offStatus = pipeline.onStatus(setSaveStatus);
    setSaveStatus(pipeline.status());
    return () => {
      offStatus();
      pipeline.detach(editor); // flushes now; the pipeline lives on until everything is saved
      if (pipeline.status() !== "error") setSaveStatus("saved"); // never hide a pending error
    };
  }, [tabId, editor, storedIds, setSaveStatus]);
  return (
    <BlockNoteView editor={editor} theme={colorScheme} formattingToolbar={false} slashMenu={false} data-testid="editor">
      <ToolbarVisibilitySync />
      <FormattingToolbarController formattingToolbar={FolioFormattingToolbar} />
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={getSlashItems}
        shouldOpen={shouldOpenSlash}
        suggestionMenuComponent={SlashMenuComponent}
        onItemClick={runSlashItem}
      />
    </BlockNoteView>
  );
}

async function loadTab(tabId: string): Promise<Loaded> {
  // Unsaved work of a just-left editor is newer than the database: start from its document.
  const pending = pendingDocumentFor(tabId);
  if (pending) return { tabId, initial: pending.document as PartialBlock[], storedIds: pending.storedIds };
  const stored = await backend.tabLoad(tabId);
  return { tabId, initial: stored.length ? toEditorBlocks(stored) : undefined, storedIds: collectIds(stored) };
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

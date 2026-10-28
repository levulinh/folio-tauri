import type { Backend } from "../backend/Backend";
import { createSavePipeline, type SavePipeline } from "./savePipeline";
import type { FolioEditor } from "./schema";

/** One pipeline per tab; it removes itself when it has nothing left to save (or the tab is gone). */
const pipelines = new Map<string, SavePipeline>();

export function getPipeline(tabId: string, backend: Pick<Backend, "tabApply" | "tabLoad">): SavePipeline {
  let p = pipelines.get(tabId);
  if (!p) {
    const created: SavePipeline = createSavePipeline({
      tabId,
      backend,
      onDispose: () => {
        if (pipelines.get(tabId) === created) pipelines.delete(tabId);
      },
    });
    pipelines.set(tabId, created);
    p = created;
  }
  return p;
}

export interface PendingDocument {
  document: FolioEditor["document"];
  storedIds: string[];
}

/**
 * If the tab's pipeline has unsaved work (dirty, in flight or failing), its current document is
 * newer than the database: a new editor must start from it instead of from `tabLoad`.
 */
export function pendingDocumentFor(tabId: string): PendingDocument | null {
  const p = pipelines.get(tabId);
  const document = p?.document();
  if (!p || !document || !p.isPending()) return null;
  return { document, storedIds: p.storedIds() ?? [] };
}

/** Flushes every pipeline (one attempt each, attached or detached) and waits for them. */
export async function flushAll(): Promise<void> {
  await Promise.all([...pipelines.values()].map((p) => p.flush()));
}

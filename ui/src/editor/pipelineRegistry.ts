import type { PipelineHandOff, SavePipeline } from "./savePipeline";
import type { FolioEditor } from "./schema";

interface Retired {
  pipeline: SavePipeline;
  editor: FolioEditor;
}

const live = new Set<SavePipeline>();
/** Unmounted pipelines that have not saved yet, by tab. At most one per tab (a newer one replaces). */
const retired = new Map<string, Retired>();
const finishing = new Set<Promise<void>>();

/** Adds a mounted editor's pipeline; the returned function removes it. */
export function registerPipeline(p: SavePipeline): () => void {
  live.add(p);
  return () => {
    live.delete(p);
  };
}

/**
 * For an unmounting editor: unregisters and keeps the pipeline in the retired map until it has
 * saved everything. Its flush loop runs until nothing is pending (edits made during the final
 * flush are included); `flushAll()` waits for it. If saving fails the pipeline keeps retrying in the
 * background until it succeeds, unless an editor for the same tab mounts first and takes over
 * (`takeOverRetired`), so an old editor can never overwrite newer edits.
 */
export function retirePipeline(p: SavePipeline, unregister: () => void, tabId: string, editor: FolioEditor): void {
  unregister();
  retired.set(tabId, { pipeline: p, editor });
  const finish = () => {
    p.dispose();
    if (retired.get(tabId)?.pipeline === p) retired.delete(tabId);
  };
  const done: Promise<void> = (async () => {
    do await p.flush();
    while (p.status() === "saving");
    if (p.status() !== "error") return finish();
    const off = p.onStatus((s) => {
      if (s !== "saved") return;
      off();
      finish();
    });
  })().finally(() => finishing.delete(done));
  finishing.add(done);
}

export interface TakenOver {
  /** The retired editor's current document, to seed the new editor with. */
  editor: FolioEditor;
  handOff: PipelineHandOff;
}

/** If an unsaved retired pipeline exists for this tab, stops it and returns its state; else null. */
export async function takeOverRetired(tabId: string): Promise<TakenOver | null> {
  const r = retired.get(tabId);
  if (!r) return null;
  retired.delete(tabId);
  return { editor: r.editor, handOff: await r.pipeline.handOff() };
}

/** Flushes every live and retired pipeline (one attempt each) and waits for final flushes. */
export async function flushAll(): Promise<void> {
  const pipelines = [...live, ...[...retired.values()].map((r) => r.pipeline)];
  await Promise.all([...pipelines.map((p) => p.flush()), ...finishing]);
}

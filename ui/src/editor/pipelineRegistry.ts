import type { SavePipeline } from "./savePipeline";
import type { FolioEditor } from "./schema";

interface Retired {
  pipeline: SavePipeline;
  editor: FolioEditor;
  /** Detaches the "dispose once saved" listener (set while the pipeline is failing). */
  stop?: () => void;
}

const live = new Set<SavePipeline>();
/** Unmounted pipelines that have not saved yet, by tab. At most one per tab. */
const retired = new Map<string, Retired>();
const finishing = new Set<Promise<void>>();
/** Hand-offs in progress: their ids are on their way into a new pipeline. */
const handingOff = new Set<Promise<void>>();

/** Adds a mounted editor's pipeline; the returned function removes it. */
export function registerPipeline(p: SavePipeline): () => void {
  live.add(p);
  return () => {
    live.delete(p);
  };
}

/** Stops `entry`'s pipeline and moves what it still owes into `target` (nothing is lost). */
function moveWork(entry: Retired, target: SavePipeline): void {
  entry.stop?.();
  const done: Promise<void> = entry.pipeline
    .handOff()
    .then((work) => target.adopt(work))
    .catch((e) => console.error("save pipeline: hand-off failed", e))
    .finally(() => handingOff.delete(done));
  handingOff.add(done);
}

/**
 * For an unmounting editor: unregisters and keeps the pipeline in the retired map until it has
 * saved everything. Its flush loop runs until nothing is pending (edits made during the final
 * flush are included); `flushAll()` waits for it. If saving fails the pipeline keeps retrying in the
 * background until it succeeds, unless an editor for the same tab mounts first and takes over
 * (`adoptRetired`), so an old editor can never overwrite newer edits. A pipeline already retired
 * for the tab (React StrictMode retires and recreates on the same editor) is merged into this one.
 */
export function retirePipeline(p: SavePipeline, unregister: () => void, tabId: string, editor: FolioEditor): void {
  unregister();
  const previous = retired.get(tabId);
  const entry: Retired = { pipeline: p, editor };
  retired.set(tabId, entry);
  if (previous && previous.pipeline !== p) moveWork(previous, p);
  const finish = () => {
    p.dispose();
    if (retired.get(tabId) === entry) retired.delete(tabId);
  };
  const done: Promise<void> = (async () => {
    do await p.flush();
    while (p.status() === "saving");
    if (p.status() !== "error") return finish();
    entry.stop = p.onStatus((s) => {
      if (s !== "saved") return;
      entry.stop?.();
      finish();
    });
  })().finally(() => finishing.delete(done));
  finishing.add(done);
}

/** The editor of an unsaved retired pipeline for this tab, to seed a new editor with (else null). */
export function peekRetiredEditor(tabId: string): FolioEditor | null {
  return retired.get(tabId)?.editor ?? null;
}

/**
 * Called when a new pipeline starts for `tabId`: any retired pipeline of that tab (an unmounted
 * editor's, or the StrictMode double-effect twin on the same editor) is stopped for good and its
 * unsaved ids and resync flag move into `target`. `flushAll()` waits for this to finish.
 */
export function adoptRetired(tabId: string, target: SavePipeline): void {
  const entry = retired.get(tabId);
  if (!entry || entry.pipeline === target) return;
  retired.delete(tabId);
  moveWork(entry, target);
}

/** Flushes every live and retired pipeline (one attempt each) and waits for final flushes. */
export async function flushAll(): Promise<void> {
  await Promise.all([...handingOff]);
  const pipelines = [...live, ...[...retired.values()].map((r) => r.pipeline)];
  await Promise.all([...pipelines.map((p) => p.flush()), ...finishing]);
}

import { flushAll } from "../editor/pipelineRegistry";
import { addTitleFlusher, removeTitleFlusher, titleFlushers } from "./titleFlushers";

const renamesInFlight = new Set<Promise<void>>();

/** Registers a mounted page title's "save pending rename now"; returns the unregister function. */
export function registerTitleFlush(flush: () => Promise<void>): () => void {
  addTitleFlusher(flush);
  return () => removeTitleFlusher(flush);
}

/** Tracks a started rename (e.g. from an unmount save) until it settles, so a quit waits for it. */
export function trackRename(rename: Promise<void>): Promise<void> {
  const tracked = rename.finally(() => renamesInFlight.delete(tracked));
  renamesInFlight.add(tracked);
  return tracked;
}

/** Everything that must reach the database before the app exits: pending title renames and every tab's blocks. */
export async function flushForQuit(): Promise<void> {
  const started = titleFlushers().map((f) => f());
  // allSettled: one failing save must not end the wait before the others have finished.
  const results = await Promise.allSettled([...started, ...renamesInFlight, flushAll()]);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) throw failed.reason;
}

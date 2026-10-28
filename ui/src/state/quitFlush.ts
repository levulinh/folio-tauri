import { flushAll } from "../editor/pipelineRegistry";

const titleFlushers = new Set<() => Promise<void>>();
const renamesInFlight = new Set<Promise<void>>();

/** Registers a mounted page title's "save pending rename now"; returns the unregister function. */
export function registerTitleFlush(flush: () => Promise<void>): () => void {
  titleFlushers.add(flush);
  return () => void titleFlushers.delete(flush);
}

/** Tracks a started rename (e.g. from an unmount save) until it settles, so a quit waits for it. */
export function trackRename(rename: Promise<void>): Promise<void> {
  const tracked = rename.finally(() => renamesInFlight.delete(tracked));
  renamesInFlight.add(tracked);
  return tracked;
}

/** Test-only: how many mounted titles are registered. */
export function titleFlushCount(): number {
  return titleFlushers.size;
}

/** Everything that must reach the database before the app exits: pending title renames and every tab's blocks. */
export async function flushForQuit(): Promise<void> {
  const started = [...titleFlushers].map((f) => f());
  await Promise.all([...started, ...renamesInFlight, flushAll()]);
}

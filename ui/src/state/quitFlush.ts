import { flushAll } from "../editor/pipelineRegistry";

const titleFlushers = new Set<() => Promise<void>>();

/** Registers a mounted page title's "save the pending rename now"; returns the unregister function. */
export function registerTitleFlush(flush: () => Promise<void>): () => void {
  titleFlushers.add(flush);
  return () => void titleFlushers.delete(flush);
}

/** Everything that must reach the database before the app exits: pending title renames and every tab's blocks. */
export async function flushForQuit(): Promise<void> {
  await Promise.all([...[...titleFlushers].map((f) => f()), flushAll()]);
}

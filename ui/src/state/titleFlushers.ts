/** Mounted page titles' "save pending rename now" callbacks; private to this module so only the helpers below touch it. */
const flushers = new Set<() => Promise<void>>();

export function addTitleFlusher(flush: () => Promise<void>): void {
  flushers.add(flush);
}

export function removeTitleFlusher(flush: () => Promise<void>): void {
  flushers.delete(flush);
}

export function titleFlushers(): Array<() => Promise<void>> {
  return [...flushers];
}

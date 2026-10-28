/** Mounted page titles' "save pending rename now" callbacks; managed by `quitFlush`, read by its test helper. */
export const titleFlushers = new Set<() => Promise<void>>();

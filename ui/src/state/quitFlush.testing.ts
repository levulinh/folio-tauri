import { titleFlushers } from "./titleFlushers";

/** Test-only: how many mounted titles are registered for the quit flush. */
export function titleFlushCount(): number {
  return titleFlushers.size;
}

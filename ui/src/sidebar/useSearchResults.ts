import { useCallback, useEffect, useRef, useState } from "react";
import { backend } from "../backend";
import type { SearchHit } from "../backend/generated/SearchHit";
import { reportError } from "../state/uiStore";

export const SEARCH_DEBOUNCE_MS = 200;

export interface SearchState {
  /** The query `hits` belong to (null hits: nothing searched yet / empty query). */
  query: string;
  hits: SearchHit[] | null;
  /** Skips the debounce: runs `query` now. Resolves with its hits, or null if superseded or failed. */
  searchNow(query: string): Promise<SearchHit[] | null>;
}

/**
 * Results for `query`. Debounced; a response is applied only if no newer query (or clear) started
 * since its request, so a slow earlier search never overwrites a later one. `hits` may belong to an
 * older query while a new one is pending: compare `query` before acting on them.
 */
export function useSearchResults(query: string): SearchState {
  const [state, setState] = useState<{ query: string; hits: SearchHit[] | null }>({ query: "", hits: null });
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback((q: string): Promise<SearchHit[] | null> => {
    clearTimeout(timer.current);
    const ticket = (counter.current += 1);
    return backend
      .search(q)
      .then((found) => {
        if (ticket !== counter.current) return null;
        setState({ query: q, hits: found });
        return found;
      })
      .catch((e: unknown) => {
        if (ticket === counter.current) reportError(e);
        return null;
      });
  }, []);

  useEffect(() => {
    counter.current += 1;
    if (query.trim() === "") {
      setState({ query: "", hits: null });
      return;
    }
    timer.current = setTimeout(() => void run(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [query, run]);

  return { ...state, searchNow: run };
}

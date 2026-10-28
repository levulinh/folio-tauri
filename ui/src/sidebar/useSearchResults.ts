import { useEffect, useRef, useState } from "react";
import { backend } from "../backend";
import type { SearchHit } from "../backend/generated/SearchHit";
import { reportError } from "../state/uiStore";

export const SEARCH_DEBOUNCE_MS = 200;

/**
 * Results for `query` (null while the query is empty). Debounced; a response is applied only if no
 * newer query (or clear) happened since its request started, so a slow earlier search never
 * overwrites a later one.
 */
export function useSearchResults(query: string): SearchHit[] | null {
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    const ticket = (counter.current += 1);
    if (query.trim() === "") {
      setHits(null);
      return;
    }
    const timer = setTimeout(() => {
      backend
        .search(query)
        .then((found) => {
          if (ticket === counter.current) setHits(found);
        })
        .catch((e: unknown) => {
          if (ticket === counter.current) reportError(e);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return hits;
}

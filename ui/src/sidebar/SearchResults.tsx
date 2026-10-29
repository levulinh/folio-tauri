import type { SearchHit } from "../backend/generated/SearchHit";
import { vi } from "../i18n/vi";
import { openPage } from "../state/pageActions";
import { usePageStore } from "../state/pageStore";
import styles from "./SearchResults.module.css";

export function openHit(hit: SearchHit): void {
  openPage(hit.pageId);
}

/** Result list in the search dialog. Snippets are rendered as plain text. */
export function SearchResults({ hits, stale, onSelect = openHit }: { hits: SearchHit[] | null; stale: boolean; onSelect?(hit: SearchHit): void }) {
  const current = usePageStore((s) => s.pageId);
  if (hits === null) return null;
  if (hits.length === 0) {
    return (
      <div className={styles.empty} data-testid="search-empty">
        {vi.noResults}
      </div>
    );
  }
  return (
    <ul className={`${styles.list} ${stale ? styles.stale : ""}`} data-stale={stale}>
      {hits.map((hit) => (
        <li key={hit.pageId}>
          <button
            type="button"
            className={`${styles.result} ${current === hit.pageId ? styles.selected : ""}`}
            aria-current={current === hit.pageId ? "page" : undefined}
            data-testid="search-result"
            data-page-id={hit.pageId}
            disabled={stale}
            onClick={() => onSelect(hit)}
          >
            <span className={styles.title} data-testid="search-result-title">
              {hit.pageTitle === "" ? vi.untitled : hit.pageTitle}
            </span>
            {hit.snippet !== "" && <span className={styles.snippet}>{hit.snippet}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

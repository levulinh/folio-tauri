import type { SearchHit } from "../backend/generated/SearchHit";
import { vi } from "../i18n/vi";
import { usePageStore } from "../state/pageStore";
import { reportError } from "../state/uiStore";
import styles from "./SearchResults.module.css";

export function openHit(hit: SearchHit): void {
  usePageStore.getState().open(hit.pageId).catch(reportError);
}

/** Result list shown in place of the tree. Snippets are rendered as plain text. */
export function SearchResults({ hits }: { hits: SearchHit[] | null }) {
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
    <ul className={styles.list}>
      {hits.map((hit) => (
        <li key={hit.pageId}>
          <button
            type="button"
            className={`${styles.result} ${current === hit.pageId ? styles.selected : ""}`}
            data-testid="search-result"
            data-page-id={hit.pageId}
            onClick={() => openHit(hit)}
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

import { useEffect, useRef, useState } from "react";
import { backend } from "../backend";
import { vi } from "../i18n/vi";
import { useUiStore } from "../state/uiStore";
import { createAndOpenPage } from "../state/pageActions";
import { PageTree } from "./PageTree";
import { SearchBox } from "./SearchBox";
import { SearchResults, openHit } from "./SearchResults";
import { useSearchResults } from "./useSearchResults";
import styles from "./Sidebar.module.css";

export function Sidebar({ onOpenSettings }: { onOpenSettings?: (source?: HTMLElement) => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { query: hitsQuery, hits, searchNow } = useSearchResults(query);
  const searching = query.trim() !== "";

  useEffect(() => backend.onMenu("search", () => { if (!useUiStore.getState().settingsOpen) inputRef.current?.focus(); }), []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.drag} data-tauri-drag-region />
      <div className={styles.brand}><span className={styles.mark} aria-hidden="true">F</span>{vi.wordmark}</div>
      <SearchBox
        onQueryChange={setQuery}
        onEnter={() => {
          if (query.trim() === "") return;
          if (hitsQuery === query && hits) {
            if (hits[0]) openHit(hits[0]);
            return;
          }
          // Results belong to an older query (or none yet): search the typed query now.
          void searchNow(query).then((found) => {
            if (found?.[0]) openHit(found[0]);
          });
        }}
        inputRef={inputRef}
      />
      <div className={styles.section}>{vi.pagesSection}</div>
      <nav className={styles.scroll}>{searching ? <SearchResults hits={hits} stale={hitsQuery !== query} /> : <PageTree />}</nav>
      <div className={styles.bottom}>
        <button
          type="button"
          className={styles.newPage}
          data-testid="sidebar-new-page"
          onClick={() => void createAndOpenPage()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> {vi.newPage}
        </button>
        <button type="button" className={styles.newPage} data-testid="open-settings" onClick={(event) => onOpenSettings?.(event.currentTarget)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l1.6-1.2-1.5-2.6-1.9.7a7 7 0 0 0-1.8-1L15 5h-3l-.3 1.9a7 7 0 0 0-1.8 1L8 8.2 6.5 10.8 8.1 12a7 7 0 0 0 0 2l-1.6 1.2L8 17.8l1.9-.7a7 7 0 0 0 1.8 1L12 20h3l.3-1.9a7 7 0 0 0 1.8-1l1.9.7 1.5-2.6-1.6-1.2A7 7 0 0 0 19 12Z" /></svg> {vi.appearance.settings}</button>
      </div>
    </aside>
  );
}

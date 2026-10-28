import { useEffect, useRef, useState } from "react";
import { backend } from "../backend";
import { vi } from "../i18n/vi";
import { createAndOpenPage } from "../state/pageActions";
import { PageTree } from "./PageTree";
import { SearchBox } from "./SearchBox";
import { SearchResults, openHit } from "./SearchResults";
import { useSearchResults } from "./useSearchResults";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { query: hitsQuery, hits, searchNow } = useSearchResults(query);
  const searching = query.trim() !== "";

  useEffect(() => backend.onMenu("search", () => inputRef.current?.focus()), []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.drag} data-tauri-drag-region />
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
      <button
        type="button"
        className={styles.newPage}
        data-testid="sidebar-new-page"
        onClick={() => void createAndOpenPage()}
      >
        + {vi.newPage}
      </button>
    </aside>
  );
}

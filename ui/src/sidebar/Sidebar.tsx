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
  const hits = useSearchResults(query);
  const searching = query.trim() !== "";

  useEffect(() => backend.onMenu("search", () => inputRef.current?.focus()), []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.drag} data-tauri-drag-region />
      <SearchBox
        query={query}
        onQueryChange={setQuery}
        onEnter={() => {
          const first = hits?.[0];
          if (first) openHit(first);
        }}
        inputRef={inputRef}
      />
      <div className={styles.section}>{vi.pagesSection}</div>
      <nav className={styles.scroll}>{searching ? <SearchResults hits={hits} /> : <PageTree />}</nav>
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

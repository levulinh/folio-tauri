import { Plus, Settings, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { backend } from "../backend";
import { vi } from "../i18n/vi";
import { useUiStore } from "../state/uiStore";
import { createAndOpenPage } from "../state/pageActions";
import { PageTree } from "./PageTree";
import { SearchDialog } from "./SearchDialog";
import styles from "./Sidebar.module.css";

export function Sidebar({ onOpenSettings }: { onOpenSettings?: (source?: HTMLElement) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const openSearch = () => { if (!useUiStore.getState().settingsOpen) useUiStore.getState().setSearchOpen(true); };
  useEffect(() => backend.onMenu("search", () => { if (!useUiStore.getState().settingsOpen) useUiStore.getState().setSearchOpen(true); }), []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.drag} data-tauri-drag-region />
      <div className={styles.brand}><span className={styles.mark} aria-hidden="true">F</span>{vi.wordmark}</div>
      <button type="button" ref={triggerRef} className={styles.searchTrigger} id="folio-search-trigger" data-testid="search-open" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={openSearch}><Search size={16} aria-hidden="true" /><span>{vi.searchPlaceholder}</span></button>
      <SearchDialog restoreFocus={() => { if (!useUiStore.getState().settingsOpen) triggerRef.current?.focus(); }} opened={searchOpen} onClose={() => useUiStore.getState().setSearchOpen(false)} />
      <div className={styles.section}>{vi.pagesSection}</div>
      <nav className={styles.scroll}><PageTree /></nav>
      <div className={styles.bottom}>
        <button
          type="button"
          className={styles.newPage}
          data-testid="sidebar-new-page"
          onClick={() => void createAndOpenPage()}
        >
          <Plus size={18} aria-hidden="true" /> {vi.newPage}
        </button>
        <button type="button" className={styles.newPage} data-testid="open-settings" onClick={(event) => onOpenSettings?.(event.currentTarget)}><Settings size={18} aria-hidden="true" /> {vi.appearance.settings}</button>
      </div>
    </aside>
  );
}

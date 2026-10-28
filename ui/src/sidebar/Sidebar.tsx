import { vi } from "../i18n/vi";
import { createAndOpenPage } from "../state/pageActions";
import { PageTree } from "./PageTree";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.drag} data-tauri-drag-region />
      <div className={styles.section}>{vi.pagesSection}</div>
      <nav className={styles.scroll}>
        <PageTree />
      </nav>
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

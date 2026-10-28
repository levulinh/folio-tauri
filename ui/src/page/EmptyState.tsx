import { vi } from "../i18n/vi";
import { createAndOpenPage } from "../state/pageActions";
import styles from "./EmptyState.module.css";

export function EmptyState() {
  return (
    <div className={styles.empty}>
      <p>{vi.emptyState}</p>
      <button type="button" data-testid="empty-create-first" onClick={() => void createAndOpenPage()}>
        {vi.createFirstPage}
      </button>
    </div>
  );
}

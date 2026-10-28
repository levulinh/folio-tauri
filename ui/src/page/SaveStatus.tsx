import { vi } from "../i18n/vi";
import { usePageStore } from "../state/pageStore";
import styles from "./PageView.module.css";

const TEXT = { saved: vi.saved, saving: vi.saving, error: vi.saveError } as const;

/** Status dot + label for the active tab's save pipeline. */
export function SaveStatus() {
  const status = usePageStore((s) => s.saveStatus);
  return (
    <div className={styles.saveStatus} data-testid="save-status" data-status={status} role="status">
      <span className={styles.saveDot} />
      {TEXT[status]}
    </div>
  );
}

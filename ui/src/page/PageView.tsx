import { vi } from "../i18n/vi";
import { usePageStore } from "../state/pageStore";
import { usePagesStore } from "../state/pagesStore";
import styles from "./PageView.module.css";

/** Phase 1 Task 12: read-only title and an empty body; the editor arrives in Task 13. */
export function PageView() {
  const pageId = usePageStore((s) => s.pageId);
  const page = usePagesStore((s) => s.pages.find((p) => p.id === pageId));
  if (!page) return null;
  return (
    <article className={styles.page}>
      <h1
        className={`${styles.title} ${page.title === "" ? styles.placeholder : ""}`}
        data-testid="page-title"
      >
        {page.title === "" ? vi.untitled : page.title}
      </h1>
    </article>
  );
}

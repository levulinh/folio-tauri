import { vi } from "../i18n/vi";
import { usePagesStore } from "../state/pagesStore";
import { SaveStatus } from "./SaveStatus";
import styles from "./PageHeader.module.css";

/** Names come from the live page tree, including the current page. */
export function PageHeader({ pageId }: { pageId: string }) {
  const pages = usePagesStore((state) => state.pages);
  const byId = new Map(pages.map((page) => [page.id, page]));
  const path = [];
  const seen = new Set<string>();
  let current = byId.get(pageId);
  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  const active = path.pop();
  return (
    <header className={styles.header} data-testid="page-header">
      <div className={styles.breadcrumb} data-testid="page-breadcrumb">
        <span className={styles.ancestors}>
          {path.map((page) => <span className={styles.ancestor} key={page.id}><span className={styles.name}>{page.title || vi.untitled}</span><span aria-hidden="true">/</span></span>)}
        </span>
        {active && <span className={styles.active}>{active.title || vi.untitled}</span>}
      </div>
      <SaveStatus />
    </header>
  );
}

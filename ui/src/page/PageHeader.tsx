import { vi } from "../i18n/vi";
import { openPage } from "../state/pageActions";
import { usePagesStore } from "../state/pagesStore";
import { SaveStatus } from "./SaveStatus";
import styles from "./PageHeader.module.css";

/** Names come from the live page tree, including the current page. Ancestors navigate on click. */
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
          {path.map((page) => {
            const name = page.title || vi.untitled;
            return (
              <span className={styles.ancestor} key={page.id}>
                <button
                  type="button"
                  className={styles.name}
                  title={name}
                  data-testid="breadcrumb-ancestor"
                  data-page-id={page.id}
                  onClick={() => openPage(page.id)}
                >
                  {name}
                </button>
                <span aria-hidden="true">/</span>
              </span>
            );
          })}
        </span>
        {active && <span className={styles.active}>{active.title || vi.untitled}</span>}
      </div>
      <SaveStatus />
    </header>
  );
}

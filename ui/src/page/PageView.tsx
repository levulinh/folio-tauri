import { FindBar } from "../editor/find/FindBar";
import { Editor } from "../editor/Editor";
import { usePageStore } from "../state/pageStore";
import { usePagesStore } from "../state/pagesStore";
import { PageTitle } from "./PageTitle";
import { PageHeader } from "./PageHeader";
import styles from "./PageView.module.css";

/** One tab per page until Phase 4: the title above the editor of the active tab. */
export function PageView() {
  const pageId = usePageStore((s) => s.pageId);
  const activeTabId = usePageStore((s) => s.activeTabId);
  const exists = usePagesStore((s) => s.pages.some((p) => p.id === pageId));
  if (pageId === null || !exists) return null;
  return (
    <>
      <PageHeader pageId={pageId} />
      <article className={styles.page}>
        <PageTitle key={pageId} pageId={pageId} />
        <FindBar />
        {activeTabId !== null && <Editor key={activeTabId} tabId={activeTabId} />}
      </article>
    </>
  );
}

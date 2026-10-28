import { useState } from "react";
import type { PageMeta } from "../backend/generated/PageMeta";
import { vi } from "../i18n/vi";
import { usePageStore } from "../state/pageStore";
import { usePagesStore } from "../state/pagesStore";
import { reportError } from "../state/uiStore";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useExpandedStore } from "./expanded";
import { PageTreeItem } from "./PageTreeItem";
import styles from "./PageTree.module.css";

export function PageTree() {
  const pages = usePagesStore((s) => s.pages);
  const expanded = useExpandedStore((s) => s.expanded);
  const set = useExpandedStore((s) => s.set);
  const [doomed, setDoomed] = useState<PageMeta | null>(null);
  const roots = usePagesStore.getState().childrenOf(null);

  const confirmDelete = async () => {
    if (!doomed) return;
    const { id } = doomed;
    setDoomed(null);
    try {
      await usePagesStore.getState().remove(id);
      const open = usePageStore.getState().pageId;
      if (open !== null && !usePagesStore.getState().pages.some((p) => p.id === open)) {
        usePageStore.getState().close();
      }
    } catch (e) {
      reportError(e);
    }
  };

  return (
    <>
      <ul role="tree" className={styles.tree} data-count={pages.length}>
        {roots.map((p) => (
          <PageTreeItem
            key={p.id}
            page={p}
            depth={0}
            expanded={expanded}
            setExpanded={set}
            onRequestDelete={setDoomed}
          />
        ))}
      </ul>
      {doomed && (
        <ConfirmDialog
          message={vi.confirmDeletePage(
            doomed.title === "" ? vi.untitled : doomed.title,
            usePagesStore.getState().descendantCount(doomed.id),
          )}
          confirmLabel={vi.delete}
          onConfirm={confirmDelete}
          onCancel={() => setDoomed(null)}
        />
      )}
    </>
  );
}

import { useRef, useState } from "react";
import type { PageMeta } from "../backend/generated/PageMeta";
import { vi } from "../i18n/vi";
import { createAndOpenPage, openPage } from "../state/pageActions";
import { usePageStore } from "../state/pageStore";
import { usePagesStore } from "../state/pagesStore";
import { reportError } from "../state/uiStore";
import { Menu } from "../ui/Menu";
import styles from "./PageTreeItem.module.css";

const INDENT_PX = 14;

interface Props {
  page: PageMeta;
  depth: number;
  expanded: ReadonlySet<string>;
  setExpanded(id: string, open: boolean): void;
  onRequestDelete(page: PageMeta): void;
}

export function PageTreeItem({ page, depth, expanded, setExpanded, onRequestDelete }: Props) {
  usePagesStore((s) => s.pages); // re-render when the list changes
  const children = usePagesStore.getState().childrenOf(page.id);
  const selected = usePageStore((s) => s.pageId === page.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const isOpen = expanded.has(page.id);

  const addChild = async () => {
    setExpanded(page.id, true);
    await createAndOpenPage(page.id);
  };

  return (
    <li role="none">
      <div
        className={`${styles.row} ${selected ? styles.selected : ""}`}
        style={{ paddingLeft: 6 + depth * INDENT_PX }}
        role="treeitem"
        aria-selected={selected}
        aria-expanded={children.length > 0 ? isOpen : undefined}
        tabIndex={0}
        data-testid="tree-item"
        data-page-id={page.id}
        onClick={() => openPage(page.id)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && e.key === "Enter") openPage(page.id);
        }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            className={`${styles.toggle} ${isOpen ? styles.open : ""}`}
            aria-label={isOpen ? vi.collapse : vi.expand}
            data-testid="tree-item-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(page.id, !isOpen);
            }}
          >
            ▸
          </button>
        ) : (
          <span className={styles.toggle} aria-hidden />
        )}
        {renaming ? (
          <RenameInput page={page} onDone={() => setRenaming(false)} />
        ) : (
          <span
            className={`${styles.title} ${page.title === "" ? styles.placeholder : ""}`}
            data-testid="tree-item-title"
          >
            {page.title === "" ? vi.untitled : page.title}
          </span>
        )}
        {!renaming && (
          <span className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label={vi.newSubpage}
              title={vi.newSubpage}
              data-testid="tree-item-add-child"
              onClick={addChild}
            >
              +
            </button>
            <button
              type="button"
              aria-label={vi.moreActions}
              title={vi.moreActions}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              data-testid="tree-item-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
          </span>
        )}
        {menuOpen && (
          <Menu
            onClose={() => setMenuOpen(false)}
            items={[
              { label: vi.rename, testId: "menu-rename", onSelect: () => setRenaming(true) },
              { label: vi.newSubpage, testId: "menu-add-child", onSelect: addChild },
              {
                label: vi.delete,
                testId: "menu-delete",
                danger: true,
                onSelect: () => onRequestDelete(page),
              },
            ]}
          />
        )}
      </div>
      {isOpen && children.length > 0 && (
        <ul role="group" className={styles.children}>
          {children.map((c) => (
            <PageTreeItem
              key={c.id}
              page={c}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Inline rename: Enter commits, Escape cancels, blur commits. */
function RenameInput({ page, onDone }: { page: PageMeta; onDone(): void }) {
  const finished = useRef(false);
  const finish = (commit: boolean, value: string) => {
    if (finished.current) return;
    finished.current = true;
    onDone();
    const title = value.trim();
    if (commit && title !== page.title) {
      usePagesStore.getState().rename(page.id, title).catch(reportError);
    }
  };
  return (
    <input
      className={styles.rename}
      data-testid="tree-item-rename"
      defaultValue={page.title}
      placeholder={vi.untitled}
      aria-label={vi.rename}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true, e.currentTarget.value);
        else if (e.key === "Escape") finish(false, "");
      }}
      onBlur={(e) => finish(true, e.currentTarget.value)}
    />
  );
}

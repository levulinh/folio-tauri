import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { FileText } from "lucide-react";
import { vi } from "../../i18n/vi";
import { useExpandedStore } from "../../state/expanded";
import { openPage } from "../../state/pageActions";
import { usePageStore } from "../../state/pageStore";
import { usePagesStore } from "../../state/pagesStore";
import { reportError, useUiStore } from "../../state/uiStore";
import type { FolioEditor } from "../schema";
import "./subpage.css";

/** A link row to a child page. The page owns its title; this block only stores its id. */
export const subpageSpec = createReactBlockSpec(
  {
    type: "folioSubpage",
    propSchema: { pageId: { default: "" } },
    content: "none",
  },
  {
    render: function Subpage({ block }) {
      const page = usePagesStore((s) => s.pages.find((p) => p.id === block.props.pageId));
      const title = page ? page.title || vi.untitled : vi.subpageMissing;
      return (
        <button
          type="button"
          className="folio-subpage"
          data-testid="subpage-row"
          data-page-id={block.props.pageId}
          data-missing={page === undefined}
          title={title}
          disabled={page === undefined}
          onClick={() => { if (page) openPage(page.id); }}
          // Enter/Space on the focused row must open the page, not insert a block in the editor.
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }}
        >
          <FileText className="folio-subpage__icon" size={18} aria-hidden="true" />
          <span className={`folio-subpage__title${page && page.title === "" ? " folio-subpage__title--untitled" : ""}`}>{title}</span>
        </button>
      );
    },
  },
)();

/**
 * Slash-menu action: create a page under the open one, link it at the caret, then open it.
 * Resolves to the new page id, or null when no page is open or creation failed.
 */
export async function insertSubpage(editor: FolioEditor): Promise<string | null> {
  const parentId = usePageStore.getState().pageId;
  if (parentId === null) return null;
  let created;
  try {
    created = await usePagesStore.getState().create(parentId);
  } catch (e) {
    reportError(e);
    return null;
  }
  const pageId = created.page.id;
  // The user may have left the page while the page was being created: the child exists, but
  // the captured editor no longer holds the document the row belongs to.
  if (usePageStore.getState().pageId === parentId) {
    insertOrUpdateBlockForSlashMenu(editor, { type: "folioSubpage", props: { pageId } });
    useExpandedStore.getState().set(parentId, true);
  }
  useUiStore.getState().requestTitleFocus(pageId);
  openPage(pageId);
  return pageId;
}

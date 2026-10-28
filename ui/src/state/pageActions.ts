import { isErrorPayload } from "../backend/Backend";
import { useExpandedStore } from "../sidebar/expanded";
import { usePageStore } from "./pageStore";
import { usePagesStore } from "./pagesStore";
import { reportError, useUiStore } from "./uiStore";

/** Creates a page (under `parentId`) and opens it; failures become a toast. Resolves to the new id. */
export async function createAndOpenPage(parentId?: string): Promise<string | null> {
  try {
    const { page } = await usePagesStore.getState().create(parentId);
    if (parentId !== undefined) useExpandedStore.getState().set(parentId, true);
    useUiStore.getState().requestTitleFocus(page.id);
    await usePageStore.getState().open(page.id);
    // open() resolves quietly when a newer open() won; then the request is stale.
    if (usePageStore.getState().pageId !== page.id) useUiStore.getState().clearTitleFocus();
    return page.id;
  } catch (e) {
    useUiStore.getState().clearTitleFocus();
    reportError(e);
    return null;
  }
}

/** Opens a page; a failure becomes a toast. A vanished page (not_found) is also dropped from the sidebar list. */
export function openPage(id: string): void {
  usePageStore
    .getState()
    .open(id)
    .catch((e: unknown) => {
      reportError(e);
      if (isErrorPayload(e) && e.code === "not_found") usePagesStore.getState().load().catch(reportError);
    });
}

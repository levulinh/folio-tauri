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
    return page.id;
  } catch (e) {
    reportError(e);
    return null;
  }
}

export function openPage(id: string): void {
  usePageStore.getState().open(id).catch(reportError);
}

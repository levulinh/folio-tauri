import { usePageStore } from "./pageStore";
import { usePagesStore } from "./pagesStore";
import { reportError } from "./uiStore";

/** Creates a page (under `parentId`) and opens it; failures become a toast. Resolves to the new id. */
export async function createAndOpenPage(parentId?: string): Promise<string | null> {
  try {
    const { page } = await usePagesStore.getState().create(parentId);
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

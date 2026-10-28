import { create } from "zustand";
import { backend } from "../backend";
import type { TabMeta } from "../backend/generated/TabMeta";
import { flushAll } from "../editor/pipelineRegistry";

interface PageState {
  pageId: string | null;
  tabs: TabMeta[];
  activeTabId: string | null;
  open(pageId: string): Promise<void>;
  close(): void;
}

let latestOpen = 0;

export const usePageStore = create<PageState>((set, get) => ({
  pageId: null,
  tabs: [],
  activeTabId: null,
  async open(pageId) {
    if (get().pageId === pageId) return;
    const ticket = (latestOpen += 1);
    await flushAll();
    const tabs = await backend.tabsList(pageId);
    if (ticket !== latestOpen) return; // a newer open() won
    set({ pageId, tabs, activeTabId: tabs[0]?.id ?? null });
  },
  close() {
    latestOpen += 1;
    set({ pageId: null, tabs: [], activeTabId: null });
  },
}));

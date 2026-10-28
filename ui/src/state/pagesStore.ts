import { create } from "zustand";
import { backend } from "../backend";
import type { Backend } from "../backend/Backend";
import type { CreatedPage } from "../backend/generated/CreatedPage";
import type { PageMeta } from "../backend/generated/PageMeta";

type PagesApi = Pick<Backend, "pagesList" | "pageCreate" | "pageRename" | "pageDelete">;

interface PagesState {
  pages: PageMeta[];
  /** False until the first `load()` finishes, so the empty state does not flash. */
  loaded: boolean;
  load(): Promise<void>;
  create(parentId?: string): Promise<CreatedPage>;
  rename(id: string, title: string): Promise<void>;
  remove(id: string): Promise<void>;
  childrenOf(parentId: string | null): PageMeta[];
  descendantCount(id: string): number;
}

const byOrder = (a: PageMeta, b: PageMeta) =>
  a.orderKey === b.orderKey ? (a.id < b.id ? -1 : 1) : a.orderKey < b.orderKey ? -1 : 1;

export function createPagesStore(api: PagesApi) {
  return create<PagesState>((set, get) => ({
    pages: [],
    loaded: false,
    async load() {
      set({ pages: await api.pagesList(), loaded: true });
    },
    async create(parentId) {
      const created = await api.pageCreate(parentId);
      set({ pages: await api.pagesList() });
      return created;
    },
    async rename(id, title) {
      const updated = await api.pageRename(id, title);
      set((s) => ({ pages: s.pages.map((p) => (p.id === id ? updated : p)) }));
    },
    async remove(id) {
      const removed = new Set(await api.pageDelete(id));
      set((s) => ({ pages: s.pages.filter((p) => !removed.has(p.id)) }));
    },
    childrenOf: (parentId) => get().pages.filter((p) => p.parentId === parentId).sort(byOrder),
    descendantCount(id) {
      const { pages } = get();
      let count = 0;
      const walk = (parent: string) => {
        for (const p of pages) {
          if (p.parentId === parent) {
            count += 1;
            walk(p.id);
          }
        }
      };
      walk(id);
      return count;
    },
  }));
}

export const usePagesStore = createPagesStore(backend);

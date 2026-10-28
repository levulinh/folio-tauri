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
  /** Last rename request per page: renames of one page run one after another, so the latest typed title wins. */
  const renameChain = new Map<string, Promise<unknown>>();
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
      const previous = renameChain.get(id) ?? Promise.resolve();
      const run = previous.then(
        () => api.pageRename(id, title),
        () => api.pageRename(id, title),
      );
      const settled = run.then(
        () => undefined,
        () => undefined,
      );
      renameChain.set(id, settled);
      void settled.then(() => {
        if (renameChain.get(id) === settled) renameChain.delete(id);
      });
      const updated = await run;
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

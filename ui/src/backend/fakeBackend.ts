import { applyOps, depthFirst, notFound, toTree } from "./fakeApply";
import { plainText, searchPages, type BlockRec, type PageTexts } from "./fakeSearch";
import type { Backend, MenuEvent } from "./Backend";
import type { PageMeta } from "./generated/PageMeta";
import type { TabMeta } from "./generated/TabMeta";

const SEARCH_LIMIT = 50;

/** Pages keep sibling order by array position; `orderKey` is derived when listing. */
interface State {
  readonly pages: readonly PageMeta[];
  readonly tabs: readonly TabMeta[];
  readonly blocks: Readonly<Record<string, readonly BlockRec[]>>;
}

const EMPTY: State = { pages: [], tabs: [], blocks: {} };

export type FakeBackend = Backend & {
  emitMenu(name: MenuEvent): void;
  /** Simulates the shell's `flush-request`; resolves when every subscriber has finished. */
  emitFlushRequest(): Promise<void>;
};

function load(key: string | undefined): State {
  if (!key) return EMPTY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<State>;
    if (!Array.isArray(parsed.pages) || !Array.isArray(parsed.tabs) || !parsed.blocks) return EMPTY;
    return { pages: parsed.pages, tabs: parsed.tabs, blocks: parsed.blocks };
  } catch {
    return EMPTY;
  }
}

function withKeys(pages: readonly PageMeta[]): PageMeta[] {
  const seen = new Map<string | null, number>();
  const keyed = pages.map((p) => {
    const n = seen.get(p.parentId) ?? 0;
    seen.set(p.parentId, n + 1);
    return { ...p, orderKey: String(n).padStart(8, "0") };
  });
  return keyed.sort((a, b) => {
    const pa = a.parentId ?? "";
    const pb = b.parentId ?? "";
    return pa === pb ? (a.orderKey < b.orderKey ? -1 : 1) : pa < pb ? -1 : 1;
  });
}

function descendantIds(pages: readonly PageMeta[], root: string): Set<string> {
  const out = new Set([root]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of pages) {
      if (p.parentId !== null && out.has(p.parentId) && !out.has(p.id)) {
        out.add(p.id);
        grew = true;
      }
    }
  }
  return out;
}

export function createFakeBackend(opts: { persistKey?: string } = {}): FakeBackend {
  let state = load(opts.persistKey);
  const menuListeners = new Map<MenuEvent, Set<() => void>>();
  const flushListeners = new Set<() => Promise<void>>();

  const commit = (next: State) => {
    state = next;
    if (!opts.persistKey) return;
    try {
      localStorage.setItem(opts.persistKey, JSON.stringify(state));
    } catch {
      /* storage unavailable or full: the fake just stays in memory */
    }
  };
  const keyed = (id: string): PageMeta => withKeys(state.pages).find((p) => p.id === id)!;
  const tabBlocks = (tabId: string): readonly BlockRec[] => {
    if (!state.tabs.some((t) => t.id === tabId)) throw notFound(tabId);
    return state.blocks[tabId] ?? [];
  };

  return {
    async pagesList() {
      return withKeys(state.pages);
    },

    async pageCreate(parentId, afterId) {
      if (parentId !== undefined && !state.pages.some((p) => p.id === parentId)) {
        throw notFound(parentId);
      }
      const parent = parentId ?? null;
      if (afterId !== undefined && !state.pages.some((p) => p.id === afterId && p.parentId === parent)) {
        throw notFound(afterId);
      }
      const now = Date.now();
      const page: PageMeta = {
        id: crypto.randomUUID(),
        parentId: parent,
        title: "",
        orderKey: "",
        createdAt: now,
        updatedAt: now,
      };
      const tab: TabMeta = { id: crypto.randomUUID(), pageId: page.id, name: "", orderKey: "a0" };
      const at = afterId === undefined ? state.pages.length : state.pages.findIndex((p) => p.id === afterId) + 1;
      commit({
        ...state,
        pages: [...state.pages.slice(0, at), page, ...state.pages.slice(at)],
        tabs: [...state.tabs, tab],
      });
      return { page: keyed(page.id), tab };
    },

    async pageRename(id, title) {
      if (!state.pages.some((p) => p.id === id)) throw notFound(id);
      commit({
        ...state,
        pages: state.pages.map((p) => (p.id === id ? { ...p, title, updatedAt: Date.now() } : p)),
      });
      return keyed(id);
    },

    async pageDelete(id) {
      if (!state.pages.some((p) => p.id === id)) throw notFound(id);
      const doomed = descendantIds(state.pages, id);
      const doomedTabs = new Set(state.tabs.filter((t) => doomed.has(t.pageId)).map((t) => t.id));
      commit({
        pages: state.pages.filter((p) => !doomed.has(p.id)),
        tabs: state.tabs.filter((t) => !doomedTabs.has(t.id)),
        blocks: Object.fromEntries(Object.entries(state.blocks).filter(([k]) => !doomedTabs.has(k))),
      });
      return [...doomed];
    },

    async tabsList(pageId) {
      if (!state.pages.some((p) => p.id === pageId)) throw notFound(pageId);
      return state.tabs.filter((t) => t.pageId === pageId);
    },

    async tabLoad(tabId) {
      return structuredClone(toTree(tabBlocks(tabId)));
    },

    async tabApply(tabId, ops) {
      const current = tabBlocks(tabId);
      const inOtherTab = (id: string) =>
        Object.entries(state.blocks).some(([k, recs]) => k !== tabId && recs.some((r) => r.id === id));
      const next = applyOps(current, ops, inOtherTab);
      const pageId = state.tabs.find((t) => t.id === tabId)!.pageId;
      const pageUpdatedAt = Date.now();
      commit({
        ...state,
        pages: state.pages.map((p) => (p.id === pageId ? { ...p, updatedAt: pageUpdatedAt } : p)),
        blocks: { ...state.blocks, [tabId]: next },
      });
      return { applied: ops.length, pageUpdatedAt };
    },

    async search(query) {
      const pages: PageTexts[] = withKeys(state.pages).map((page) => ({
        page,
        texts: state.tabs
          .filter((t) => t.pageId === page.id)
          .flatMap((t) => depthFirst(state.blocks[t.id] ?? []).map(plainText)),
      }));
      return searchPages(pages, query).slice(0, SEARCH_LIMIT);
    },

    onMenu(name, cb) {
      const set = menuListeners.get(name) ?? new Set();
      set.add(cb);
      menuListeners.set(name, set);
      return () => void set.delete(cb);
    },
    emitMenu(name) {
      [...(menuListeners.get(name) ?? [])].forEach((cb) => cb());
    },
    onFlushRequest(cb) {
      flushListeners.add(cb);
      return () => void flushListeners.delete(cb);
    },
    async emitFlushRequest() {
      await Promise.all([...flushListeners].map((cb) => cb()));
    },
    async quitReady() {},
  };
}

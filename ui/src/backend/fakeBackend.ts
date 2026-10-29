import { imageMime } from "./imageValidation";
import type { AssetMeta } from "./generated/AssetMeta";
import { applyOps, depthFirst, notFound, toTree } from "./fakeApply";
import { plainText, searchPages, type BlockRec, type PageTexts } from "./fakeSearch";
import type { Backend, MenuEvent } from "./Backend";
import type { Appearance } from "./generated/Appearance";
import type { PageMeta } from "./generated/PageMeta";
import type { TabMeta } from "./generated/TabMeta";

const SEARCH_LIMIT = 50;

/** Pages keep sibling order by array position; `orderKey` is derived when listing. */
interface State {
  readonly assets?: Readonly<Record<string, { meta: AssetMeta; data: string }>>;
  readonly appearance: Appearance;
  readonly pages: readonly PageMeta[];
  readonly tabs: readonly TabMeta[];
  readonly blocks: Readonly<Record<string, readonly BlockRec[]>>;
}

const DEFAULT_APPEARANCE: Appearance = { mode: "system", accent: "neutral" };
const EMPTY: State = { appearance: DEFAULT_APPEARANCE, pages: [], tabs: [], blocks: {} };

function parseAppearance(value: unknown): Appearance | null {
  if (typeof value !== "object" || value === null) return null;
  const { mode, accent } = value as Record<string, unknown>;
  if ((mode !== "system" && mode !== "light" && mode !== "dark") ||
      (accent !== "neutral" && accent !== "blue" && accent !== "olive" && accent !== "purple")) return null;
  return { mode, accent };
}

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
    return { assets: parsed.assets ?? {}, appearance: parseAppearance(parsed.appearance) ?? DEFAULT_APPEARANCE, pages: parsed.pages, tabs: parsed.tabs, blocks: parsed.blocks };
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
    if (opts.persistKey) {
      try { localStorage.setItem(opts.persistKey, JSON.stringify(next)); }
      catch (e) { throw { code: "io", message: String(e) }; }
    }
    state = next;
  };
  const keyed = (id: string): PageMeta => withKeys(state.pages).find((p) => p.id === id)!;
  const tabBlocks = (tabId: string): readonly BlockRec[] => {
    if (!state.tabs.some((t) => t.id === tabId)) throw notFound(tabId);
    return state.blocks[tabId] ?? [];
  };

  return {
    async assetImport(file) {
      if (file.size > 20 * 1024 * 1024) throw { code: "invalid_op", message: "Image exceeds 20 MiB" };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = imageMime(file.name, bytes);
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
      const existing = Object.values(state.assets ?? {}).find((a) => a.meta.sha256 === sha256);
      if (existing) return existing.meta;
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(new Blob([bytes], { type: mime })); });
      const meta: AssetMeta = { id: crypto.randomUUID(), fileName: file.name, mime, ext: mime.split("/")[1]!.replace("jpeg", "jpg"), byteSize: bytes.length, sha256, createdAt: Date.now() };
      const next = { ...state, assets: { ...state.assets, [meta.id]: { meta, data } } };
      if (opts.persistKey) { try { localStorage.setItem(opts.persistKey, JSON.stringify(next)); } catch { throw { code: "io", message: "Image storage full" }; } }
      state = next;
      return meta;
    },
    assetDisplayUrl(url) { return url.startsWith("folio-asset:") ? state.assets?.[url.slice(12)]?.data ?? "" : ""; },
    async appearanceGet() {
      return { ...state.appearance };
    },
    async appearanceSet(appearance) {
      const value = parseAppearance(appearance);
      if (!value) throw { code: "invalid_op", message: "Invalid appearance" };
      const next = { ...state, appearance: value };
      if (opts.persistKey) {
        try {
          localStorage.setItem(opts.persistKey, JSON.stringify(next));
        } catch (e) {
          throw { code: "db", message: String(e) };
        }
      }
      state = next;
    },
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
        ...state,
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

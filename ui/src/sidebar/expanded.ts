import { create } from "zustand";

const KEY = "folio.tree.expanded";

function read(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function write(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable: expanded state just isn't remembered */
  }
}

interface ExpandedState {
  expanded: ReadonlySet<string>;
  set(id: string, open: boolean): void;
}

/** Which tree nodes are expanded, persisted in `localStorage["folio.tree.expanded"]`. */
export const useExpandedStore = create<ExpandedState>((setState, get) => ({
  expanded: read(),
  set(id, open) {
    const prev = get().expanded;
    if (prev.has(id) === open) return;
    const next = new Set(prev);
    if (open) next.add(id);
    else next.delete(id);
    write(next);
    setState({ expanded: next });
  },
}));

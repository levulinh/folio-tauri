import { useCallback, useState } from "react";

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

/** Which tree nodes are expanded, persisted in `localStorage["folio.tree.expanded"]`. */
export function useExpanded() {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(read);
  const set = useCallback((id: string, open: boolean) => {
    setExpanded((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      write(next);
      return next;
    });
  }, []);
  return { expanded, set };
}

import type { Backend } from "../backend/Backend";
import { isErrorPayload } from "../backend/Backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import type { BlockOp } from "../backend/generated/BlockOp";
import { vi } from "../i18n/vi";
import { useUiStore } from "../state/uiStore";
import { toStored } from "./convert";
import type { FolioEditor } from "./schema";

export type SaveStatus = "saved" | "saving" | "error";

export interface SavePipeline {
  /** Sends every pending change; resolves once it was attempted (never rejects). */
  flush(): Promise<void>;
  dispose(): void;
  /**
   * Stops this pipeline for good (no timers, no new requests), waits for an in-flight request and
   * returns what it still owes the backend, for a new pipeline on the same tab to adopt.
   */
  handOff(): Promise<PipelineHandOff>;
  status(): SaveStatus;
  onStatus(cb: (s: SaveStatus) => void): () => void;
}

export interface PipelineHandOff {
  ids: string[];
  needsResync: boolean;
}

export interface SavePipelineOptions {
  tabId: string;
  editor: FolioEditor;
  /** `tabLoad` is only used by the full resync after an `invalid_op` (decisions D-014). */
  backend: Pick<Backend, "tabApply" | "tabLoad">;
  debounceMs?: number;
  maxWaitMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  onError?: (e: unknown) => void;
  /**
   * Ids of the blocks the backend has. Document blocks outside it (BlockNote's default block on an
   * empty page, blocks adopted from a retired editor) are marked dirty at creation.
   */
  storedIds?: Iterable<string>;
  /** Unsaved work of a retired pipeline on the same tab (see `handOff`). */
  adopt?: PipelineHandOff;
}

type Doc = FolioEditor["document"];
type Upsert = Extract<BlockOp, { op: "upsert" }>;

interface Placed {
  block: Doc[number];
  parentId: string | null;
  prevSiblingId: string | null;
}

/** One depth-first walk: every block with its parent and previous sibling, in document order. */
function place(blocks: Doc, parentId: string | null, out: Map<string, Placed>): Map<string, Placed> {
  let prev: string | null = null;
  for (const block of blocks) {
    out.set(block.id, { block, parentId, prevSiblingId: prev });
    place(block.children as Doc, block.id, out);
    prev = block.id;
  }
  return out;
}

function toUpsert(id: string, p: Placed): Upsert {
  const stored = toStored(p.block as never);
  return { op: "upsert", id, parentId: p.parentId, prevSiblingId: p.prevSiblingId, ...stored };
}

function descendantIds(block: { children?: unknown }, into: Set<string>): void {
  for (const child of (block.children ?? []) as { id: string; children?: unknown }[]) {
    into.add(child.id);
    descendantIds(child, into);
  }
}

function storedIds(nodes: BlockNode[], into: Set<string>): Set<string> {
  for (const n of nodes) {
    into.add(n.id);
    storedIds(n.children, into);
  }
  return into;
}

const errorCode = (e: unknown): string => (isErrorPayload(e) ? e.code : "");

/** Runs a callback that must never break the save path (toast, listeners, error hook). */
function safely(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.error("save pipeline: callback threw", e);
  }
}

const logError = (e: unknown) => console.error("save pipeline error", e);

export function createSavePipeline(o: SavePipelineOptions): SavePipeline {
  const onError = o.onError ?? logError;
  const debounceMs = o.debounceMs ?? 600;
  const maxWaitMs = o.maxWaitMs ?? 3000;
  const retryBaseMs = o.retryBaseMs ?? 2000;
  const retryMaxMs = o.retryMaxMs ?? 30000;

  let dirty = new Set<string>();
  let inFlight = false;
  let queue: Promise<void> = Promise.resolve();
  let errored = false;
  let toasted = false;
  let needsResync = false;
  let failures = 0;
  let disposed = false;
  let firstDirtyAt = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let last: SaveStatus = "saved";
  const listeners = new Set<(s: SaveStatus) => void>();

  const status = (): SaveStatus => (disposed ? "saved" : errored ? "error" : dirty.size > 0 || inFlight || needsResync ? "saving" : "saved");
  const emit = () => {
    const s = status();
    if (s === last) return;
    last = s;
    for (const cb of [...listeners]) safely(() => cb(s));
  };

  const schedule = () => {
    if (disposed || errored) return; // while failing, the backoff timer drives retries
    const now = Date.now();
    const delay = Math.max(0, Math.min(debounceMs, firstDirtyAt + maxWaitMs - now));
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void flush(), delay);
  };

  const unsubscribe = o.editor.onChange((_editor, { getChanges }) => {
    if (disposed) return;
    const before = dirty.size;
    for (const change of getChanges()) {
      if (change.source.type === "yjs-remote") continue;
      dirty.add(change.block.id);
      if (change.type === "delete" || change.type === "insert") {
        descendantIds(change.block, dirty);
      }
    }
    if (dirty.size === 0) return;
    if (before === 0) firstDirtyAt = Date.now();
    schedule();
    emit();
  }, false);

  if (o.storedIds) {
    const stored = new Set(o.storedIds);
    for (const id of place(o.editor.document, null, new Map()).keys()) if (!stored.has(id)) dirty.add(id);
  }
  if (o.adopt) {
    for (const id of o.adopt.ids) dirty.add(id);
    needsResync = o.adopt.needsResync;
  }
  last = status();

  /** Every block of the document plus a delete for stored blocks the document no longer has. */
  async function resyncOps(): Promise<BlockOp[]> {
    const placed = place(o.editor.document, null, new Map());
    const stored = storedIds(await o.backend.tabLoad(o.tabId), new Set());
    const ops: BlockOp[] = [...placed].map(([id, p]) => toUpsert(id, p));
    const gone = [...stored].filter((id) => !placed.has(id));
    if (gone.length > 0) ops.push({ op: "delete", ids: gone });
    return ops;
  }

  function incrementalOps(ids: Set<string>): BlockOp[] {
    const placed = place(o.editor.document, null, new Map());
    const ops: BlockOp[] = [];
    for (const [id, p] of placed) if (ids.has(id)) ops.push(toUpsert(id, p));
    const gone = [...ids].filter((id) => !placed.has(id));
    if (gone.length > 0) ops.push({ op: "delete", ids: gone });
    return ops;
  }

  function fail(e: unknown, taken: Set<string>, startedAt: number): void {
    safely(() => onError(e));
    if (errorCode(e) === "not_found") {
      // The tab or page was deleted: nothing left to save.
      dirty = new Set();
      errored = false;
      needsResync = false;
      emit();
      dispose();
      return;
    }
    if (errorCode(e) === "invalid_op") {
      // Retrying the same batch would fail forever: next attempt resends the whole tab.
      console.error("save pipeline: invalid_op, resyncing the tab", e);
      needsResync = true;
    }
    for (const id of taken) dirty.add(id);
    if (disposed) return; // handed off: the adopting pipeline owns these ids now
    firstDirtyAt = Math.min(firstDirtyAt, startedAt);
    clearTimeout(debounceTimer); // retries follow the backoff only
    errored = true;
    if (!toasted) {
      toasted = true;
      safely(() => useUiStore.getState().toast(vi.errors.saveFailed));
    }
    const delay = Math.min(retryBaseMs * 2 ** failures, retryMaxMs);
    failures += 1;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void flush();
    }, delay);
    emit();
  }

  async function run(): Promise<void> {
    if (disposed) return;
    if (dirty.size === 0 && !needsResync) return;
    clearTimeout(debounceTimer);
    const startedAt = firstDirtyAt;
    const taken = dirty;
    dirty = new Set();
    inFlight = true;
    emit();
    try {
      const ops = needsResync ? await resyncOps() : incrementalOps(taken);
      if (ops.length > 0) await o.backend.tabApply(o.tabId, ops);
      needsResync = false;
      errored = false;
      toasted = false;
      failures = 0;
      clearTimeout(retryTimer);
      retryTimer = undefined;
    } catch (e) {
      inFlight = false;
      fail(e, taken, startedAt);
      return;
    }
    inFlight = false;
    emit();
    if (dirty.size > 0) {
      firstDirtyAt = Date.now();
      schedule();
    }
  }

  function flush(): Promise<void> {
    queue = queue.then(run).catch(logError);
    return queue;
  }

  function dispose(): void {
    disposed = true;
    unsubscribe();
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
  }

  async function handOff(): Promise<PipelineHandOff> {
    disposed = true;
    unsubscribe();
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
    await queue;
    return { ids: [...dirty], needsResync };
  }

  // Unsaved state at creation (default block, adopted work) is sent like any change.
  if (dirty.size > 0 || needsResync) {
    firstDirtyAt = Date.now();
    schedule();
  }

  return {
    flush,
    dispose,
    handOff,
    status,
    onStatus(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

import type { Backend } from "../backend/Backend";
import { isErrorPayload } from "../backend/Backend";
import { SAVE_DEBOUNCE_MS } from "./saveTiming";
import type { BlockNode } from "../backend/generated/BlockNode";
import type { BlockOp } from "../backend/generated/BlockOp";
import { vi } from "../i18n/vi";
import { useUiStore } from "../state/uiStore";
import { toStored } from "./convert";
import type { FolioEditor } from "./schema";

export type SaveStatus = "saved" | "saving" | "error";

/**
 * Saves one tab. It outlives editor instances: editors `attach` and `detach`, the dirty set stays
 * here, so unsaved work can never be dropped by a hand-over between pipelines (decisions D-014).
 */
export interface SavePipeline {
  readonly tabId: string;
  /** Sends every pending change; resolves once it was attempted (never rejects). */
  flush(): Promise<void>;
  /** Stops for good (no timers, no subscription). Pending work is abandoned. */
  dispose(): void;
  status(): SaveStatus;
  onStatus(cb: (s: SaveStatus) => void): () => void;
  /** Makes `editor` the source of changes and of the document; blocks it has that are not known to be stored become dirty. */
  attach(editor: FolioEditor): void;
  /** Unsubscribes if `editor` is the attached one, flushes now, keeps it as the document source; disposes once clean. */
  detach(editor: FolioEditor): void;
  /** Ids the backend is known to have (from the loaded tree). Ignored once seeded. */
  seedStoredIds(ids: Iterable<string>): void;
  /** Known stored ids, or null before seeding. */
  storedIds(): string[] | null;
  /** True while changes are unsent, in flight or failing. */
  isPending(): boolean;
  /** The current document of the editor that feeds this pipeline (null before the first attach). */
  document(): FolioEditor["document"] | null;
}

export interface SavePipelineOptions {
  tabId: string;
  /** `tabLoad` is only used by the full resync after an `invalid_op` (decisions D-014). */
  backend: Pick<Backend, "tabApply" | "tabLoad">;
  /** Convenience: attach this editor at creation. */
  editor?: FolioEditor;
  /** Convenience: seed the stored ids at creation. */
  storedIds?: Iterable<string>;
  debounceMs?: number;
  maxWaitMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  onError?: (e: unknown) => void;
  /** Called once when the pipeline disposes itself or is disposed (the registry drops it). */
  onDispose?: () => void;
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

function storedIdsOf(nodes: BlockNode[], into: Set<string>): Set<string> {
  for (const n of nodes) {
    into.add(n.id);
    storedIdsOf(n.children, into);
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
  const debounceMs = o.debounceMs ?? SAVE_DEBOUNCE_MS;
  const maxWaitMs = o.maxWaitMs ?? 3000;
  const retryBaseMs = o.retryBaseMs ?? 2000;
  const retryMaxMs = o.retryMaxMs ?? 30000;

  let dirty = new Set<string>();
  let stored: Set<string> | null = null;
  let source: FolioEditor | null = null; // document source (stays after detach)
  let attached: FolioEditor | null = null;
  let unsubscribe: (() => void) | null = null;
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

  const isPending = () => dirty.size > 0 || inFlight || errored || needsResync;
  const status = (): SaveStatus => (disposed ? "saved" : errored ? "error" : isPending() ? "saving" : "saved");
  const emit = () => {
    const s = status();
    if (s === last) return;
    last = s;
    for (const cb of [...listeners]) safely(() => cb(s));
  };

  const schedule = () => {
    if (disposed || errored) return; // while failing, the backoff timer drives retries
    const delay = Math.max(0, Math.min(debounceMs, firstDirtyAt + maxWaitMs - Date.now()));
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void flush(), delay);
  };

  const markDirty = (ids: Iterable<string>) => {
    const before = dirty.size;
    for (const id of ids) dirty.add(id);
    if (dirty.size === 0) return;
    if (before === 0) firstDirtyAt = Date.now();
    schedule();
    emit();
  };

  function attach(editor: FolioEditor): void {
    if (disposed) return;
    unsubscribe?.();
    source = editor;
    attached = editor;
    unsubscribe = editor.onChange((_e, { getChanges }) => {
      if (disposed || attached !== editor) return;
      const ids = new Set<string>();
      for (const change of getChanges()) {
        if (change.source.type === "yjs-remote") continue;
        ids.add(change.block.id);
        if (change.type === "delete" || change.type === "insert") descendantIds(change.block, ids);
      }
      markDirty(ids);
    }, false);
    if (stored) {
      const unknown = [...place(editor.document, null, new Map()).keys()].filter((id) => !stored!.has(id));
      markDirty(unknown);
    }
  }

  function detach(editor: FolioEditor): void {
    if (attached !== editor) return; // a newer editor took over (StrictMode, tab reopen)
    unsubscribe?.();
    unsubscribe = null;
    attached = null;
    void flush();
  }

  /** Every block of the document plus a delete for stored blocks the document no longer has. */
  async function resyncOps(): Promise<{ ops: BlockOp[]; storedNow: Set<string> }> {
    const placed = place(source!.document, null, new Map());
    const storedNow = storedIdsOf(await o.backend.tabLoad(o.tabId), new Set());
    const ops: BlockOp[] = [...placed].map(([id, p]) => toUpsert(id, p));
    const gone = [...storedNow].filter((id) => !placed.has(id));
    if (gone.length > 0) ops.push({ op: "delete", ids: gone });
    return { ops, storedNow };
  }

  function incrementalOps(ids: Set<string>): BlockOp[] {
    const placed = place(source!.document, null, new Map());
    const ops: BlockOp[] = [];
    for (const [id, p] of placed) if (ids.has(id)) ops.push(toUpsert(id, p));
    const gone = [...ids].filter((id) => !placed.has(id));
    if (gone.length > 0) ops.push({ op: "delete", ids: gone });
    return ops;
  }

  function recordStored(ops: BlockOp[], base: Set<string> | null): void {
    const next = base ?? stored;
    if (!next) return;
    for (const op of ops) {
      if (op.op === "upsert") next.add(op.id);
      else for (const id of op.ids) next.delete(id);
    }
    stored = next;
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
    if (disposed || !source) return;
    if (dirty.size === 0 && !needsResync) return;
    clearTimeout(debounceTimer);
    const startedAt = firstDirtyAt;
    const taken = dirty;
    dirty = new Set();
    inFlight = true;
    emit();
    try {
      let ops: BlockOp[];
      let base: Set<string> | null = null;
      if (needsResync) {
        const r = await resyncOps();
        ops = r.ops;
        base = r.storedNow;
      } else {
        ops = incrementalOps(taken);
      }
      if (ops.length > 0) await o.backend.tabApply(o.tabId, ops);
      recordStored(ops, base);
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

  /** A detached pipeline with nothing left to send is done. */
  function maybeDispose(): void {
    if (!disposed && attached === null && !isPending()) dispose();
  }

  function flush(): Promise<void> {
    queue = queue.then(run).catch(logError).then(maybeDispose);
    return queue;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    unsubscribe = null;
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
    safely(() => o.onDispose?.());
  }

  const pipeline: SavePipeline = {
    tabId: o.tabId,
    flush,
    dispose,
    status,
    onStatus(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    attach,
    detach,
    seedStoredIds(ids) {
      if (stored === null) stored = new Set(ids);
    },
    storedIds: () => (stored ? [...stored] : null),
    isPending,
    document: () => source?.document ?? null,
  };
  if (o.storedIds) pipeline.seedStoredIds(o.storedIds);
  if (o.editor) attach(o.editor);
  return pipeline;
}

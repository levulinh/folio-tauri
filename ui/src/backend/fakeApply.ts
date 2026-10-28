import type { BlockNode } from "./generated/BlockNode";
import type { BlockOp } from "./generated/BlockOp";
import type { ErrorPayload } from "./generated/ErrorPayload";
import type { BlockRec } from "./fakeSearch";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const notFound = (what: string): ErrorPayload => ({
  code: "not_found",
  message: `not found: ${what}`,
});
const invalid = (at: number, message: string): ErrorPayload => ({
  code: "invalid_op",
  message: `op ${at}: ${message}`,
});

type Upsert = Extract<BlockOp, { op: "upsert" }>;

function isAncestorOrSelf(recs: readonly BlockRec[], ancestor: string, from: string): boolean {
  const byId = new Map(recs.map((r) => [r.id, r]));
  const seen = new Set<string>();
  for (let cur: string | null = from; cur !== null && !seen.has(cur); ) {
    if (cur === ancestor) return true;
    seen.add(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

function upsert(
  recs: readonly BlockRec[],
  op: Upsert,
  at: number,
  inOtherTab: (id: string) => boolean,
): BlockRec[] {
  if (typeof op.id !== "string" || !UUID.test(op.id)) throw invalid(at, "block id must be a UUID");
  if (typeof op.props !== "object" || op.props === null || Array.isArray(op.props)) {
    throw invalid(at, "props must be an object");
  }
  if (inOtherTab(op.id)) throw invalid(at, "block belongs to another tab");
  if (op.parentId !== null) {
    if (op.parentId === op.id) throw invalid(at, "block cannot be its own parent");
    if (!recs.some((r) => r.id === op.parentId)) {
      throw invalid(at, `unknown parent block ${op.parentId}`);
    }
    if (isAncestorOrSelf(recs, op.id, op.parentId)) {
      throw invalid(at, "parent is a descendant of the block");
    }
  }
  if (op.prevSiblingId === op.id) throw invalid(at, "block cannot follow itself");
  if (
    op.prevSiblingId !== null &&
    !recs.some((r) => r.id === op.prevSiblingId && r.parentId === op.parentId)
  ) {
    throw invalid(at, `prev sibling ${op.prevSiblingId} is not under the same parent`);
  }
  const rec: BlockRec = {
    id: op.id,
    parentId: op.parentId,
    type: op.type,
    props: structuredClone(op.props),
    content: structuredClone(op.content),
  };
  const rest = recs.filter((r) => r.id !== op.id);
  const index =
    op.prevSiblingId !== null
      ? rest.findIndex((r) => r.id === op.prevSiblingId) + 1
      : firstSiblingIndex(rest, op.parentId);
  return [...rest.slice(0, index), rec, ...rest.slice(index)];
}

function firstSiblingIndex(recs: readonly BlockRec[], parentId: string | null): number {
  const i = recs.findIndex((r) => r.parentId === parentId);
  return i === -1 ? recs.length : i;
}

function remove(recs: readonly BlockRec[], ids: readonly string[]): BlockRec[] {
  let out = [...recs];
  for (const id of ids) {
    const doomed = new Set<string>();
    if (out.some((r) => r.id === id)) doomed.add(id);
    for (let grew = doomed.size > 0; grew; ) {
      grew = false;
      for (const r of out) {
        if (r.parentId !== null && doomed.has(r.parentId) && !doomed.has(r.id)) {
          doomed.add(r.id);
          grew = true;
        }
      }
    }
    out = out.filter((r) => !doomed.has(r.id));
  }
  return out;
}

/** All-or-nothing: returns the new block list, or throws and leaves `recs` untouched. */
export function applyOps(
  recs: readonly BlockRec[],
  ops: readonly BlockOp[],
  inOtherTab: (id: string) => boolean,
): BlockRec[] {
  let working = [...recs];
  ops.forEach((op, at) => {
    working =
      op.op === "upsert" ? upsert(working, op, at, inOtherTab) : remove(working, op.ids);
  });
  return working;
}

/** The nested tree, siblings in stored order. */
export function toTree(recs: readonly BlockRec[]): BlockNode[] {
  const kids = new Map<string | null, BlockRec[]>();
  for (const r of recs) kids.set(r.parentId, [...(kids.get(r.parentId) ?? []), r]);
  const build = (r: BlockRec): BlockNode => ({
    id: r.id,
    type: r.type,
    props: r.props,
    content: r.content,
    children: (kids.get(r.id) ?? []).map(build),
  });
  return (kids.get(null) ?? []).map(build);
}

/** Block records depth-first in reading order. */
export function depthFirst(recs: readonly BlockRec[]): BlockRec[] {
  const out: BlockRec[] = [];
  const walk = (nodes: BlockNode[]) =>
    nodes.forEach((n) => {
      out.push(recs.find((r) => r.id === n.id)!);
      walk(n.children);
    });
  walk(toTree(recs));
  return out;
}

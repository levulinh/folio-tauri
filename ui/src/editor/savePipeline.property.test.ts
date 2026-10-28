import { BlockNoteEditor } from "@blocknote/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";
import { isErrorPayload } from "../backend/Backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import { useUiStore } from "../state/uiStore";
import { toStored } from "./convert";
import { createSavePipeline } from "./savePipeline";
import { schema } from "./schema";
import { withoutFirst, type TableContent as LooseTable } from "./table/tableContent";

const SEEDS = 24;
const ACTIONS = 60;

/** mulberry32: small seeded PRNG so a failing seed reproduces. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Doc = BlockNoteEditor<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>["document"];
type Flat = Doc[number];

const flatten = (blocks: Doc): Flat[] => blocks.flatMap((b) => [b, ...flatten(b.children as Doc)]);

const TYPES = ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote"] as const;
const WORDS = ["xin", "chào", "Việt", "note", "a", "folio", "😀", "ế"];

/** Structural view used for comparison: id, type, props, content and nesting, JSON-normalised. */
function normalise(blocks: Doc): unknown {
  return JSON.parse(
    JSON.stringify(
      blocks.map((b) => ({ id: b.id, ...toStored(b as never), children: normalise(b.children as Doc) })),
    ),
  );
}
const normaliseStored = (nodes: BlockNode[]): unknown =>
  JSON.parse(
    JSON.stringify(nodes.map((n) => ({ id: n.id, type: n.type, props: n.props, content: n.content, children: normaliseStored(n.children) }))),
  );

type TableContent = { type: "tableContent"; rows: { cells: unknown[] }[]; columnWidths?: unknown; headerRows?: number; headerCols?: number };
const tablesOf = (blocks: Doc): Flat[] => flatten(blocks).filter((b) => b.type === "table");
const tableContentOf = (b: Flat): TableContent => b.content as unknown as TableContent;
const cellInline = (cell: unknown): unknown => (Array.isArray(cell) ? cell : (cell as { content: unknown }).content);
const cellText = (cell: unknown): string =>
  (cellInline(cell) as { type: string; text?: string; content?: { text?: string }[] }[])
    .map((n) => (n.type === "link" ? (n.content ?? []).map((c) => c.text ?? "").join("") : (n.text ?? "")))
    .join("");

/** Explicit table view (rows x cells inline text and shape, header flags, widths) so a stored/editor mismatch names the table. */
function tableShape(content: unknown): unknown {
  const t = content as TableContent;
  return JSON.parse(
    JSON.stringify({
      rows: t.rows.map((r) => r.cells.map((c) => ({ text: cellText(c), inline: cellInline(c) }))),
      headerRows: t.headerRows ?? null,
      headerCols: t.headerCols ?? null,
      columnWidths: t.columnWidths ?? null,
    }),
  );
}
const rawTableShapes = (blocks: Doc): unknown[] => tablesOf(blocks).map((b) => ({ id: b.id, shape: tableShape(tableContentOf(b)) }));
const tableShapes = (nodes: { id: string; type: string; content: unknown; children: unknown[] }[]): unknown[] =>
  nodes.flatMap((n) => [
    ...(n.type === "table" ? [{ id: n.id, shape: tableShape(n.content) }] : []),
    ...tableShapes(n.children as never),
  ]);

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

let tableTotal = 0;
let headerTotal = 0;

async function runSeed(seed: number): Promise<void> {
  const rnd = prng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const word = () => pick(WORDS);

  const be = createFakeBackend();
  const { tab } = await be.pageCreate();
  const editor = BlockNoteEditor.create({ schema });
  editor.mount(document.createElement("div")); // undo / redo only work on a mounted editor
  const errors: unknown[] = [];
  const pipeline = createSavePipeline({
    tabId: tab.id,
    backend: be,
    storedIds: [],
    editor,
    onError: (e) => errors.push(e),
  });

  const editTable = (action: number): void => {
    const tables = tablesOf(editor.document).filter((t) => action < 16 || (action === 16 ? tableContentOf(t).headerRows : tableContentOf(t).headerCols));
    if (tables.length === 0) return;
    const table = pick(tables);
    const content = tableContentOf(table);
    const rows = content.rows.map((r) => r.cells);
    const width = rows[0]?.length ?? 1;
    const r = Math.floor(rnd() * rows.length);
    const c = Math.floor(rnd() * width);
    let next: unknown[][];
    let widths = content.columnWidths as unknown[] | undefined;
    if (action === 16 || action === 17) {
      // the shared helper behind deleteFirstKeepingHeader (FolioTableHandles): drop row/column 0, keep a header
      const orientation = action === 16 ? "row" : "column";
      if ((orientation === "row" ? rows.length : width) < 2) return;
      editor.updateBlock(table.id, { content: { type: "tableContent", ...withoutFirst(content as unknown as LooseTable, orientation) } } as never);
      return;
    }
    if (action === 11) next = [...rows.slice(0, r + 1), Array.from({ length: width }, () => word()), ...rows.slice(r + 1)];
    else if (action === 12) {
      next = rows.map((cells) => [...cells.slice(0, c + 1), word(), ...cells.slice(c + 1)]);
      if (widths) widths = [...widths.slice(0, c + 1), undefined, ...widths.slice(c + 1)];
    }
    else if (action === 13) {
      if (rows.length < 2) return;
      next = rows.filter((_, i) => i !== r);
    } else next = rows.map((cells, i) => (i === r ? cells.map((cell, j) => (j === c ? `${word()}${rnd() < 0.3 ? "\n" + word() : ""}` : cell)) : cells));
    const nextContent: Record<string, unknown> = { type: "tableContent", rows: next.map((cells) => ({ cells })) };
    if (widths) nextContent.columnWidths = widths;
    if (content.headerRows) nextContent.headerRows = content.headerRows;
    if (content.headerCols) nextContent.headerCols = content.headerCols;
    editor.updateBlock(table.id, { content: nextContent } as never);
  };

  for (let i = 0; i < ACTIONS; i += 1) {
    const blocks = flatten(editor.document);
    const target = pick(blocks);
    const action = Math.floor(rnd() * 18);
    try {
      switch (action) {
        case 0: // insert a block with children
          editor.insertBlocks(
            [
              {
                type: pick(TYPES) as "paragraph",
                content: word(),
                children: rnd() < 0.5 ? [{ type: "bulletListItem", content: word(), children: [{ type: "paragraph", content: word() }] }] : [],
              },
            ],
            target.id,
            pick(["before", "after"] as const),
          );
          break;
        case 1:
          editor.setTextCursorPosition(target.id);
          editor.nestBlock();
          break;
        case 2:
          editor.setTextCursorPosition(target.id);
          editor.unnestBlock();
          break;
        case 3:
          editor.setTextCursorPosition(target.id);
          editor.moveBlocksUp();
          break;
        case 4:
          editor.setTextCursorPosition(target.id);
          editor.moveBlocksDown();
          break;
        case 5:
          // removing the last block is allowed: the editor is mounted (getChanges() throws only on an unmounted editor), so the replacement placeholder block gets an id
          editor.removeBlocks([target.id]);
          break;
        case 6:
          editor.updateBlock(target.id, { type: pick(TYPES) as "paragraph" });
          break;
        case 7:
          editor.updateBlock(target.id, { content: `${word()} ${word()}` });
          break;
        case 8:
          editor.undo();
          break;
        case 9:
          editor.redo();
          break;
        case 10: // insert a 2x3 table
          editor.insertBlocks(
            [
              {
                type: "table",
                content: {
                  type: "tableContent",
                  rows: [0, 1].map(() => ({ cells: [0, 1, 2].map(() => `${word()} ${word()}`) })),
                  ...(rnd() < 0.5 ? { headerRows: 1 } : {}),
                  ...(rnd() < 0.4 ? { headerCols: 1 } : {}),
                },
              },
            ],
            target.id,
            pick(["before", "after"] as const),
          );
          break;
        case 11: // add a row
        case 12: // add a column
        case 13: // delete a row (never the last)
        case 14: // edit a cell's text
          editTable(action);
          break;
        case 16: // delete row 0 of a header-row table (app rule D-029)
        case 17: // delete column 0 of a header-column table
          editTable(action);
          break;
        default: {
          // move a table block up / down
          const tables = tablesOf(editor.document);
          if (tables.length === 0) break;
          editor.setTextCursorPosition(pick(tables).id);
          if (rnd() < 0.5) editor.moveBlocksUp();
          else editor.moveBlocksDown();
        }
      }
    } catch {
      // an action that does not apply to this block (e.g. type without content) is skipped
    }
    if (rnd() < 0.2) await pipeline.flush();
    if (rnd() < 0.1) await vi.advanceTimersByTimeAsync(700);
  }

  await pipeline.flush();
  const stored = await be.tabLoad(tab.id);
  expect(tableShapes(normaliseStored(stored) as never), `seed ${seed} tables`).toEqual(rawTableShapes(editor.document));
  tableTotal += rawTableShapes(editor.document).length;
  headerTotal += tablesOf(editor.document).filter((b) => tableContentOf(b).headerRows || tableContentOf(b).headerCols).length;
  expect(normaliseStored(stored), `seed ${seed}`).toEqual(normalise(editor.document));
  expect(errors.filter(isErrorPayload).map((e) => e.code), `seed ${seed} errors`).toEqual([]);
  expect(errors, `seed ${seed} errors`).toEqual([]);
  pipeline.dispose();
  editor.unmount();
}

describe("save pipeline property test", () => {
  it(`keeps the stored tab equal to the editor over ${SEEDS} seeds x ${ACTIONS} random actions`, async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let seed = 1; seed <= SEEDS; seed += 1) await runSeed(seed);
    expect(tableTotal, "tables survive to the end of some seeds").toBeGreaterThan(0);
    expect(headerTotal, "header tables survive to the end of some seeds").toBeGreaterThan(0);
    expect(spy.mock.calls.filter((c) => String(c[0]).includes("invalid_op"))).toEqual([]);
    spy.mockRestore();
  }, 30000);
});

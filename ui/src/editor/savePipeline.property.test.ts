import { BlockNoteEditor } from "@blocknote/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";
import { isErrorPayload } from "../backend/Backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import { useUiStore } from "../state/uiStore";
import { toStored } from "./convert";
import { createSavePipeline } from "./savePipeline";
import { schema } from "./schema";

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

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

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

  for (let i = 0; i < ACTIONS; i += 1) {
    const blocks = flatten(editor.document);
    const target = pick(blocks);
    const action = Math.floor(rnd() * 10);
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
          // never empty the document: BlockNote then creates an id-less placeholder block (a mounted editor assigns it an id)
          if (!(editor.document.length === 1 && editor.document[0]!.id === target.id)) editor.removeBlocks([target.id]);
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
        default:
          editor.redo();
      }
    } catch {
      // an action that does not apply to this block (e.g. type without content) is skipped
    }
    if (rnd() < 0.2) await pipeline.flush();
    if (rnd() < 0.1) await vi.advanceTimersByTimeAsync(700);
  }

  await pipeline.flush();
  const stored = await be.tabLoad(tab.id);
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
    expect(spy.mock.calls.filter((c) => String(c[0]).includes("invalid_op"))).toEqual([]);
    spy.mockRestore();
  }, 30000);
});

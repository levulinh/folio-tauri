import { BlockNoteEditor } from "@blocknote/core";
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest";
import type { Backend } from "../backend/Backend";
import type { BlockNode } from "../backend/generated/BlockNode";
import type { BlockOp } from "../backend/generated/BlockOp";
import { useUiStore } from "../state/uiStore";
import { flushAll, registerPipeline, retirePipeline, takeOverRetired } from "./pipelineRegistry";
import { toEditorBlocks } from "./convert";
import { createSavePipeline, type SavePipeline } from "./savePipeline";
import { schema } from "./schema";

const text = (t: string) => [{ type: "text", text: t, styles: {} }];
const node = (id: string, t: string, children: BlockNode[] = [], type = "paragraph"): BlockNode => ({
  id,
  type,
  props: {},
  content: text(t),
  children,
});

type Call = { tabId: string; ops: BlockOp[] };

function mockBackend(stored: BlockNode[] = []) {
  const calls: Call[] = [];
  const loads: string[] = [];
  const state = { fail: null as unknown, failTimes: 0, stored };
  const backend: Pick<Backend, "tabApply" | "tabLoad"> = {
    async tabApply(tabId, ops) {
      if (state.failTimes > 0) {
        state.failTimes -= 1;
        throw state.fail;
      }
      calls.push({ tabId, ops });
      return { applied: ops.length, pageUpdatedAt: 0 };
    },
    async tabLoad(tabId) {
      loads.push(tabId);
      return state.stored;
    },
  };
  return { backend, calls, loads, state };
}

const pipelines: SavePipeline[] = [];
function setup(nodes: BlockNode[], tabId = "T1", opts: Partial<Parameters<typeof createSavePipeline>[0]> = {}, stored?: BlockNode[]) {
  const editor = BlockNoteEditor.create({ schema, initialContent: toEditorBlocks(nodes) });
  const be = mockBackend(stored ?? nodes);
  const pipeline = createSavePipeline({ tabId, editor, backend: be.backend, ...opts });
  pipelines.push(pipeline);
  return { editor, pipeline, ...be };
}

const upserts = (c: Call) => c.ops.filter((o) => o.op === "upsert");
const ids = (c: Call) => upserts(c).map((o) => (o as { id: string }).id);

beforeEach(() => {
  vitest.useFakeTimers();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => {
  pipelines.splice(0).forEach((p) => p.dispose());
  vitest.useRealTimers();
});

describe("savePipeline", () => {
  it("typing_one_block_sends_one_upsert", async () => {
    const { editor, calls } = setup([node("a", "x"), node("b", "y")]);
    editor.updateBlock("a", { content: "xin chào" });
    await vitest.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.ops).toEqual([
      { op: "upsert", id: "a", parentId: null, prevSiblingId: null, type: "paragraph", props: expect.any(Object), content: text("xin chào") },
    ]);
  });

  it("insert_between_sets_prevSiblingId", async () => {
    const { editor, calls } = setup([node("a", "1"), node("b", "2")]);
    const [inserted] = editor.insertBlocks([{ type: "paragraph", content: "mid" }], "a", "after");
    await vitest.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(1);
    expect(upserts(calls[0]!)).toHaveLength(1);
    expect(calls[0]!.ops[0]).toMatchObject({ op: "upsert", id: inserted!.id, parentId: null, prevSiblingId: "a" });
  });

  it("delete_nested_item_sends_one_delete_with_children", async () => {
    const tree = [node("p", "p"), node("x", "x", [node("y", "y", [node("z", "z", [], "bulletListItem")], "bulletListItem")], "bulletListItem")];
    const { editor, calls } = setup(tree);
    editor.removeBlocks(["x"]);
    await vitest.advanceTimersByTimeAsync(600);
    const deletes = calls.flatMap((c) => c.ops.filter((o) => o.op === "delete"));
    expect(deletes).toHaveLength(1);
    expect([...(deletes[0]! as { ids: string[] }).ids].sort()).toEqual(["x", "y", "z"]);
  });

  it("move_block_with_children_upserts_only_moved_block", async () => {
    const tree = [node("a", "a"), node("b", "b", [node("b1", "b1")]), node("c", "c")];
    const { editor, calls } = setup(tree);
    editor.setTextCursorPosition("b");
    editor.moveBlocksUp("b");
    await vitest.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(1);
    expect(ids(calls[0]!)).toEqual(["b"]);
    expect(calls[0]!.ops.some((o) => o.op === "delete")).toBe(false);
  });

  it("undo_after_delete_restores_with_upserts", async () => {
    const { editor, calls } = setup([node("a", "a"), node("b", "b", [node("b1", "b1")])]);
    editor.mount(document.createElement("div"));
    editor.removeBlocks(["b"]);
    await vitest.advanceTimersByTimeAsync(600);
    expect(calls.at(-1)!.ops.some((o) => o.op === "delete")).toBe(true);
    editor.undo();
    await vitest.advanceTimersByTimeAsync(600);
    const last = calls.at(-1)!;
    expect(ids(last).sort()).toEqual(["b", "b1"]);
    expect(last.ops.some((o) => o.op === "delete")).toBe(false);
    expect(last.ops.find((o) => o.op === "upsert" && o.id === "b1")).toMatchObject({ parentId: "b", prevSiblingId: null });
  });

  it("vietnamese_text_roundtrip", async () => {
    const { editor, calls } = setup([node("a", "")]);
    editor.updateBlock("a", { content: "Đà Nẵng" });
    await vitest.advanceTimersByTimeAsync(600);
    expect((calls[0]!.ops[0] as { content: unknown }).content).toEqual(text("Đà Nẵng"));
  });

  it("burst_of_50_changes_in_600ms_is_one_call", async () => {
    const { editor, calls } = setup([node("a", "")]);
    for (let i = 0; i < 50; i++) {
      editor.updateBlock("a", { content: "k".repeat(i + 1) });
      await vitest.advanceTimersByTimeAsync(10);
    }
    expect(calls).toHaveLength(0);
    await vitest.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(1);
    expect((calls[0]!.ops[0] as { content: { text: string }[] }).content[0]!.text).toHaveLength(50);
  });

  it("continuous_typing_flushes_by_3s", async () => {
    const { editor, calls } = setup([node("a", "")]);
    for (let i = 0; i < 30; i++) {
      editor.updateBlock("a", { content: "k".repeat(i + 1) });
      await vitest.advanceTimersByTimeAsync(100); // never idle for 600 ms
    }
    // 3000 ms of typing have passed: the max wait must have forced a call.
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it("paste_500_blocks_is_one_call_with_500_upserts", async () => {
    const { editor, calls } = setup([node("a", "")]);
    const many = Array.from({ length: 500 }, (_, i) => ({ type: "paragraph" as const, content: `dòng ${i}` }));
    editor.insertBlocks(many, "a", "after");
    await vitest.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(1);
    expect(upserts(calls[0]!)).toHaveLength(500);
  });

  it("outdent_then_delete_parent_order", async () => {
    const { editor, calls } = setup([node("d", "d", [node("c", "c", [node("g", "g")])])]);
    editor.setTextCursorPosition("c");
    editor.unnestBlock();
    editor.removeBlocks(["d"]);
    await vitest.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(1);
    const ops = calls[0]!.ops;
    const cAt = ops.findIndex((o) => o.op === "upsert" && o.id === "c");
    const dAt = ops.findIndex((o) => o.op === "delete");
    expect(cAt).toBeGreaterThanOrEqual(0);
    expect(dAt).toBe(ops.length - 1);
    expect(cAt).toBeLessThan(dAt);
    expect(ops[dAt]).toEqual({ op: "delete", ids: ["d"] });
    expect(ops[cAt]).toMatchObject({ parentId: null });
  });

  it("not_found_drops_and_stops", async () => {
    const { editor, pipeline, calls, state } = setup([node("a", "")]);
    state.fail = { code: "not_found", message: "gone" };
    state.failTimes = 1000;
    editor.updateBlock("a", { content: "x" });
    await vitest.advanceTimersByTimeAsync(600);
    expect(pipeline.status()).toBe("saved");
    state.failTimes = 0;
    editor.updateBlock("a", { content: "xy" });
    await vitest.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(0);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it("other_error_retries_with_backoff", async () => {
    const { editor, pipeline, calls, state } = setup([node("a", "")]);
    state.fail = { code: "db", message: "boom" };
    state.failTimes = 3;
    const seen: string[] = [];
    pipeline.onStatus((s) => seen.push(s));
    editor.updateBlock("a", { content: "x" });
    await vitest.advanceTimersByTimeAsync(600); // attempt 1 fails
    expect(pipeline.status()).toBe("error");
    await vitest.advanceTimersByTimeAsync(1999);
    expect(state.failTimes).toBe(2);
    await vitest.advanceTimersByTimeAsync(1); // +2 s: attempt 2 fails
    expect(state.failTimes).toBe(1);
    await vitest.advanceTimersByTimeAsync(3999);
    expect(state.failTimes).toBe(1);
    await vitest.advanceTimersByTimeAsync(1); // +4 s: attempt 3 fails
    expect(state.failTimes).toBe(0);
    await vitest.advanceTimersByTimeAsync(7999);
    expect(calls).toHaveLength(0);
    await vitest.advanceTimersByTimeAsync(1); // +8 s: succeeds
    expect(calls).toHaveLength(1);
    expect(ids(calls[0]!)).toEqual(["a"]);
    expect(pipeline.status()).toBe("saved");
    expect(seen).toContain("error");
    expect(useUiStore.getState().toasts).toHaveLength(1); // once per streak
  });

  it("invalid_op_triggers_full_resync", async () => {
    const stored = [node("a", "a"), node("gone", "old")];
    const { editor, pipeline, calls, loads, state } = setup([node("a", "a"), node("b", "b")], "T1", {}, stored);
    state.fail = { code: "invalid_op", message: "bad" };
    state.failTimes = 1;
    editor.updateBlock("a", { content: "edited" });
    await vitest.advanceTimersByTimeAsync(600);
    expect(pipeline.status()).toBe("error");
    expect(useUiStore.getState().toasts).toHaveLength(1);
    await vitest.advanceTimersByTimeAsync(2000);
    expect(loads).toEqual(["T1"]);
    expect(calls).toHaveLength(1);
    const ops = calls[0]!.ops;
    expect(ids(calls[0]!)).toEqual(editor.document.map((b) => b.id));
    expect(ops.at(-1)).toEqual({ op: "delete", ids: ["gone"] });
    expect(pipeline.status()).toBe("saved");
  });

  it("pipelines_write_only_their_tab", async () => {
    const calls: Call[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const backend: Pick<Backend, "tabApply" | "tabLoad"> = {
      async tabApply(tabId, ops) {
        calls.push({ tabId, ops });
        if (tabId === "T2") await gate;
        return { applied: ops.length, pageUpdatedAt: 0 };
      },
      tabLoad: async () => [],
    };
    const e1 = BlockNoteEditor.create({ schema, initialContent: toEditorBlocks([node("a1", "")]) });
    const e2 = BlockNoteEditor.create({ schema, initialContent: toEditorBlocks([node("a2", "")]) });
    const p1 = createSavePipeline({ tabId: "T1", editor: e1, backend });
    const p2 = createSavePipeline({ tabId: "T2", editor: e2, backend });
    pipelines.push(p1, p2);
    e2.updateBlock("a2", { content: "two" });
    const f2 = p2.flush(); // in flight, blocked
    e1.updateBlock("a1", { content: "one" });
    await p1.flush();
    release();
    await f2;
    expect(calls.map((c) => [c.tabId, ids(c)])).toEqual([
      ["T2", ["a2"]],
      ["T1", ["a1"]],
    ]);
  });

  it("flushAll_flushes_every_registered_pipeline", async () => {
    const a = setup([node("a", "")], "T1");
    const b = setup([node("b", "")], "T2");
    const offA = registerPipeline(a.pipeline);
    const offB = registerPipeline(b.pipeline);
    a.editor.updateBlock("a", { content: "x" });
    b.editor.updateBlock("b", { content: "y" });
    await flushAll();
    expect(a.calls).toHaveLength(1);
    expect(b.calls).toHaveLength(1);
    offA();
    offB();
  });

  it("flushAll_waits_for_final_flush_of_unmounted_pipeline", async () => {
    const a = setup([node("a", "")], "T1");
    const off = registerPipeline(a.pipeline);
    a.editor.updateBlock("a", { content: "x" });
    retirePipeline(a.pipeline, off, "T1", a.editor);
    await flushAll();
    expect(a.calls).toHaveLength(1);
  });

  it("default_block_on_empty_page_is_saved_with_first_insert", async () => {
    const editor = BlockNoteEditor.create({ schema }); // empty page: BlockNote makes a default block
    const be = mockBackend([]);
    const pipeline = createSavePipeline({ tabId: "T1", editor, backend: be.backend, storedIds: [] });
    pipelines.push(pipeline);
    const defaultId = editor.document[0]!.id;
    const [added] = editor.insertBlocks([{ type: "paragraph", content: "mới" }], defaultId, "after");
    await vitest.advanceTimersByTimeAsync(600);
    expect(be.calls).toHaveLength(1);
    expect(ids(be.calls[0]!)).toEqual([defaultId, added!.id]);
    expect(pipeline.status()).toBe("saved");
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it("throwing_status_listener_does_not_stop_later_flushes", async () => {
    const { editor, pipeline, calls } = setup([node("a", "")], "T1", { onError: () => {} });
    const spy = vitest.spyOn(console, "error").mockImplementation(() => {});
    pipeline.onStatus(() => {
      throw new Error("listener boom");
    });
    editor.updateBlock("a", { content: "1" });
    await vitest.advanceTimersByTimeAsync(600);
    editor.updateBlock("a", { content: "12" });
    await expect(pipeline.flush()).resolves.toBeUndefined();
    expect(calls).toHaveLength(2);
    spy.mockRestore();
  });

  it("reopen_tab_with_unsaved_retired_pipeline_adopts_it", async () => {
    const stored = [node("a", "stored")];
    const old = setup(stored, "T1", {}, stored);
    old.state.fail = { code: "db", message: "down" };
    old.state.failTimes = 2; // the edit's save and the final flush on unmount both fail
    const off = registerPipeline(old.pipeline);
    old.editor.updateBlock("a", { content: "old-editor-text" });
    await vitest.advanceTimersByTimeAsync(600); // save fails, ids put back
    expect(old.pipeline.status()).toBe("error");
    retirePipeline(old.pipeline, off, "T1", old.editor);
    await vitest.advanceTimersByTimeAsync(0);

    // A new Editor for the tab mounts: takes the retired editor's document instead of tabLoad.
    const taken = await takeOverRetired("T1");
    expect(taken).not.toBeNull();
    expect(taken!.handOff.ids).toEqual(["a"]);
    const editor2 = BlockNoteEditor.create({ schema, initialContent: taken!.editor.document as never });
    expect(JSON.stringify(editor2.document[0]!.content)).toContain("old-editor-text");
    const p2 = createSavePipeline({ tabId: "T1", editor: editor2, backend: old.backend, storedIds: ["a"], adopt: taken!.handOff });
    pipelines.push(p2);
    editor2.insertBlocks([{ type: "paragraph", content: "newer" }], "a", "after");
    await vitest.advanceTimersByTimeAsync(60_000);

    // Old pipeline is silent; everything stored came from the new one and ends up newest.
    const sent = old.calls.flatMap((c) => c.ops).filter((o) => o.op === "upsert");
    expect(old.calls).toHaveLength(1);
    expect(JSON.stringify(sent)).toContain("old-editor-text");
    expect(sent.map((o) => (o as { id: string }).id)).toContain("a");
    expect(JSON.stringify(sent)).not.toContain('"stored"');
    expect(old.pipeline.status()).toBe("saved"); // disposed
    expect(await takeOverRetired("T1")).toBeNull();
  });

  it("flushAll_flushes_retired_pipelines", async () => {
    const a = setup([node("a", "")], "T9");
    a.state.fail = { code: "db", message: "down" };
    a.state.failTimes = 2;
    const off = registerPipeline(a.pipeline);
    a.editor.updateBlock("a", { content: "x" });
    await vitest.advanceTimersByTimeAsync(600);
    retirePipeline(a.pipeline, off, "T9", a.editor);
    await vitest.advanceTimersByTimeAsync(0);
    expect(a.calls).toHaveLength(0);
    await flushAll(); // one attempt now, without waiting for the backoff
    expect(a.calls).toHaveLength(1);
    await takeOverRetired("T9"); // cleanup
  });

  it("flush_requested_during_a_flush_runs_after_it", async () => {
    const { editor, pipeline, calls, backend } = setup([node("a", "")]);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const inner = backend.tabApply;
    let slow = true;
    backend.tabApply = async (t, ops) => {
      if (slow) {
        slow = false;
        await gate;
      }
      return inner(t, ops);
    };
    editor.updateBlock("a", { content: "1" });
    const first = pipeline.flush();
    await vitest.advanceTimersByTimeAsync(0); // first flush is now in flight
    editor.updateBlock("a", { content: "12" });
    const second = pipeline.flush();
    expect(calls).toHaveLength(0);
    release();
    await Promise.all([first, second]);
    expect(calls).toHaveLength(2);
    expect((calls[1]!.ops[0] as { content: { text: string }[] }).content[0]!.text).toBe("12");
  });
});

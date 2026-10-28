import { BlockNoteEditor } from "@blocknote/core";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "../schema";
import { findExtension, findMatches, findPluginKey } from "./findPlugin";

function docOf(content: unknown) {
  const editor = BlockNoteEditor.create({ schema, initialContent: [{ type: "paragraph", content }] as never });
  return editor.transact((tr) => tr.doc);
}

const slice = (doc: ReturnType<typeof docOf>, m: { from: number; to: number }) => doc.textBetween(m.from, m.to);

describe("findMatches", () => {
  it("finds accentless in accented text", () => {
    const doc = docOf("Đà Nẵng và đà nẵng");
    const matches = findMatches(doc, "da nang");
    expect(matches.map((m) => slice(doc, m))).toEqual(["Đà Nẵng", "đà nẵng"]);
  });

  it("empty query no matches", () => {
    const doc = docOf("Đà Nẵng");
    expect(findMatches(doc, "")).toEqual([]);
    expect(findMatches(doc, "   ")).toEqual([]);
  });

  it("match across styled runs", () => {
    const doc = docOf([
      { type: "text", text: "Đà", styles: { bold: true } },
      { type: "text", text: " Nẵng", styles: {} },
    ]);
    const matches = findMatches(doc, "da nang");
    expect(matches).toHaveLength(1);
    expect(slice(doc, matches[0]!)).toBe("Đà Nẵng");
  });

  it("matches are non-overlapping and cover supplementary-plane chars", () => {
    const doc = docOf("aaaa 😀 aa");
    expect(findMatches(doc, "aa").map((m) => slice(doc, m))).toEqual(["aa", "aa", "aa"]);
    expect(findMatches(doc, "😀").map((m) => slice(doc, m))).toEqual(["😀"]);
  });

  it("covers the combining marks of a decomposed last char", () => {
    const doc = docOf("N\u0061\u0306\u0303ng");
    const matches = findMatches(doc, "na");
    expect(matches).toHaveLength(1);
    expect(slice(doc, matches[0]!)).toBe("Na\u0306\u0303");
  });

  it("maps positions after a hard break and never matches across one", () => {
    const doc = docOf("foo\nbar");
    expect(doc.textContent).toBe("foobar");
    const bar = findMatches(doc, "bar");
    expect(bar).toHaveLength(1);
    expect(doc.textBetween(bar[0]!.from, bar[0]!.to)).toBe("bar");
    expect(bar[0]!.from).toBe(7); // content starts at 3 (blockGroup, blockContainer, paragraph), "foo" 3-6, break 6-7
    expect(findMatches(doc, "foobar")).toEqual([]);
  });

  it("searches every textblock, code blocks included, never across blocks", () => {
    const editor = BlockNoteEditor.create({
      schema,
      initialContent: [
        { type: "paragraph", content: "xa" },
        { type: "codeBlock", content: "a" },
        { type: "paragraph", content: "b" },
      ] as never,
    });
    const doc = editor.transact((tr) => tr.doc);
    expect(findMatches(doc, "a")).toHaveLength(2);
    expect(findMatches(doc, "ab")).toEqual([]);
  });
});

describe("find plugin state", () => {
  const open: Array<{ unmount(): void }> = [];
  // Unmount so no prosemirror-view timer outlives its test.
  afterEach(() => open.splice(0).forEach((e) => e.unmount()));
  function mounted() {
    const editor = BlockNoteEditor.create({
      schema,
      extensions: [findExtension()],
      initialContent: [
        { id: "a", type: "paragraph", content: "nang" },
        { id: "b", type: "paragraph", content: "Nắng" },
      ] as never,
    });
    editor.mount(document.createElement("div"));
    open.push(editor);
    return editor;
  }
  const state = (editor: ReturnType<typeof mounted>) => findPluginKey.getState(editor.prosemirrorState)!;

  it("recomputes on document changes and clamps the current index, leaving the selection alone", () => {
    const editor = mounted();
    const before = JSON.stringify(editor.prosemirrorState.selection.toJSON());
    editor.transact((tr) => tr.setMeta(findPluginKey, { type: "query", query: "nang" }));
    editor.transact((tr) => tr.setMeta(findPluginKey, { type: "current", index: 1 }));
    expect(JSON.stringify(editor.prosemirrorState.selection.toJSON())).toBe(before);
    expect(state(editor).matches).toHaveLength(2);
    expect(state(editor).current).toBe(1);

    editor.removeBlocks(["b"]);
    expect(state(editor).matches).toHaveLength(1);
    expect(state(editor).current).toBe(0);
    editor.updateBlock("a", { content: "xx nang nang" });
    expect(state(editor).matches).toHaveLength(2);

    editor.transact((tr) => tr.setMeta(findPluginKey, { type: "clear" }));
    expect(state(editor)).toEqual({ query: "", matches: [], current: 0 });
  });

  it("mirrors its state into the extension store", () => {
    const editor = mounted();
    editor.transact((tr) => tr.setMeta(findPluginKey, { type: "query", query: "nang" }));
    expect(editor.getExtension(findExtension)!.store.state.matches).toHaveLength(2);
  });
});

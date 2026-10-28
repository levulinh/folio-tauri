import { createExtension, createStore } from "@blocknote/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { fold, foldWithMap } from "../../lib/fold";

export interface FindMatch {
  from: number;
  to: number;
}

export interface FindState {
  query: string;
  matches: FindMatch[];
  /** Index into `matches`; 0 when there are none. */
  current: number;
}

export const EMPTY_FIND_STATE: FindState = { query: "", matches: [], current: 0 };

/** Where one text node of a textblock starts, in the textblock's text and in the document. */
interface Segment {
  textStart: number;
  docPos: number;
}

function docPosOf(segments: Segment[], textOffset: number): number {
  let seg = segments[0]!;
  for (const s of segments) if (s.textStart <= textOffset) seg = s;
  return seg.docPos + (textOffset - seg.textStart);
}

/**
 * All matches of `query` (compared folded: accents, case and whitespace runs ignored) in the text
 * blocks of `doc`, as document ranges. Matching is per textblock, so it never spans blocks;
 * non-text inline nodes contribute no text. Matches do not overlap.
 */
export function findMatches(doc: ProseMirrorNode, query: string): FindMatch[] {
  const needle = fold(query);
  if (needle === "") return [];
  const matches: FindMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // A run is the text between non-text inline nodes (hard breaks, ...): matches never span runs.
    let text = "";
    let segments: Segment[] = [];
    const flush = () => {
      if (segments.length > 0) matches.push(...matchRun(text, segments, needle));
      text = "";
      segments = [];
    };
    node.forEach((child, offset) => {
      if (!child.isText) return flush();
      segments.push({ textStart: text.length, docPos: pos + 1 + offset });
      text += child.text;
    });
    flush();
    return false;
  });
  return matches;
}

const TRAILING_MARK = /^\p{M}/u;

function matchRun(text: string, segments: Segment[], needle: string): FindMatch[] {
  const matches: FindMatch[] = [];
  const { folded, map } = foldWithMap(text);
  for (let at = folded.indexOf(needle); at !== -1; at = folded.indexOf(needle, at + needle.length)) {
    const first = map[at]!;
    const last = map[at + needle.length - 1]!;
    let end = last + String.fromCodePoint(text.codePointAt(last)!).length;
    // Keep a decomposed char's combining marks inside the match (no split grapheme).
    for (let m = TRAILING_MARK.exec(text.slice(end)); m; m = TRAILING_MARK.exec(text.slice(end))) end += m[0].length;
    matches.push({ from: docPosOf(segments, first), to: docPosOf(segments, end - 1) + 1 });
  }
  return matches;
}

export type FindAction = { type: "query"; query: string } | { type: "current"; index: number } | { type: "clear" };

export const findPluginKey = new PluginKey<FindState>("folio-find");

function clampIndex(index: number, count: number): number {
  return count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
}

/** Holds `{ query, matches, current }` and renders the matches as inline decorations only. */
export function createFindPlugin(): Plugin<FindState> {
  return new Plugin<FindState>({
    key: findPluginKey,
    state: {
      init: () => EMPTY_FIND_STATE,
      apply(tr, value) {
        const action = tr.getMeta(findPluginKey) as FindAction | undefined;
        if (action?.type === "clear") return EMPTY_FIND_STATE;
        if (action?.type === "query") {
          const matches = findMatches(tr.doc, action.query);
          return { query: action.query, matches, current: 0 };
        }
        if (action?.type === "current") {
          return { ...value, current: clampIndex(action.index, value.matches.length) };
        }
        if (tr.docChanged && value.query !== "") {
          const matches = findMatches(tr.doc, value.query);
          return { ...value, matches, current: clampIndex(value.current, matches.length) };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        const { matches, current } = findPluginKey.getState(state)!;
        if (matches.length === 0) return DecorationSet.empty;
        return DecorationSet.create(
          state.doc,
          matches.map((m, i) =>
            Decoration.inline(m.from, m.to, { class: i === current ? "find-match find-match-current" : "find-match" }),
          ),
        );
      },
    },
  });
}

/**
 * BlockNote extension (public `extensions` option of `useCreateBlockNote`): registers the plugin
 * and mirrors its state into a store that the find bar subscribes to.
 */
export const findExtension = createExtension(() => {
  const store = createStore<FindState>(EMPTY_FIND_STATE);
  const plugin = createFindPlugin();
  return {
    key: "find",
    store,
    prosemirrorPlugins: [
      new Plugin({
        key: new PluginKey("folio-find-mirror"),
        view: (view) => {
          const sync = () => {
            const next = findPluginKey.getState(view.state);
            if (next && next !== store.state) store.setState(next);
          };
          sync();
          return { update: sync };
        },
      }),
      plugin,
    ],
  } as const;
});

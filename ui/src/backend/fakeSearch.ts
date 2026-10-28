import { fold, foldWithMap } from "../lib/fold";
import type { PageMeta } from "./generated/PageMeta";
import type { SearchHit } from "./generated/SearchHit";

/** A stored block, flat (parent link instead of children). Sibling order = array order. */
export interface BlockRec {
  readonly id: string;
  readonly parentId: string | null;
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly content: unknown;
}

const SNIPPET_MAX = 120;
const ELLIPSIS = "…";
const NON_WORD = /[^\p{L}\p{N}]+/u;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((run: unknown) => {
      if (!isRecord(run)) return "";
      if (run.type === "text") return typeof run.text === "string" ? run.text : "";
      if (run.type === "link") return inlineText(run.content);
      return "";
    })
    .join("");
}

function tableText(content: unknown): string {
  if (!isRecord(content) || !Array.isArray(content.rows)) return "";
  return content.rows
    .flatMap((row: unknown) => (isRecord(row) && Array.isArray(row.cells) ? row.cells : []))
    .map((cell: unknown) => inlineText(Array.isArray(cell) ? cell : isRecord(cell) ? cell.content : []))
    .filter((t) => t !== "")
    .join(" ");
}

/** Plain text of one block (Phase 1: text and link runs; tables = cell texts joined by spaces). */
export function plainText(block: BlockRec): string {
  return block.type === "table" ? tableText(block.content) : inlineText(block.content);
}

export function queryTokens(query: string): string[] {
  return fold(query).split(NON_WORD).filter((t) => t !== "");
}

/** Every token is the prefix of some word of `text` (AND within this one text). */
function matchesAll(text: string, tokens: string[]): boolean {
  const words = fold(text).split(NON_WORD);
  return tokens.every((t) => words.some((w) => w.startsWith(t)));
}

/** UTF-16 offset in `original` of the first word-start match of `token` (any substring match, else 0). */
function matchCenter(original: string, token: string): number {
  const { folded, map } = foldWithMap(original);
  let at = -1;
  for (let i = folded.indexOf(token); i !== -1; i = folded.indexOf(token, i + 1)) {
    if (i === 0 || folded[i - 1] === " ") {
      at = i;
      break;
    }
  }
  if (at === -1) at = Math.max(folded.indexOf(token), 0);
  return map[at] ?? 0;
}

/** `center` is a UTF-16 offset into `text`; the cut itself counts chars (code points), like the core. */
function cutSnippet(text: string, center: number): string {
  const chars = Array.from(text);
  if (chars.length <= SNIPPET_MAX) return text;
  center = Array.from(text.slice(0, center)).length;
  const start = Math.min(Math.max(center - SNIPPET_MAX / 2, 0), chars.length - SNIPPET_MAX);
  const end = start + SNIPPET_MAX;
  const out = chars.slice(start, end);
  if (start > 0) out[0] = ELLIPSIS;
  if (end < chars.length) out[SNIPPET_MAX - 1] = ELLIPSIS;
  return out.join("");
}

/** Texts of a page's blocks in reading order (tabs in order, blocks depth-first). */
export type PageTexts = { page: PageMeta; texts: string[] };

/** Prefix-of-word search; title hits first, then page id; one hit per page. */
export function searchPages(pages: PageTexts[], query: string): SearchHit[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const { page, texts } of pages) {
    const titleMatch = matchesAll(page.title, tokens);
    const block = texts.find((t) => matchesAll(t, tokens));
    if (!titleMatch && block === undefined) continue;
    const snippet =
      block !== undefined
        ? cutSnippet(block, matchCenter(block, tokens[0]!))
        : cutSnippet(texts.find((t) => t !== "") ?? "", 0) /* title-only: head of first block */;
    hits.push({ pageId: page.id, pageTitle: page.title, snippet, titleMatch });
  }
  return hits.sort((a, b) => Number(b.titleMatch) - Number(a.titleMatch) || (a.pageId < b.pageId ? -1 : 1));
}

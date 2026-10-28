import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { vi } from "../i18n/vi";
import type { FolioEditor } from "./schema";

export type SlashKey =
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletedList"
  | "numberedList"
  | "todoList"
  | "quote"
  | "code"
  | "table";

/** Menu order (tech spec §5.7). Phases 4-5 append Math, CSV, Markdown, Image, File, Date, Page link, Dropdown. */
export const SLASH_ORDER: readonly SlashKey[] = [
  "text",
  "heading1",
  "heading2",
  "heading3",
  "bulletedList",
  "numberedList",
  "todoList",
  "quote",
  "code",
  "table",
];

export interface FolioSlashItem {
  key: SlashKey;
  title: string;
  aliases: string[];
  onItemClick: () => void;
}

const ALIASES: Record<SlashKey, string[]> = {
  text: ["paragraph", "p"],
  heading1: ["h1", "title"],
  heading2: ["h2"],
  heading3: ["h3"],
  bulletedList: ["ul", "bullet", "-"],
  numberedList: ["ol", "number", "1."],
  todoList: ["todo", "checkbox", "check", "[]"],
  quote: ["blockquote", ">"],
  code: ["codeblock", "```"],
  table: ["grid"],
};

// Same shape as BlockNote's own slash-menu table: 2 rows x 3 columns (header row comes from the block's defaults).
const EMPTY_TABLE_CONTENT = {
  type: "tableContent",
  rows: [{ cells: ["", "", ""] }, { cells: ["", "", ""] }],
} as never;

type SlashBlock = Parameters<typeof insertOrUpdateBlockForSlashMenu<FolioEditor["schema"]["blockSchema"], FolioEditor["schema"]["inlineContentSchema"], FolioEditor["schema"]["styleSchema"]>>[1];

const BLOCKS: Record<SlashKey, SlashBlock> = {
  text: { type: "paragraph" },
  heading1: { type: "heading", props: { level: 1 } },
  heading2: { type: "heading", props: { level: 2 } },
  heading3: { type: "heading", props: { level: 3 } },
  bulletedList: { type: "bulletListItem" },
  numberedList: { type: "numberedListItem" },
  todoList: { type: "checkListItem" },
  quote: { type: "quote" },
  code: { type: "codeBlock" },
  table: { type: "table", content: EMPTY_TABLE_CONTENT },
};

/**
 * The slash-menu items in `SLASH_ORDER`. Applying one converts the current block when it is empty
 * (or holds only the typed `/`), else inserts the new block below (BlockNote's own rule).
 */
export function slashItems(editor: FolioEditor): FolioSlashItem[] {
  return SLASH_ORDER.map((key) => ({
    key,
    title: vi.slashMenu[key],
    aliases: ALIASES[key],
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, BLOCKS[key]);
    },
  }));
}

/** Case-insensitive substring match on the title and each alias; an empty query keeps everything. */
export function filterSlashItems(items: FolioSlashItem[], query: string): FolioSlashItem[] {
  const q = query.toLowerCase();
  return items.filter(
    (item) => item.title.toLowerCase().includes(q) || item.aliases.some((a) => a.toLowerCase().includes(q)),
  );
}

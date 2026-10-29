import { insertColumns } from "./columns";
import { createElement, type ReactElement } from "react";
import { Text, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Code, Table, Image, Columns2, Columns3, type LucideIcon } from "lucide-react";
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
  | "table"
  | "image"
  | "columns2"
  | "columns3";

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
  "image",
  "columns2",
  "columns3",
];

export interface FolioSlashItem {
  key: SlashKey;
  title: string;
  aliases: string[];
  icon?: ReactElement;
  onItemClick: () => void;
}

const ICONS: Record<SlashKey, LucideIcon> = { text: Text, heading1: Heading1, heading2: Heading2, heading3: Heading3, bulletedList: List, numberedList: ListOrdered, todoList: ListTodo, quote: Quote, code: Code, table: Table, image: Image, columns2: Columns2, columns3: Columns3 };

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
  columns2: ["2 columns", "2 cot", "2 cột"],
  columns3: ["3 columns", "3 cot", "3 cột"],
  image: ["photo", "picture", "anh", "ảnh"],
};

// Same shape as BlockNote's own slash-menu table: 2 rows x 3 columns (header row comes from the block's defaults).
const EMPTY_TABLE_CONTENT = {
  type: "tableContent",
  rows: [{ cells: ["", "", ""] }, { cells: ["", "", ""] }],
} as never;

type SlashBlock = Parameters<typeof insertOrUpdateBlockForSlashMenu<FolioEditor["schema"]["blockSchema"], FolioEditor["schema"]["inlineContentSchema"], FolioEditor["schema"]["styleSchema"]>>[1];

const BLOCKS: Record<Exclude<SlashKey, "columns2" | "columns3">, SlashBlock> = {
  image: { type: "image" },
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
    icon: createElement(ICONS[key], { size: 18, "aria-hidden": true }),
    aliases: ALIASES[key],
    onItemClick: () => {
      if (key === "columns2" || key === "columns3") { insertColumns(editor, key === "columns2" ? 2 : 3); return; }
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

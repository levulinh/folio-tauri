import { columnsSpec, columnSpec } from "./columns";
import { BlockNoteSchema, createHeadingBlockSpec, defaultBlockSpecs, defaultStyleSpecs } from "@blocknote/core";

// Images and Folio layout containers extend the basic editor; audio/video/files
// and text/background color controls remain outside the current scope.
const { bulletListItem, checkListItem, codeBlock, numberedListItem, paragraph, quote, table, image } = defaultBlockSpecs;
const { bold, italic, underline, strike, code } = defaultStyleSpecs;

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    folioColumns: columnsSpec,
    folioColumn: columnSpec,
    image,
    paragraph,
    heading: createHeadingBlockSpec({ levels: [1, 2, 3], allowToggleHeadings: false }),
    bulletListItem,
    numberedListItem,
    checkListItem,
    quote,
    codeBlock,
    table,
  },
  styleSpecs: { bold, italic, underline, strike, code },
});

export type FolioEditor = typeof schema.BlockNoteEditor;

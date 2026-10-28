import { BlockNoteSchema, createHeadingBlockSpec, defaultBlockSpecs, defaultStyleSpecs } from "@blocknote/core";

// Default specs minus audio, video, file, image, toggleListItem, divider (they return in
// Phase 5 or never) and the textColor / backgroundColor styles; tech spec §5.6.
const { bulletListItem, checkListItem, codeBlock, numberedListItem, paragraph, quote, table } = defaultBlockSpecs;
const { bold, italic, underline, strike, code } = defaultStyleSpecs;

export const schema = BlockNoteSchema.create({
  blockSpecs: {
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

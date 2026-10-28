import {
  BlockNoteSchema,
  defaultBlockSpecs,
  type PartialBlock,
} from "@blocknote/core";
import { vi } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { textareaBlock } from "./TextareaBlock";

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, textareaBlock: textareaBlock() },
});

const emptyRow = { cells: ["", "", ""] };

const initialContent: PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>[] = [
  { type: "heading", props: { level: 1 }, content: "Kiểm tra gõ tiếng Việt" },
  { type: "paragraph" },
  { type: "heading", props: { level: 2 }, content: "Tiêu đề" },
  { type: "bulletListItem", content: "Danh sách" },
  {
    type: "table",
    content: { type: "tableContent", rows: [emptyRow, emptyRow] },
  },
  { type: "textareaBlock" },
];

export default function App() {
  const editor = useCreateBlockNote({
    schema,
    dictionary: { ...vi },
    initialContent,
  });

  return (
    <MantineProvider>
      <div style={{ padding: 16 }}>
        <BlockNoteView editor={editor} />
        <input
          placeholder="Ô tìm kiếm thử"
          style={{ width: "100%", boxSizing: "border-box", marginTop: 16, padding: 8 }}
        />
      </div>
    </MantineProvider>
  );
}

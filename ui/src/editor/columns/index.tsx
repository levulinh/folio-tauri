import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  PartialBlock,
  StyleSchema,
} from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { createReactBlockSpec } from "@blocknote/react";
import { closeHistory } from "prosemirror-history";
import "./columns.css";

/** Both containers are layout nodes; editable content lives in ordinary descendants. */
export const columnsSpec = createReactBlockSpec(
  {
    type: "folioColumns",
    propSchema: { count: { default: 2, values: [2, 3] as const } },
    content: "none",
    layoutOnly: true,
    children: { allow: ["folioColumn"], min: 2, dissolve: true },
  },
  {
    renderFrame: function ColumnsFrame({ block, slotRef }) {
      return (
        <div className="folio-columns" data-testid="columns-layout" data-columns={block.children.length}>
          <div className="folio-columns__slots" ref={slotRef} />
        </div>
      );
    },
  },
)();

export const columnSpec = createReactBlockSpec(
  {
    type: "folioColumn", propSchema: {}, content: "none", layoutOnly: true,
    placeable: "namedOnly",
    // The blocks form implicitly requires one child and dissolves when emptied.
    children: { allow: "blocks", exclude: ["folioColumns"] },
  },
  {
    renderFrame: function ColumnFrame({ slotRef }) {
      return <div className="folio-column" data-testid="column" ref={slotRef} />;
    },
  },
)();

export type ColumnCount = 2 | 3;

/**
 * Slash-item callback for a schema registering both specs under their own names.
 * Works after SuggestionMenuWrapper has cleared the query, or directly with an active menu.
 * Returns undefined inside an existing layout; it does not mutate the slash query there.
 */
export function insertColumns<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>, count: ColumnCount) {
  if (count !== 2 && count !== 3) throw new RangeError("Columns require a count of 2 or 3");
  if (!editor.schema.blockSchema.folioColumns || !editor.schema.blockSchema.folioColumn || !editor.schema.blockSchema.paragraph) {
    throw new Error("Register folioColumns, folioColumn and paragraph before inserting columns");
  }

  const current = editor.getTextCursorPosition().block;
  for (let ancestor: typeof current | undefined = current; ancestor; ancestor = editor.getParentBlock(ancestor)) {
    if (ancestor.type === "folioColumns" || ancestor.type === "folioColumn") return undefined;
  }

  const menu = editor.getExtension(SuggestionMenu);
  menu?.clearQuery();
  menu?.closeMenu();
  const inserted = editor.transact((tr) => {
    // Keep earlier typing separate from layout insertion in the normal history stack.
    closeHistory(tr);

    const target = editor.getTextCursorPosition().block;
    const content = target.content;
    const empty = Array.isArray(content) && (
      content.length === 0 ||
      (content.length === 1 && content[0]?.type === "text" && "text" in content[0] && content[0].text === "/")
    );
    // Runtime registration is checked above; B remains generic so Folio can extend its schema independently.
    const layout = {
      type: "folioColumns",
      props: { count },
      children: Array.from({ length: count }, () => ({
        type: "folioColumn",
        children: [{ type: "paragraph", content: [] }],
      })),
    } as unknown as PartialBlock<B, I, S>;
    const block = empty && target.children.length === 0
      ? editor.updateBlock(target, layout)
      : editor.insertBlocks([layout], target, "after")[0]!;
    editor.setTextCursorPosition(block.children[0]!.children[0]!, "start");
    return block;
  });
  editor.focus();
  // Stop subsequent typing from merging with insertion as well.
  editor.transact((tr) => { closeHistory(tr); });
  return inserted;
}

/** Install once per editor; call the returned cleanup on unmount. Grid rendering needs no installer. */
export function installColumnsCountSync<B extends BlockSchema, I extends InlineContentSchema, S extends StyleSchema>(
  editor: BlockNoteEditor<B, I, S>,
): () => void {
  let disposed = false;
  let queued = false;
  const reconcile = () => {
    if (disposed) return;
    const updates: { id: string; count: ColumnCount }[] = [];
    const visit = (blocks: typeof editor.document) => {
      for (const block of blocks) {
        const count = block.children.length;
        if (block.type === "folioColumns" && (count === 2 || count === 3) && block.props.count !== count) {
          updates.push({ id: block.id, count });
        }
        visit(block.children);
      }
    };
    visit(editor.document);
    if (!updates.length) return;
    editor.transact((tr) => {
      tr.setMeta("addToHistory", false);
      for (const { id, count } of updates) {
        editor.updateBlock(id, { props: { count } } as unknown as PartialBlock<B, I, S>);
      }
    });
  };
  // Defer to avoid reading editor state from inside a change transaction.
  const unsubscribe = editor.onChange(() => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => { queued = false; reconcile(); });
  });
  reconcile();
  return () => { disposed = true; unsubscribe(); };
}

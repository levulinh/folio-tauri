import { TableHandlesExtension } from "@blocknote/core/extensions";
import {
  AddButton,
  ExtendButton,
  TableHandle,
  TableHandlesController,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtension,
  useExtensionState,
  type TableHandleMenuProps,
  type TableHandleProps,
} from "@blocknote/react";
import { useEffect, useRef } from "react";

/** Delete row / column; the table's last row or column removes the whole block (D-029). */
function DeleteItem({ orientation }: TableHandleMenuProps) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor();
  const tableHandles = useExtension(TableHandlesExtension);
  const { block, index } = useExtensionState(TableHandlesExtension, {
    selector: (state) => ({ block: state?.block, index: orientation === "column" ? state?.colIndex : state?.rowIndex }),
  });
  if (!tableHandles || !block || index === undefined) return null;
  const rows = block.content.rows as { cells: unknown[] }[];
  const count = orientation === "row" ? rows.length : (rows[0]?.cells.length ?? 0);
  const onClick = () => {
    if (count <= 1) editor.removeBlocks([block]);
    else tableHandles.removeRowOrColumn(index, orientation);
  };
  return (
    <Components.Generic.Menu.Item onClick={onClick}>
      {orientation === "row" ? dict.table_handle.delete_row_menuitem : dict.table_handle.delete_column_menuitem}
    </Components.Generic.Menu.Item>
  );
}

/** "Hàng tiêu đề" on the handle of row 0, "Cột tiêu đề" on the handle of column 0 (a checked toggle). */
function HeaderToggle({ orientation }: TableHandleMenuProps) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor();
  const { block, index } = useExtensionState(TableHandlesExtension, {
    selector: (state) => ({ block: state?.block, index: orientation === "column" ? state?.colIndex : state?.rowIndex }),
  });
  if (!block || index !== 0) return null;
  const key = orientation === "row" ? "headerRows" : "headerCols";
  const isHeader = Boolean(block.content[key]);
  return (
    <Components.Generic.Menu.Item
      checked={isHeader}
      onClick={() => editor.updateBlock(block, { ...block, content: { ...block.content, [key]: isHeader ? undefined : 1 } as never })}
    >
      {orientation === "row" ? dict.drag_handle.header_row_menuitem : dict.drag_handle.header_column_menuitem}
    </Components.Generic.Menu.Item>
  );
}

/** Add before/after, delete, header toggle; no colour, split or merge. */
function FolioTableHandleMenu({ orientation }: TableHandleMenuProps) {
  const Components = useComponentsContext()!;
  return (
    <Components.Generic.Menu.Dropdown className="bn-table-handle-menu">
      {orientation === "row" ? (
        <>
          <AddButton orientation="row" side="above" />
          <AddButton orientation="row" side="below" />
        </>
      ) : (
        <>
          <AddButton orientation="column" side="left" />
          <AddButton orientation="column" side="right" />
        </>
      )}
      <DeleteItem orientation={orientation} />
      <HeaderToggle orientation={orientation} />
    </Components.Generic.Menu.Dropdown>
  );
}

function FolioTableHandle(props: TableHandleProps) {
  const holder = useRef<HTMLSpanElement>(null);
  // The handle forwards no props; BlockNote marks its icon with `data-test`.
  useEffect(() => {
    holder.current
      ?.querySelector('[data-test="tableHandle"]')
      ?.closest(".bn-table-handle")
      ?.setAttribute("data-testid", `table-handle-${props.orientation}`);
  });
  return (
    <span ref={holder} style={{ display: "contents" }}>
      <TableHandle {...props} tableHandleMenu={FolioTableHandleMenu as never} />
    </span>
  );
}

const NoCellHandle = () => null;

/** BlockNote's table handles with Folio's menus; the cell menu (colour / split) is off. */
export function FolioTableHandles() {
  return <TableHandlesController tableHandle={FolioTableHandle} tableCellHandle={NoCellHandle} extendButton={ExtendButton} />;
}

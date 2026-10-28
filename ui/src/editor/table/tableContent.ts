/** Table block content as BlockNote hands it over, typed loosely (the generic schema types do not narrow here). */
export type TableContent = {
  rows: { cells: unknown[] }[];
  columnWidths?: (number | undefined)[];
  headerRows?: number;
  headerCols?: number;
};

/**
 * Content with the first row or column removed and the header flag kept on the new first one (D-029, Notion parity).
 * Pure: the input is not mutated; column widths shift with a deleted column, every other field is kept.
 */
export function withoutFirst(content: TableContent, orientation: "row" | "column"): TableContent {
  if (orientation === "row") return { ...content, rows: content.rows.slice(1), headerRows: 1 };
  return {
    ...content,
    rows: content.rows.map((r) => ({ ...r, cells: r.cells.slice(1) })),
    columnWidths: content.columnWidths?.slice(1),
    headerCols: 1,
  };
}

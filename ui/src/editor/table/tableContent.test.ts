import { describe, expect, it } from "vitest";
import { withoutFirst, type TableContent } from "./tableContent";

const base = (): TableContent & { type: string } => ({
  type: "tableContent",
  rows: [{ cells: ["a", "b", "c"] }, { cells: ["d", "e", "f"] }],
  columnWidths: [100, undefined, 150],
  headerRows: 1,
  headerCols: 1,
});

describe("withoutFirst", () => {
  it("drops row 0, keeps the header row flag and every other field", () => {
    const content = base();
    const next = withoutFirst(content, "row");
    expect(next.rows).toEqual([{ cells: ["d", "e", "f"] }]);
    expect(next).toMatchObject({ type: "tableContent", headerRows: 1, headerCols: 1, columnWidths: [100, undefined, 150] });
  });

  it("drops column 0, shifts the widths and keeps the header column flag", () => {
    const next = withoutFirst(base(), "column");
    expect(next.rows).toEqual([{ cells: ["b", "c"] }, { cells: ["e", "f"] }]);
    expect(next.columnWidths).toEqual([undefined, 150]);
    expect(next).toMatchObject({ type: "tableContent", headerCols: 1, headerRows: 1 });
  });

  it("sets the header flag even when it was not set, and leaves absent widths absent", () => {
    const bare: Partial<TableContent> = base();
    delete bare.columnWidths;
    delete bare.headerRows;
    expect(withoutFirst(bare as TableContent, "row").headerRows).toBe(1);
    expect(withoutFirst(bare as TableContent, "column").columnWidths).toBeUndefined();
  });

  it("does not mutate its input", () => {
    const content = base();
    const snapshot = JSON.stringify(content);
    withoutFirst(content, "row");
    withoutFirst(content, "column");
    expect(JSON.stringify(content)).toBe(snapshot);
  });
});

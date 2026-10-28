import { describe, expect, it } from "vitest";
import cases from "../../../crates/folio-core/tests/fixtures/fold_cases.json";
import { fold, foldWithMap } from "./fold";

describe("fold", () => {
  it.each(cases as [string, string][])("folds %j to %j", (input, expected) => {
    expect(fold(input)).toBe(expected);
  });
});

describe("foldWithMap (UTF-16 offsets, one entry per UTF-16 unit of the folded string)", () => {
  it("points at the source of every folded unit", () => {
    expect(foldWithMap("Hà Nội")).toEqual({ folded: "ha noi", map: [0, 1, 2, 3, 4, 5] });
  });

  it("tracks original offsets through decomposition, whitespace runs and trimming", () => {
    const { folded, map } = foldWithMap("  Nẵng \t x ");
    expect(folded).toBe("nang x");
    expect(map).toEqual([2, 3, 6, 7, 8, 11]);
  });

  it("maps a supplementary-plane char to its first UTF-16 unit for both of its units", () => {
    const { folded, map } = foldWithMap("😀 Ơn");
    expect(folded).toBe("😀 on");
    expect(map).toEqual([0, 0, 2, 3, 4]);
  });

  it("has one map entry per folded unit for every fixture row", () => {
    for (const [input] of cases as [string, string][]) {
      const { folded, map } = foldWithMap(input);
      expect(map).toHaveLength(folded.length);
      expect(folded).toBe(fold(input));
    }
  });
});

import { describe, expect, it } from "vitest";
import cases from "../../../crates/folio-core/tests/fixtures/fold_cases.json";
import { fold } from "./fold";

describe("fold", () => {
  it.each(cases as [string, string][])("folds %j to %j", (input, expected) => {
    expect(fold(input)).toBe(expected);
  });
});

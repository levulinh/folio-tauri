import { describe, expect, it } from "vitest";
import { toWellFormed, wellFormedDeep } from "./wellFormed";

const isWellFormed = (s: string) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

describe("toWellFormed", () => {
  it("replaces lone surrogates and keeps valid pairs", () => {
    expect(toWellFormed("a\ud83db")).toBe("a�b");
    expect(toWellFormed("a\ude00b")).toBe("a�b");
    expect(toWellFormed("ok 😀 ế")).toBe("ok 😀 ế");
  });
  it("works without the native method", () => {
    const proto = String.prototype as { toWellFormed?: () => string };
    const native = proto.toWellFormed;
    delete proto.toWellFormed;
    try {
      expect(toWellFormed("a\ud83db😀")).toBe("a\uFFFDb😀");
    } finally {
      proto.toWellFormed = native;
    }
  });
  it("walks nested values", () => {
    const out = wellFormedDeep({ a: ["\ud83d", { b: "x\ude00" }], n: 1, z: null });
    expect(out).toEqual({ a: ["�", { b: "x�" }], n: 1, z: null });
    expect(isWellFormed(JSON.stringify(out))).toBe(true);
  });
});

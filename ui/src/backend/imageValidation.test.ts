import { describe, expect, it } from "vitest";
import { imageMime } from "./imageValidation";
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
describe("raster import validation", () => {
  it("accepts matching raster signatures", () => {
    expect(imageMime("a.PNG", png)).toBe("image/png");
    expect(imageMime("a.jpeg", new Uint8Array([255, 216, 255]))).toBe("image/jpeg");
    expect(imageMime("a.gif", new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(imageMime("a.webp", new TextEncoder().encode("RIFF1234WEBP"))).toBe("image/webp");
  });
  it("rejects mismatched extensions, incomplete signatures and path names", () => {
    for (const name of ["a.svg", "a.jpg", "../a.png", "a\\b.png", "", "a\u0000.png"]) expect(() => imageMime(name, png)).toThrow();
    expect(() => imageMime("a.png", png.slice(0, 4))).toThrow();
    expect(() => imageMime("a.png", new Uint8Array(20 * 1024 * 1024 + 1))).toThrow();
  });
});

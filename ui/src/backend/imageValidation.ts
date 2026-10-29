/** Keep preview imports aligned with Rust's raster-only asset contract. */
export function imageMime(name: string, bytes: Uint8Array): string {
  const invalid = () => { throw { code: "invalid_op", message: "Expected PNG, JPEG, GIF or WebP, maximum 20 MiB" }; };
  if (!name.trim() || name.length > 255 || /[/\\\p{Cc}]/u.test(name) || bytes.length === 0 || bytes.length > 20 * 1024 * 1024) return invalid();
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const prefix = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (ext === "png" && prefix([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if ((ext === "jpg" || ext === "jpeg") && prefix([255, 216, 255])) return "image/jpeg";
  const head = String.fromCharCode(...bytes.slice(0, 12));
  if (ext === "gif" && /^GIF8[79]a/.test(head)) return "image/gif";
  if (ext === "webp" && bytes.length >= 12 && head.startsWith("RIFF") && head.slice(8) === "WEBP") return "image/webp";
  return invalid();
}

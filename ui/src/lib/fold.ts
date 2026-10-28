/** Vietnamese-aware folding; twin of `folio_core::fold` (tech spec §3.6). */

// Exactly Rust's `char::is_whitespace` (Unicode White_Space): U+0085 is whitespace, U+FEFF is not.
// (JS `\s` differs on both.)
const WHITESPACE = /^[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]$/;
const MARK = /^\p{M}$/u;

export interface FoldMap {
  folded: string;
  /**
   * One entry per UTF-16 code unit of `folded` (so an astral char has two equal entries): the
   * UTF-16 offset in the ORIGINAL string of the char that produced it. Whitespace runs keep the
   * offset of their first char. Same contract as Rust's `fold_with_map`, except that Rust counts
   * chars; the two agree for text without astral chars. UTF-16 is what ProseMirror text offsets use.
   */
  map: number[];
}

export function foldWithMap(s: string): FoldMap {
  let folded = "";
  const map: number[] = [];
  let offset = 0;
  for (const original of s) {
    for (const lowered of original.toLowerCase()) {
      for (const ch of lowered.normalize("NFD")) {
        if (MARK.test(ch)) continue;
        if (WHITESPACE.test(ch)) {
          if (folded !== "" && !folded.endsWith(" ")) {
            folded += " ";
            map.push(offset);
          }
          continue;
        }
        const out = ch === "đ" ? "d" : ch;
        folded += out;
        for (let i = 0; i < out.length; i += 1) map.push(offset);
      }
    }
    offset += original.length;
  }
  if (folded.endsWith(" ")) {
    folded = folded.slice(0, -1);
    map.pop();
  }
  return { folded, map };
}

export function fold(s: string): string {
  return foldWithMap(s).folded;
}

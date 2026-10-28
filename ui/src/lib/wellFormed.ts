/**
 * Replaces lone UTF-16 surrogates with U+FFFD. serde_json rejects them, so a single one in a block
 * would make its tab unsaveable for good. Uses the native `toWellFormed` when the engine has it.
 */
export function toWellFormed(s: string): string {
  const native = (s as { toWellFormed?: () => string }).toWellFormed;
  if (typeof native === "function") return native.call(s);
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
}

/** `toWellFormed` for every string inside a JSON-like value (strings, arrays, plain objects); returns a copy. */
export function wellFormedDeep<T>(value: T): T {
  if (typeof value === "string") return toWellFormed(value) as T;
  if (Array.isArray(value)) return value.map(wellFormedDeep) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [toWellFormed(k), wellFormedDeep(v)])) as T;
  }
  return value;
}

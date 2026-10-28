//! Vietnamese-aware text folding (tech spec §3.6). The TS twin lives in `ui/src/lib/fold.ts`.

use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

/// Fold `s`: lowercase, strip diacritics, `đ` -> `d`, collapse whitespace, trim.
pub fn fold(s: &str) -> String {
    fold_with_map(s).0
}

/// Like [`fold`], also returning for each folded char the char index in `s`
/// (the original input) of the char that produced it. Whitespace runs keep
/// the index of their first char.
pub fn fold_with_map(s: &str) -> (String, Vec<usize>) {
    let mut folded = String::with_capacity(s.len());
    let mut map: Vec<usize> = Vec::with_capacity(s.len());
    for (idx, original) in s.chars().enumerate() {
        for lowered in original.to_lowercase() {
            for ch in std::iter::once(lowered).nfd() {
                if is_combining_mark(ch) {
                    continue;
                }
                if ch.is_whitespace() {
                    if !folded.is_empty() && !folded.ends_with(' ') {
                        folded.push(' ');
                        map.push(idx);
                    }
                    continue;
                }
                folded.push(if ch == 'đ' { 'd' } else { ch });
                map.push(idx);
            }
        }
    }
    if folded.ends_with(' ') {
        folded.pop();
        map.pop();
    }
    (folded, map)
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn fold_matches_shared_fixture() {
        let cases: Vec<(String, String)> =
            serde_json::from_str(include_str!("../tests/fixtures/fold_cases.json")).unwrap();
        assert!(!cases.is_empty());
        for (input, expected) in cases {
            assert_eq!(fold(&input), expected, "input {input:?}");
        }
    }

    #[test]
    fn map_points_to_source() {
        let (folded, map) = fold_with_map("Hà Nội");
        assert_eq!(folded, "ha noi");
        assert_eq!(map, vec![0, 1, 2, 3, 4, 5]);
    }

    #[test]
    fn map_covers_every_folded_char_for_precomposed_input() {
        let (folded, map) = fold_with_map("Đà Nẵng");
        assert_eq!(folded, "da nang");
        assert_eq!(map, vec![0, 1, 2, 3, 4, 5, 6]);
    }

    #[test]
    fn map_tracks_original_indices_through_decomposition_and_whitespace() {
        // NFD input: marks are separate original chars, so indices skip them.
        let (folded, map) = fold_with_map("  Na\u{306}\u{303}ng \t x ");
        assert_eq!(folded, "nang x");
        assert_eq!(map.len(), folded.chars().count());
        assert_eq!(map, vec![2, 3, 6, 7, 8, 11]);
    }
}

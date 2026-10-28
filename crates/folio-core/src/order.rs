//! Fractional order keys. Keys compare correctly under SQLite's default BINARY
//! collation, i.e. plain byte order, which equals Rust `str` ordering.

use fractional_index::FractionalIndex;

use crate::error::{CoreError, Result};

fn out_of_order() -> CoreError {
    CoreError::InvalidOp {
        index: 0,
        reason: "order keys out of order".into(),
    }
}

fn parse(key: &str) -> Result<FractionalIndex> {
    FractionalIndex::from_string(key).map_err(|_| CoreError::InvalidOp {
        index: 0,
        reason: format!("invalid order key: {key}"),
    })
}

/// Returns a key `k` with `prev < k < next`; `None` is an open end.
pub fn key_between(prev: Option<&str>, next: Option<&str>) -> Result<String> {
    let prev = prev.map(parse).transpose()?;
    let next = next.map(parse).transpose()?;
    let key = match (prev, next) {
        (None, None) => FractionalIndex::default(),
        (Some(p), None) => FractionalIndex::new_after(&p),
        (None, Some(n)) => FractionalIndex::new_before(&n),
        (Some(p), Some(n)) => FractionalIndex::new_between(&p, &n).ok_or_else(out_of_order)?,
    };
    Ok(key.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Lcg(u64);
    impl Lcg {
        fn next(&mut self) -> u64 {
            self.0 = self
                .0
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            self.0 >> 33
        }
    }

    #[test]
    fn between_none_none() {
        assert!(!key_between(None, None).unwrap().is_empty());
    }

    #[test]
    fn after() {
        let a = key_between(None, None).unwrap();
        assert!(key_between(Some(&a), None).unwrap() > a);
    }

    #[test]
    fn before() {
        let a = key_between(None, None).unwrap();
        assert!(key_between(None, Some(&a)).unwrap() < a);
    }

    #[test]
    fn between() {
        let first = key_between(None, None).unwrap();
        let next = key_between(Some(&first), None).unwrap();
        let mut prev = first;
        for _ in 0..1000 {
            let k = key_between(Some(&prev), Some(&next)).unwrap();
            assert!(prev < k && k < next, "{prev} < {k} < {next}");
            prev = k;
        }
    }

    #[test]
    fn byte_order_matches_rust_string_order() {
        let mut rng = Lcg(42);
        let mut ordered: Vec<String> = Vec::new();
        for _ in 0..200 {
            let pos = (rng.next() as usize) % (ordered.len() + 1);
            let prev = pos.checked_sub(1).map(|i| ordered[i].as_str());
            let next = ordered.get(pos).map(String::as_str);
            let k = key_between(prev, next).unwrap();
            ordered.insert(pos, k);
        }
        let mut sorted = ordered.clone();
        sorted.sort();
        assert_eq!(sorted, ordered);
        sorted.dedup();
        assert_eq!(sorted.len(), 200);
    }

    #[test]
    fn reversed_is_error() {
        let a = key_between(None, None).unwrap();
        let b = key_between(Some(&a), None).unwrap();
        for (p, n) in [(&b, &a), (&a, &a)] {
            match key_between(Some(p), Some(n)) {
                Err(CoreError::InvalidOp { index: 0, reason }) => {
                    assert_eq!(reason, "order keys out of order")
                }
                other => panic!("expected InvalidOp, got {other:?}"),
            }
        }
    }
}

//! Order keys: a port of the MIT-licensed `fractional-indexing` algorithm
//! (rocicorp, `generateKeyBetween`) with base-62 digits `0-9A-Za-z`.
//! The digits are in ASCII order, so SQLite's default BINARY collation, plain
//! byte order and Rust `str` ordering all agree.
//!
//! A key is an integer part (a head char `a`-`z` / `A`-`Z` giving its length,
//! then digits) followed by a fractional part that never ends in `0`.

use crate::error::{CoreError, Result};

const DIGITS: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ZERO: u8 = b'0';
const LAST: u8 = b'z';
const SMALLEST_INTEGER: &str = "A00000000000000000000000000";

type Res<T> = std::result::Result<T, String>;

fn digit_value(c: u8) -> Res<usize> {
    DIGITS
        .iter()
        .position(|&d| d == c)
        .ok_or_else(|| format!("invalid character {:?} in order key", c as char))
}

/// Midpoint of two fractional parts; `a < b` (or `b` open), no trailing zeros.
fn midpoint(a: &[u8], b: Option<&[u8]>) -> Res<Vec<u8>> {
    if let Some(b) = b {
        if a >= b {
            return Err("order keys out of order".into());
        }
    }
    if a.last() == Some(&ZERO) || b.is_some_and(|b| b.last() == Some(&ZERO)) {
        return Err("fractional part ends in 0".into());
    }
    if let Some(b) = b {
        let mut n = 0;
        while a.get(n).copied().unwrap_or(ZERO) == *b.get(n).ok_or("order keys out of order")? {
            n += 1;
        }
        if n > 0 {
            let mut out = b[..n].to_vec();
            out.extend(midpoint(&a[n.min(a.len())..], Some(&b[n..]))?);
            return Ok(out);
        }
    }
    let digit_a = a.first().map_or(Ok(0), |&c| digit_value(c))?;
    let digit_b = b.map_or(Ok(DIGITS.len()), |b| digit_value(b[0]))?;
    if digit_b - digit_a > 1 {
        return Ok(vec![DIGITS[(digit_a + digit_b).div_ceil(2)]]);
    }
    if let Some(b) = b.filter(|b| b.len() > 1) {
        return Ok(b[..1].to_vec());
    }
    let mut out = vec![DIGITS[digit_a]];
    out.extend(midpoint(a.get(1..).unwrap_or(&[]), None)?);
    Ok(out)
}

fn integer_length(head: u8) -> Res<usize> {
    match head {
        b'a'..=b'z' => Ok((head - b'a') as usize + 2),
        b'A'..=b'Z' => Ok((b'Z' - head) as usize + 2),
        _ => Err(format!("invalid order key head {:?}", head as char)),
    }
}

/// Splits a key into (integer part, fractional part).
fn split(key: &[u8]) -> Res<(&[u8], &[u8])> {
    let len = integer_length(*key.first().ok_or("order key is empty")?)?;
    if len > key.len() {
        return Err("order key is too short for its head".into());
    }
    Ok(key.split_at(len))
}

fn validate(key: &str) -> Res<()> {
    let bytes = key.as_bytes();
    if key == SMALLEST_INTEGER {
        return Err("order key is the smallest integer".into());
    }
    let (int, frac) = split(bytes)?;
    for &c in int[1..].iter().chain(frac) {
        digit_value(c)?;
    }
    if frac.last() == Some(&ZERO) {
        return Err("fractional part ends in 0".into());
    }
    Ok(())
}

/// Next integer, or `None` on overflow of the largest one.
fn increment(int: &[u8]) -> Option<Vec<u8>> {
    let mut out = int.to_vec();
    let mut carry = true;
    for i in (1..out.len()).rev() {
        if !carry {
            break;
        }
        let d = digit_value(out[i]).ok()? + 1;
        if d == DIGITS.len() {
            out[i] = ZERO;
        } else {
            out[i] = DIGITS[d];
            carry = false;
        }
    }
    if carry {
        match out[0] {
            b'Z' => return Some(b"a0".to_vec()),
            b'z' => return None,
            h => {
                out[0] = h + 1;
                if out[0] > b'a' {
                    out.push(ZERO);
                } else {
                    out.pop();
                }
            }
        }
    }
    Some(out)
}

/// Previous integer, or `None` on underflow of the smallest one.
fn decrement(int: &[u8]) -> Option<Vec<u8>> {
    let mut out = int.to_vec();
    let mut borrow = true;
    for i in (1..out.len()).rev() {
        if !borrow {
            break;
        }
        let d = digit_value(out[i]).ok()?;
        if d == 0 {
            out[i] = LAST;
        } else {
            out[i] = DIGITS[d - 1];
            borrow = false;
        }
    }
    if borrow {
        match out[0] {
            b'a' => return Some(b"Zz".to_vec()),
            b'A' => return None,
            h => {
                out[0] = h - 1;
                if out[0] < b'Z' {
                    out.push(LAST);
                } else {
                    out.pop();
                }
            }
        }
    }
    Some(out)
}

fn generate(a: Option<&str>, b: Option<&str>) -> Res<String> {
    if let Some(a) = a {
        validate(a)?;
    }
    if let Some(b) = b {
        validate(b)?;
    }
    if let (Some(a), Some(b)) = (a, b) {
        if a >= b {
            return Err("order keys out of order".into());
        }
    }
    let text = |v: Vec<u8>| String::from_utf8(v).map_err(|_| "non-ascii order key".to_string());
    let join = |int: &[u8], frac: Vec<u8>| text([int, &frac].concat());
    match (a, b) {
        (None, None) => Ok("a0".into()),
        (None, Some(b)) => {
            let (ib, fb) = split(b.as_bytes())?;
            if ib == SMALLEST_INTEGER.as_bytes() {
                return join(ib, midpoint(b"", Some(fb))?);
            }
            if ib < b.as_bytes() {
                return text(ib.to_vec());
            }
            text(decrement(ib).ok_or("cannot decrement any more")?)
        }
        (Some(a), None) => {
            let (ia, fa) = split(a.as_bytes())?;
            match increment(ia) {
                Some(i) => text(i),
                None => join(ia, midpoint(fa, None)?),
            }
        }
        (Some(a), Some(b)) => {
            let (ia, fa) = split(a.as_bytes())?;
            let (ib, fb) = split(b.as_bytes())?;
            if ia == ib {
                return join(ia, midpoint(fa, Some(fb))?);
            }
            let i = increment(ia).ok_or("cannot increment any more")?;
            if i.as_slice() < b.as_bytes() {
                return text(i);
            }
            join(ia, midpoint(fa, None)?)
        }
    }
}

/// Returns a key `k` with `prev < k < next` under byte order; `None` is an open end.
pub fn key_between(prev: Option<&str>, next: Option<&str>) -> Result<String> {
    let invalid = |reason: String| CoreError::InvalidOp { index: 0, reason };
    let key = generate(prev, next).map_err(invalid)?;
    let above = prev.is_none_or(|p| p < key.as_str());
    let below = next.is_none_or(|n| key.as_str() < n);
    if !(above && below) {
        return Err(invalid("order key generation failed".into()));
    }
    Ok(key)
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
        for _ in 0..1000 {
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
        assert_eq!(sorted.len(), 1000);
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

    #[test]
    fn prepend_1000_then_insert_between_smallest() {
        let mut keys = vec![key_between(None, None).unwrap()];
        for _ in 0..1000 {
            keys.insert(0, key_between(None, Some(&keys[0])).unwrap());
        }
        assert!(keys.windows(2).all(|w| w[0] < w[1]));
        let k = key_between(Some(&keys[0]), Some(&keys[1])).unwrap();
        assert!(keys[0] < k && k < keys[1]);
        // the reviewer's scenario: prepend 300 times, then between the two smallest
        let mut k = key_between(None, None).unwrap();
        for _ in 0..300 {
            k = key_between(None, Some(&k)).unwrap();
        }
        let second = key_between(Some(&k), None).unwrap();
        let mid = key_between(Some(&k), Some(&second)).unwrap();
        assert!(k < mid && mid < second);
    }

    #[test]
    fn append_1000_keys_increase() {
        let mut prev = key_between(None, None).unwrap();
        for _ in 0..1000 {
            let k = key_between(Some(&prev), None).unwrap();
            assert!(k > prev);
            prev = k;
        }
    }

    #[test]
    fn alternating_inserts_stay_ordered() {
        let mut lo = key_between(None, None).unwrap();
        let mut hi = key_between(Some(&lo), None).unwrap();
        for i in 0..500 {
            let k = key_between(Some(&lo), Some(&hi)).unwrap();
            assert!(lo < k && k < hi);
            if i % 2 == 0 {
                lo = k;
            } else {
                hi = k;
            }
        }
    }

    #[test]
    fn malformed_keys_are_invalid_op() {
        let smallest = "A00000000000000000000000000";
        for bad in ["", "800", "aé", "a00", "a1V0", "a", "b1", "a-", smallest] {
            for (p, n) in [
                (Some(bad), None),
                (None, Some(bad)),
                (Some(bad), Some("a1")),
            ] {
                assert!(
                    matches!(key_between(p, n), Err(CoreError::InvalidOp { .. })),
                    "{bad:?} should be InvalidOp"
                );
            }
        }
    }
}

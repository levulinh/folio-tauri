//! Full-text index maintenance (crate-private helpers) and `Store::search`.
//! Every function that deletes pages, tabs or blocks must call the matching `unindex_*`
//! in the same transaction: FTS rows have no foreign keys.
//!
//! `search_fts`'s owner columns are UNINDEXED, so every lookup goes through the
//! `search_owner` side table (owner -> fts rowid) and touches `search_fts` by rowid only.

use std::collections::HashMap;

use rusqlite::{params, OptionalExtension, Transaction};
use serde_json::Value;

use crate::db::Store;
use crate::error::Result;
use crate::fold::{fold, fold_with_map};
use crate::model::SearchHit;
use crate::text::{plain_text, DbTextContext};

const SNIPPET_MAX_CHARS: usize = 120;
const ELLIPSIS: char = '…';

const SELECT_ROWID_BY_OWNER: &str =
    "SELECT fts_rowid FROM search_owner WHERE kind = ?1 AND owner_id = ?2";
const SELECT_ROWIDS_BY_PAGE: &str = "SELECT fts_rowid FROM search_owner WHERE page_id = ?1";
const DELETE_FTS_BY_ROWID: &str = "DELETE FROM search_fts WHERE rowid = ?1";
const DELETE_OWNER_BY_ROWID: &str = "DELETE FROM search_owner WHERE fts_rowid = ?1";

/// Inserts or updates the one row owned by (`kind`, `owner_id`). `plain` is folded here.
fn upsert_row(
    tx: &Transaction,
    kind: &str,
    owner_id: &str,
    page_id: &str,
    plain: &str,
) -> Result<()> {
    let existing: Option<i64> = tx
        .prepare_cached(SELECT_ROWID_BY_OWNER)?
        .query_row(params![kind, owner_id], |r| r.get(0))
        .optional()?;
    let text = fold(plain);
    match existing {
        Some(rowid) => {
            tx.prepare_cached("UPDATE search_fts SET text = ?2, page_id = ?3 WHERE rowid = ?1")?
                .execute(params![rowid, text, page_id])?;
            tx.prepare_cached("UPDATE search_owner SET page_id = ?2 WHERE fts_rowid = ?1")?
                .execute(params![rowid, page_id])?;
        }
        None => {
            tx.prepare_cached(
                "INSERT INTO search_fts (kind, owner_id, page_id, text) VALUES (?1, ?2, ?3, ?4)",
            )?
            .execute(params![kind, owner_id, page_id, text])?;
            let rowid = tx.last_insert_rowid();
            tx.prepare_cached(
                "INSERT INTO search_owner (fts_rowid, kind, owner_id, page_id) VALUES (?1, ?2, ?3, ?4)",
            )?
            .execute(params![rowid, kind, owner_id, page_id])?;
        }
    }
    Ok(())
}

/// Replaces the `title` row of a page. The stored text is folded.
pub(crate) fn index_title(tx: &Transaction, page_id: &str, title: &str) -> Result<()> {
    upsert_row(tx, "title", page_id, page_id, title)
}

/// Replaces the `block` row of a block. `plain` is the block's plain text; it is folded here.
pub(crate) fn index_block(
    tx: &Transaction,
    block_id: &str,
    page_id: &str,
    plain: &str,
) -> Result<()> {
    upsert_row(tx, "block", block_id, page_id, plain)
}

fn delete_rowid(tx: &Transaction, rowid: i64) -> Result<()> {
    tx.prepare_cached(DELETE_FTS_BY_ROWID)?.execute([rowid])?;
    tx.prepare_cached(DELETE_OWNER_BY_ROWID)?.execute([rowid])?;
    Ok(())
}

/// Deletes the rows of `kind` ('title' | 'block') owned by any of `ids`.
pub(crate) fn unindex_owners(tx: &Transaction, kind: &str, ids: &[String]) -> Result<()> {
    for id in ids {
        let rowid: Option<i64> = tx
            .prepare_cached(SELECT_ROWID_BY_OWNER)?
            .query_row(params![kind, id], |r| r.get(0))
            .optional()?;
        if let Some(rowid) = rowid {
            delete_rowid(tx, rowid)?;
        }
    }
    Ok(())
}

/// Deletes every row (title and blocks) belonging to the given pages.
pub(crate) fn unindex_pages(tx: &Transaction, page_ids: &[String]) -> Result<()> {
    for id in page_ids {
        let rowids: Vec<i64> = {
            let mut stmt = tx.prepare_cached(SELECT_ROWIDS_BY_PAGE)?;
            let rows = stmt.query_map([id], |r| r.get(0))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        for rowid in rowids {
            delete_rowid(tx, rowid)?;
        }
    }
    Ok(())
}

/// Folded query -> FTS5 prefix terms (`"tok"*`, implicitly ANDed) and the bare tokens.
/// Every non-alphanumeric char is stripped, which removes all FTS5 syntax.
fn query_tokens(query: &str) -> Vec<String> {
    fold(query)
        .split(' ')
        .map(|t| {
            t.chars()
                .filter(|c| c.is_alphanumeric())
                .collect::<String>()
        })
        .filter(|t| !t.is_empty())
        .collect()
}

#[derive(Default)]
struct PageMatch {
    title: bool,
    best_rank: f64,
    /// Best-ranked matching block: (rank, block id).
    best_block: Option<(f64, String)>,
}

/// Cuts `text` to at most `SNIPPET_MAX_CHARS` chars around char index `center`,
/// marking cut ends with an ellipsis (which counts toward the limit).
fn cut_snippet(text: &str, center: usize) -> String {
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    if len <= SNIPPET_MAX_CHARS {
        return text.to_owned();
    }
    let start = center
        .saturating_sub(SNIPPET_MAX_CHARS / 2)
        .min(len - SNIPPET_MAX_CHARS);
    let end = start + SNIPPET_MAX_CHARS;
    let mut out: Vec<char> = chars[start..end].to_vec();
    if start > 0 {
        out[0] = ELLIPSIS;
    }
    if end < len {
        out[SNIPPET_MAX_CHARS - 1] = ELLIPSIS;
    }
    out.into_iter().collect()
}

/// Char index in `original` where `token` starts matching (word start preferred).
fn match_center(original: &str, token: &str) -> usize {
    let (folded, map) = fold_with_map(original);
    let at_word_start = |byte: usize| byte == 0 || folded.as_bytes()[byte - 1] == b' ';
    let byte = folded
        .match_indices(token)
        .map(|(b, _)| b)
        .find(|&b| at_word_start(b))
        .or_else(|| folded.find(token));
    byte.and_then(|b| map.get(folded[..b].chars().count()).copied())
        .unwrap_or(0)
}

impl Store {
    /// Accent-insensitive prefix search over page titles and block text (tech spec §3.6).
    /// Terms are ANDed within one title or block row. Pages with a title hit come first, then
    /// by best bm25; ties by title. `limit` caps the number of pages.
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchHit>> {
        let tokens = query_tokens(query);
        if tokens.is_empty() || limit == 0 {
            return Ok(Vec::new());
        }
        let terms: Vec<String> = tokens.iter().map(|t| format!("\"{t}\"*")).collect();
        let expr = format!("text : ({})", terms.join(" "));

        let mut stmt = self.conn().prepare_cached(
            "SELECT kind, owner_id, page_id, bm25(search_fts) FROM search_fts WHERE search_fts MATCH ?1",
        )?;
        let rows = stmt.query_map([&expr], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, f64>(3)?,
            ))
        })?;
        let mut pages: HashMap<String, PageMatch> = HashMap::new();
        for row in rows {
            let (kind, owner_id, page_id, rank) = row?;
            let entry = pages.entry(page_id).or_insert_with(|| PageMatch {
                best_rank: f64::INFINITY,
                ..PageMatch::default()
            });
            entry.best_rank = entry.best_rank.min(rank);
            if kind == "title" {
                entry.title = true;
            } else if entry
                .best_block
                .as_ref()
                .is_none_or(|(best, _)| rank < *best)
            {
                entry.best_block = Some((rank, owner_id));
            }
        }
        drop(stmt);

        let mut ranked = Vec::with_capacity(pages.len());
        for (page_id, m) in pages {
            let title: Option<String> = self
                .conn()
                .query_row("SELECT title FROM pages WHERE id = ?1", [&page_id], |r| {
                    r.get(0)
                })
                .optional()?;
            if let Some(title) = title {
                ranked.push((page_id, title, m));
            }
        }
        ranked.sort_by(|a, b| {
            b.2.title
                .cmp(&a.2.title)
                .then(a.2.best_rank.total_cmp(&b.2.best_rank))
                .then_with(|| a.1.cmp(&b.1))
        });
        ranked.truncate(limit);

        let ctx = DbTextContext::new(self.conn());
        let mut hits = Vec::with_capacity(ranked.len());
        for (page_id, page_title, m) in ranked {
            let snippet = match &m.best_block {
                Some((_, block_id)) => self.block_snippet(block_id, &tokens[0], &ctx)?,
                None => self.first_block_snippet(&page_id, &ctx)?,
            };
            hits.push(SearchHit {
                page_id,
                page_title,
                snippet,
                title_match: m.title,
            });
        }
        if let Some(e) = ctx.take_error() {
            return Err(e);
        }
        Ok(hits)
    }

    fn block_text(&self, block_id: &str, ctx: &DbTextContext) -> Result<Option<String>> {
        let row: Option<(String, String, Option<String>)> = self
            .conn()
            .query_row(
                "SELECT type, props, content FROM blocks WHERE id = ?1",
                [block_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()?;
        let Some((block_type, props, content)) = row else {
            return Ok(None);
        };
        let props: Value = serde_json::from_str(&props)?;
        let content: Option<Value> = content.map(|c| serde_json::from_str(&c)).transpose()?;
        Ok(Some(plain_text(&block_type, &props, content.as_ref(), ctx)))
    }

    fn block_snippet(&self, block_id: &str, token: &str, ctx: &DbTextContext) -> Result<String> {
        Ok(match self.block_text(block_id, ctx)? {
            Some(text) => cut_snippet(&text, match_center(&text, token)),
            None => String::new(),
        })
    }

    /// First 120 chars of the page's first non-empty block (tabs, then blocks in document order).
    fn first_block_snippet(&self, page_id: &str, ctx: &DbTextContext) -> Result<String> {
        let tab_ids: Vec<String> = {
            let mut stmt = self
                .conn()
                .prepare_cached("SELECT id FROM tabs WHERE page_id = ?1 ORDER BY order_key, id")?;
            let rows = stmt.query_map([page_id], |r| r.get(0))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        for tab_id in tab_ids {
            let mut stack: Vec<_> = self.load_tab(&tab_id)?.into_iter().rev().collect();
            while let Some(node) = stack.pop() {
                let text = plain_text(&node.r#type, &node.props, node.content.as_ref(), ctx);
                if !text.is_empty() {
                    return Ok(first_chars(&text));
                }
                stack.extend(node.children.into_iter().rev());
            }
        }
        Ok(String::new())
    }
}

fn first_chars(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= SNIPPET_MAX_CHARS {
        return text.to_owned();
    }
    let mut out: Vec<char> = chars[..SNIPPET_MAX_CHARS].to_vec();
    out[SNIPPET_MAX_CHARS - 1] = ELLIPSIS;
    out.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Store;

    #[test]
    fn fts_maintenance_uses_rowid_lookup() {
        let store = Store::open_in_memory().unwrap();
        for sql in [
            SELECT_ROWID_BY_OWNER,
            SELECT_ROWIDS_BY_PAGE,
            DELETE_FTS_BY_ROWID,
            DELETE_OWNER_BY_ROWID,
        ] {
            let mut stmt = store
                .conn()
                .prepare(&format!("EXPLAIN QUERY PLAN {sql}"))
                .unwrap();
            let n = stmt.parameter_count();
            let params = rusqlite::params_from_iter(std::iter::repeat_n("x", n));
            let plan: Vec<String> = stmt
                .query_map(params, |r| r.get::<_, String>(3))
                .unwrap()
                .collect::<rusqlite::Result<_>>()
                .unwrap();
            let plan = plan.join(" | ");
            // FTS5 reports a rowid-equality lookup as "INDEX 0:=" and a full scan as "INDEX 0:".
            if sql.contains("search_fts") {
                assert!(plan.contains("INDEX 0:="), "{sql}: {plan}");
            } else {
                assert!(!plan.contains("SCAN search_owner"), "{sql}: {plan}");
            }
        }
    }
}

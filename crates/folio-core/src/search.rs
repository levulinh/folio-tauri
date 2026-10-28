//! Full-text index maintenance (crate-private helpers; `Store::search` arrives with Task 9).
//! Every function that deletes pages, tabs or blocks must call the matching `unindex_*`
//! in the same transaction: FTS rows have no foreign keys.
//!
//! `search_fts`'s owner columns are UNINDEXED, so every lookup goes through the
//! `search_owner` side table (owner -> fts rowid) and touches `search_fts` by rowid only.

use rusqlite::{params, OptionalExtension, Transaction};

use crate::error::Result;
use crate::fold::fold;

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

//! Full-text index maintenance (crate-private helpers; `Store::search` arrives with Task 9).
//! Every function that deletes pages, tabs or blocks must call the matching `unindex_*`
//! in the same transaction: FTS rows have no foreign keys.

use rusqlite::{params, Transaction};

use crate::error::Result;
use crate::fold::fold;

/// Replaces the `title` row of a page. The stored text is folded.
pub(crate) fn index_title(tx: &Transaction, page_id: &str, title: &str) -> Result<()> {
    unindex_owners(tx, "title", &[page_id.to_string()])?;
    tx.execute(
        "INSERT INTO search_fts (kind, owner_id, page_id, text) VALUES ('title', ?1, ?1, ?2)",
        params![page_id, fold(title)],
    )?;
    Ok(())
}

/// Replaces the `block` row of a block. `plain` is the block's plain text; it is folded here.
#[allow(dead_code)] // first used by the edit ops (Task 7)
pub(crate) fn index_block(
    tx: &Transaction,
    block_id: &str,
    page_id: &str,
    plain: &str,
) -> Result<()> {
    unindex_owners(tx, "block", &[block_id.to_string()])?;
    tx.execute(
        "INSERT INTO search_fts (kind, owner_id, page_id, text) VALUES ('block', ?1, ?2, ?3)",
        params![block_id, page_id, fold(plain)],
    )?;
    Ok(())
}

/// Deletes the rows of `kind` ('title' | 'block') owned by any of `ids`.
pub(crate) fn unindex_owners(tx: &Transaction, kind: &str, ids: &[String]) -> Result<()> {
    let mut stmt = tx.prepare_cached("DELETE FROM search_fts WHERE kind = ?1 AND owner_id = ?2")?;
    for id in ids {
        stmt.execute(params![kind, id])?;
    }
    Ok(())
}

/// Deletes every row (title and blocks) belonging to the given pages.
pub(crate) fn unindex_pages(tx: &Transaction, page_ids: &[String]) -> Result<()> {
    let mut stmt = tx.prepare_cached("DELETE FROM search_fts WHERE page_id = ?1")?;
    for id in page_ids {
        stmt.execute(params![id])?;
    }
    Ok(())
}

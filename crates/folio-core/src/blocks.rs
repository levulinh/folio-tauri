//! Block edit API: `apply` (the one write path), `load_tab` and `replace_tab_blocks` (tech spec §3.3).

use std::collections::{HashMap, HashSet};

use rusqlite::{params, OptionalExtension, Transaction};
use serde_json::Value;

use crate::db::Store;
use crate::error::{CoreError, Result};
use crate::ids::is_uuid;
use crate::model::{ApplyResult, BlockNode, BlockOp};
use crate::order::key_between;
use crate::search::{index_block, unindex_owners};
use crate::text::{plain_text, DbTextContext};
use crate::time::now_ms;

fn invalid(index: usize, reason: impl Into<String>) -> CoreError {
    CoreError::InvalidOp {
        index,
        reason: reason.into(),
    }
}

/// Returns the page id of the tab, or `NotFound { entity: "tab" }`.
fn tab_page(tx: &Transaction, tab_id: &str) -> Result<String> {
    tx.query_row("SELECT page_id FROM tabs WHERE id = ?1", [tab_id], |r| {
        r.get(0)
    })
    .optional()?
    .ok_or_else(|| CoreError::NotFound {
        entity: "tab",
        id: tab_id.to_string(),
    })
}

fn touch_page(tx: &Transaction, page_id: &str) -> Result<i64> {
    let now = now_ms();
    tx.execute(
        "UPDATE pages SET updated_at = ?2 WHERE id = ?1",
        params![page_id, now],
    )?;
    Ok(now)
}

fn content_json(content: Option<&Value>) -> Option<String> {
    content.filter(|c| !c.is_null()).map(Value::to_string)
}

/// Indexes one block; fails the whole run if the option lookup hit a database error.
fn index(
    tx: &Transaction,
    page_id: &str,
    id: &str,
    block_type: &str,
    props: &Value,
    content: Option<&Value>,
) -> Result<()> {
    let ctx = DbTextContext::new(tx);
    let plain = plain_text(block_type, props, content, &ctx);
    if let Some(e) = ctx.take_error() {
        return Err(e);
    }
    index_block(tx, id, page_id, &plain)
}

struct Upsert<'a> {
    id: &'a str,
    parent_id: Option<&'a str>,
    prev_sibling_id: Option<&'a str>,
    block_type: &'a str,
    props: &'a Value,
    content: Option<&'a Value>,
}

fn upsert(tx: &Transaction, tab_id: &str, page_id: &str, op: &Upsert, at: usize) -> Result<()> {
    if !is_uuid(op.id) {
        return Err(invalid(at, "block id must be a UUID"));
    }
    if !op.props.is_object() {
        return Err(invalid(at, "props must be an object"));
    }
    let existing_tab: Option<String> = tx
        .query_row("SELECT tab_id FROM blocks WHERE id = ?1", [op.id], |r| {
            r.get(0)
        })
        .optional()?;
    if existing_tab.is_some_and(|t| t != tab_id) {
        return Err(invalid(at, "block belongs to another tab"));
    }
    if let Some(parent) = op.parent_id {
        check_parent(tx, tab_id, op.id, parent, at)?;
    }
    let (prev_key, next_key) = neighbour_keys(tx, tab_id, op, at)?;
    let order_key = key_between(prev_key.as_deref(), next_key.as_deref())
        .map_err(|e| invalid(at, e.to_string()))?;
    let now = now_ms();
    tx.execute(
        "INSERT INTO blocks (id, tab_id, parent_id, order_key, type, props, content, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
         ON CONFLICT(id) DO UPDATE SET
           parent_id = excluded.parent_id, order_key = excluded.order_key, type = excluded.type,
           props = excluded.props, content = excluded.content, updated_at = excluded.updated_at",
        params![
            op.id,
            tab_id,
            op.parent_id,
            order_key,
            op.block_type,
            op.props.to_string(),
            content_json(op.content),
            now
        ],
    )?;
    index(tx, page_id, op.id, op.block_type, op.props, op.content)
}

/// The parent must exist in this tab and must not be the block itself or one of its descendants.
fn check_parent(tx: &Transaction, tab_id: &str, id: &str, parent: &str, at: usize) -> Result<()> {
    if parent == id {
        return Err(invalid(at, "block cannot be its own parent"));
    }
    let exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM blocks WHERE id = ?1 AND tab_id = ?2)",
        params![parent, tab_id],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(invalid(at, format!("unknown parent block {parent}")));
    }
    let cycle: bool = tx.query_row(
        "WITH RECURSIVE anc(id) AS (
             SELECT ?1
             UNION
             SELECT b.parent_id FROM blocks b JOIN anc a ON b.id = a.id WHERE b.parent_id IS NOT NULL
         ) SELECT EXISTS(SELECT 1 FROM anc WHERE id = ?2)",
        params![parent, id],
        |r| r.get(0),
    )?;
    if cycle {
        return Err(invalid(at, "parent is a descendant of the block"));
    }
    Ok(())
}

/// Keys of `prev` and of the sibling right after it, ignoring the block itself.
fn neighbour_keys(
    tx: &Transaction,
    tab_id: &str,
    op: &Upsert,
    at: usize,
) -> Result<(Option<String>, Option<String>)> {
    let prev_key: Option<String> = match op.prev_sibling_id {
        None => None,
        Some(prev) => {
            if prev == op.id {
                return Err(invalid(at, "block cannot follow itself"));
            }
            let found: Option<String> = tx
                .query_row(
                    "SELECT order_key FROM blocks WHERE id = ?1 AND tab_id = ?2 AND parent_id IS ?3",
                    params![prev, tab_id, op.parent_id],
                    |r| r.get(0),
                )
                .optional()?;
            Some(found.ok_or_else(|| {
                invalid(
                    at,
                    format!("prev sibling {prev} is not under the same parent"),
                )
            })?)
        }
    };
    let next_key: Option<String> = tx.query_row(
        "SELECT MIN(order_key) FROM blocks
             WHERE tab_id = ?1 AND parent_id IS ?2 AND id <> ?3
               AND (?4 IS NULL OR order_key > ?4)",
        params![tab_id, op.parent_id, op.id, prev_key],
        |r| r.get(0),
    )?;
    Ok((prev_key, next_key))
}

fn delete(tx: &Transaction, tab_id: &str, ids: &[String]) -> Result<()> {
    for id in ids {
        let doomed: Vec<String> = {
            let mut stmt = tx.prepare_cached(
                "WITH RECURSIVE tree(id) AS (
                     SELECT id FROM blocks WHERE id = ?1 AND tab_id = ?2
                     UNION ALL
                     SELECT b.id FROM blocks b JOIN tree t ON b.parent_id = t.id
                 ) SELECT id FROM tree",
            )?;
            let rows = stmt.query_map(params![id, tab_id], |r| r.get(0))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        unindex_owners(tx, "block", &doomed)?;
        tx.execute(
            "DELETE FROM blocks WHERE id = ?1 AND tab_id = ?2",
            params![id, tab_id],
        )?;
    }
    Ok(())
}

struct Row {
    id: String,
    parent_id: Option<String>,
    node: BlockNode,
}

fn build(
    id: &str,
    rows: &mut HashMap<String, Row>,
    kids: &HashMap<String, Vec<String>>,
) -> Option<BlockNode> {
    let mut node = rows.remove(id)?.node;
    node.children = kids
        .get(id)
        .map(|ids| ids.iter().filter_map(|c| build(c, rows, kids)).collect())
        .unwrap_or_default();
    Some(node)
}

impl Store {
    /// Applies all ops in one transaction, in order. Any failure rolls everything back.
    pub fn apply(&mut self, tab_id: &str, ops: &[BlockOp]) -> Result<ApplyResult> {
        let tx = self.conn_mut().transaction()?;
        let page_id = tab_page(&tx, tab_id)?;
        for (at, op) in ops.iter().enumerate() {
            match op {
                BlockOp::Upsert {
                    id,
                    parent_id,
                    prev_sibling_id,
                    r#type,
                    props,
                    content,
                } => upsert(
                    &tx,
                    tab_id,
                    &page_id,
                    &Upsert {
                        id,
                        parent_id: parent_id.as_deref(),
                        prev_sibling_id: prev_sibling_id.as_deref(),
                        block_type: r#type,
                        props,
                        content: content.as_ref(),
                    },
                    at,
                )?,
                BlockOp::Delete { ids } => delete(&tx, tab_id, ids)?,
            }
        }
        let page_updated_at = touch_page(&tx, &page_id)?;
        tx.commit()?;
        Ok(ApplyResult {
            applied: ops.len() as u32,
            page_updated_at,
        })
    }

    /// The tab's block tree; siblings in `order_key` order.
    pub fn load_tab(&self, tab_id: &str) -> Result<Vec<BlockNode>> {
        let conn = self.conn();
        let exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM tabs WHERE id = ?1)",
            [tab_id],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(CoreError::NotFound {
                entity: "tab",
                id: tab_id.to_string(),
            });
        }
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, type, props, content FROM blocks WHERE tab_id = ?1 ORDER BY order_key, id",
        )?;
        let raw = stmt
            .query_map([tab_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, Option<String>>(4)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let known: HashSet<String> = raw.iter().map(|r| r.0.clone()).collect();
        let mut order = Vec::new();
        let mut rows = HashMap::new();
        for (id, parent_id, block_type, props, content) in raw {
            let node = BlockNode {
                id: id.clone(),
                r#type: block_type,
                props: serde_json::from_str(&props)?,
                content: content.map(|c| serde_json::from_str(&c)).transpose()?,
                children: Vec::new(),
            };
            order.push(id.clone());
            rows.insert(
                id.clone(),
                Row {
                    id,
                    parent_id,
                    node,
                },
            );
        }
        let mut kids: HashMap<String, Vec<String>> = HashMap::new();
        let mut top = Vec::new();
        for id in &order {
            match rows[id].parent_id.as_deref() {
                Some(p) if known.contains(p) => {
                    kids.entry(p.to_string()).or_default().push(id.clone())
                }
                Some(p) => {
                    eprintln!(
                        "folio: block {} has missing parent {p}; attached at top level",
                        rows[id].id
                    );
                    top.push(id.clone());
                }
                None => top.push(id.clone()),
            }
        }
        Ok(top
            .iter()
            .filter_map(|id| build(id, &mut rows, &kids))
            .collect())
    }

    /// Replaces every block of the tab with `tree` (fresh order keys, depth-first), reindexed.
    pub fn replace_tab_blocks(&mut self, tab_id: &str, tree: &[BlockNode]) -> Result<()> {
        let tx = self.conn_mut().transaction()?;
        let page_id = tab_page(&tx, tab_id)?;
        let created: HashMap<String, i64> = {
            let mut stmt = tx.prepare("SELECT id, created_at FROM blocks WHERE tab_id = ?1")?;
            let rows = stmt.query_map([tab_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        let old_ids: Vec<String> = created.keys().cloned().collect();
        unindex_owners(&tx, "block", &old_ids)?;
        tx.execute("DELETE FROM blocks WHERE tab_id = ?1", [tab_id])?;
        let mut seen = HashSet::new();
        insert_level(&tx, tab_id, &page_id, None, tree, &created, &mut seen)?;
        touch_page(&tx, &page_id)?;
        tx.commit()?;
        Ok(())
    }
}

fn insert_level(
    tx: &Transaction,
    tab_id: &str,
    page_id: &str,
    parent: Option<&str>,
    nodes: &[BlockNode],
    created: &HashMap<String, i64>,
    seen: &mut HashSet<String>,
) -> Result<()> {
    let mut prev_key: Option<String> = None;
    for node in nodes {
        if !is_uuid(&node.id) || !seen.insert(node.id.clone()) {
            return Err(invalid(0, format!("bad or duplicate block id {}", node.id)));
        }
        if !node.props.is_object() {
            return Err(invalid(0, "props must be an object"));
        }
        let key = key_between(prev_key.as_deref(), None)?;
        let now = now_ms();
        tx.execute(
            "INSERT INTO blocks (id, tab_id, parent_id, order_key, type, props, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                node.id,
                tab_id,
                parent,
                key,
                node.r#type,
                node.props.to_string(),
                content_json(node.content.as_ref()),
                created.get(&node.id).copied().unwrap_or(now),
                now
            ],
        )?;
        index(
            tx,
            page_id,
            &node.id,
            &node.r#type,
            &node.props,
            node.content.as_ref(),
        )?;
        insert_level(
            tx,
            tab_id,
            page_id,
            Some(&node.id),
            &node.children,
            created,
            seen,
        )?;
        prev_key = Some(key);
    }
    Ok(())
}

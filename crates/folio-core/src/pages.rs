use rusqlite::{params, OptionalExtension, Row, Transaction};

use crate::db::Store;
use crate::error::{CoreError, Result};
use crate::ids::new_id;
use crate::model::{CreatedPage, PageMeta, TabMeta};
use crate::order::key_between;
use crate::search::{index_title, unindex_pages};
use crate::time::now_ms;

const PAGE_COLS: &str = "id, parent_id, title, order_key, created_at, updated_at";

fn page_from_row(r: &Row) -> rusqlite::Result<PageMeta> {
    Ok(PageMeta {
        id: r.get(0)?,
        parent_id: r.get(1)?,
        title: r.get(2)?,
        order_key: r.get(3)?,
        created_at: r.get(4)?,
        updated_at: r.get(5)?,
    })
}

fn not_found(id: &str) -> CoreError {
    CoreError::NotFound {
        entity: "page",
        id: id.to_string(),
    }
}

fn get_page(tx: &Transaction, id: &str) -> Result<PageMeta> {
    tx.query_row(
        &format!("SELECT {PAGE_COLS} FROM pages WHERE id = ?1"),
        [id],
        page_from_row,
    )
    .optional()?
    .ok_or_else(|| not_found(id))
}

/// Order key for a new page under `parent_id`: last, or right after `after_id`.
fn new_page_key(
    tx: &Transaction,
    parent_id: Option<&str>,
    after_id: Option<&str>,
) -> Result<String> {
    match after_id {
        None => {
            let last: Option<String> = tx
                .query_row(
                    "SELECT order_key FROM pages WHERE parent_id IS ?1
                     ORDER BY order_key DESC LIMIT 1",
                    [parent_id],
                    |r| r.get(0),
                )
                .optional()?;
            key_between(last.as_deref(), None)
        }
        Some(after) => {
            let after_key: String = tx
                .query_row(
                    "SELECT order_key FROM pages WHERE id = ?1 AND parent_id IS ?2",
                    params![after, parent_id],
                    |r| r.get(0),
                )
                .optional()?
                .ok_or_else(|| not_found(after))?;
            let next: Option<String> = tx
                .query_row(
                    "SELECT order_key FROM pages WHERE parent_id IS ?1 AND order_key > ?2
                     ORDER BY order_key LIMIT 1",
                    params![parent_id, after_key],
                    |r| r.get(0),
                )
                .optional()?;
            key_between(Some(&after_key), next.as_deref())
        }
    }
}

impl Store {
    /// All pages ordered by (parent, order_key); top-level pages (NULL parent) first.
    pub fn list_pages(&self) -> Result<Vec<PageMeta>> {
        let mut stmt = self.conn().prepare(&format!(
            "SELECT {PAGE_COLS} FROM pages ORDER BY parent_id, order_key"
        ))?;
        let rows = stmt.query_map([], page_from_row)?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// New page (title "") with one empty tab; last among siblings unless `after_id`.
    pub fn create_page(
        &mut self,
        parent_id: Option<&str>,
        after_id: Option<&str>,
    ) -> Result<CreatedPage> {
        let tx = self.conn_mut().transaction()?;
        if let Some(parent) = parent_id {
            get_page(&tx, parent)?;
        }
        let now = now_ms();
        let page = PageMeta {
            id: new_id(),
            parent_id: parent_id.map(str::to_string),
            title: String::new(),
            order_key: new_page_key(&tx, parent_id, after_id)?,
            created_at: now,
            updated_at: now,
        };
        tx.execute(
            "INSERT INTO pages (id, parent_id, title, order_key, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![page.id, page.parent_id, page.title, page.order_key, now],
        )?;
        let tab = TabMeta {
            id: new_id(),
            page_id: page.id.clone(),
            name: String::new(),
            order_key: key_between(None, None)?,
        };
        tx.execute(
            "INSERT INTO tabs (id, page_id, name, order_key, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![tab.id, tab.page_id, tab.name, tab.order_key, now],
        )?;
        index_title(&tx, &page.id, &page.title)?;
        tx.commit()?;
        Ok(CreatedPage { page, tab })
    }

    /// Stores the title exactly as typed and reindexes it.
    pub fn rename_page(&mut self, id: &str, title: &str) -> Result<PageMeta> {
        let tx = self.conn_mut().transaction()?;
        let changed = tx.execute(
            "UPDATE pages SET title = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, title, now_ms()],
        )?;
        if changed == 0 {
            return Err(not_found(id));
        }
        index_title(&tx, id, title)?;
        let page = get_page(&tx, id)?;
        tx.commit()?;
        Ok(page)
    }

    /// Deletes the page and all descendants; returns every deleted page id.
    pub fn delete_page(&mut self, id: &str) -> Result<Vec<String>> {
        let tx = self.conn_mut().transaction()?;
        get_page(&tx, id)?;
        let ids: Vec<String> = {
            let mut stmt = tx.prepare(
                "WITH RECURSIVE tree(id) AS (
                     SELECT id FROM pages WHERE id = ?1
                     UNION ALL
                     SELECT p.id FROM pages p JOIN tree t ON p.parent_id = t.id
                 ) SELECT id FROM tree",
            )?;
            let rows = stmt.query_map([id], |r| r.get(0))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        unindex_pages(&tx, &ids)?;
        tx.execute("DELETE FROM pages WHERE id = ?1", [id])?;
        tx.commit()?;
        Ok(ids)
    }
}

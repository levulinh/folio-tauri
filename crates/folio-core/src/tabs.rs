use rusqlite::{params, OptionalExtension, Row, Transaction};

use crate::db::Store;
use crate::error::{CoreError, Result};
use crate::ids::new_id;
use crate::model::TabMeta;
use crate::order::key_between;
use crate::search::unindex_owners;
use crate::time::now_ms;

const TAB_COLS: &str = "id, page_id, name, order_key";

fn tab_from_row(r: &Row) -> rusqlite::Result<TabMeta> {
    Ok(TabMeta {
        id: r.get(0)?,
        page_id: r.get(1)?,
        name: r.get(2)?,
        order_key: r.get(3)?,
    })
}

fn tab_not_found(id: &str) -> CoreError {
    CoreError::NotFound {
        entity: "tab",
        id: id.to_string(),
    }
}

fn get_tab(tx: &Transaction, id: &str) -> Result<TabMeta> {
    tx.query_row(
        &format!("SELECT {TAB_COLS} FROM tabs WHERE id = ?1"),
        [id],
        tab_from_row,
    )
    .optional()?
    .ok_or_else(|| tab_not_found(id))
}

fn tabs_of(tx: &Transaction, page_id: &str) -> Result<Vec<TabMeta>> {
    let mut stmt = tx.prepare(&format!(
        "SELECT {TAB_COLS} FROM tabs WHERE page_id = ?1 ORDER BY order_key"
    ))?;
    let rows = stmt.query_map([page_id], tab_from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn touch_page(tx: &Transaction, page_id: &str) -> Result<()> {
    tx.execute(
        "UPDATE pages SET updated_at = ?2 WHERE id = ?1",
        params![page_id, now_ms()],
    )?;
    Ok(())
}

impl Store {
    pub fn list_tabs(&self, page_id: &str) -> Result<Vec<TabMeta>> {
        let mut stmt = self.conn().prepare(&format!(
            "SELECT {TAB_COLS} FROM tabs WHERE page_id = ?1 ORDER BY order_key"
        ))?;
        let rows = stmt.query_map([page_id], tab_from_row)?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// Appends a tab after the page's last one.
    pub fn create_tab(&mut self, page_id: &str, name: &str) -> Result<TabMeta> {
        let tx = self.conn_mut().transaction()?;
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM pages WHERE id = ?1)",
            [page_id],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(CoreError::NotFound {
                entity: "page",
                id: page_id.to_string(),
            });
        }
        let last: Option<String> = tx
            .query_row(
                "SELECT order_key FROM tabs WHERE page_id = ?1 ORDER BY order_key DESC LIMIT 1",
                [page_id],
                |r| r.get(0),
            )
            .optional()?;
        let tab = TabMeta {
            id: new_id(),
            page_id: page_id.to_string(),
            name: name.to_string(),
            order_key: key_between(last.as_deref(), None)?,
        };
        let now = now_ms();
        tx.execute(
            "INSERT INTO tabs (id, page_id, name, order_key, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![tab.id, tab.page_id, tab.name, tab.order_key, now],
        )?;
        touch_page(&tx, page_id)?;
        tx.commit()?;
        Ok(tab)
    }

    pub fn rename_tab(&mut self, id: &str, name: &str) -> Result<TabMeta> {
        let tx = self.conn_mut().transaction()?;
        let tab = get_tab(&tx, id)?;
        tx.execute(
            "UPDATE tabs SET name = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, name, now_ms()],
        )?;
        touch_page(&tx, &tab.page_id)?;
        let tab = get_tab(&tx, id)?;
        tx.commit()?;
        Ok(tab)
    }

    /// Places the tab right after `prev_sibling_id` (None = first); returns the page's tabs in order.
    pub fn move_tab(&mut self, id: &str, prev_sibling_id: Option<&str>) -> Result<Vec<TabMeta>> {
        let tx = self.conn_mut().transaction()?;
        let tab = get_tab(&tx, id)?;
        let others: Vec<TabMeta> = tabs_of(&tx, &tab.page_id)?
            .into_iter()
            .filter(|t| t.id != id)
            .collect();
        let (prev_key, next_key) = match prev_sibling_id {
            None => (None, others.first()),
            Some(prev) => {
                let pos = others
                    .iter()
                    .position(|t| t.id == prev)
                    .ok_or_else(|| tab_not_found(prev))?;
                (Some(others[pos].order_key.as_str()), others.get(pos + 1))
            }
        };
        let key = key_between(prev_key, next_key.map(|t| t.order_key.as_str()))?;
        tx.execute(
            "UPDATE tabs SET order_key = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, key, now_ms()],
        )?;
        touch_page(&tx, &tab.page_id)?;
        let tabs = tabs_of(&tx, &tab.page_id)?;
        tx.commit()?;
        Ok(tabs)
    }

    /// Refuses the last tab. Comment threads move to the page's first remaining tab.
    pub fn delete_tab(&mut self, id: &str) -> Result<()> {
        let tx = self.conn_mut().transaction()?;
        let tab = get_tab(&tx, id)?;
        let remaining: Vec<TabMeta> = tabs_of(&tx, &tab.page_id)?
            .into_iter()
            .filter(|t| t.id != id)
            .collect();
        let Some(first) = remaining.first() else {
            return Err(CoreError::LastTab);
        };
        tx.execute(
            "UPDATE comment_threads SET tab_id = ?2 WHERE tab_id = ?1",
            params![id, first.id],
        )?;
        let block_ids: Vec<String> = {
            let mut stmt = tx.prepare("SELECT id FROM blocks WHERE tab_id = ?1")?;
            let rows = stmt.query_map([id], |r| r.get(0))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        unindex_owners(&tx, "block", &block_ids)?;
        tx.execute("DELETE FROM tabs WHERE id = ?1", [id])?;
        touch_page(&tx, &tab.page_id)?;
        tx.commit()?;
        Ok(())
    }
}

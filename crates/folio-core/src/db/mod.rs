use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::error::Result;

/// Forward-only migrations; migration `n` (1-based) sets `user_version = n`.
const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_init.sql")];

pub struct Store {
    conn: Connection,
    assets_dir: PathBuf,
    /// Keeps the temp assets dir of an in-memory store alive.
    _temp: Option<tempfile::TempDir>,
}

impl Store {
    pub fn open(db_path: &Path, assets_dir: &Path) -> Result<Store> {
        std::fs::create_dir_all(assets_dir)?;
        let conn = Connection::open(db_path)?;
        Self::init(conn, assets_dir.to_path_buf(), None)
    }

    pub fn open_in_memory() -> Result<Store> {
        let temp = tempfile::tempdir()?;
        let conn = Connection::open_in_memory()?;
        let assets_dir = temp.path().to_path_buf();
        Self::init(conn, assets_dir, Some(temp))
    }

    fn init(
        conn: Connection,
        assets_dir: PathBuf,
        temp: Option<tempfile::TempDir>,
    ) -> Result<Store> {
        configure(&conn)?;
        let mut store = Store {
            conn,
            assets_dir,
            _temp: temp,
        };
        migrate(&mut store.conn)?;
        Ok(store)
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    pub fn assets_dir(&self) -> &Path {
        &self.assets_dir
    }
}

fn configure(conn: &Connection) -> Result<()> {
    // journal_mode returns a row, so it must be read as a query.
    conn.query_row("PRAGMA journal_mode=WAL", [], |_| Ok(()))?;
    conn.execute_batch(
        "PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;",
    )?;
    Ok(())
}

fn migrate(conn: &mut Connection) -> Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(version as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.execute_batch(&format!("PRAGMA user_version = {}", index + 1))?;
        tx.commit()?;
    }
    Ok(())
}

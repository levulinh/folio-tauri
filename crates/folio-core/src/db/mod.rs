use std::path::{Path, PathBuf};

use rusqlite::{Connection, TransactionBehavior};

use crate::error::{CoreError, Result};

/// Forward-only migrations; migration `n` (1-based) sets `user_version = n`.
pub const MIGRATIONS: &[&str] = &[
    include_str!("migrations/0001_init.sql"),
    include_str!("migrations/0002_search_owner.sql"),
];

const WAL_RETRIES: u32 = 100;
const WAL_RETRY_PAUSE_MS: u64 = 20;

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

    // Raw connection access is crate-internal. Tests (this crate's unit tests and, via
    // the `test-support` feature, its integration tests) get it as `pub`. folio-app
    // must never enable the feature (D-003).
    #[cfg(any(test, feature = "test-support"))]
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    #[cfg(not(any(test, feature = "test-support")))]
    pub(crate) fn conn(&self) -> &Connection {
        &self.conn
    }

    #[cfg(any(test, feature = "test-support"))]
    pub fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    #[cfg(not(any(test, feature = "test-support")))]
    pub(crate) fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    pub fn assets_dir(&self) -> &Path {
        &self.assets_dir
    }
}

fn configure(conn: &Connection) -> Result<()> {
    // busy_timeout first: switching to WAL needs a lock another opener may hold.
    conn.execute_batch("PRAGMA busy_timeout=5000;")?;
    // Refuse a newer schema with a plain read, before anything writes to the file.
    check_schema_not_newer(conn.query_row("PRAGMA user_version", [], |r| r.get(0))?)?;
    enable_wal(conn)?;
    conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;")?;
    Ok(())
}

/// The journal-mode switch returns SQLITE_BUSY at once (the busy handler is not
/// consulted) while another connection is switching the same fresh file, so it is
/// retried for a bounded time.
fn enable_wal(conn: &Connection) -> Result<()> {
    let mut attempts = 0;
    loop {
        // journal_mode returns a row, so it must be read as a query.
        match conn.query_row("PRAGMA journal_mode=WAL", [], |_| Ok(())) {
            Ok(()) => return Ok(()),
            Err(rusqlite::Error::SqliteFailure(e, _))
                if e.code == rusqlite::ErrorCode::DatabaseBusy && attempts < WAL_RETRIES =>
            {
                attempts += 1;
                std::thread::sleep(std::time::Duration::from_millis(WAL_RETRY_PAUSE_MS));
            }
            Err(rusqlite::Error::SqliteFailure(e, msg))
                if e.code == rusqlite::ErrorCode::DatabaseBusy =>
            {
                let reason = msg.unwrap_or_else(|| e.to_string());
                // Stays a `Db` error (code "db") with context in the message.
                return Err(rusqlite::Error::SqliteFailure(
                    e,
                    Some(format!(
                        "could not enable WAL after {WAL_RETRIES} attempts: {reason}"
                    )),
                )
                .into());
            }
            Err(e) => return Err(e.into()),
        }
    }
}

fn check_schema_not_newer(found: i64) -> Result<()> {
    let known = MIGRATIONS.len() as i64;
    if found > known {
        return Err(CoreError::SchemaTooNew { found, known });
    }
    Ok(())
}

fn migrate(conn: &mut Connection) -> Result<()> {
    // IMMEDIATE takes the write lock before `user_version` is read, so a second
    // opener waits (busy_timeout) and then sees the finished schema.
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let version: i64 = tx.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    check_schema_not_newer(version)?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(version as usize) {
        tx.execute_batch(sql)?;
        tx.execute_batch(&format!("PRAGMA user_version = {}", index + 1))?;
    }
    tx.commit()?;
    Ok(())
}

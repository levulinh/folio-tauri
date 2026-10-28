use folio_core::db::MIGRATIONS;
use folio_core::error::CoreError;
use folio_core::ids::{is_uuid, new_id};
use folio_core::time::now_ms;
use folio_core::Store;
use uuid::Uuid;

fn user_version(store: &Store) -> i64 {
    store
        .conn()
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap()
}

#[test]
fn open_creates_schema() {
    let store = Store::open_in_memory().unwrap();
    assert_eq!(user_version(&store), MIGRATIONS.len() as i64);
    for table in [
        "pages",
        "tabs",
        "blocks",
        "option_sets",
        "comment_threads",
        "comments",
        "assets",
        "page_versions",
        "settings",
        "search_fts",
        "search_owner",
    ] {
        let n: i64 = store
            .conn()
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name = ?1",
                [table],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1, "missing table {table}");
    }
}

#[test]
fn open_twice_is_idempotent() {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("folio.db");
    let assets = dir.path().join("assets");
    let first = Store::open(&db, &assets).unwrap();
    assert_eq!(user_version(&first), MIGRATIONS.len() as i64);
    drop(first);
    let second = Store::open(&db, &assets).unwrap();
    assert_eq!(user_version(&second), MIGRATIONS.len() as i64);
    assert!(assets.is_dir());
}

#[test]
fn newer_schema_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("folio.db");
    let assets = dir.path().join("assets");
    let newer = MIGRATIONS.len() as i64 + 1;
    {
        let conn = rusqlite::Connection::open(&db).unwrap();
        conn.execute_batch(&format!("PRAGMA user_version = {newer}"))
            .unwrap();
    }
    let err = Store::open(&db, &assets).err().expect("must refuse");
    match &err {
        CoreError::SchemaTooNew { found, known } => {
            assert_eq!(*found, newer);
            assert_eq!(*known, MIGRATIONS.len() as i64);
        }
        other => panic!("unexpected error {other:?}"),
    }
    assert_eq!(err.code(), "db");
    // The refused file is left untouched.
    let conn = rusqlite::Connection::open(&db).unwrap();
    let v: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap();
    assert_eq!(v, newer);
}

#[test]
fn two_connections_migrating_a_fresh_db_both_succeed() {
    for round in 0..20 {
        let dir = tempfile::tempdir().unwrap();
        let db = dir.path().join("folio.db");
        let assets = dir.path().join("assets");
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
        let handles: Vec<_> = (0..2)
            .map(|_| {
                let (db, assets, barrier) = (db.clone(), assets.clone(), barrier.clone());
                std::thread::spawn(move || {
                    barrier.wait();
                    Store::open(&db, &assets).map(|s| user_version(&s))
                })
            })
            .collect();
        for h in handles {
            let v = h
                .join()
                .unwrap()
                .unwrap_or_else(|e| panic!("round {round}: {e}"));
            assert_eq!(v, MIGRATIONS.len() as i64);
        }
    }
}

#[test]
fn foreign_keys_on() {
    let store = Store::open_in_memory().unwrap();
    let on: i64 = store
        .conn()
        .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
        .unwrap();
    assert_eq!(on, 1);
}

#[test]
fn new_id_is_v7() {
    let id = new_id();
    assert_eq!(Uuid::parse_str(&id).unwrap().get_version_num(), 7);
    assert_eq!(id, id.to_lowercase());
}

#[test]
fn is_uuid_rejects_garbage() {
    assert!(!is_uuid("abc"));
    assert!(is_uuid(&Uuid::new_v4().to_string()));
}

#[test]
fn error_codes() {
    assert_eq!(CoreError::LastTab.code(), "last_tab");
    assert_eq!(
        CoreError::NotFound {
            entity: "page",
            id: "x".into()
        }
        .code(),
        "not_found"
    );
    assert_eq!(
        CoreError::InvalidOp {
            index: 0,
            reason: "r".into()
        }
        .code(),
        "invalid_op"
    );
    assert_eq!(CoreError::EmptyComment.code(), "empty_comment");
    let payload = CoreError::LastTab.to_payload();
    assert_eq!(payload.code, "last_tab");
    assert!(!payload.message.is_empty());
}

#[test]
fn now_ms_is_plausible() {
    assert!(now_ms() > 1_700_000_000_000);
}

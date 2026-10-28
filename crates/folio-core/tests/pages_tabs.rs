use folio_core::error::CoreError;
use folio_core::time::now_ms;
use folio_core::Store;

fn count(store: &Store, sql: &str) -> i64 {
    store.conn().query_row(sql, [], |r| r.get(0)).unwrap()
}

fn titles(store: &Store) -> Vec<String> {
    store
        .list_pages()
        .unwrap()
        .into_iter()
        .map(|p| p.title)
        .collect()
}

fn page(store: &mut Store, parent: Option<&str>, after: Option<&str>, title: &str) -> String {
    let created = store.create_page(parent, after).unwrap();
    store.rename_page(&created.page.id, title).unwrap();
    created.page.id
}

#[test]
fn create_top_level_page_has_one_tab() {
    let mut store = Store::open_in_memory().unwrap();
    let created = store.create_page(None, None).unwrap();
    assert_eq!(created.page.parent_id, None);
    assert_eq!(created.page.title, "");
    assert_eq!(created.tab.page_id, created.page.id);
    assert_eq!(created.tab.name, "");
    let tabs = store.list_tabs(&created.page.id).unwrap();
    assert_eq!(tabs, vec![created.tab]);
    assert_eq!(store.list_pages().unwrap(), vec![created.page.clone()]);
    let indexed: i64 = count(&store, "SELECT count(*) FROM search_fts WHERE kind='title'");
    assert_eq!(indexed, 1);
}

#[test]
fn pages_order_after() {
    let mut store = Store::open_in_memory().unwrap();
    let a = page(&mut store, None, None, "A");
    let _b = page(&mut store, None, None, "B");
    let _c = page(&mut store, None, Some(&a), "C");
    assert_eq!(titles(&store), ["A", "C", "B"]);
}

#[test]
fn subpage_parent() {
    let mut store = Store::open_in_memory().unwrap();
    let a = page(&mut store, None, None, "A");
    let child = store.create_page(Some(&a), None).unwrap();
    assert_eq!(child.page.parent_id.as_deref(), Some(a.as_str()));
    let missing = store.create_page(Some("nope"), None).unwrap_err();
    assert!(matches!(
        missing,
        CoreError::NotFound { entity: "page", .. }
    ));
}

#[test]
fn rename_roundtrip_exact() {
    let mut store = Store::open_in_memory().unwrap();
    let id = store.create_page(None, None).unwrap().page.id;
    for title in ["", "   ", "Ghi chú 😀", &"x".repeat(500)] {
        let renamed = store.rename_page(&id, title).unwrap();
        assert_eq!(renamed.title, title);
        let listed = store.list_pages().unwrap();
        assert_eq!(listed[0].title, title);
    }
    assert!(matches!(
        store.rename_page("nope", "x").unwrap_err(),
        CoreError::NotFound { entity: "page", .. }
    ));
}

#[test]
fn delete_cascades_descendants() {
    let mut store = Store::open_in_memory().unwrap();
    let a = page(&mut store, None, None, "A");
    let b = page(&mut store, Some(&a), None, "B");
    let c = page(&mut store, Some(&b), None, "C");
    let tab = store.list_tabs(&c).unwrap()[0].id.clone();
    store
        .conn()
        .execute(
            "INSERT INTO blocks (id, tab_id, order_key, type, created_at, updated_at)
             VALUES ('blk', ?1, 'a0', 'paragraph', 0, 0)",
            [&tab],
        )
        .unwrap();
    let mut gone = store.delete_page(&a).unwrap();
    gone.sort();
    let mut expected = vec![a, b, c];
    expected.sort();
    assert_eq!(gone, expected);
    assert!(store.list_pages().unwrap().is_empty());
    assert_eq!(count(&store, "SELECT count(*) FROM search_fts"), 0);
    assert_eq!(count(&store, "SELECT count(*) FROM blocks"), 0);
    assert_eq!(count(&store, "SELECT count(*) FROM tabs"), 0);
}

#[test]
fn delete_missing_is_not_found() {
    let mut store = Store::open_in_memory().unwrap();
    let err = store.delete_page("nope").unwrap_err();
    assert!(matches!(err, CoreError::NotFound { entity: "page", .. }));
}

#[test]
fn last_tab_refused() {
    let mut store = Store::open_in_memory().unwrap();
    let created = store.create_page(None, None).unwrap();
    let err = store.delete_tab(&created.tab.id).unwrap_err();
    assert!(matches!(err, CoreError::LastTab));
    assert_eq!(store.list_tabs(&created.page.id).unwrap().len(), 1);
}

#[test]
fn move_tab_reorders() {
    let mut store = Store::open_in_memory().unwrap();
    let created = store.create_page(None, None).unwrap();
    let pid = &created.page.id;
    let t1 = created.tab.id.clone();
    let t2 = store.create_tab(pid, "two").unwrap().id;
    let t3 = store.create_tab(pid, "three").unwrap().id;
    let ids = |tabs: Vec<folio_core::model::TabMeta>| -> Vec<String> {
        tabs.into_iter().map(|t| t.id).collect()
    };
    assert_eq!(
        ids(store.list_tabs(pid).unwrap()),
        vec![t1.clone(), t2.clone(), t3.clone()]
    );
    let moved = store.move_tab(&t3, None).unwrap();
    assert_eq!(ids(moved), vec![t3.clone(), t1.clone(), t2.clone()]);
    let moved = store.move_tab(&t3, Some(&t1)).unwrap();
    assert_eq!(ids(moved), vec![t1.clone(), t3.clone(), t2.clone()]);
    let moved = store.move_tab(&t1, Some(&t2)).unwrap();
    assert_eq!(ids(moved), vec![t3.clone(), t2.clone(), t1.clone()]);
    assert_eq!(store.rename_tab(&t2, "renamed").unwrap().name, "renamed");
}

#[test]
fn delete_tab_moves_threads() {
    let mut store = Store::open_in_memory().unwrap();
    let created = store.create_page(None, None).unwrap();
    let t2 = store.create_tab(&created.page.id, "two").unwrap().id;
    let now = now_ms();
    store
        .conn()
        .execute(
            "INSERT INTO comment_threads (id, page_id, tab_id, quote, created_at, updated_at)
             VALUES ('th', ?1, ?2, 'q', ?3, ?3)",
            rusqlite::params![created.page.id, t2, now],
        )
        .unwrap();
    store
        .conn()
        .execute(
            "INSERT INTO blocks (id, tab_id, order_key, type, created_at, updated_at)
             VALUES ('blk', ?1, 'a0', 'paragraph', 0, 0)",
            [&t2],
        )
        .unwrap();
    store
        .conn()
        .execute(
            "INSERT INTO search_fts (kind, owner_id, page_id, text) VALUES ('block','blk',?1,'hi')",
            [&created.page.id],
        )
        .unwrap();
    store
        .conn()
        .execute(
            "INSERT INTO search_owner (fts_rowid, kind, owner_id, page_id)
             VALUES (last_insert_rowid(), 'block', 'blk', ?1)",
            [&created.page.id],
        )
        .unwrap();
    store.delete_tab(&t2).unwrap();
    let tab_id: String = store
        .conn()
        .query_row(
            "SELECT tab_id FROM comment_threads WHERE id='th'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(tab_id, created.tab.id);
    assert_eq!(count(&store, "SELECT count(*) FROM blocks"), 0);
    assert_eq!(
        count(&store, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        0
    );
    assert!(matches!(
        store.delete_tab(&t2).unwrap_err(),
        CoreError::NotFound { entity: "tab", .. }
    ));
}

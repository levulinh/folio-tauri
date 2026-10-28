use folio_core::error::CoreError;
use folio_core::model::{BlockNode, BlockOp};
use folio_core::Store;
use serde_json::{json, Value};

fn id(n: u32) -> String {
    format!("00000000-0000-4000-8000-{n:012}")
}

fn text(t: &str) -> Value {
    json!([{ "type": "text", "text": t, "styles": {} }])
}

fn up(n: u32, parent: Option<u32>, prev: Option<u32>, t: &str) -> BlockOp {
    BlockOp::Upsert {
        id: id(n),
        parent_id: parent.map(id),
        prev_sibling_id: prev.map(id),
        r#type: "paragraph".into(),
        props: json!({}),
        content: Some(text(t)),
    }
}

fn p(n: u32, prev: Option<u32>, t: &str) -> BlockOp {
    up(n, None, prev, t)
}

fn del(ns: &[u32]) -> BlockOp {
    BlockOp::Delete {
        ids: ns.iter().map(|n| id(*n)).collect(),
    }
}

fn setup() -> (Store, String, String) {
    let mut store = Store::open_in_memory().unwrap();
    let created = store.create_page(None, None).unwrap();
    (store, created.page.id, created.tab.id)
}

fn ids(nodes: &[BlockNode]) -> Vec<String> {
    nodes.iter().map(|n| n.id.clone()).collect()
}

fn count(store: &Store, sql: &str) -> i64 {
    store.conn().query_row(sql, [], |r| r.get(0)).unwrap()
}

fn invalid_index(e: CoreError) -> usize {
    match e {
        CoreError::InvalidOp { index, .. } => index,
        other => panic!("expected InvalidOp, got {other:?}"),
    }
}

#[test]
fn insert_three_in_order() {
    let (mut s, _, tab) = setup();
    let r = s
        .apply(
            &tab,
            &[p(1, None, "a"), p(2, Some(1), "b"), p(3, Some(2), "c")],
        )
        .unwrap();
    assert_eq!(r.applied, 3);
    assert_eq!(ids(&s.load_tab(&tab).unwrap()), [id(1), id(2), id(3)]);
}

#[test]
fn insert_between() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "a"), p(3, Some(1), "c")])
        .unwrap();
    s.apply(&tab, &[p(2, Some(1), "b")]).unwrap();
    assert_eq!(ids(&s.load_tab(&tab).unwrap()), [id(1), id(2), id(3)]);
}

#[test]
fn insert_first_before_existing() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "a")]).unwrap();
    s.apply(&tab, &[p(2, None, "b")]).unwrap();
    assert_eq!(ids(&s.load_tab(&tab).unwrap()), [id(2), id(1)]);
}

#[test]
fn update_keeps_created_at_and_changes_text() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "old")]).unwrap();
    s.conn()
        .execute("UPDATE blocks SET created_at = 5, updated_at = 5", [])
        .unwrap();
    s.apply(&tab, &[p(1, None, "new")]).unwrap();
    let (c, u): (i64, i64) = s
        .conn()
        .query_row("SELECT created_at, updated_at FROM blocks", [], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .unwrap();
    assert_eq!(c, 5);
    assert!(u > 5);
    assert_eq!(s.load_tab(&tab).unwrap()[0].content, Some(text("new")));
    assert_eq!(count(&s, "SELECT count(*) FROM blocks"), 1);
}

#[test]
fn nested_children() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "a"), up(2, Some(1), None, "b")])
        .unwrap();
    let tree = s.load_tab(&tab).unwrap();
    assert_eq!(tree.len(), 1);
    assert_eq!(ids(&tree[0].children), [id(2)]);
}

#[test]
fn upsert_parent_in_same_batch() {
    let (mut s, _, tab) = setup();
    s.apply(
        &tab,
        &[
            p(1, None, "a"),
            up(2, Some(1), None, "b"),
            up(3, Some(2), None, "c"),
        ],
    )
    .unwrap();
    let tree = s.load_tab(&tab).unwrap();
    assert_eq!(tree[0].children[0].children[0].id, id(3));
}

#[test]
fn upsert_unknown_parent_is_invalid_and_rolls_back() {
    let (mut s, _, tab) = setup();
    let e = s.apply(&tab, &[up(1, Some(99), None, "x")]).unwrap_err();
    assert_eq!(invalid_index(e), 0);
    let e = s
        .apply(&tab, &[p(2, None, "ok"), up(1, Some(99), None, "x")])
        .unwrap_err();
    assert_eq!(invalid_index(e), 1);
    assert_eq!(count(&s, "SELECT count(*) FROM blocks"), 0);
    assert_eq!(
        count(&s, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        0
    );
}

#[test]
fn delete_cascades() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "a"), up(2, Some(1), None, "b")])
        .unwrap();
    assert_eq!(
        count(&s, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        2
    );
    s.apply(&tab, &[del(&[1])]).unwrap();
    assert_eq!(count(&s, "SELECT count(*) FROM blocks"), 0);
    assert_eq!(
        count(&s, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        0
    );
}

#[test]
fn outdent_then_delete_parent_keeps_child_subtree() {
    let (mut s, _, tab) = setup();
    s.apply(
        &tab,
        &[
            p(4, None, "d"),
            up(3, Some(4), None, "c"),
            up(5, Some(3), None, "e"),
        ],
    )
    .unwrap();
    s.apply(&tab, &[p(3, Some(4), "c"), del(&[4])]).unwrap();
    let tree = s.load_tab(&tab).unwrap();
    assert_eq!(ids(&tree), [id(3)]);
    assert_eq!(ids(&tree[0].children), [id(5)]);
    assert_eq!(
        count(&s, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        2
    );
}

#[test]
fn delete_unknown_ids_ignored() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "a")]).unwrap();
    let r = s.apply(&tab, &[del(&[77, 78])]).unwrap();
    assert_eq!(r.applied, 1);
    assert_eq!(s.load_tab(&tab).unwrap().len(), 1);
}

#[test]
fn vietnamese_roundtrip() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "Đà Nẵng")]).unwrap();
    assert_eq!(s.load_tab(&tab).unwrap()[0].content, Some(text("Đà Nẵng")));
}

#[test]
fn apply_updates_page_updated_at() {
    let (mut s, page, tab) = setup();
    s.conn()
        .execute("UPDATE pages SET updated_at = 0", [])
        .unwrap();
    let r = s.apply(&tab, &[p(1, None, "a")]).unwrap();
    let got: i64 = s
        .conn()
        .query_row("SELECT updated_at FROM pages WHERE id = ?1", [&page], |r| {
            r.get(0)
        })
        .unwrap();
    assert!(got > 0);
    assert_eq!(got, r.page_updated_at);
}

#[test]
fn replace_tab_blocks_roundtrip() {
    let (mut s, _, tab) = setup();
    s.apply(
        &tab,
        &[
            p(1, None, "a"),
            up(2, Some(1), None, "b"),
            up(3, Some(1), Some(2), "c"),
            p(4, Some(1), "d"),
        ],
    )
    .unwrap();
    let before = s.load_tab(&tab).unwrap();
    s.replace_tab_blocks(&tab, &before).unwrap();
    assert_eq!(s.load_tab(&tab).unwrap(), before);
    assert_eq!(
        count(&s, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        4
    );
    s.replace_tab_blocks(&tab, &[]).unwrap();
    assert!(s.load_tab(&tab).unwrap().is_empty());
    assert_eq!(
        count(&s, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        0
    );
}

#[test]
fn search_row_written() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "Đà Nẵng")]).unwrap();
    let t: String = s
        .conn()
        .query_row(
            "SELECT text FROM search_fts WHERE owner_id = ?1",
            [id(1)],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(t, "da nang");
}

#[test]
fn move_within_same_parent_and_reupsert_in_place() {
    let (mut s, _, tab) = setup();
    s.apply(
        &tab,
        &[p(1, None, "a"), p(2, Some(1), "b"), p(3, Some(2), "c")],
    )
    .unwrap();
    s.apply(&tab, &[p(1, Some(1), "a")]).unwrap_err();
    s.apply(&tab, &[p(1, Some(3), "a")]).unwrap();
    assert_eq!(ids(&s.load_tab(&tab).unwrap()), [id(2), id(3), id(1)]);
    s.apply(&tab, &[p(3, Some(2), "c")]).unwrap();
    assert_eq!(ids(&s.load_tab(&tab).unwrap()), [id(2), id(3), id(1)]);
    s.apply(&tab, &[p(3, None, "c")]).unwrap();
    assert_eq!(ids(&s.load_tab(&tab).unwrap()), [id(3), id(2), id(1)]);
}

#[test]
fn validation_errors_carry_op_index() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "a"), up(2, Some(1), None, "b")])
        .unwrap();
    let bad_uuid = BlockOp::Upsert {
        id: "nope".into(),
        parent_id: None,
        prev_sibling_id: None,
        r#type: "paragraph".into(),
        props: json!({}),
        content: None,
    };
    let bad_props = BlockOp::Upsert {
        id: id(9),
        parent_id: None,
        prev_sibling_id: None,
        r#type: "paragraph".into(),
        props: json!([]),
        content: None,
    };
    let cases: Vec<(BlockOp, &str)> = vec![
        (bad_uuid, "uuid"),
        (bad_props, "props must be an object"),
        (up(1, Some(1), None, "x"), "own parent"),
        (up(1, Some(2), None, "x"), "cycle"),
        (p(1, Some(1), "x"), "prev is self"),
        (p(5, Some(2), "x"), "prev under other parent"),
        (p(5, Some(88), "x"), "unknown prev"),
    ];
    for (op, label) in cases {
        let e = s.apply(&tab, &[p(7, None, "ok"), op]).unwrap_err();
        assert_eq!(invalid_index(e), 1, "{label}");
    }
    assert_eq!(count(&s, "SELECT count(*) FROM blocks"), 2);
}

#[test]
fn content_may_be_null_array_or_object() {
    let (mut s, _, tab) = setup();
    let mk = |n: u32, content: Option<Value>| BlockOp::Upsert {
        id: id(n),
        parent_id: None,
        prev_sibling_id: if n > 1 { Some(id(n - 1)) } else { None },
        r#type: "table".into(),
        props: json!({}),
        content,
    };
    s.apply(
        &tab,
        &[
            mk(1, None),
            mk(2, Some(json!(null))),
            mk(3, Some(json!({"type":"tableContent","rows":[]}))),
        ],
    )
    .unwrap();
    let tree = s.load_tab(&tab).unwrap();
    assert_eq!(tree[0].content, None);
    assert_eq!(tree[1].content, None);
    assert!(tree[2].content.as_ref().unwrap().is_object());
}

#[test]
fn block_of_another_tab_is_rejected() {
    let (mut s, page, tab) = setup();
    let other = s.create_tab(&page, "two").unwrap();
    s.apply(&tab, &[p(1, None, "a")]).unwrap();
    let e = s.apply(&other.id, &[p(1, None, "moved")]).unwrap_err();
    assert_eq!(invalid_index(e), 0);
    assert_eq!(s.load_tab(&tab).unwrap()[0].content, Some(text("a")));
    assert!(s.load_tab(&other.id).unwrap().is_empty());
    // a parent in another tab is unknown too; deletes never touch other tabs
    let e = s
        .apply(&other.id, &[up(2, Some(1), None, "x")])
        .unwrap_err();
    assert_eq!(invalid_index(e), 0);
    s.apply(&other.id, &[del(&[1])]).unwrap();
    assert_eq!(s.load_tab(&tab).unwrap().len(), 1);
}

#[test]
fn unknown_tab_is_not_found() {
    let (mut s, _, _) = setup();
    assert!(matches!(
        s.apply("nope", &[]).unwrap_err(),
        CoreError::NotFound { entity: "tab", .. }
    ));
    assert!(matches!(
        s.load_tab("nope").unwrap_err(),
        CoreError::NotFound { entity: "tab", .. }
    ));
    assert!(matches!(
        s.replace_tab_blocks("nope", &[]).unwrap_err(),
        CoreError::NotFound { entity: "tab", .. }
    ));
}

#[test]
fn orphans_load_at_top_level() {
    let (mut s, _, tab) = setup();
    s.apply(&tab, &[p(1, None, "a"), up(2, Some(1), None, "b")])
        .unwrap();
    s.conn().execute_batch("PRAGMA foreign_keys=OFF;").unwrap();
    s.conn()
        .execute(
            "UPDATE blocks SET parent_id = ?1 WHERE id = ?2",
            [id(99), id(2)],
        )
        .unwrap();
    s.conn().execute_batch("PRAGMA foreign_keys=ON;").unwrap();
    let tree = s.load_tab(&tab).unwrap();
    assert_eq!(tree.len(), 2);
    assert!(tree.iter().all(|n| n.children.is_empty()));
}

#[test]
fn apply_fails_on_option_lookup_db_error() {
    let (mut s, _, tab) = setup();
    s.conn()
        .execute_batch("ALTER TABLE option_sets RENAME TO option_sets_x;")
        .unwrap();
    let chip = BlockOp::Upsert {
        id: id(1),
        parent_id: None,
        prev_sibling_id: None,
        r#type: "paragraph".into(),
        props: json!({}),
        content: Some(json!([{"type":"dropdownChip","props":{"optionSetId":"s","optionId":"o"}}])),
    };
    let e = s.apply(&tab, &[p(2, None, "ok"), chip]).unwrap_err();
    assert!(matches!(e, CoreError::Db(_)), "{e:?}");
    assert_eq!(count(&s, "SELECT count(*) FROM blocks"), 0);
    assert_eq!(
        count(&s, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        0
    );
}

#[test]
fn delete_page_removes_descendant_block_fts_rows() {
    let (mut s, a, _) = setup();
    let b = s.create_page(Some(&a), None).unwrap();
    s.apply(&b.tab.id, &[p(1, None, "hello")]).unwrap();
    assert_eq!(
        count(&s, "SELECT count(*) FROM search_fts WHERE kind='block'"),
        1
    );
    s.delete_page(&a).unwrap();
    assert_eq!(count(&s, "SELECT count(*) FROM search_fts"), 0);
}

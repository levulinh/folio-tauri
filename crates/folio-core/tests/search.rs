use folio_core::ids::new_id;
use folio_core::model::BlockOp;
use folio_core::Store;
use serde_json::json;

fn page(store: &mut Store, title: &str, blocks: &[&str]) -> String {
    let created = store.create_page(None, None).unwrap();
    store.rename_page(&created.page.id, title).unwrap();
    let mut prev: Option<String> = None;
    let mut ops = Vec::new();
    for text in blocks {
        let id = new_id();
        ops.push(BlockOp::Upsert {
            id: id.clone(),
            parent_id: None,
            prev_sibling_id: prev.take(),
            r#type: "paragraph".into(),
            props: json!({}),
            content: Some(json!([{"type":"text","text":text,"styles":{}}])),
        });
        prev = Some(id);
    }
    store.apply(&created.tab.id, &ops).unwrap();
    created.page.id
}

fn ids(hits: &[folio_core::model::SearchHit]) -> Vec<&str> {
    hits.iter().map(|h| h.page_id.as_str()).collect()
}

#[test]
fn accentless_matches_accented_body() {
    let mut s = Store::open_in_memory().unwrap();
    let a = page(&mut s, "Du lịch", &["Chuyến đi Đà Nẵng rất vui"]);
    let hits = s.search("da nang", 50).unwrap();
    assert_eq!(ids(&hits), [a.as_str()]);
    assert!(!hits[0].title_match);
    assert_eq!(hits[0].page_title, "Du lịch");
}

#[test]
fn title_match_ranks_first() {
    let mut s = Store::open_in_memory().unwrap();
    let x = page(&mut s, "Ghi chú", &["Đà Nẵng đẹp"]);
    let y = page(&mut s, "Đà Nẵng", &[]);
    let hits = s.search("da nang", 50).unwrap();
    assert_eq!(ids(&hits), [y.as_str(), x.as_str()]);
    assert!(hits[0].title_match);
    assert!(!hits[1].title_match);
}

#[test]
fn multiple_tokens_and() {
    let mut s = Store::open_in_memory().unwrap();
    let full = page(&mut s, "A", &["Đà Nẵng"]);
    let _partial = page(&mut s, "B", &["Đà lạt"]);
    assert_eq!(ids(&s.search("da nang", 50).unwrap()), [full.as_str()]);
}

#[test]
fn prefix_match() {
    let mut s = Store::open_in_memory().unwrap();
    let a = page(&mut s, "A", &["Đà Nẵng"]);
    assert_eq!(ids(&s.search("nan", 50).unwrap()), [a.as_str()]);
}

#[test]
fn snippet_is_original_text() {
    let mut s = Store::open_in_memory().unwrap();
    let long = format!("{} Đà Nẵng {}", "abc ".repeat(60), "xyz ".repeat(60));
    assert!(long.chars().count() > 450);
    page(&mut s, "A", &[&long]);
    let hit = s.search("da nang", 50).unwrap().remove(0);
    assert!(hit.snippet.contains("Đà Nẵng"), "{}", hit.snippet);
    assert!(hit.snippet.chars().count() <= 120);
    assert!(hit.snippet.starts_with('…') && hit.snippet.ends_with('…'));
}

#[test]
fn short_snippet_is_whole_text() {
    let mut s = Store::open_in_memory().unwrap();
    page(&mut s, "A", &["Đà Nẵng"]);
    assert_eq!(s.search("nang", 50).unwrap()[0].snippet, "Đà Nẵng");
}

#[test]
fn title_only_snippet_is_first_block() {
    let mut s = Store::open_in_memory().unwrap();
    let id = page(&mut s, "Đà Nẵng", &["", "Dòng đầu tiên", "Dòng hai"]);
    let hits = s.search("da nang", 50).unwrap();
    assert_eq!(ids(&hits), [id.as_str()]);
    assert_eq!(hits[0].snippet, "Dòng đầu tiên");
    let empty = page(&mut s, "Hội An", &[]);
    let hit = s.search("hoi an", 50).unwrap();
    assert_eq!(ids(&hit), [empty.as_str()]);
    assert_eq!(hit[0].snippet, "");
}

#[test]
fn empty_query_returns_empty() {
    let mut s = Store::open_in_memory().unwrap();
    page(&mut s, "A", &["x"]);
    for q in ["", "   ", "\"", "*", "-", "()"] {
        assert!(s.search(q, 50).unwrap().is_empty(), "{q:?}");
    }
}

#[test]
fn fts_syntax_is_literal() {
    let mut s = Store::open_in_memory().unwrap();
    let a = page(&mut s, "A", &["a or b x a:b near"]);
    for q in ["\"", "*", "-a", "(x", "a OR b", "NEAR", "a:b"] {
        s.search(q, 50).unwrap_or_else(|e| panic!("{q:?}: {e}"));
    }
    for q in ["a OR b", "a:b", "-a", "(x", "NEAR"] {
        assert_eq!(ids(&s.search(q, 50).unwrap()), [a.as_str()], "{q:?}");
    }
}

#[test]
fn punctuated_words_are_findable() {
    let mut s = Store::open_in_memory().unwrap();
    let a = page(&mut s, "A", &["Gửi e-mail cho Hà, don't forget wi-fi 3.14"]);
    for q in ["e-mail", "don't", "wi-fi", "3.14", "cho:hà"] {
        assert_eq!(ids(&s.search(q, 50).unwrap()), [a.as_str()], "{q:?}");
    }
}

#[test]
fn identical_pages_order_by_page_id() {
    let mut s = Store::open_in_memory().unwrap();
    let mut expected: Vec<String> = (0..6).map(|_| page(&mut s, "Same", &["hello"])).collect();
    expected.sort();
    for _ in 0..20 {
        let hits = s.search("hello", 50).unwrap();
        assert_eq!(
            ids(&hits),
            expected.iter().map(String::as_str).collect::<Vec<_>>()
        );
    }
}

#[test]
fn snippet_centres_on_decomposed_text() {
    let mut s = Store::open_in_memory().unwrap();
    let long = format!(
        "{} Na\u{306}\u{303}ng {}",
        "abc ".repeat(40),
        "xyz ".repeat(40)
    );
    page(&mut s, "A", &[&long]);
    let hit = s.search("nang", 50).unwrap().remove(0);
    assert!(
        hit.snippet.contains("Na\u{306}\u{303}ng"),
        "{}",
        hit.snippet
    );
    assert!(hit.snippet.chars().count() <= 120);
}

#[test]
fn limit_respected() {
    let mut s = Store::open_in_memory().unwrap();
    for i in 0..5 {
        page(&mut s, &format!("P{i}"), &["hello"]);
    }
    assert_eq!(s.search("hello", 3).unwrap().len(), 3);
    assert_eq!(s.search("hello", 50).unwrap().len(), 5);
    assert!(s.search("hello", 0).unwrap().is_empty());
}

#[test]
fn deleted_page_is_not_found() {
    let mut s = Store::open_in_memory().unwrap();
    let a = page(&mut s, "A", &["hello"]);
    s.delete_page(&a).unwrap();
    assert!(s.search("hello", 50).unwrap().is_empty());
}

#[test]
fn table_cell_text_is_searchable() {
    let mut s = Store::open_in_memory().unwrap();
    let created = s.create_page(None, None).unwrap();
    s.rename_page(&created.page.id, "Bảng").unwrap();
    let cell = |runs: serde_json::Value| json!({"type":"tableCell","content":runs});
    let content = json!({"type":"tableContent","rows":[
        {"cells":[
            cell(json!([
                {"type":"text","text":"Hà ","styles":{"bold":true}},
                {"type":"text","text":"Nội\nmùa thu","styles":{}}
            ])),
            cell(json!([{"type":"text","text":"khác","styles":{}}]))
        ]}
    ]});
    s.apply(
        &created.tab.id,
        &[BlockOp::Upsert {
            id: new_id(),
            parent_id: None,
            prev_sibling_id: None,
            r#type: "table".into(),
            props: json!({}),
            content: Some(content),
        }],
    )
    .unwrap();
    let hits = s.search("ha noi", 50).unwrap();
    assert_eq!(ids(&hits), [created.page.id.as_str()]);
    assert!(!hits[0].title_match);
    assert!(hits[0].snippet.contains("Hà Nội"), "{}", hits[0].snippet);
    // A query that crosses the cell's line break finds it too.
    assert_eq!(
        ids(&s.search("noi mua", 50).unwrap()),
        [created.page.id.as_str()]
    );
}

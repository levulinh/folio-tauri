//! Plain-text extraction of a block, used for the search index (tech spec §3.6).

use crate::error::CoreError;
use crate::model::block::{parse_inline, parse_table, Inline};
use rusqlite::Connection;
use serde_json::Value;
use std::cell::RefCell;

/// Resolves dropdown option names while extracting text.
pub trait TextContext {
    fn option_name(&self, option_set_id: &str, option_id: &str) -> Option<String>;
}

/// Context that knows no options: every dropdown chip contributes `""`.
pub struct NoContext;

impl TextContext for NoContext {
    fn option_name(&self, _option_set_id: &str, _option_id: &str) -> Option<String> {
        None
    }
}

/// Reads option names from `option_sets.options` (a JSON array of `{id, name, color}`).
/// A missing set or option and unparsable JSON are plain `None`; any other SQLite error also
/// yields `None` but is remembered so the caller can fail the index run via [`take_error`].
///
/// [`take_error`]: DbTextContext::take_error
pub(crate) struct DbTextContext<'a> {
    conn: &'a Connection,
    error: RefCell<Option<rusqlite::Error>>,
}

impl<'a> DbTextContext<'a> {
    pub(crate) fn new(conn: &'a Connection) -> Self {
        Self {
            conn,
            error: RefCell::new(None),
        }
    }

    /// The first real database error seen so far, if any (cleared by this call).
    pub(crate) fn take_error(&self) -> Option<CoreError> {
        self.error.borrow_mut().take().map(CoreError::Db)
    }
}

impl TextContext for DbTextContext<'_> {
    fn option_name(&self, option_set_id: &str, option_id: &str) -> Option<String> {
        let json: String = match self.conn.query_row(
            "SELECT options FROM option_sets WHERE id = ?",
            [option_set_id],
            |r| r.get(0),
        ) {
            Ok(json) => json,
            Err(rusqlite::Error::QueryReturnedNoRows) => return None,
            Err(e) => {
                self.error.borrow_mut().get_or_insert(e);
                return None;
            }
        };
        let options: Value = serde_json::from_str(&json).ok()?;
        options
            .as_array()?
            .iter()
            .find(|o| o.get("id").and_then(Value::as_str) == Some(option_id))?
            .get("name")?
            .as_str()
            .map(str::to_owned)
    }
}

/// The searchable text of one block. Never fails or panics on malformed input.
pub fn plain_text(
    block_type: &str,
    props: &Value,
    content: Option<&Value>,
    ctx: &dyn TextContext,
) -> String {
    let prop = |k: &str| props.get(k).and_then(Value::as_str).unwrap_or("");
    match block_type {
        "mathBlock" | "csvBlock" | "markdownBlock" => prop("source").to_owned(),
        "image" | "file" => [prop("name"), prop("caption")]
            .iter()
            .filter(|s| !s.is_empty())
            .copied()
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_owned(),
        "table" => table_text(content, ctx),
        _ => content
            .map(|c| inline_text(&parse_inline(c), ctx))
            .unwrap_or_default(),
    }
}

fn table_text(content: Option<&Value>, ctx: &dyn TextContext) -> String {
    let Some(table) = content.and_then(parse_table) else {
        return String::new();
    };
    table
        .rows
        .iter()
        .flat_map(|row| &row.cells)
        .map(|cell| inline_text(&cell.content, ctx))
        .filter(|t| !t.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn inline_text(items: &[Inline], ctx: &dyn TextContext) -> String {
    items
        .iter()
        .map(|item| match item {
            Inline::Text { text, .. } => text.clone(),
            Inline::Link { content, .. } => content.iter().map(|r| r.text.as_str()).collect(),
            Inline::DateChip { props } => format_date(&props.date),
            Inline::DropdownChip { props } => ctx
                .option_name(&props.option_set_id, &props.option_id)
                .unwrap_or_default(),
            Inline::PageLink { .. } | Inline::Unknown => String::new(),
        })
        .collect()
}

/// `YYYY-MM-DD` → `dd/MM/yyyy`; anything unparsable → `""`.
fn format_date(s: &str) -> String {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(|d| d.format("%d/%m/%Y").to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct Fixed;
    impl TextContext for Fixed {
        fn option_name(&self, _: &str, _: &str) -> Option<String> {
            Some("Xong".into())
        }
    }

    fn pt(t: &str, props: Value, content: Value) -> String {
        plain_text(t, &props, Some(&content), &NoContext)
    }

    fn run(text: &str) -> Value {
        json!({"type":"text","text":text,"styles":{}})
    }

    #[test]
    fn paragraph_concatenates_styled_runs() {
        let c = json!([
            {"type":"text","text":"Xin ","styles":{"bold":true}},
            {"type":"text","text":"chào","styles":{"italic":true}}
        ]);
        assert_eq!(pt("paragraph", json!({}), c), "Xin chào");
    }

    #[test]
    fn link_yields_its_text() {
        let c = json!([run("a "), {"type":"link","href":"https://x","content":[run("here")]}]);
        assert_eq!(pt("paragraph", json!({}), c), "a here");
    }

    #[test]
    fn date_chip_formats_and_bad_date_is_empty() {
        let ok = json!([{"type":"dateChip","props":{"date":"2026-10-28"}}]);
        assert_eq!(pt("paragraph", json!({}), ok), "28/10/2026");
        for bad in ["", "garbage", "2026-13-40"] {
            let c = json!([{"type":"dateChip","props":{"date":bad}}]);
            assert_eq!(pt("paragraph", json!({}), c), "");
        }
    }

    #[test]
    fn page_link_is_empty() {
        let c = json!([{"type":"pageLink","props":{"pageId":"p","tabId":""}}]);
        assert_eq!(pt("paragraph", json!({}), c), "");
    }

    #[test]
    fn dropdown_chip_uses_context() {
        let c = json!([{"type":"dropdownChip","props":{"optionSetId":"s","optionId":"o"}}]);
        assert_eq!(
            plain_text("paragraph", &json!({}), Some(&c), &Fixed),
            "Xong"
        );
        assert_eq!(
            plain_text("paragraph", &json!({}), Some(&c), &NoContext),
            ""
        );
    }

    #[test]
    fn table_cells_joined_row_major_skipping_empty() {
        let cell = |t: &str| json!({"type":"tableCell","content":[run(t)]});
        let c = json!({"type":"tableContent","rows":[
            {"cells":[cell("a"), cell("")]},
            {"cells":[cell("c"), cell("d")]}
        ]});
        assert_eq!(pt("table", json!({}), c), "a c d");
    }

    #[test]
    fn code_block_text() {
        assert_eq!(
            pt(
                "codeBlock",
                json!({"language":"rs"}),
                json!([run("let x = 1;")])
            ),
            "let x = 1;"
        );
    }

    #[test]
    fn source_blocks_use_source() {
        for t in ["mathBlock", "csvBlock", "markdownBlock"] {
            assert_eq!(
                plain_text(t, &json!({"source":"x^2"}), None, &NoContext),
                "x^2"
            );
        }
    }

    #[test]
    fn image_and_file_name_plus_caption() {
        assert_eq!(
            plain_text(
                "image",
                &json!({"name":"a.png","caption":"Ảnh"}),
                None,
                &NoContext
            ),
            "a.png Ảnh"
        );
        assert_eq!(
            plain_text(
                "file",
                &json!({"name":"a.pdf","caption":""}),
                None,
                &NoContext
            ),
            "a.pdf"
        );
        assert_eq!(
            plain_text(
                "image",
                &json!({"name":"","caption":"Ảnh"}),
                None,
                &NoContext
            ),
            "Ảnh"
        );
    }

    #[test]
    fn unknown_inline_skipped_and_malformed_content_empty() {
        let c = json!([run("a"), {"type":"mystery"}, run("b")]);
        assert_eq!(pt("paragraph", json!({}), c), "ab");
        assert_eq!(pt("paragraph", json!({}), json!(42)), "");
        assert_eq!(pt("table", json!({}), json!(42)), "");
        assert_eq!(plain_text("paragraph", &json!(null), None, &NoContext), "");
    }

    #[test]
    fn unknown_block_type_concatenates_inline_content() {
        assert_eq!(pt("futureBlock", json!({}), json!([run("x")])), "x");
        assert_eq!(plain_text("futureBlock", &json!({}), None, &NoContext), "");
    }

    #[test]
    fn bad_styles_run_keeps_text() {
        let c = json!([
            {"type":"text","text":"a","styles":null},
            {"type":"text","text":"b","styles":{"bold":"x"}},
            {"type":"link","href":"h","content":[{"text":"c","styles":null}]}
        ]);
        assert_eq!(pt("paragraph", json!({}), c), "abc");
    }

    fn store_with_set(options: &str) -> crate::Store {
        let store = crate::Store::open_in_memory().unwrap();
        store
            .conn()
            .execute_batch("INSERT INTO pages (id, title, order_key, created_at, updated_at) VALUES ('p', 't', 'a', 0, 0);")
            .unwrap();
        for (id, opts) in [("s", options), ("bad", "not json")] {
            store
                .conn()
                .execute(
                    "INSERT INTO option_sets (id, page_id, name, options, created_at, updated_at) VALUES (?, 'p', 'n', ?, 0, 0)",
                    [id, opts],
                )
                .unwrap();
        }
        store
    }

    #[test]
    fn db_context_reads_option_names() {
        let store = store_with_set(r#"[{"id":"o1","name":"Xong","color":"green"}]"#);
        let ctx = DbTextContext::new(store.conn());
        assert_eq!(ctx.option_name("s", "o1").as_deref(), Some("Xong"));
        assert_eq!(ctx.option_name("s", "zz"), None);
        assert_eq!(ctx.option_name("missing", "o1"), None);
        assert_eq!(ctx.option_name("bad", "o1"), None);
        assert!(ctx.take_error().is_none());
    }

    #[test]
    fn db_context_records_real_errors() {
        let store = store_with_set("[]");
        store
            .conn()
            .execute_batch("ALTER TABLE option_sets RENAME TO option_sets_x;")
            .unwrap();
        let ctx = DbTextContext::new(store.conn());
        assert_eq!(ctx.option_name("s", "o1"), None);
        assert!(matches!(ctx.take_error(), Some(CoreError::Db(_))));
        assert!(ctx.take_error().is_none());
    }
}

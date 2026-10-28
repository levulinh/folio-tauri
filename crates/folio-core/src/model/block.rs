//! Block tree shape (exchanged with the UI) and a typed, never-failing reading model for content.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BlockNode {
    pub id: String,
    #[serde(rename = "type")]
    #[ts(rename = "type")]
    pub r#type: String,
    #[ts(type = "Record<string, unknown>")]
    pub props: Value,
    #[ts(type = "unknown")]
    pub content: Option<Value>,
    pub children: Vec<BlockNode>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Styles {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strike: bool,
    pub code: bool,
    /// Space-separated comment thread ids.
    pub comment: Option<String>,
}

/// Lenient: `null`, a non-object, or a wrongly typed field never fails; that part is default.
impl<'de> Deserialize<'de> for Styles {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let v = Value::deserialize(d)?;
        let flag = |k: &str| v.get(k).and_then(Value::as_bool).unwrap_or(false);
        Ok(Styles {
            bold: flag("bold"),
            italic: flag("italic"),
            underline: flag("underline"),
            strike: flag("strike"),
            code: flag("code"),
            comment: v.get("comment").and_then(Value::as_str).map(str::to_owned),
        })
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct TextRun {
    pub text: String,
    #[serde(default)]
    pub styles: Styles,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DateProps {
    pub date: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PageLinkProps {
    pub page_id: String,
    /// Empty = the whole page.
    #[serde(default)]
    pub tab_id: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DropdownProps {
    pub option_set_id: String,
    /// Empty = no option chosen.
    #[serde(default)]
    pub option_id: String,
}

/// One inline element. `Unknown` is produced by [`parse_inline`] for an element whose `type`
/// is not one we know (serde's `other` only works on unit variants of untagged data, so we
/// parse element by element instead).
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Inline {
    Text {
        text: String,
        #[serde(default)]
        styles: Styles,
    },
    Link {
        href: String,
        #[serde(default)]
        content: Vec<TextRun>,
    },
    DateChip {
        props: DateProps,
    },
    PageLink {
        props: PageLinkProps,
    },
    DropdownChip {
        props: DropdownProps,
    },
    #[serde(skip)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct TableContent {
    pub rows: Vec<TableRow>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct TableRow {
    pub cells: Vec<TableCell>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct TableCell {
    pub content: Vec<Inline>,
}

/// Parse inline content. Never fails: elements without a string `type` are skipped, elements
/// with an unrecognised or malformed `type` become `Inline::Unknown`.
pub fn parse_inline(v: &Value) -> Vec<Inline> {
    let Some(items) = v.as_array() else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(
            |item| match serde_json::from_value::<Inline>(item.clone()) {
                Ok(inline) => Some(inline),
                Err(_) if item.get("type").is_some_and(Value::is_string) => Some(Inline::Unknown),
                Err(_) => None,
            },
        )
        .collect()
}

/// Parse table content (`{ rows: [{ cells: [...] }] }`). `None` when `v` is not an object with
/// a `rows` array. A cell is either `{ content: [...] }` or a bare inline array; anything else
/// becomes an empty cell. Never fails or panics.
pub fn parse_table(v: &Value) -> Option<TableContent> {
    let rows = v.get("rows")?.as_array()?;
    let rows = rows
        .iter()
        .map(|row| TableRow {
            cells: row
                .get("cells")
                .and_then(Value::as_array)
                .map(|cells| cells.iter().map(parse_cell).collect())
                .unwrap_or_default(),
        })
        .collect();
    Some(TableContent { rows })
}

fn parse_cell(cell: &Value) -> TableCell {
    let content = if cell.is_array() {
        parse_inline(cell)
    } else {
        cell.get("content").map(parse_inline).unwrap_or_default()
    };
    TableCell { content }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_known_inlines() {
        let v = json!([
            {"type":"text","text":"hi","styles":{"bold":true,"comment":"t1"}},
            {"type":"link","href":"https://x","content":[{"type":"text","text":"x","styles":{}}]},
            {"type":"dateChip","props":{"date":"2026-01-02"}},
            {"type":"pageLink","props":{"pageId":"p"}},
            {"type":"dropdownChip","props":{"optionSetId":"s","optionId":""}}
        ]);
        let got = parse_inline(&v);
        assert_eq!(got.len(), 5);
        match &got[0] {
            Inline::Text { text, styles } => {
                assert_eq!(text, "hi");
                assert!(styles.bold && !styles.italic);
                assert_eq!(styles.comment.as_deref(), Some("t1"));
            }
            other => panic!("unexpected {other:?}"),
        }
        assert!(matches!(&got[3], Inline::PageLink { props } if props.tab_id.is_empty()));
    }

    #[test]
    fn bad_styles_keep_text() {
        let v = json!([
            {"type":"text","text":"a","styles":null},
            {"type":"text","text":"b","styles":{"bold":"x","italic":true}},
            {"type":"text","text":"c"},
            {"type":"link","href":"h","content":[{"text":"d","styles":null},{"text":"e","styles":{"bold":"x"}}]}
        ]);
        let got = parse_inline(&v);
        assert_eq!(got.len(), 4);
        assert!(
            matches!(&got[0], Inline::Text { text, styles } if text == "a" && *styles == Styles::default())
        );
        assert!(
            matches!(&got[1], Inline::Text { text, styles } if text == "b" && !styles.bold && styles.italic)
        );
        assert!(matches!(&got[2], Inline::Text { text, .. } if text == "c"));
        match &got[3] {
            Inline::Link { content, .. } => {
                assert_eq!(
                    content.iter().map(|r| r.text.as_str()).collect::<String>(),
                    "de"
                );
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn reads_all_valid_styles() {
        let v = json!([{"type":"text","text":"a","styles":{
            "bold":true,"italic":true,"underline":true,"strike":true,"code":true}}]);
        match &parse_inline(&v)[0] {
            Inline::Text { styles, .. } => {
                assert!(
                    styles.bold
                        && styles.italic
                        && styles.underline
                        && styles.strike
                        && styles.code
                );
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn garbage_never_fails() {
        let v = json!([1, "s", null, {}, {"x":1}, {"type":"mystery","a":1}, {"type":7},
                       {"type":"text"}, {"type":"text","text":5}]);
        let got = parse_inline(&v);
        assert_eq!(got, vec![Inline::Unknown, Inline::Unknown, Inline::Unknown]);
        for g in [json!(null), json!(3), json!("x"), json!({"a":1})] {
            assert!(parse_inline(&g).is_empty());
        }
    }

    #[test]
    fn parses_tables_and_survives_garbage() {
        let v = json!({"type":"tableContent","rows":[
            {"cells":[{"type":"tableCell","content":[{"type":"text","text":"a","styles":{}}]},
                      [{"type":"text","text":"b","styles":{}}], 5, {}]},
            7, {"cells":"nope"}
        ]});
        let t = parse_table(&v).unwrap();
        assert_eq!(t.rows.len(), 3);
        assert_eq!(t.rows[0].cells.len(), 4);
        assert_eq!(t.rows[0].cells[0].content.len(), 1);
        assert_eq!(t.rows[0].cells[1].content.len(), 1);
        assert!(t.rows[0].cells[2].content.is_empty());
        assert!(t.rows[2].cells.is_empty());
        for g in [
            json!(null),
            json!([]),
            json!("x"),
            json!({"rows":3}),
            json!({}),
        ] {
            assert!(parse_table(&g).is_none());
        }
    }
}

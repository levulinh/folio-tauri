use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

/// One edit to a tab's block tree. The UI sends all `Upsert`s (document order) then one `Delete`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(tag = "op", rename_all = "camelCase", rename_all_fields = "camelCase")]
#[ts(export)]
pub enum BlockOp {
    /// Insert or replace one block's own fields (not its children).
    /// Position: after `prev_sibling_id` under `parent_id` (prev = None → first child).
    Upsert {
        id: String,
        parent_id: Option<String>,
        prev_sibling_id: Option<String>,
        #[serde(rename = "type")]
        #[ts(rename = "type")]
        r#type: String,
        #[ts(type = "Record<string, unknown>")]
        props: Value,
        #[ts(type = "unknown")]
        content: Option<Value>,
    },
    /// Delete blocks and all their descendants.
    Delete { ids: Vec<String> },
}

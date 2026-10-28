use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PageMeta {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub order_key: String,
    #[ts(type = "number")]
    pub created_at: i64,
    #[ts(type = "number")]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TabMeta {
    pub id: String,
    pub page_id: String,
    pub name: String,
    pub order_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreatedPage {
    pub page: PageMeta,
    pub tab: TabMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SearchHit {
    pub page_id: String,
    pub page_title: String,
    pub snippet: String,
    pub title_match: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ApplyResult {
    pub applied: u32,
    #[ts(type = "number")]
    pub page_updated_at: i64,
}

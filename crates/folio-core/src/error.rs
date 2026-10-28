use serde::Serialize;
use ts_rs::TS;

pub type Result<T> = std::result::Result<T, CoreError>;

#[derive(thiserror::Error, Debug)]
pub enum CoreError {
    #[error("{entity} not found: {id}")]
    NotFound { entity: &'static str, id: String },
    #[error("invalid op #{index}: {reason}")]
    InvalidOp { index: usize, reason: String },
    #[error("cannot delete the last tab of a page")]
    LastTab,
    #[error("comment body is empty")]
    EmptyComment,
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("database schema version {found} is newer than this app understands ({known}); update Folio")]
    SchemaTooNew { found: i64, known: i64 },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

/// Error as the UI sees it: a stable `code` plus an English `message` for logs.
#[derive(Serialize, TS, Debug, Clone, PartialEq, Eq)]
#[ts(export)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
}

impl CoreError {
    pub fn code(&self) -> &'static str {
        match self {
            CoreError::NotFound { .. } => "not_found",
            CoreError::InvalidOp { .. } => "invalid_op",
            CoreError::LastTab => "last_tab",
            CoreError::EmptyComment => "empty_comment",
            CoreError::Db(_) | CoreError::SchemaTooNew { .. } => "db",
            CoreError::Io(_) => "io",
            CoreError::Json(_) => "json",
        }
    }

    pub fn to_payload(&self) -> ErrorPayload {
        ErrorPayload {
            code: self.code().to_string(),
            message: self.to_string(),
        }
    }
}

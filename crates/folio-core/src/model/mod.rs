//! Data model shared with the UI (generated TS) and the typed reading model for block content.

pub mod block;
pub mod entities;
pub mod ops;

pub use block::{BlockNode, Inline, TableContent};
pub use entities::{ApplyResult, AssetMeta, CreatedPage, PageMeta, SearchHit, TabMeta};
pub use ops::BlockOp;

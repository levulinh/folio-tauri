//! Folio core: storage, model and rendering. Never depends on Tauri or any UI crate.

pub mod db;
pub mod error;
pub mod fold;
pub mod ids;
pub mod model;
pub mod order;
pub mod pages;
pub(crate) mod search;
pub mod tabs;
pub mod text;
pub mod time;

pub use db::Store;
pub use error::{CoreError, Result};

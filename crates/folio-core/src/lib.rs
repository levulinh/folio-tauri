//! Folio core: storage, model and rendering. Never depends on Tauri or any UI crate.

pub mod db;
pub mod error;
pub mod ids;
pub mod time;

pub use db::Store;
pub use error::{CoreError, Result};

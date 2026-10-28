use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use folio_core::error::ErrorPayload;
use folio_core::Store;

/// Shared app state. The store lives behind a mutex that is only ever locked inside
/// `spawn_blocking` closures (see [`blocking`]), never across an await.
pub struct AppState {
    pub store: Arc<Mutex<Store>>,
    /// Set once the quit flow has started; later triggers do nothing (§4.5).
    pub quitting: AtomicBool,
}

impl AppState {
    pub fn new(store: Store) -> Self {
        Self {
            store: Arc::new(Mutex::new(store)),
            quitting: AtomicBool::new(false),
        }
    }
}

fn error_payload(code: &str, message: String) -> ErrorPayload {
    ErrorPayload {
        code: code.to_string(),
        message,
    }
}

/// Runs a core call on the blocking pool with the store locked.
pub async fn blocking<T, F>(state: &AppState, f: F) -> Result<T, ErrorPayload>
where
    T: Send + 'static,
    F: FnOnce(&mut Store) -> folio_core::Result<T> + Send + 'static,
{
    let store = Arc::clone(&state.store);
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let mut guard = store
            .lock()
            .map_err(|_| error_payload("db", "store lock poisoned".to_string()))?;
        f(&mut guard).map_err(|e| e.to_payload())
    })
    .await;
    match joined {
        Ok(result) => result,
        Err(e) => Err(error_payload("db", format!("blocking task failed: {e}"))),
    }
}

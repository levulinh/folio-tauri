use std::any::Any;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, MutexGuard};

use folio_core::error::ErrorPayload;
use folio_core::Store;

/// Shared app state. The store lives behind a mutex that is only ever locked inside
/// `spawn_blocking` closures (see [`blocking`]), never across an await.
pub struct AppState {
    pub store: Arc<Mutex<Store>>,
    /// Set once the quit flow has started; later triggers do nothing (§4.5).
    pub quitting: AtomicBool,
    /// Set right before the final `app.exit(0)`; lets macOS `terminate:` through.
    pub exiting: AtomicBool,
}

impl AppState {
    pub fn new(store: Store) -> Self {
        Self {
            store: Arc::new(Mutex::new(store)),
            quitting: AtomicBool::new(false),
            exiting: AtomicBool::new(false),
        }
    }
}

fn error_payload(code: &str, message: String) -> ErrorPayload {
    ErrorPayload {
        code: code.to_string(),
        message,
    }
}

/// Locks the store; a poisoned lock is recovered (rusqlite rolls back the panicked
/// transaction when its guard drops), so one panic never bricks the app.
pub fn lock_store(store: &Mutex<Store>) -> MutexGuard<'_, Store> {
    store.lock().unwrap_or_else(|poisoned| {
        eprintln!("store lock was poisoned by a panic; recovering");
        poisoned.into_inner()
    })
}

fn panic_message(payload: &(dyn Any + Send)) -> String {
    payload
        .downcast_ref::<&str>()
        .map(|s| s.to_string())
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic".to_string())
}

/// Runs a core call on the blocking pool with the store locked.
pub async fn blocking<T, F>(state: &AppState, f: F) -> Result<T, ErrorPayload>
where
    T: Send + 'static,
    F: FnOnce(&mut Store) -> folio_core::Result<T> + Send + 'static,
{
    let store = Arc::clone(&state.store);
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let mut guard = lock_store(&store);
        match catch_unwind(AssertUnwindSafe(|| f(&mut guard))) {
            Ok(result) => result.map_err(|e| e.to_payload()),
            Err(payload) => Err(error_payload(
                "db",
                format!("internal error: {}", panic_message(payload.as_ref())),
            )),
        }
    })
    .await;
    match joined {
        Ok(result) => result,
        Err(e) => Err(error_payload("db", format!("blocking task failed: {e}"))),
    }
}

//! Quit and close without data loss (§4.5): ask the UI to flush, then exit on `quit_ready`
//! or after a timeout, whichever comes first.

use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};

use crate::state::AppState;

pub const FLUSH_EVENT: &str = "flush-request";
const FLUSH_TIMEOUT: Duration = Duration::from_secs(3);

/// Starts the quit flow once; repeated triggers do nothing.
pub fn begin(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state.quitting.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Err(e) = app.emit(FLUSH_EVENT, ()) {
        eprintln!("could not emit {FLUSH_EVENT}: {e}");
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(FLUSH_TIMEOUT);
        handle.exit(0);
    });
}

/// Final exit; the `quitting` flag is already set, so `ExitRequested` is not prevented again.
pub fn finish(app: &AppHandle) {
    app.state::<AppState>()
        .quitting
        .store(true, Ordering::SeqCst);
    app.exit(0);
}

/// Window close and app exit requests (Dock → Quit, logout) go through the flush first.
pub fn handle_run_event(app: &AppHandle, event: &RunEvent) {
    match event {
        RunEvent::WindowEvent {
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            api.prevent_close();
            begin(app);
        }
        RunEvent::ExitRequested { api, .. } => {
            if app.state::<AppState>().quitting.load(Ordering::SeqCst) {
                return;
            }
            api.prevent_exit();
            begin(app);
        }
        _ => {}
    }
}

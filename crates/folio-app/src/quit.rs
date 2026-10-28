//! Quit and close without data loss (§4.5): ask the UI to flush, then exit on `quit_ready`
//! or after a timeout, whichever comes first.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};

use crate::state::{lock_store, AppState};

pub const FLUSH_EVENT: &str = "flush-request";
const FLUSH_TIMEOUT: Duration = Duration::from_secs(3);

/// True for the first trigger only (sets the flag); later triggers do nothing.
fn try_begin(quitting: &AtomicBool) -> bool {
    !quitting.swap(true, Ordering::SeqCst)
}

/// Once quitting, the final `app.exit(0)` must go through.
fn should_prevent_exit(quitting: bool) -> bool {
    !quitting
}

/// Waits for an in-flight store call (e.g. a `tab_apply` transaction) to commit.
fn wait_for_writes(app: &AppHandle) {
    drop(lock_store(&app.state::<AppState>().store));
}

fn exit_now(app: &AppHandle) {
    app.state::<AppState>()
        .exiting
        .store(true, Ordering::SeqCst);
    wait_for_writes(app);
    app.exit(0);
}

/// Starts the quit flow once; repeated triggers do nothing.
/// Returns whether this call started it.
pub fn begin(app: &AppHandle) -> bool {
    if !try_begin(&app.state::<AppState>().quitting) {
        return false;
    }
    if let Err(e) = app.emit(FLUSH_EVENT, ()) {
        eprintln!("could not emit {FLUSH_EVENT}: {e}");
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(FLUSH_TIMEOUT);
        exit_now(&handle);
    });
    true
}

/// Final exit; the `quitting` flag is already set, so `ExitRequested` is not prevented again.
pub fn finish(app: &AppHandle) {
    app.state::<AppState>()
        .quitting
        .store(true, Ordering::SeqCst);
    exit_now(app);
}

/// Window close and app exit requests go through the flush first.
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
            if should_prevent_exit(app.state::<AppState>().quitting.load(Ordering::SeqCst)) {
                api.prevent_exit();
                begin(app);
            }
        }
        // Last chance: never tear the process down in the middle of a transaction.
        RunEvent::Exit => wait_for_writes(app),
        _ => {}
    }
}

/// Dock → Quit, logout and the app switcher end in `terminate:`. tao's app delegate has no
/// `applicationShouldTerminate:`, so no `ExitRequested` precedes `RunEvent::Exit` and nothing
/// would be flushed. Add the method to the delegate's class at runtime: the first call starts
/// the quit flow and cancels the termination, the final `app.exit(0)` terminates for real.
#[cfg(target_os = "macos")]
pub fn install_dock_quit_hook(app: &AppHandle) {
    use std::sync::OnceLock;

    use objc2::ffi::class_addMethod;
    use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
    use objc2::{msg_send, sel};

    const TERMINATE_CANCEL: usize = 0;
    const TERMINATE_NOW: usize = 1;
    static APP: OnceLock<AppHandle> = OnceLock::new();

    extern "C" fn should_terminate(
        _this: *mut AnyObject,
        _cmd: Sel,
        _sender: *mut AnyObject,
    ) -> usize {
        let Some(app) = APP.get() else {
            return TERMINATE_NOW;
        };
        // Only our own final `app.exit(0)` may terminate; every earlier trigger (including a
        // repeated one while the flush is pending) is cancelled.
        if app.state::<AppState>().exiting.load(Ordering::SeqCst) {
            return TERMINATE_NOW;
        }
        begin(app);
        TERMINATE_CANCEL
    }

    let _ = APP.set(app.clone());
    // SAFETY: `NSApp` and its delegate exist once tauri's setup runs; the class is only
    // extended with a method it lacks (`class_addMethod` returns false if it already exists).
    unsafe {
        let ns_app: *mut AnyObject = msg_send![objc2::class!(NSApplication), sharedApplication];
        let delegate: *mut AnyObject = msg_send![ns_app, delegate];
        if delegate.is_null() {
            eprintln!("no NSApp delegate; Dock quit will not flush");
            return;
        }
        let class: &AnyClass = (*delegate).class();
        let imp: Imp = std::mem::transmute(
            should_terminate as extern "C" fn(*mut AnyObject, Sel, *mut AnyObject) -> usize,
        );
        let added = class_addMethod(
            class as *const AnyClass as *mut _,
            sel!(applicationShouldTerminate:),
            imp,
            c"Q@:@".as_ptr(),
        );
        if !added.as_bool() {
            eprintln!("applicationShouldTerminate: already exists; Dock quit hook not installed");
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn install_dock_quit_hook(_app: &AppHandle) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_trigger_begins_second_does_nothing() {
        let quitting = AtomicBool::new(false);
        assert!(try_begin(&quitting));
        assert!(!try_begin(&quitting));
        assert!(quitting.load(Ordering::SeqCst));
    }

    #[test]
    fn exit_is_prevented_only_before_quitting() {
        assert!(should_prevent_exit(false));
        assert!(!should_prevent_exit(true));
    }
}

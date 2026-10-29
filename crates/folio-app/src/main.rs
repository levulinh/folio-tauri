mod commands;
mod menu;
mod quit;
mod state;

use tauri::Manager;

fn main() {
    let app = tauri::Builder::default()
        .invoke_handler(commands::invoke_handler())
        .menu(menu::build)
        .on_menu_event(menu::on_event)
        .setup(|app| {
            let dir = state::data_dir(&app.path().app_data_dir()?, cfg!(debug_assertions));
            std::fs::create_dir_all(&dir)?;
            let db_path = dir.join("folio.sqlite");
            let store = folio_core::Store::open(&db_path, &dir.join("assets"))
                .map_err(|e| format!("cannot open {}: {e}", db_path.display()))?;
            app.manage(state::AppState::new(store));
            quit::install_dock_quit_hook(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Folio (see the message above for the cause)");
    app.run(|handle, event| quit::handle_run_event(handle, &event));
}

#[cfg(test)]
mod tests {
    /// `data-tauri-drag-region` calls `start_dragging` (drag) and `internal_toggle_maximize`
    /// (double-click), which `core:default` does not allow: without them the overlay title bar
    /// cannot move or zoom the window (D-032).
    #[test]
    fn main_window_may_start_dragging() {
        let capability = include_str!("../capabilities/default.json");
        for permission in [
            "core:window:allow-start-dragging",
            "core:window:allow-internal-toggle-maximize",
        ] {
            assert!(
                capability.contains(&format!("\"{permission}\"")),
                "{permission}"
            );
        }
    }
}

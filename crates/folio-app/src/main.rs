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
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let store = folio_core::Store::open(&dir.join("folio.sqlite"), &dir.join("assets"))?;
            app.manage(state::AppState::new(store));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Folio");
    app.run(|handle, event| quit::handle_run_event(handle, &event));
}

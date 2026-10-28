//! macOS menu bar (§4.4), Phase 1 subset. Custom items emit an event to the main window.

use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Wry};

use crate::quit;

const QUIT_ID: &str = "quit";

/// Menu item id → event name emitted to the UI.
const NEW_PAGE_ID: &str = "new-page";
const NEW_SUBPAGE_ID: &str = "new-subpage";
const FIND_ID: &str = "find";
const SEARCH_ID: &str = "search";
const UNDO_ID: &str = "undo";
const REDO_ID: &str = "redo";

const EVENT_ITEMS: &[(&str, &str)] = &[
    (NEW_PAGE_ID, "menu:new-page"),
    (NEW_SUBPAGE_ID, "menu:new-subpage"),
    (FIND_ID, "menu:find"),
    (SEARCH_ID, "menu:search"),
    (UNDO_ID, "menu:undo"),
    (REDO_ID, "menu:redo"),
];

pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let folio = Submenu::with_items(
        app,
        "Folio",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("Giới thiệu Folio"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some("Ẩn Folio"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, QUIT_ID, "Thoát Folio", true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;
    let file = Submenu::with_items(
        app,
        "Tệp",
        true,
        &[
            &MenuItem::with_id(app, NEW_PAGE_ID, "Trang mới", true, Some("CmdOrCtrl+N"))?,
            &MenuItem::with_id(
                app,
                NEW_SUBPAGE_ID,
                "Trang con mới",
                true,
                Some("CmdOrCtrl+Shift+N"),
            )?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Sửa",
        true,
        &[
            // Custom (not the native undo:/redo:): the UI routes history itself (D-026).
            &MenuItem::with_id(app, UNDO_ID, "Hoàn tác", true, Some("CmdOrCtrl+Z"))?,
            &MenuItem::with_id(app, REDO_ID, "Làm lại", true, Some("CmdOrCtrl+Shift+Z"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("Cắt"))?,
            &PredefinedMenuItem::copy(app, Some("Sao chép"))?,
            &PredefinedMenuItem::paste(app, Some("Dán"))?,
            &PredefinedMenuItem::select_all(app, Some("Chọn tất cả"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, FIND_ID, "Tìm trong trang", true, Some("CmdOrCtrl+F"))?,
            &MenuItem::with_id(
                app,
                SEARCH_ID,
                "Tìm mọi trang",
                true,
                Some("CmdOrCtrl+Shift+F"),
            )?,
        ],
    )?;
    Menu::with_items(app, &[&folio, &file, &edit])
}

pub fn on_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();
    if id == QUIT_ID {
        quit::begin(app);
        return;
    }
    if let Some((_, name)) = EVENT_ITEMS.iter().find(|(item, _)| *item == id) {
        if let Err(e) = app.emit_to("main", name, ()) {
            eprintln!("could not emit {name}: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn undo_and_redo_are_custom_items_that_emit_events() {
        let event_of = |id: &str| {
            EVENT_ITEMS
                .iter()
                .find(|(item, _)| *item == id)
                .map(|(_, e)| *e)
        };
        assert_eq!(event_of(UNDO_ID), Some("menu:undo"));
        assert_eq!(event_of(REDO_ID), Some("menu:redo"));
    }

    /// The native `undo:`/`redo:` items bypass the UI's history routing (D-024/D-026), so the Edit menu
    /// must not contain them. (A menu cannot be built off the main thread, hence the source check.)
    #[test]
    fn edit_menu_has_no_predefined_undo_or_redo() {
        let source = include_str!("menu.rs");
        for kind in ["undo", "redo"] {
            let needle = format!("{}{}::{kind}(", "Predefined", "MenuItem");
            let production = source.split("#[cfg(test)]").next().unwrap();
            assert!(!production.contains(&needle), "found {needle}");
        }
    }
}

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

const EVENT_ITEMS: &[(&str, &str)] = &[
    (NEW_PAGE_ID, "menu:new-page"),
    (NEW_SUBPAGE_ID, "menu:new-subpage"),
    (FIND_ID, "menu:find"),
    (SEARCH_ID, "menu:search"),
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
            &PredefinedMenuItem::undo(app, Some("Hoàn tác"))?,
            &PredefinedMenuItem::redo(app, Some("Làm lại"))?,
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

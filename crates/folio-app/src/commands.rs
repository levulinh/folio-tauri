//! Tauri commands (§4.2, Phase 1 subset). Each runs its core call via [`blocking`].

use folio_core::appearance::Appearance;
use folio_core::error::ErrorPayload;
use folio_core::model::{
    ApplyResult, AssetMeta, BlockNode, BlockOp, CreatedPage, PageMeta, SearchHit, TabMeta,
};
use tauri::{AppHandle, State};

use crate::quit;
use crate::state::{blocking, AppState};

const SEARCH_LIMIT: usize = 50;

type CmdResult<T> = Result<T, ErrorPayload>;

/// Single source of the command list: `$cb!` receives every command identifier, so the
/// `COMMANDS` names and the `generate_handler!` list cannot drift apart.
macro_rules! command_list {
    ($cb:ident) => {
        $cb! {
            asset_import,
            appearance_get,
            appearance_set,
            pages_list,
            page_create,
            page_rename,
            page_delete,
            tabs_list,
            tab_create,
            tab_rename,
            tab_move,
            tab_delete,
            tab_load,
            tab_apply,
            search,
            quit_ready
        }
    };
}

macro_rules! names {
    ($($c:ident),* $(,)?) => { &[$(stringify!($c)),*] };
}

macro_rules! handler {
    ($($c:ident),* $(,)?) => { tauri::generate_handler![$($c),*] };
}

/// Exact `invoke` names, exported to `ui/src/backend/generated/commands.ts`.
#[cfg_attr(not(test), allow(dead_code))] // read by the name-export tests only
pub const COMMANDS: &[&str] = command_list!(names);

pub fn invoke_handler() -> impl Fn(tauri::ipc::Invoke) -> bool + Send + Sync + 'static {
    command_list!(handler)
}

fn import_request(
    body: &tauri::ipc::InvokeBody,
    headers: &tauri::http::HeaderMap,
) -> CmdResult<(String, Vec<u8>)> {
    let invalid = || {
        folio_core::CoreError::InvalidOp {
            index: 0,
            reason: "expected raw image bytes and percent-encoded x-file-name".into(),
        }
        .to_payload()
    };
    let tauri::ipc::InvokeBody::Raw(bytes) = body else {
        return Err(invalid());
    };
    if bytes.len() > folio_core::assets::MAX_ASSET_BYTES {
        return Err(invalid());
    }
    let encoded = headers
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(invalid)?;
    // Reject malformed escapes instead of silently retaining them in the display name.
    let mut decoded = Vec::new();
    let mut chars = encoded.as_bytes().iter().copied();
    while let Some(ch) = chars.next() {
        if ch == b'%' {
            let hi = chars
                .next()
                .and_then(|c| (c as char).to_digit(16))
                .ok_or_else(invalid)?;
            let lo = chars
                .next()
                .and_then(|c| (c as char).to_digit(16))
                .ok_or_else(invalid)?;
            decoded.push((hi * 16 + lo) as u8);
        } else {
            decoded.push(ch);
        }
    }
    Ok((
        String::from_utf8(decoded).map_err(|_| invalid())?,
        bytes.clone(),
    ))
}

#[tauri::command]
async fn asset_import(
    state: State<'_, AppState>,
    request: tauri::ipc::Request<'_>,
) -> CmdResult<AssetMeta> {
    let (name, bytes) = import_request(request.body(), request.headers())?;
    blocking(&state, move |s| s.import_asset(&name, &bytes)).await
}

#[tauri::command]
async fn appearance_get(state: State<'_, AppState>) -> CmdResult<Appearance> {
    blocking(&state, |s| s.appearance_get()).await
}

#[tauri::command]
async fn appearance_set(state: State<'_, AppState>, appearance: Appearance) -> CmdResult<()> {
    blocking(&state, move |s| s.appearance_set(appearance)).await
}

#[tauri::command]
async fn pages_list(state: State<'_, AppState>) -> CmdResult<Vec<PageMeta>> {
    blocking(&state, |s| s.list_pages()).await
}

#[tauri::command]
async fn page_create(
    state: State<'_, AppState>,
    parent_id: Option<String>,
    after_id: Option<String>,
) -> CmdResult<CreatedPage> {
    blocking(&state, move |s| {
        s.create_page(parent_id.as_deref(), after_id.as_deref())
    })
    .await
}

#[tauri::command]
async fn page_rename(state: State<'_, AppState>, id: String, title: String) -> CmdResult<PageMeta> {
    blocking(&state, move |s| s.rename_page(&id, &title)).await
}

#[tauri::command]
async fn page_delete(state: State<'_, AppState>, id: String) -> CmdResult<Vec<String>> {
    blocking(&state, move |s| s.delete_page(&id)).await
}

#[tauri::command]
async fn tabs_list(state: State<'_, AppState>, page_id: String) -> CmdResult<Vec<TabMeta>> {
    blocking(&state, move |s| s.list_tabs(&page_id)).await
}

#[tauri::command]
async fn tab_create(
    state: State<'_, AppState>,
    page_id: String,
    name: String,
) -> CmdResult<TabMeta> {
    blocking(&state, move |s| s.create_tab(&page_id, &name)).await
}

#[tauri::command]
async fn tab_rename(state: State<'_, AppState>, id: String, name: String) -> CmdResult<TabMeta> {
    blocking(&state, move |s| s.rename_tab(&id, &name)).await
}

#[tauri::command]
async fn tab_move(
    state: State<'_, AppState>,
    id: String,
    prev_sibling_id: Option<String>,
) -> CmdResult<Vec<TabMeta>> {
    blocking(&state, move |s| s.move_tab(&id, prev_sibling_id.as_deref())).await
}

#[tauri::command]
async fn tab_delete(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    blocking(&state, move |s| s.delete_tab(&id)).await
}

#[tauri::command]
async fn tab_load(state: State<'_, AppState>, tab_id: String) -> CmdResult<Vec<BlockNode>> {
    blocking(&state, move |s| s.load_tab(&tab_id)).await
}

#[tauri::command]
async fn tab_apply(
    state: State<'_, AppState>,
    tab_id: String,
    ops: Vec<BlockOp>,
) -> CmdResult<ApplyResult> {
    blocking(&state, move |s| s.apply(&tab_id, &ops)).await
}

#[tauri::command]
async fn search(state: State<'_, AppState>, query: String) -> CmdResult<Vec<SearchHit>> {
    blocking(&state, move |s| s.search(&query, SEARCH_LIMIT)).await
}

#[tauri::command]
fn quit_ready(app: AppHandle) {
    quit::finish(&app);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn raw_import_request_decodes_names_and_rejects_bad_requests() {
        use tauri::{http::HeaderMap, ipc::InvokeBody};
        let mut headers = HeaderMap::new();
        let raw = InvokeBody::Raw(b"GIF89aimage".to_vec());
        assert!(import_request(&raw, &headers).is_err());
        headers.insert("x-file-name", "%E1%BA%A3nh%20a.gif".parse().unwrap());
        let (name, bytes) = import_request(&raw, &headers).unwrap();
        assert_eq!(name, "ảnh a.gif");
        let mut store = folio_core::Store::open_in_memory().unwrap();
        assert_eq!(store.import_asset(&name, &bytes).unwrap().file_name, name);
        assert!(import_request(&InvokeBody::default(), &headers).is_err());
        for name in ["%", "%ZZ", "%FF"] {
            headers.insert("x-file-name", name.parse().unwrap());
            assert!(import_request(&raw, &headers).is_err());
        }
        headers.insert("x-file-name", "%2e%2e%2fa.gif".parse().unwrap());
        let (name, bytes) = import_request(&raw, &headers).unwrap();
        assert!(store.import_asset(&name, &bytes).is_err());
    }

    /// Second literal list next to the macro one: adding a command means touching both.
    const EXPECTED: [&str; 16] = [
        "asset_import",
        "appearance_get",
        "appearance_set",
        "pages_list",
        "page_create",
        "page_rename",
        "page_delete",
        "tabs_list",
        "tab_create",
        "tab_rename",
        "tab_move",
        "tab_delete",
        "tab_load",
        "tab_apply",
        "search",
        "quit_ready",
    ];

    #[test]
    fn commands_match_handler() {
        assert_eq!(COMMANDS, EXPECTED.as_slice());
    }

    fn export_dir() -> PathBuf {
        std::env::var_os("TS_RS_EXPORT_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../ui/src/backend/generated")
            })
    }

    fn camel_case(snake: &str) -> String {
        let mut out = String::new();
        let mut upper = false;
        for ch in snake.chars() {
            if ch == '_' {
                upper = true;
            } else if upper {
                out.extend(ch.to_uppercase());
                upper = false;
            } else {
                out.push(ch);
            }
        }
        out
    }

    fn commands_ts() -> String {
        let mut out = String::from("export const Commands = {\n");
        for name in COMMANDS {
            out.push_str(&format!("  {}: \"{}\",\n", camel_case(name), name));
        }
        out.push_str("} as const;\n");
        out
    }

    /// Generator, not a check: writes `ui/src/backend/generated/commands.ts` from `COMMANDS`
    /// (run by `cargo test --workspace export_`; `scripts/check.sh` then fails on any diff).
    #[test]
    fn export_commands_ts_file() {
        let dir = export_dir();
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("commands.ts");
        std::fs::write(&path, commands_ts()).unwrap();
        let written = std::fs::read_to_string(&path).unwrap();
        assert!(written.contains("assetImport: \"asset_import\""));
        assert!(written.contains("pagesList: \"pages_list\""));
        assert!(written.contains("tabApply: \"tab_apply\""));
        assert!(written.ends_with("} as const;\n"));
    }

    #[test]
    fn blocking_runs_core_calls_and_maps_errors() {
        let state = AppState::new(folio_core::Store::open_in_memory().unwrap());
        let created =
            tauri::async_runtime::block_on(blocking(&state, |s| s.create_page(None, None)))
                .unwrap();
        let err = tauri::async_runtime::block_on(blocking(&state, |s| s.rename_page("nope", "x")))
            .unwrap_err();
        assert_eq!(err.code, "not_found");
        assert!(!created.page.id.is_empty());
    }

    #[test]
    fn blocking_recovers_from_a_poisoned_lock() {
        let state = AppState::new(folio_core::Store::open_in_memory().unwrap());
        let store = std::sync::Arc::clone(&state.store);
        let _ = std::thread::spawn(move || {
            let _guard = store.lock().unwrap();
            panic!("poison the lock");
        })
        .join();
        assert!(state.store.is_poisoned());
        let pages = tauri::async_runtime::block_on(blocking(&state, |s| s.list_pages())).unwrap();
        assert!(pages.is_empty());
    }

    #[test]
    fn blocking_reports_a_panic_and_keeps_working() {
        let state = AppState::new(folio_core::Store::open_in_memory().unwrap());
        let err = tauri::async_runtime::block_on(blocking(&state, |_| -> folio_core::Result<()> {
            panic!("boom")
        }))
        .unwrap_err();
        assert_eq!(err.code, "db");
        assert_eq!(err.message, "internal error: boom");
        let next = tauri::async_runtime::block_on(blocking(&state, |s| s.list_pages()));
        assert!(next.is_ok());
    }
}

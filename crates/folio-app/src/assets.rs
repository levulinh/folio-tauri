use folio_core::Store;
use std::sync::Mutex;
use tauri::http::Response;

pub fn response(store: &Mutex<Store>, path: &str) -> Response<Vec<u8>> {
    let result = (|| -> folio_core::Result<_> {
        let id = path.strip_prefix('/').unwrap_or("");
        let store = crate::state::lock_store(store);
        let meta = store.get_asset(id)?;
        let bytes = std::fs::read(store.asset_path(id)?)?;
        Ok((meta.mime, bytes))
    })();
    match result {
        Ok((mime, bytes)) => Response::builder()
            .header("Content-Type", mime)
            .header("Cache-Control", "max-age=31536000, immutable")
            .header("Access-Control-Allow-Origin", "*")
            .header("X-Content-Type-Options", "nosniff")
            .body(bytes)
            .unwrap(),
        Err(_) => Response::builder().status(404).body(Vec::new()).unwrap(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn serves_persisted_bytes_and_returns_404_for_paths() {
        let mut store = Store::open_in_memory().unwrap();
        let bytes = b"GIF89aimage";
        let meta = store.import_asset("a.gif", bytes).unwrap();
        let store = Mutex::new(store);
        let result = response(&store, &format!("/{}", meta.id));
        assert_eq!(result.status(), 200);
        assert_eq!(result.headers()["Content-Type"], "image/gif");
        assert_eq!(result.body(), bytes);
        for path in ["/missing", "/../secret", "/%2e%2e%2fsecret", "/"] {
            assert_eq!(response(&store, path).status(), 404);
        }
    }
}

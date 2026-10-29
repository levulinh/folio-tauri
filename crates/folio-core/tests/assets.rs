use folio_core::Store;
const PNG: &[u8] = b"\x89PNG\r\n\x1a\nimage bytes";
#[test]
fn persists_deduplicates_and_reopens() {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("db");
    let assets = dir.path().join("assets");
    let mut store = Store::open(&db, &assets).unwrap();
    let first = store.import_asset("ảnh.PNG", PNG).unwrap();
    assert_eq!(first, store.import_asset("other.png", PNG).unwrap());
    assert_eq!(first.mime, "image/png");
    assert_eq!(first.ext, "png");
    assert_eq!(first.sha256.len(), 64);
    drop(store);
    let store = Store::open(&db, &assets).unwrap();
    assert_eq!(store.get_asset(&first.id).unwrap(), first);
    assert_eq!(
        std::fs::read(store.asset_path(&first.id).unwrap()).unwrap(),
        PNG
    );
    assert_eq!(std::fs::read_dir(assets).unwrap().count(), 1);
}
#[test]
fn rejects_invalid_images_names_sizes_and_paths() {
    let mut store = Store::open_in_memory().unwrap();
    for name in [
        "", "../a.png", "/a.png", "a\\b.png", "a\0.png", "a.svg", "a.jpg",
    ] {
        assert!(store.import_asset(name, PNG).is_err(), "{name:?}");
    }
    for bytes in [b"<svg/>".as_slice(), b"", b"not an image"] {
        assert!(store.import_asset("a.png", bytes).is_err());
    }
    assert!(store
        .import_asset("a.png", &vec![0; 20 * 1024 * 1024 + 1])
        .is_err());
    for id in ["../secret", "/etc/passwd", "unknown", "%2e%2e%2fsecret"] {
        assert!(store.asset_path(id).is_err());
        assert!(store.get_asset(id).is_err());
    }
}

#[test]
fn supports_all_raster_signatures_and_rejects_corrupt_stored_paths() {
    let mut store = Store::open_in_memory().unwrap();
    for (name, bytes, mime) in [
        ("a.jpg", b"\xff\xd8\xffimage".as_slice(), "image/jpeg"),
        ("a.jpeg", b"\xff\xd8\xffother".as_slice(), "image/jpeg"),
        ("a.gif", b"GIF87aimage".as_slice(), "image/gif"),
        ("a.webp", b"RIFF1234WEBPimage".as_slice(), "image/webp"),
    ] {
        assert_eq!(store.import_asset(name, bytes).unwrap().mime, mime);
    }
    let meta = store.import_asset("a.png", PNG).unwrap();
    store
        .conn()
        .execute("UPDATE assets SET ext='../secret' WHERE id=?1", [&meta.id])
        .unwrap();
    assert!(store.asset_path(&meta.id).is_err());
}

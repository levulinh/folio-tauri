use folio_core::{
    appearance::{AccentColor, Appearance, ThemeMode},
    CoreError, Store,
};

#[test]
fn enum_serialization_uses_exact_lowercase_strings() {
    for (mode, expected) in [
        (ThemeMode::System, r#""system""#),
        (ThemeMode::Light, r#""light""#),
        (ThemeMode::Dark, r#""dark""#),
    ] {
        assert_eq!(serde_json::to_string(&mode).unwrap(), expected);
    }
    for (accent, expected) in [
        (AccentColor::Neutral, r#""neutral""#),
        (AccentColor::Blue, r#""blue""#),
        (AccentColor::Olive, r#""olive""#),
        (AccentColor::Purple, r#""purple""#),
    ] {
        assert_eq!(serde_json::to_string(&accent).unwrap(), expected);
    }
}

#[test]
fn defaults_and_all_combinations_survive_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("db.sqlite");
    let assets = dir.path().join("assets");
    let mut store = Store::open(&db, &assets).unwrap();
    assert_eq!(store.appearance_get().unwrap(), Appearance::default());
    for mode in [ThemeMode::System, ThemeMode::Light, ThemeMode::Dark] {
        for accent in [
            AccentColor::Neutral,
            AccentColor::Blue,
            AccentColor::Olive,
            AccentColor::Purple,
        ] {
            let value = Appearance {
                mode: mode.clone(),
                accent,
            };
            store.appearance_set(value.clone()).unwrap();
            drop(store);
            store = Store::open(&db, &assets).unwrap();
            assert_eq!(store.appearance_get().unwrap(), value);
        }
    }
}

#[test]
fn corrupt_values_default_without_rewriting_or_affecting_pages() {
    let mut store = Store::open_in_memory().unwrap();
    let page = store.create_page(None, None).unwrap().page;
    for raw in [
        "{",
        "{}",
        r#"{"mode":"dark","accent":"invalid"}"#,
        r#"{"mode":"invalid","accent":"blue"}"#,
    ] {
        store.conn().execute("INSERT INTO settings VALUES ('appearance.v1', ?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [raw]).unwrap();
        assert_eq!(store.appearance_get().unwrap(), Appearance::default());
        let persisted: String = store
            .conn()
            .query_row(
                "SELECT value FROM settings WHERE key='appearance.v1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(persisted, raw);
        assert_eq!(store.list_pages().unwrap()[0].id, page.id);
    }
}

#[test]
fn database_errors_propagate_and_failed_write_preserves_value() {
    let mut store = Store::open_in_memory().unwrap();
    let prior = Appearance {
        mode: ThemeMode::Dark,
        accent: AccentColor::Blue,
    };
    store.appearance_set(prior.clone()).unwrap();
    let page = store.create_page(None, None).unwrap().page;
    store
        .conn()
        .execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            ["unrelated", "keep"],
        )
        .unwrap();
    store.conn().execute_batch("CREATE TRIGGER fail_appearance BEFORE UPDATE ON settings BEGIN SELECT RAISE(ABORT, 'fail'); END;").unwrap();
    assert!(matches!(
        store.appearance_set(Appearance::default()),
        Err(CoreError::Db(_))
    ));
    assert_eq!(store.appearance_get().unwrap(), prior);
    assert_eq!(store.list_pages().unwrap()[0].id, page.id);
    let other: String = store
        .conn()
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            ["unrelated"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(other, "keep");
    store.conn().execute_batch("DROP TABLE settings;").unwrap();
    assert!(matches!(store.appearance_get(), Err(CoreError::Db(_))));
}

#[test]
fn deserialization_rejects_invalid_and_missing_fields() {
    for value in [
        r#"{}"#,
        r#"{"mode":"light"}"#,
        r#"{"mode":"light","accent":"invalid"}"#,
    ] {
        assert!(serde_json::from_str::<Appearance>(value).is_err());
    }
}

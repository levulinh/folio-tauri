use uuid::Uuid;

/// New page/tab/etc. id: UUID v7, lowercase hyphenated.
pub fn new_id() -> String {
    Uuid::now_v7().hyphenated().to_string()
}

/// True for any well-formed UUID string (any version).
pub fn is_uuid(s: &str) -> bool {
    Uuid::parse_str(s).is_ok()
}

//! Persisted raster assets. GC is deliberately deferred until references in both
//! blocks and history snapshots can be checked; imports never delete old files.
use crate::{model::AssetMeta, CoreError, Result, Store};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use sha2::{Digest, Sha256};
use std::{io::Write, path::PathBuf};
pub const MAX_ASSET_BYTES: usize = 20 * 1024 * 1024;
fn invalid(reason: &str) -> CoreError {
    CoreError::InvalidOp {
        index: 0,
        reason: reason.into(),
    }
}
fn format(name: &str, bytes: &[u8]) -> Result<(String, &'static str)> {
    if name.trim().is_empty()
        || name.len() > 255
        || name.contains(['/', '\\'])
        || name.chars().any(char::is_control)
    {
        return Err(invalid("asset name must be a file name"));
    }
    if bytes.is_empty() || bytes.len() > MAX_ASSET_BYTES {
        return Err(invalid("image must be between 1 byte and 20 MiB"));
    }
    let ext = name
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" if bytes.starts_with(b"\x89PNG\r\n\x1a\n") => "image/png",
        "jpg" | "jpeg" if bytes.starts_with(b"\xff\xd8\xff") => "image/jpeg",
        "gif" if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") => "image/gif",
        "webp" if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" => {
            "image/webp"
        }
        _ => {
            return Err(invalid(
                "expected PNG, JPEG, GIF or WebP with matching file signature",
            ))
        }
    };
    Ok((ext, mime))
}
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<AssetMeta> {
    Ok(AssetMeta {
        id: r.get(0)?,
        file_name: r.get(1)?,
        ext: r.get(2)?,
        mime: r.get(3)?,
        byte_size: r.get(4)?,
        sha256: r.get(5)?,
        created_at: r.get(6)?,
    })
}
impl Store {
    pub fn import_asset(&mut self, name: &str, bytes: &[u8]) -> Result<AssetMeta> {
        let (ext, mime) = format(name, bytes)?;
        let sha256 = format!("{:x}", Sha256::digest(bytes));
        let dir = self.assets_dir().to_path_buf();
        // Serialize dedupe across separate Store connections as well as app calls.
        let tx = self
            .conn_mut()
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        if let Some(meta) = tx.query_row("SELECT id,file_name,ext,mime,byte_size,sha256,created_at FROM assets WHERE sha256=?1 LIMIT 1", [&sha256], row).optional()? { return Ok(meta); }
        let meta = AssetMeta {
            id: crate::ids::new_id(),
            file_name: name.into(),
            ext,
            mime: mime.into(),
            byte_size: bytes.len() as i64,
            sha256,
            created_at: crate::time::now_ms(),
        };
        let mut temp = tempfile::NamedTempFile::new_in(&dir)?;
        temp.write_all(bytes)?;
        temp.as_file().sync_all()?;
        temp.persist_noclobber(dir.join(format!("{}.{}", meta.id, meta.ext)))
            .map_err(|e| e.error)?;
        // A failed insert may leave an orphan; never delete a potentially referenced file.
        tx.execute("INSERT INTO assets(id,file_name,ext,mime,byte_size,sha256,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", params![meta.id,meta.file_name,meta.ext,meta.mime,meta.byte_size,meta.sha256,meta.created_at])?;
        tx.commit()?;
        Ok(meta)
    }
    pub fn get_asset(&self, id: &str) -> Result<AssetMeta> {
        self.conn()
            .query_row(
                "SELECT id,file_name,ext,mime,byte_size,sha256,created_at FROM assets WHERE id=?1",
                [id],
                row,
            )
            .optional()?
            .ok_or_else(|| CoreError::NotFound {
                entity: "asset",
                id: id.into(),
            })
    }
    pub fn asset_path(&self, id: &str) -> Result<PathBuf> {
        let meta = self.get_asset(id)?;
        if !crate::ids::is_uuid(&meta.id)
            || !matches!(meta.ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp")
        {
            return Err(invalid("invalid stored asset path"));
        }
        let root = self.assets_dir().canonicalize()?;
        let path = root
            .join(format!("{}.{}", meta.id, meta.ext))
            .canonicalize()?;
        if path.parent() != Some(root.as_path()) {
            return Err(invalid("asset path escapes storage"));
        }
        Ok(path)
    }
}

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{Result, Store};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    System,
    Light,
    Dark,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum AccentColor {
    Neutral,
    Blue,
    Olive,
    Purple,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Appearance {
    pub mode: ThemeMode,
    pub accent: AccentColor,
}

impl Default for Appearance {
    fn default() -> Self {
        Self {
            mode: ThemeMode::System,
            accent: AccentColor::Neutral,
        }
    }
}

impl Store {
    pub fn appearance_get(&self) -> Result<Appearance> {
        let value: Option<String> = self
            .conn()
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                ["appearance.v1"],
                |row| row.get(0),
            )
            .optional()?;
        Ok(value
            .and_then(|v| serde_json::from_str(&v).ok())
            .unwrap_or_default())
    }

    pub fn appearance_set(&mut self, appearance: Appearance) -> Result<()> {
        let value = serde_json::to_string(&appearance)?;
        self.conn_mut().execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params!["appearance.v1", value],
        )?;
        Ok(())
    }
}

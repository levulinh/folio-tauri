-- search_fts columns kind/owner_id/page_id are UNINDEXED (tech spec §3.1), so deleting by owner
-- would scan the whole table. This side table maps each owner to its fts rowid.
CREATE TABLE search_owner (
  fts_rowid INTEGER PRIMARY KEY,   -- rowid of the matching search_fts row
  kind      TEXT NOT NULL,
  owner_id  TEXT NOT NULL,
  page_id   TEXT NOT NULL,
  UNIQUE (kind, owner_id)
);
CREATE INDEX search_owner_page ON search_owner(page_id);
INSERT INTO search_owner (fts_rowid, kind, owner_id, page_id)
  SELECT rowid, kind, owner_id, page_id FROM search_fts;

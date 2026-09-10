-- Additive migration. The backend also applies this schema at startup.
BEGIN;
SET LOCAL search_path = mercaz, public;
SELECT pg_advisory_xact_lock(-910902);
CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  source TEXT NOT NULL,
  account TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'mapping',
  sheets TEXT NOT NULL DEFAULT '[]',
  items TEXT NOT NULL DEFAULT '[]',
  results TEXT NOT NULL DEFAULT '[]',
  settings TEXT NOT NULL DEFAULT '{}',
  cursor INTEGER NOT NULL DEFAULT 0,
  lease TEXT NOT NULL DEFAULT '',
  locked_until BIGINT NOT NULL DEFAULT 0,
  created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_import_batches_store ON import_batches(store_id,created);
CREATE TABLE IF NOT EXISTS import_links (
  store_id INTEGER NOT NULL REFERENCES stores(id),
  source TEXT NOT NULL,
  account TEXT NOT NULL,
  external_key TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id TEXT NOT NULL REFERENCES import_batches(id),
  sku TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(store_id,source,account,external_key)
);
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON import_batches, import_links FROM anon, authenticated;
COMMIT;

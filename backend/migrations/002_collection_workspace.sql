-- Add collection_id to environments and schemas to support isolated workspaces
ALTER TABLE saved_assets ADD COLUMN IF NOT EXISTS parent_collection_key TEXT;
ALTER TABLE validation_schemas ADD COLUMN IF NOT EXISTS parent_collection_key TEXT;

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_saved_assets_parent ON saved_assets(parent_collection_key);
CREATE INDEX IF NOT EXISTS idx_validation_schemas_parent ON validation_schemas(parent_collection_key);

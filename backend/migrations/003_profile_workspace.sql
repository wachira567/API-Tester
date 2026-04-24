-- Add parent_collection_key to credential_profiles to support isolated workspaces
ALTER TABLE credential_profiles ADD COLUMN IF NOT EXISTS parent_collection_key TEXT;

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_credential_profiles_parent ON credential_profiles(parent_collection_key);

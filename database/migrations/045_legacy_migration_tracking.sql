-- v0.37.0: Legacy Rule Migration Tracking
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds tracking columns to library_custom_rules for migration
-- to the new policy-driven system. This supports the gradual migration from
-- legacy rules to policy overrides during v0.37-v0.39 transition period.
-- 
-- Related Issue: #103
-- Parent Epic: #82 (v0.37.0 Formula-Based Classification Engine)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add migration tracking columns to library_custom_rules
ALTER TABLE library_custom_rules 
ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS migrated_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS migration_type VARCHAR(50);

-- Create index for efficient querying of unmigrated rules
CREATE INDEX IF NOT EXISTS idx_legacy_rules_migrated 
ON library_custom_rules(migrated_at) WHERE migrated_at IS NULL;

-- Add index for migration type filtering
CREATE INDEX IF NOT EXISTS idx_legacy_rules_migration_type 
ON library_custom_rules(migration_type) WHERE migration_type IS NOT NULL;

COMMENT ON COLUMN library_custom_rules.migrated_at IS 'Timestamp when rule was migrated to policy system';
COMMENT ON COLUMN library_custom_rules.migrated_by IS 'User who performed the migration';
COMMENT ON COLUMN library_custom_rules.migration_type IS 'Type of migration: preset, override, or manual';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Legacy Migration Tracking (045) completed successfully';
    RAISE NOTICE 'Added migration tracking columns to library_custom_rules';
END $$;

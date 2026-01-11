-- v0.37.2: Add custom_signals column to policy_presets
-- Allows per-policy customization of preset signals (certifications, genres, keywords)

ALTER TABLE policy_presets
ADD COLUMN IF NOT EXISTS custom_signals JSONB DEFAULT NULL;

COMMENT ON COLUMN policy_presets.custom_signals IS 'Per-policy customization of preset signals (overrides preset defaults)';

-- Add sort_order column if missing (for ordering presets within a policy)
ALTER TABLE policy_presets
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
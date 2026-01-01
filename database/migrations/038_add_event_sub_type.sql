-- Migration: Add event_sub_type column for more specific event detection
-- This allows libraries to target specific event types (e.g., "christmas" instead of just "holiday")

-- Add event_sub_type column to libraries table
ALTER TABLE libraries
ADD COLUMN IF NOT EXISTS event_sub_type VARCHAR(50) DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN libraries.event_sub_type IS 'Sub-type for event detection (e.g., christmas, halloween for holiday type)';
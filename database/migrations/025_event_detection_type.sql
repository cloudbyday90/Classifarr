-- Migration 025: Add event_detection_type to libraries
-- Allows explicit assignment of event detection type per library
-- Values: 'holiday', 'sports', 'ppv', 'concert', 'awards', or NULL

ALTER TABLE libraries
ADD COLUMN IF NOT EXISTS event_detection_type VARCHAR(50) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN libraries.event_detection_type IS 'Event detection type: holiday, sports, ppv, concert, awards';
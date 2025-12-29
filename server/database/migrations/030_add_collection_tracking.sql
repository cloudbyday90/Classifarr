-- v0.33.0: Add collection_id to classification_history for franchise tracking

-- Add collection_id column for TMDb franchise/collection tracking
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS collection_id INTEGER;

-- Add library_name column for easier querying (denormalized)
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS library_name VARCHAR(255);

-- Add signals_json column to store all collected signals
ALTER TABLE classification_history
ADD COLUMN IF NOT EXISTS signals_json JSONB;

-- Create index on collection_id for franchise queries
CREATE INDEX IF NOT EXISTS idx_classification_history_collection_id ON classification_history (collection_id)
WHERE
    collection_id IS NOT NULL;
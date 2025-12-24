-- OMDb API configuration table
-- Free tier: 1,000 requests/day

CREATE TABLE IF NOT EXISTS omdb_config (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    daily_limit INTEGER DEFAULT 1000,
    requests_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default row if empty
INSERT INTO
    omdb_config (id, is_active)
SELECT 1, false
WHERE
    NOT EXISTS (
        SELECT 1
        FROM omdb_config
        WHERE
            id = 1
    );
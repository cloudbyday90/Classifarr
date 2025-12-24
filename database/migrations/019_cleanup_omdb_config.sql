-- Cleanup duplicate OMDb configuration rows
-- Preserves existing configuration and consolidates to id=1

DO $$
DECLARE
    existing_config RECORD;
BEGIN
    -- Check if any config exists
    SELECT * INTO existing_config FROM omdb_config ORDER BY id LIMIT 1;
    
    IF FOUND THEN
        -- If id=1 doesn't exist, copy first config to id=1
        IF NOT EXISTS (SELECT 1 FROM omdb_config WHERE id = 1) THEN
            INSERT INTO omdb_config (id, api_key, is_active, daily_limit, requests_today, last_reset_date, created_at, updated_at)
            VALUES (
                1,
                existing_config.api_key,
                existing_config.is_active,
                COALESCE(existing_config.daily_limit, 1000),
                COALESCE(existing_config.requests_today, 0),
                COALESCE(existing_config.last_reset_date, CURRENT_DATE),
                existing_config.created_at,
                existing_config.updated_at
            );
        END IF;
        
        -- Delete all duplicate rows (keep only id=1)
        DELETE FROM omdb_config WHERE id != 1;
    ELSE
        -- No config exists, create default row
        INSERT INTO omdb_config (id, is_active, daily_limit, requests_today, last_reset_date)
        VALUES (1, false, 1000, 0, CURRENT_DATE);
    END IF;
    
    -- Reset sequence to ensure next insert starts at 2
    PERFORM setval('omdb_config_id_seq', 1, true);
END $$;
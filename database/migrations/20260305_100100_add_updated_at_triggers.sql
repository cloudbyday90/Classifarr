/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Migration: Add updated_at auto-update triggers to config tables
 *
 * 2025/2026 best practice: use ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)
 * guard so no-op UPDATE statements (SET x = x) do NOT bump updated_at.
 * This prevents spurious cache invalidation and audit noise.
 *
 * Uses CREATE OR REPLACE so it is safe to re-run.
 * Each trigger is created only if it does not already exist to be idempotent.
 */

-- Shared trigger function (idempotent via OR REPLACE)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update updated_at when row data actually changed
    IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: create trigger only if table exists and trigger does not yet exist
DO $$
DECLARE
    tbl TEXT;
    trig_name TEXT;
    tables TEXT[] := ARRAY[
        'radarr_config',
        'sonarr_config',
        'ollama_config',
        'tmdb_config',
        'notification_config',
        'libraries',
        'library_custom_rules',
        'settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        trig_name := 'trg_' || tbl || '_updated_at';

        -- Only create if table exists (safe for partial schema states)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        )
        -- Only create if the updated_at column actually exists on this table
        AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
        )
        -- Only create if trigger doesn't already exist (idempotent)
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.triggers
            WHERE trigger_schema = 'public'
              AND event_object_table = tbl
              AND trigger_name = trig_name
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I
                 BEFORE UPDATE ON %I
                 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
                trig_name, tbl
            );
        END IF;
    END LOOP;
END $$;

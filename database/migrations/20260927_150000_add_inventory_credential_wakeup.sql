-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE inventory_credential_wakeups (
    config_id INTEGER PRIMARY KEY REFERENCES tmdb_config(id) ON DELETE CASCADE,
    generation UUID NOT NULL DEFAULT gen_random_uuid(),
    verified_at TIMESTAMPTZ,
    probe_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    provider_retry_after TIMESTAMPTZ,
    probe_lease_id UUID,
    probe_lease_until TIMESTAMPTZ,
    probe_failures INTEGER NOT NULL DEFAULT 0 CHECK (probe_failures BETWEEN 0 AND 1000000),
    last_failure_category TEXT,
    batch_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    after_item_id INTEGER NOT NULL DEFAULT 0 CHECK (after_item_id >= 0),
    released_count BIGINT NOT NULL DEFAULT 0 CHECK (released_count >= 0),
    last_released_at TIMESTAMPTZ,
    CHECK ((probe_lease_id IS NULL) = (probe_lease_until IS NULL))
);
ALTER TABLE media_server_items ADD COLUMN inventory_tmdb_wakeup_generation UUID;
CREATE INDEX idx_inventory_authentication_recovery ON media_server_items(id)
    WHERE inventory_tmdb_recovery->>'status' = 'open'
      AND inventory_tmdb_recovery->>'category' = 'authentication';

-- Configuration changes atomically invalidate old verification, including A -> B -> A.
-- Language-only edits and masked-key saves do not authorize a new wakeup.
CREATE FUNCTION reset_inventory_credential_wakeup() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.inventory_credential_wakeups(config_id) VALUES (NEW.id)
    ON CONFLICT (config_id) DO UPDATE SET generation = gen_random_uuid(), verified_at = NULL,
        probe_after = GREATEST(clock_timestamp(), inventory_credential_wakeups.provider_retry_after),
        probe_lease_id = NULL, probe_lease_until = NULL,
        probe_failures = 0, last_failure_category = NULL, batch_after = clock_timestamp(),
        after_item_id = 0, released_count = 0, last_released_at = NULL;
    RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_credential_wakeup_insert AFTER INSERT ON tmdb_config
    FOR EACH ROW EXECUTE FUNCTION reset_inventory_credential_wakeup();
CREATE TRIGGER inventory_credential_wakeup_change AFTER UPDATE OF api_key, is_active ON tmdb_config
    FOR EACH ROW WHEN (ROW(OLD.api_key, OLD.is_active) IS DISTINCT FROM ROW(NEW.api_key, NEW.is_active))
    EXECUTE FUNCTION reset_inventory_credential_wakeup();
-- First installation may verify existing credentials, but never releases work in the migration.
INSERT INTO inventory_credential_wakeups(config_id) SELECT id FROM tmdb_config;

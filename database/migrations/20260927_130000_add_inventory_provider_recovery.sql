-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE media_server_items
    ADD COLUMN inventory_tmdb_recovery JSONB,
    ADD COLUMN inventory_tmdb_retry_after TIMESTAMPTZ,
    ADD COLUMN inventory_tmdb_lease_id UUID,
    ADD COLUMN inventory_tmdb_lease_until TIMESTAMPTZ,
    ADD CONSTRAINT inventory_tmdb_recovery_shape CHECK (inventory_tmdb_recovery IS NULL OR
        COALESCE((jsonb_typeof(inventory_tmdb_recovery) = 'object'
         AND inventory_tmdb_recovery->>'version' = '1'
         AND octet_length(inventory_tmdb_recovery::text) <= 2048), false)),
    ADD CONSTRAINT inventory_tmdb_lease_shape CHECK
        ((inventory_tmdb_lease_id IS NULL) = (inventory_tmdb_lease_until IS NULL));

CREATE OR REPLACE FUNCTION reset_inventory_tmdb_observation_clocks() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    NEW.inventory_tmdb_attempted_at := NULL;
    NEW.inventory_tmdb_fetched_at := NULL;
    NEW.inventory_tmdb_recovery := NULL;
    NEW.inventory_tmdb_retry_after := NULL;
    NEW.inventory_tmdb_lease_id := NULL;
    NEW.inventory_tmdb_lease_until := NULL;
    RETURN NEW;
END;
$$;
DROP TRIGGER reset_inventory_tmdb_observation_clocks ON media_server_items;
CREATE TRIGGER reset_inventory_tmdb_observation_clocks
    BEFORE UPDATE OF tmdb_id, media_type, library_id, media_server_id, external_id,
        title, year, imdb_id, tvdb_id ON media_server_items
    FOR EACH ROW WHEN
        (ROW(OLD.tmdb_id, OLD.media_type, OLD.library_id, OLD.media_server_id, OLD.external_id,
             OLD.title, OLD.year, OLD.imdb_id, OLD.tvdb_id)
         IS DISTINCT FROM
         ROW(NEW.tmdb_id, NEW.media_type, NEW.library_id, NEW.media_server_id, NEW.external_id,
             NEW.title, NEW.year, NEW.imdb_id, NEW.tvdb_id))
    EXECUTE FUNCTION reset_inventory_tmdb_observation_clocks();

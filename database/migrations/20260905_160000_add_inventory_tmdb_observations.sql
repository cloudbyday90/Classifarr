-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE media_server_items
    ADD COLUMN inventory_tmdb_attempted_at TIMESTAMPTZ,
    ADD COLUMN inventory_tmdb_fetched_at TIMESTAMPTZ;

-- A prior identity's success or failure must not delay acquisition for a new one.
CREATE FUNCTION reset_inventory_tmdb_observation_clocks() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    NEW.inventory_tmdb_attempted_at := NULL;
    NEW.inventory_tmdb_fetched_at := NULL;
    RETURN NEW;
END;
$$;
CREATE TRIGGER reset_inventory_tmdb_observation_clocks
    BEFORE UPDATE OF tmdb_id, media_type ON media_server_items
    FOR EACH ROW WHEN (OLD.tmdb_id IS DISTINCT FROM NEW.tmdb_id OR OLD.media_type IS DISTINCT FROM NEW.media_type)
    EXECUTE FUNCTION reset_inventory_tmdb_observation_clocks();

CREATE OR REPLACE FUNCTION library_profile_observed_metadata(payload JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, public AS $$
    SELECT jsonb_build_object(
        'omdb', CASE WHEN jsonb_typeof(payload -> 'omdb') = 'object' THEN
            jsonb_build_object('rated', payload #> '{omdb,rated}', 'data', jsonb_build_object('rated', payload #> '{omdb,data,rated}')) END,
        'tmdb', CASE WHEN jsonb_typeof(payload -> 'tmdb') = 'object' THEN
            jsonb_build_object('genres', payload #> '{tmdb,genres}', 'certification', payload #> '{tmdb,certification}',
                'production_companies', payload #> '{tmdb,production_companies}') END,
        'inventory_tmdb', CASE WHEN jsonb_typeof(payload -> 'inventory_tmdb') = 'object' THEN
            jsonb_build_object('version', payload #> '{inventory_tmdb,version}',
                'tmdb_id', payload #> '{inventory_tmdb,tmdb_id}', 'media_type', payload #> '{inventory_tmdb,media_type}',
                'keywords', payload #> '{inventory_tmdb,keywords}', 'original_language', payload #> '{inventory_tmdb,original_language}') END
    );
$$;

-- The meaning of observed keywords/language changed; refresh without operator input.
SELECT mark_library_profile_inventory_changed(array_agg(id ORDER BY id)) FROM libraries
WHERE EXISTS (SELECT 1 FROM media_server_items WHERE library_id = libraries.id)
   OR EXISTS (SELECT 1 FROM library_profiles WHERE library_id = libraries.id);

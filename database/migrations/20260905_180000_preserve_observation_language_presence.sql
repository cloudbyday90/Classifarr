-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Preserve absence versus explicit unknown language when projecting attributable records.
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
                'keywords', payload #> '{inventory_tmdb,keywords}') ||
            CASE WHEN (payload -> 'inventory_tmdb') ? 'original_language' THEN
                jsonb_build_object('original_language', payload #> '{inventory_tmdb,original_language}') ELSE '{}'::jsonb END END
    );
$$;

SELECT mark_library_profile_inventory_changed(array_agg(l.id ORDER BY l.id)) FROM libraries l
WHERE EXISTS (SELECT 1 FROM media_server_items msi WHERE msi.library_id = l.id
    AND jsonb_typeof(msi.metadata -> 'inventory_tmdb') = 'object'
    AND NOT ((msi.metadata -> 'inventory_tmdb') ? 'original_language'));

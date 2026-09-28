-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- ROW(...) IS DISTINCT FROM ROW(...) expands into nested OR nodes whose
-- pg_dump output flattens on restore. Explicit scalar comparisons preserve
-- the same NULL-safe behavior and a stable upgrade/fresh-install catalog.
-- Keep the original migration immutable; do not reset existing item state.
CREATE OR REPLACE TRIGGER reset_inventory_tmdb_observation_clocks
    BEFORE UPDATE OF tmdb_id, media_type, library_id, media_server_id, external_id,
        title, year, imdb_id, tvdb_id ON public.media_server_items
    FOR EACH ROW WHEN (
        OLD.tmdb_id IS DISTINCT FROM NEW.tmdb_id
        OR OLD.media_type IS DISTINCT FROM NEW.media_type
        OR OLD.library_id IS DISTINCT FROM NEW.library_id
        OR OLD.media_server_id IS DISTINCT FROM NEW.media_server_id
        OR OLD.external_id IS DISTINCT FROM NEW.external_id
        OR OLD.title IS DISTINCT FROM NEW.title
        OR OLD.year IS DISTINCT FROM NEW.year
        OR OLD.imdb_id IS DISTINCT FROM NEW.imdb_id
        OR OLD.tvdb_id IS DISTINCT FROM NEW.tvdb_id
    )
    EXECUTE FUNCTION public.reset_inventory_tmdb_observation_clocks();

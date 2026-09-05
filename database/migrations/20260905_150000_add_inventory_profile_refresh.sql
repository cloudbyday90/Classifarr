-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0

CREATE TABLE library_profile_inventory_state (
    library_id BIGINT PRIMARY KEY REFERENCES libraries(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
    refreshed_revision BIGINT NOT NULL DEFAULT 0 CHECK (refreshed_revision >= 0),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (refreshed_revision <= revision)
);
CREATE INDEX idx_library_profile_inventory_dirty
    ON library_profile_inventory_state (changed_at, library_id)
    WHERE revision > refreshed_revision;

-- This projection is shared by change detection and the observation reader.
CREATE FUNCTION library_profile_observed_metadata(payload JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, public AS $$
    SELECT jsonb_build_object(
        'original_language', payload -> 'original_language',
        'omdb', CASE WHEN jsonb_typeof(payload -> 'omdb') = 'object' THEN
            jsonb_build_object('rated', payload #> '{omdb,rated}', 'data', jsonb_build_object('rated', payload #> '{omdb,data,rated}')) END,
        'tmdb', CASE WHEN jsonb_typeof(payload -> 'tmdb') = 'object' THEN
            jsonb_build_object('genres', payload #> '{tmdb,genres}', 'certification', payload #> '{tmdb,certification}',
                'production_companies', payload #> '{tmdb,production_companies}',
                'keywords', payload #> '{tmdb,keywords}', 'original_language', payload #> '{tmdb,original_language}') END
    );
$$;

CREATE FUNCTION mark_library_profile_inventory_changed(library_ids BIGINT[]) RETURNS VOID
LANGUAGE sql SET search_path = pg_catalog, public AS $$
    INSERT INTO public.library_profile_inventory_state (library_id)
    SELECT id FROM public.libraries WHERE id = ANY(library_ids) ORDER BY id
    ON CONFLICT (library_id) DO UPDATE
    SET revision = public.library_profile_inventory_state.revision + 1,
        changed_at = clock_timestamp();
$$;

CREATE FUNCTION capture_library_profile_inventory_change() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE affected BIGINT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT array_agg(DISTINCT library_id) INTO affected FROM new_items;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT array_agg(DISTINCT library_id) INTO affected FROM old_items;
    ELSIF TG_OP = 'UPDATE' THEN
        WITH changed AS (
            SELECT old_row.library_id AS old_library_id, new_row.library_id AS new_library_id
            FROM old_items old_row FULL JOIN new_items new_row USING (id)
            WHERE ROW(old_row.library_id, old_row.tmdb_id, old_row.media_type, old_row.content_rating,
                old_row.genres, old_row.studio, public.library_profile_observed_metadata(old_row.metadata))
                IS DISTINCT FROM ROW(new_row.library_id, new_row.tmdb_id, new_row.media_type, new_row.content_rating,
                new_row.genres, new_row.studio, public.library_profile_observed_metadata(new_row.metadata))
        ), libraries_changed AS (
            SELECT old_library_id AS library_id FROM changed UNION SELECT new_library_id FROM changed
        )
        SELECT array_agg(library_id) INTO affected FROM libraries_changed;
    ELSE
        SELECT array_agg(library_id) INTO affected FROM (
            SELECT library_id FROM public.library_profile_inventory_state
            UNION SELECT library_id FROM public.library_profiles
        ) previously_observed;
    END IF;
    PERFORM public.mark_library_profile_inventory_changed(affected);
    RETURN NULL;
END;
$$;

CREATE TRIGGER library_profile_inventory_insert AFTER INSERT ON media_server_items
    REFERENCING NEW TABLE AS new_items FOR EACH STATEMENT
    EXECUTE FUNCTION capture_library_profile_inventory_change();
CREATE TRIGGER library_profile_inventory_update AFTER UPDATE ON media_server_items
    REFERENCING OLD TABLE AS old_items NEW TABLE AS new_items FOR EACH STATEMENT
    EXECUTE FUNCTION capture_library_profile_inventory_change();
CREATE TRIGGER library_profile_inventory_delete AFTER DELETE ON media_server_items
    REFERENCING OLD TABLE AS old_items FOR EACH STATEMENT
    EXECUTE FUNCTION capture_library_profile_inventory_change();
CREATE TRIGGER library_profile_inventory_truncate AFTER TRUNCATE ON media_server_items
    FOR EACH STATEMENT EXECUTE FUNCTION capture_library_profile_inventory_change();

INSERT INTO library_profile_inventory_state (library_id)
SELECT id FROM libraries library WHERE EXISTS (SELECT 1 FROM media_server_items WHERE library_id = library.id)
    OR EXISTS (SELECT 1 FROM library_profiles WHERE library_id = library.id);

ALTER TABLE policy_profile_refresh_outbox ADD COLUMN inventory_revision BIGINT;
ALTER TABLE policy_profile_refresh_outbox
    DROP CONSTRAINT policy_profile_refresh_outbox_request_type_chk,
    DROP CONSTRAINT policy_profile_refresh_outbox_request_shape_chk;
ALTER TABLE policy_profile_refresh_outbox
    ADD CONSTRAINT policy_profile_refresh_outbox_request_type_chk CHECK (
        request_type IN ('learning_evidence', 'native_readiness', 'inventory_change')
    ),
    ADD CONSTRAINT policy_profile_refresh_outbox_request_shape_chk CHECK (
        (
            request_type = 'learning_evidence' AND inventory_revision IS NULL
            AND classification_id IS NOT NULL
            AND learning_operation_id IN ('write_compatibility_evidence', 'write_identity_evidence')
            AND learning_tier_id IN ('compatibility_evidence', 'identity_evidence')
            AND ((learning_operation_id = 'write_compatibility_evidence' AND learning_tier_id = 'compatibility_evidence')
                OR (learning_operation_id = 'write_identity_evidence' AND learning_tier_id = 'identity_evidence'))
            AND char_length(btrim(candidate_key)) BETWEEN 3 AND 160
            AND refresh_reason_id = 'profile_refresh_required'
            AND source_system = 'policy_authorized_profile_refresh'
        ) OR (
            request_type = 'native_readiness' AND inventory_revision IS NULL
            AND classification_id IS NULL AND learning_operation_id IS NULL
            AND learning_tier_id IS NULL AND candidate_key IS NULL
            AND source_id = 'native_policy_profile_readiness'
            AND refresh_reason_id = 'stale_library_profile'
            AND source_system = 'policy_native_readiness_profile_refresh'
        ) OR (
            request_type = 'inventory_change' AND inventory_revision IS NOT NULL AND inventory_revision > 0
            AND classification_id IS NULL AND learning_operation_id IS NULL
            AND learning_tier_id IS NULL AND candidate_key IS NULL
            AND source_id = 'library_inventory_observation'
            AND refresh_reason_id = 'library_inventory_changed'
            AND source_system = 'library_inventory_profile_refresh'
        )
    );
CREATE INDEX idx_profile_refresh_inventory_latest
    ON policy_profile_refresh_outbox (library_id, id DESC)
    WHERE request_type = 'inventory_change';

COMMENT ON TABLE library_profile_inventory_state IS
    'Transactional observation-input revisions and claim-bound acknowledgement; runtime state, not verified labels or portable configuration.';

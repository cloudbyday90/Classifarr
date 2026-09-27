-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE media_server_items ADD COLUMN inventory_tmdb_recovery_progress JSONB,
    ADD CONSTRAINT inventory_recovery_progress_shape CHECK (inventory_tmdb_recovery_progress IS NULL OR
        COALESCE(jsonb_typeof(inventory_tmdb_recovery_progress)='object'
        AND inventory_tmdb_recovery_progress->>'version'='1'
        AND octet_length(inventory_tmdb_recovery_progress::text)<=1024, false));
CREATE INDEX idx_inventory_recovery_progress_recent ON media_server_items
    ((inventory_tmdb_recovery_progress->>'released_at') DESC, id DESC)
    WHERE inventory_tmdb_recovery_progress IS NOT NULL;
CREATE INDEX idx_inventory_recovery_active_task ON task_queue ((payload->>'itemId'))
    WHERE task_type='metadata_enrichment' AND status IN ('pending','processing');

-- A bounded, latest-case receipt on the source row, not an unbounded event stream.
-- Run after the source-reset BEFORE trigger, including changes made by that trigger.
CREATE FUNCTION capture_inventory_recovery_progress() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE at_text TEXT := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
    IF NEW.inventory_tmdb_recovery->>'case_id' IS DISTINCT FROM OLD.inventory_tmdb_recovery->>'case_id'
       OR NEW.inventory_tmdb_recovery IS NULL THEN
        NEW.inventory_tmdb_recovery_progress := NULL;
    END IF;
    IF NEW.inventory_tmdb_wakeup_generation IS NOT NULL
       AND NEW.inventory_tmdb_wakeup_generation IS DISTINCT FROM OLD.inventory_tmdb_wakeup_generation
       AND NEW.inventory_tmdb_recovery->>'status'='open'
       AND NEW.inventory_tmdb_recovery->>'category'='authentication'
       AND NEW.inventory_tmdb_recovery->>'tmdb_id'=NEW.tmdb_id::text
       AND NEW.inventory_tmdb_recovery->>'media_type'=NEW.media_type
       AND NEW.media_type IN ('movie','tv')
       AND NEW.inventory_tmdb_recovery->>'case_id' ~ '^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$'
       AND NEW.inventory_tmdb_retry_after IS NOT NULL THEN
        NEW.inventory_tmdb_recovery_progress := jsonb_build_object('version',1,
            'case_id',NEW.inventory_tmdb_recovery->>'case_id',
            'generation',NEW.inventory_tmdb_wakeup_generation,'released_at',at_text,
            'eligible_at',to_char(NEW.inventory_tmdb_retry_after AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    END IF;
    IF NEW.inventory_tmdb_recovery_progress->>'case_id'=NEW.inventory_tmdb_recovery->>'case_id' THEN
        IF NEW.inventory_tmdb_lease_id IS NOT NULL AND NEW.inventory_tmdb_lease_id IS DISTINCT FROM OLD.inventory_tmdb_lease_id
           AND NEW.inventory_tmdb_lease_until>clock_timestamp()
           AND NOT (NEW.inventory_tmdb_recovery_progress ? 'started_at') THEN
            NEW.inventory_tmdb_recovery_progress := NEW.inventory_tmdb_recovery_progress || jsonb_build_object('started_at',at_text);
        END IF;
        IF NEW.inventory_tmdb_recovery->>'status'='resolved'
           AND OLD.inventory_tmdb_recovery->>'status'='open'
           AND NEW.inventory_tmdb_fetched_at IS DISTINCT FROM OLD.inventory_tmdb_fetched_at
           AND NEW.metadata->'inventory_tmdb'->>'tmdb_id'=NEW.tmdb_id::text
           AND NEW.metadata->'inventory_tmdb'->>'media_type'=NEW.media_type THEN
            NEW.inventory_tmdb_recovery_progress := NEW.inventory_tmdb_recovery_progress || jsonb_build_object('persisted_at',at_text);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER zz_inventory_recovery_progress BEFORE UPDATE ON media_server_items
    FOR EACH ROW EXECUTE FUNCTION capture_inventory_recovery_progress();

-- Atomic with actual queue insertion. Never reconstruct admission from logs or an API attempt.
CREATE FUNCTION capture_inventory_recovery_queue_admission() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE item_text TEXT := NEW.payload->>'itemId';
BEGIN
    IF item_text IS NULL OR item_text !~ '^[1-9][0-9]{0,9}$' THEN RETURN NEW; END IF;
    IF item_text::bigint>2147483647 THEN RETURN NEW; END IF;
    UPDATE public.media_server_items SET inventory_tmdb_recovery_progress=inventory_tmdb_recovery_progress ||
        jsonb_build_object('queued_at',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    WHERE id=item_text::integer AND inventory_tmdb_recovery_progress IS NOT NULL
      AND inventory_tmdb_recovery->>'status'='open'
      AND inventory_tmdb_recovery_progress->>'case_id'=inventory_tmdb_recovery->>'case_id'
      AND inventory_tmdb_recovery_progress->>'case_id'=NEW.payload->>'inventory_recovery_case_id'
      AND inventory_tmdb_recovery_progress->>'generation'=NEW.payload->>'inventory_recovery_generation'
      AND media_type=NEW.payload->'media'->>'media_type' AND tmdb_id::text=NEW.payload->>'tmdb_id'
      AND library_id::text=NEW.payload->>'source_library_id'
      AND NOT (inventory_tmdb_recovery_progress ? 'queued_at');
    RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_recovery_queue_admission AFTER INSERT ON task_queue
    FOR EACH ROW WHEN (NEW.task_type='metadata_enrichment' AND NEW.status IN ('pending','processing'))
    EXECUTE FUNCTION capture_inventory_recovery_queue_admission();

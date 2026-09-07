-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Separate statements intentionally leave every existing row unknown.
ALTER TABLE public.classification_history ADD COLUMN recorded_at timestamptz;
ALTER TABLE public.classification_history
    ALTER COLUMN recorded_at SET DEFAULT statement_timestamp(),
    ADD CONSTRAINT classification_history_recorded_at_finite
        CHECK (recorded_at IS NULL OR isfinite(recorded_at));

COMMENT ON COLUMN public.classification_history.recorded_at IS
    'INSERT statement start instant; immutable after insert. NULL means unknown legacy/import time. Not media creation or transaction commit time.';

CREATE FUNCTION public.preserve_history_recording_instant() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'History recording instant cannot be changed';
END;
$$;

CREATE TRIGGER preserve_history_recording_instant
    AFTER UPDATE ON public.classification_history
    FOR EACH ROW WHEN (OLD.recorded_at IS DISTINCT FROM NEW.recorded_at)
    EXECUTE FUNCTION public.preserve_history_recording_instant();

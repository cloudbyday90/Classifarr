-- Classifarr Database Schema Snapshot
-- Generated: 2026-09-07T01:15:31.152Z
-- Latest Migration: 20260907_020000_add_feedback_source_receipts.sql
-- 
-- ⚠️  FOR FRESH INSTALLS ONLY
-- ⚠️  Existing installations should use migrations/
-- 
-- This file represents the complete database state after all migrations.

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: intarray; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS intarray WITH SCHEMA public;


--
-- Name: EXTENSION intarray; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION intarray IS 'functions, operators, and index support for 1-D arrays of integers';


--
-- Name: pg_prewarm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_prewarm WITH SCHEMA public;


--
-- Name: EXTENSION pg_prewarm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_prewarm IS 'prewarm relation data';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

DO $$
DECLARE
    preload_setting text;
BEGIN
    SELECT setting INTO preload_setting
    FROM pg_settings
    WHERE name = 'shared_preload_libraries';

    IF EXISTS (
        SELECT 1
        FROM pg_available_extensions
        WHERE name = 'pg_stat_statements'
    ) AND position('pg_stat_statements' IN COALESCE(preload_setting, '')) > 0 THEN
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
        COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';
    ELSE
        RAISE NOTICE 'Skipping pg_stat_statements extension install because the runtime is unavailable or not preloaded.';
    END IF;
END $$;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        ALTER EXTENSION vector UPDATE TO '0.8.6';
    END IF;
END $$;


--
-- Name: capture_library_observation_clock_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capture_library_observation_clock_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
    INSERT INTO public.library_profile_inventory_state (library_id, observation_clock_revision)
    SELECT DISTINCT new_row.library_id, 1 FROM old_items old_row JOIN new_items new_row USING (id)
    JOIN public.libraries library ON library.id = new_row.library_id
    WHERE ROW(old_row.inventory_tmdb_attempted_at, old_row.inventory_tmdb_fetched_at)
        IS DISTINCT FROM ROW(new_row.inventory_tmdb_attempted_at, new_row.inventory_tmdb_fetched_at)
    ORDER BY new_row.library_id
    ON CONFLICT (library_id) DO UPDATE SET observation_clock_revision =
        public.library_profile_inventory_state.observation_clock_revision + 1;
    RETURN NULL;
END;
$$;


--
-- Name: capture_library_profile_inventory_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capture_library_profile_inventory_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
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


--
-- Name: enforce_cbv_capability_receipts_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_cbv_capability_receipts_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting(
           'classifarr.verification_capability_receipt_maintenance',
           true
       ) = 'replace_restore' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION
        'candidate-bound verification capability receipts are append-only'
        USING ERRCODE = '55000';
END;
$$;


--
-- Name: enforce_policy_intent_active_purpose_rule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_policy_intent_active_purpose_rule() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    affected_intent_id BIGINT;
BEGIN
    IF TG_TABLE_NAME = 'policy_intents' THEN
        affected_intent_id := COALESCE(NEW.id, OLD.id);
    ELSE
        affected_intent_id := COALESCE(NEW.intent_id, OLD.intent_id);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM policy_intents AS intent
        WHERE intent.id = affected_intent_id
          AND intent.active = TRUE
    ) AND NOT EXISTS (
        SELECT 1
        FROM policy_intent_rules AS purpose_rule
        WHERE purpose_rule.intent_id = affected_intent_id
          AND purpose_rule.intent_role = 'purpose'
    ) THEN
        RAISE EXCEPTION
            'Active native intent % requires at least one purpose rule',
            affected_intent_id
            USING ERRCODE = '23514',
                  HINT = 'Insert a purpose rule in the same transaction or deactivate the intent.';
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: extract_jsonb_name_text(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_jsonb_name_text(arr jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT COALESCE(
        string_agg(
            CASE
                WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
                WHEN jsonb_typeof(elem) = 'object' AND (elem ? 'name') THEN elem->>'name'
                ELSE NULL
            END,
            ' '
        ),
        ''
    )
    FROM jsonb_array_elements(
        CASE WHEN arr IS NOT NULL AND jsonb_typeof(arr) = 'array' THEN arr ELSE '[]'::jsonb END
    ) AS elem
$$;


--
-- Name: guard_policy_authorized_outcome_receipt_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_authorized_outcome_receipt_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- A replace restore starts a new runtime boundary. The caller must opt in
    -- locally inside its transaction; normal application paths cannot rewrite
    -- or remove receipts.
    IF TG_OP = 'DELETE'
       AND current_setting(
           'classifarr.policy_authorized_outcome_receipt_maintenance',
           true
       ) = 'replace_restore' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Authorized outcome source-event receipts are append-only';
END;
$$;


--
-- Name: guard_policy_backup_restore_verification_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_backup_restore_verification_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Backup restore verification evidence is append-only';
END;
$$;


--
-- Name: guard_policy_candidate_correction_review_corpus_audit_event_mut(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_candidate_correction_review_corpus_audit_event_mut() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Representative review-corpus audit events are append-only';
END;
$$;


--
-- Name: guard_policy_candidate_correction_review_corpus_capture_audit_e(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_candidate_correction_review_corpus_capture_audit_e() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Representative review-corpus capture audit events are append-only';
END;
$$;


--
-- Name: guard_policy_candidate_correction_review_projection_audit_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_candidate_correction_review_projection_audit_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Representative review-projection audit events are append-only';
END;
$$;


--
-- Name: guard_policy_identity_evidence_admission_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_identity_evidence_admission_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting(
           'classifarr.policy_identity_evidence_admission_maintenance',
           true
       ) = 'replace_restore' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Policy identity evidence admissions are append-only';
END;
$$;


--
-- Name: guard_policy_migration_verification_run_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_migration_verification_run_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- A replace restore starts a new runtime boundary. Normal runtime paths
    -- must not rewrite or delete migration verification evidence.
    IF TG_OP = 'DELETE'
       AND current_setting(
           'classifarr.policy_migration_verification_run_maintenance',
           true
       ) = 'replace_restore' THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Policy migration verification runs are append-only';
END;
$$;


--
-- Name: guard_policy_native_intent_change_receipt_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_native_intent_change_receipt_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Replace restore starts a new runtime boundary. It may clear
        -- operational retry state only through an explicit transaction-local
        -- permit. A foreign-key cascade caused by deleting the parent policy
        -- is also legitimate; the receipt cannot outlive that policy.
        IF current_setting(
               'classifarr.policy_native_intent_change_receipt_maintenance',
               true
           ) = 'replace_restore'
           OR NOT EXISTS (
               SELECT 1
               FROM library_policies
               WHERE id = OLD.policy_id
           ) THEN
            RETURN OLD;
        END IF;

        -- Retention has a separate, transaction-local permit and must never
        -- delete a receipt in the 30-day exact-replay window. The database
        -- enforces this invariant independently of the application query.
        IF current_setting(
               'classifarr.policy_native_intent_change_receipt_maintenance',
               true
           ) = 'retention_cleanup'
           AND OLD.created_at < NOW() - INTERVAL '30 days' THEN
            RETURN OLD;
        END IF;
    END IF;

    RAISE EXCEPTION 'Native intent change receipts are append-only';
END;
$$;


--
-- Name: guard_policy_observed_evidence_provenance_snapshot_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_observed_evidence_provenance_snapshot_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.establishment_id IS DISTINCT FROM OLD.establishment_id
       OR NEW.policy_id IS DISTINCT FROM OLD.policy_id
       OR NEW.library_id IS DISTINCT FROM OLD.library_id
       OR NEW.intent_id IS DISTINCT FROM OLD.intent_id
       OR NEW.snapshot_version IS DISTINCT FROM OLD.snapshot_version
       OR NEW.source_id IS DISTINCT FROM OLD.source_id
       OR NEW.capture_state IS DISTINCT FROM OLD.capture_state
       OR NEW.capture_reason_id IS DISTINCT FROM OLD.capture_reason_id
       OR NEW.profile_freshness_state IS DISTINCT FROM OLD.profile_freshness_state
       OR NEW.source_profile_generated_at IS DISTINCT FROM OLD.source_profile_generated_at
       OR NEW.source_profile_updated_at IS DISTINCT FROM OLD.source_profile_updated_at
       OR NEW.evidence_fingerprint IS DISTINCT FROM OLD.evidence_fingerprint
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Observed evidence provenance metadata is immutable';
    END IF;

    IF OLD.payload_redacted = TRUE THEN
        RAISE EXCEPTION 'Observed evidence provenance payload is already redacted';
    END IF;

    IF NEW.payload_redacted IS DISTINCT FROM TRUE
       OR NEW.redacted_at IS NULL
       OR jsonb_typeof(NEW.snapshot_payload) <> 'object'
       OR NOT (NEW.snapshot_payload ? 'retention_marker') THEN
        RAISE EXCEPTION 'Observed evidence provenance snapshots may only transition to a retention marker';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: guard_policy_runtime_pending_question_cleanup_audit_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_policy_runtime_pending_question_cleanup_audit_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Pending-question cleanup audit records are append-only';
END;
$$;


--
-- Name: is_policy_runtime_pending_question_cleanup_reason_ids(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_policy_runtime_pending_question_cleanup_reason_ids(value jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
    reason_id TEXT;
BEGIN
    IF jsonb_typeof(value) <> 'array' OR jsonb_array_length(value) > 20 THEN
        RETURN FALSE;
    END IF;

    FOR reason_id IN SELECT jsonb_array_elements_text(value)
    LOOP
        IF reason_id !~ '^[a-z0-9_]{1,120}$' THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$_$;


--
-- Name: library_profile_observed_metadata(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.library_profile_observed_metadata(payload jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
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


--
-- Name: mark_library_profile_inventory_changed(bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_library_profile_inventory_changed(library_ids bigint[]) RETURNS void
    LANGUAGE sql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
    INSERT INTO public.library_profile_inventory_state (library_id)
    SELECT id FROM public.libraries WHERE id = ANY(library_ids) ORDER BY id
    ON CONFLICT (library_id) DO UPDATE
    SET revision = public.library_profile_inventory_state.revision + 1,
        changed_at = clock_timestamp();
$$;


--
-- Name: reject_policy_tuning_cohort_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_policy_tuning_cohort_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Suggestion cohorts are immutable' USING ERRCODE = '23514';
END;
$$;


--
-- Name: reset_inventory_tmdb_observation_clocks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_inventory_tmdb_observation_clocks() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
    NEW.inventory_tmdb_attempted_at := NULL;
    NEW.inventory_tmdb_fetched_at := NULL;
    RETURN NEW;
END;
$$;


--
-- Name: sync_classification_history_totals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_classification_history_totals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_is_success boolean := FALSE;
    new_is_success boolean := FALSE;
    old_is_failed boolean := FALSE;
    new_is_failed boolean := FALSE;
    success_delta integer := 0;
    failed_delta integer := 0;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        old_is_success := OLD.status = ANY (ARRAY['completed', 'corrected', 'verified', 'reclassified', 'routed']);
        old_is_failed := OLD.status = 'failed';
    END IF;

    IF TG_OP <> 'DELETE' THEN
        new_is_success := NEW.status = ANY (ARRAY['completed', 'corrected', 'verified', 'reclassified', 'routed']);
        new_is_failed := NEW.status = 'failed';
    END IF;

    success_delta := (CASE WHEN new_is_success THEN 1 ELSE 0 END)
        - (CASE WHEN old_is_success THEN 1 ELSE 0 END);
    failed_delta := (CASE WHEN new_is_failed THEN 1 ELSE 0 END)
        - (CASE WHEN old_is_failed THEN 1 ELSE 0 END);

    IF success_delta <> 0 OR failed_delta <> 0 THEN
        INSERT INTO public.classification_history_totals (
            singleton,
            successful_count,
            failed_count,
            updated_at
        )
        VALUES (TRUE, 0, 0, NOW())
        ON CONFLICT (singleton) DO NOTHING;

        UPDATE public.classification_history_totals
        SET successful_count = successful_count + success_delta,
            failed_count = failed_count + failed_delta,
            updated_at = NOW()
        WHERE singleton = TRUE;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_classification_search_text(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_classification_search_text() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    genre_text   TEXT := '';
    keyword_text TEXT := '';
BEGIN
    -- Extract genre names from metadata JSONB if present
    IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'genres' THEN
        genre_text := extract_jsonb_name_text(NEW.metadata->'genres');
    END IF;

    -- Extract keyword names from metadata JSONB if present
    IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'keywords' THEN
        keyword_text := extract_jsonb_name_text(NEW.metadata->'keywords');
    END IF;

    NEW.search_text := to_tsvector('english',
        COALESCE(NEW.title, '')        || ' ' ||
        COALESCE(NEW.library_name, '') || ' ' ||
        COALESCE(NEW.method, '')       || ' ' ||
        COALESCE(genre_text, '')       || ' ' ||
        COALESCE(keyword_text, '')
    );
    RETURN NEW;
END;
$$;


--
-- Name: update_library_rules_v2_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_library_rules_v2_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_provider_capability_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_provider_capability_metrics (
    provider_id character varying(32) NOT NULL,
    model character varying(255) NOT NULL,
    authority_mode character varying(32) NOT NULL,
    request_count bigint DEFAULT 0 NOT NULL,
    structured_parse_success_count bigint DEFAULT 0 CONSTRAINT ai_provider_capability_metr_structured_parse_success_c_not_null NOT NULL,
    semantic_contract_violation_count bigint DEFAULT 0 CONSTRAINT ai_provider_capability_metr_semantic_contract_violatio_not_null NOT NULL,
    repair_attempt_count bigint DEFAULT 0 NOT NULL,
    repair_success_count bigint DEFAULT 0 NOT NULL,
    timeout_or_incomplete_stream_count bigint DEFAULT 0 CONSTRAINT ai_provider_capability_metr_timeout_or_incomplete_stre_not_null NOT NULL,
    hallucinated_library_reference_count bigint DEFAULT 0 CONSTRAINT ai_provider_capability_metr_hallucinated_library_refer_not_null NOT NULL,
    hallucinated_action_count bigint DEFAULT 0 CONSTRAINT ai_provider_capability_metri_hallucinated_action_count_not_null NOT NULL,
    thinking_trace_leakage_count bigint DEFAULT 0 CONSTRAINT ai_provider_capability_metr_thinking_trace_leakage_cou_not_null NOT NULL,
    last_observed_at timestamp with time zone DEFAULT now() NOT NULL,
    model_digest_mismatch_count bigint DEFAULT 0 CONSTRAINT ai_provider_capability_metr_model_digest_mismatch_coun_not_null NOT NULL,
    last_model_digest_mismatch_at timestamp with time zone,
    CONSTRAINT ai_provider_capability_metrics_authority_mode_chk CHECK (((authority_mode)::text = ANY (ARRAY[('structured_contract'::character varying)::text, ('verification'::character varying)::text, ('proposal'::character varying)::text, ('explanation'::character varying)::text, ('fallback_advisory'::character varying)::text, ('disabled'::character varying)::text]))),
    CONSTRAINT ai_provider_capability_metrics_model_digest_mismatch_nonnegativ CHECK ((model_digest_mismatch_count >= 0)),
    CONSTRAINT ai_provider_capability_metrics_model_shape_chk CHECK (((length(btrim((model)::text)) >= 1) AND (length(btrim((model)::text)) <= 255))),
    CONSTRAINT ai_provider_capability_metrics_nonnegative_counts_chk CHECK (((request_count >= 0) AND (structured_parse_success_count >= 0) AND (semantic_contract_violation_count >= 0) AND (repair_attempt_count >= 0) AND (repair_success_count >= 0) AND (timeout_or_incomplete_stream_count >= 0) AND (hallucinated_library_reference_count >= 0) AND (hallucinated_action_count >= 0) AND (thinking_trace_leakage_count >= 0))),
    CONSTRAINT ai_provider_capability_metrics_provider_shape_chk CHECK (((provider_id)::text ~ '^[a-z0-9_-]{1,32}$'::text))
);


--
-- Name: TABLE ai_provider_capability_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_provider_capability_metrics IS 'Aggregate AI provider capability counters and bounded runtime failure timestamps; no prompts, model output, media data, or actions.';


--
-- Name: ai_provider_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_provider_config (
    id integer NOT NULL,
    primary_provider character varying(50) DEFAULT 'none'::character varying,
    api_endpoint character varying(500),
    api_key character varying(500),
    model text,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 2000,
    monthly_budget_usd numeric(10,2),
    current_month_usage_usd numeric(10,6) DEFAULT 0,
    budget_alert_threshold integer DEFAULT 80,
    pause_on_budget_exhausted boolean DEFAULT true,
    last_budget_reset date DEFAULT CURRENT_DATE,
    ollama_fallback_enabled boolean DEFAULT false,
    ollama_for_basic_tasks boolean DEFAULT false,
    ollama_for_budget_exhausted boolean DEFAULT true,
    ollama_host character varying(200) DEFAULT 'localhost'::character varying,
    ollama_port integer DEFAULT 11434,
    ollama_model text DEFAULT 'llama3.2'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    embedding_provider character varying(50) DEFAULT 'auto'::character varying,
    embedding_model text,
    rag_enabled boolean DEFAULT false,
    rag_similarity_threshold numeric(4,2) DEFAULT 0.70,
    rag_backfill_budget_type character varying(20) DEFAULT 'percentage'::character varying,
    rag_backfill_budget_value numeric(10,2) DEFAULT 25.00,
    rag_min_history_count integer DEFAULT 50,
    rag_fusion_method character varying(20) DEFAULT 'rrf'::character varying,
    rag_rrf_k integer DEFAULT 60,
    embedding_format_version integer DEFAULT 2,
    pattern_mining_enabled boolean DEFAULT true,
    pattern_rule_priority character varying(20) DEFAULT 'rules_first'::character varying,
    pattern_ai_skip_threshold integer DEFAULT 90,
    pattern_notification_dismissed boolean DEFAULT false,
    formula_pattern_weight real DEFAULT 0.40,
    formula_rule_weight real DEFAULT 0.30,
    formula_rag_weight real DEFAULT 0.20,
    formula_history_weight real DEFAULT 0.10,
    embedding_provider_mode character varying(20) DEFAULT 'same'::character varying,
    embedding_ollama_host character varying(255),
    embedding_ollama_port integer DEFAULT 11434,
    embedding_ollama_model text,
    embedding_cloud_provider character varying(50),
    embedding_cloud_api_key character varying(500),
    embedding_cloud_model text,
    heartbeat_timeout integer DEFAULT 30000,
    heartbeat_interval integer DEFAULT 5000,
    max_wait_time integer DEFAULT 60000,
    realtime_embedding_enabled boolean DEFAULT true,
    idle_backfill_enabled boolean DEFAULT true,
    idle_threshold integer DEFAULT 30000,
    idle_batch_size integer DEFAULT 10,
    scheduled_backfill_enabled boolean DEFAULT false,
    scheduled_backfill_time character varying(10) DEFAULT '02:00'::character varying,
    scheduled_backfill_days character varying(20) DEFAULT '0,1,2,3,4,5,6'::character varying,
    scheduled_backfill_batch_size integer DEFAULT 100,
    scheduled_backfill_max_duration integer DEFAULT 3600000,
    manual_backfill_batch_size integer DEFAULT 50,
    max_retries integer DEFAULT 3,
    retry_delay integer DEFAULT 1000,
    request_timeout integer DEFAULT 30000,
    cache_enabled boolean DEFAULT false,
    cache_ttl integer DEFAULT 24,
    verbose_logging boolean DEFAULT false,
    log_embedding_content boolean DEFAULT false,
    warmup_timeout integer DEFAULT 120000,
    retry_backoff_multiplier numeric(3,1) DEFAULT 2.0,
    jitter_factor numeric(3,2) DEFAULT 0.3,
    image_embedding_provider_mode character varying(30) DEFAULT 'disabled'::character varying,
    image_embedding_local_host character varying(255),
    image_embedding_local_port integer DEFAULT 8000,
    image_embedding_local_model text,
    image_embedding_cloud_provider character varying(50),
    image_embedding_cloud_api_key text,
    image_embedding_cloud_model text,
    image_embedding_image_size integer DEFAULT 512,
    image_embedding_rps integer DEFAULT 2,
    image_embedding_concurrency integer DEFAULT 2,
    image_embedding_batch_size integer DEFAULT 1,
    image_embedding_cache_ttl_hours integer DEFAULT 24,
    image_embedding_cache_max_mb integer DEFAULT 1024,
    image_embedding_cloud_api_endpoint text,
    rag_text_weight numeric(4,2) DEFAULT 0.70,
    rag_image_weight numeric(4,2) DEFAULT 0.30,
    image_embedding_models_cache jsonb,
    image_embedding_models_cache_updated_at timestamp with time zone,
    rag_retrieval_loop_enabled boolean DEFAULT true,
    rag_loop_rollout_mode character varying(10) DEFAULT 'apply'::character varying,
    rag_loop_low_confidence_threshold integer DEFAULT 70,
    rag_loop_max_passes integer DEFAULT 2,
    rag_loop_use_hybrid_on_retry boolean DEFAULT true,
    rag_loop_conflict_detection_enabled boolean DEFAULT false,
    rag_retry_strategy character varying(20) DEFAULT 'auto'::character varying,
    rag_retry_low_signal_similarity_floor numeric(4,2) DEFAULT 0.55,
    rag_retry_conflict_semantic_preferred boolean DEFAULT true,
    rag_retry_sparse_metadata_prefers_hybrid boolean DEFAULT true,
    rag_loop_candidate_limit integer DEFAULT 25,
    rag_conflict_top_n integer DEFAULT 5,
    rag_conflict_min_matches integer DEFAULT 3,
    rag_conflict_min_votes_per_library integer DEFAULT 2,
    rag_conflict_max_vote_gap integer DEFAULT 1,
    rag_conflict_max_similarity_margin_ratio numeric(4,2) DEFAULT 0.10,
    rag_conflict_min_avg_similarity numeric(4,2) DEFAULT 0.55,
    policy_recheck_below_prompt_threshold_enabled boolean DEFAULT true,
    policy_recheck_max_attempts integer DEFAULT 1,
    policy_recheck_identifier_caps jsonb DEFAULT '{"cast": 3, "genres": 5, "studios": 3, "keywords": 8}'::jsonb,
    policy_recheck_min_similarity_delta numeric(4,2) DEFAULT 0.08,
    policy_recheck_min_margin_delta numeric(6,2) DEFAULT 10,
    policy_recheck_min_confidence_gain numeric(6,2) DEFAULT 5,
    policy_recheck_max_ai_calls_per_item integer DEFAULT 2,
    policy_recheck_metadata_enrichment_enabled boolean DEFAULT true,
    policy_recheck_metadata_missing_fields_min integer DEFAULT 2,
    policy_recheck_metadata_timeout_ms integer DEFAULT 2000,
    policy_recheck_metadata_max_attempts integer DEFAULT 1,
    policy_recheck_metadata_source character varying(30) DEFAULT 'authoritative_only'::character varying,
    rag_loop_shadow_min_samples integer DEFAULT 200,
    rag_loop_shadow_max_error_rate_delta numeric(5,4) DEFAULT 0.01,
    rag_loop_shadow_max_p95_latency_delta_ms integer DEFAULT 250,
    rag_loop_trace_enabled boolean DEFAULT true,
    rag_loop_trace_max_events integer DEFAULT 20,
    rag_loop_trace_max_bytes integer DEFAULT 16384,
    rag_loop_trace_include_stage_metrics boolean DEFAULT true,
    policy_learning_second_pass_requires_manual_confirmation boolean DEFAULT true,
    policy_learning_include_shadow_feedback boolean DEFAULT false,
    policy_learning_allow_machine_only_second_pass_feedback boolean DEFAULT false,
    rag_alias_expansion_enabled boolean DEFAULT true,
    rag_alias_max_terms integer DEFAULT 5,
    rag_alias_min_token_length integer DEFAULT 3,
    rag_alias_source_policy character varying(30) DEFAULT 'authoritative_only'::character varying,
    rag_title_precedence_mode character varying(30) DEFAULT 'canonical_first'::character varying,
    rag_alias_weight numeric(4,2) DEFAULT 0.60,
    rag_loop_resilience_enabled boolean DEFAULT true,
    rag_loop_resilience_window_ms integer DEFAULT 300000,
    rag_loop_resilience_min_samples integer DEFAULT 20,
    rag_loop_resilience_timeout_streak_threshold integer DEFAULT 3,
    rag_loop_resilience_timeout_rate_threshold numeric(4,2) DEFAULT 0.35,
    rag_loop_resilience_error_rate_threshold numeric(4,2) DEFAULT 0.50,
    rag_loop_cooldown_tmdb_ms integer DEFAULT 900000,
    rag_loop_cooldown_rag_ms integer DEFAULT 600000,
    rag_loop_cooldown_ai_ms integer DEFAULT 900000,
    rag_loop_half_open_probe_count integer DEFAULT 2,
    rag_loop_global_bypass_multi_open_enabled boolean DEFAULT true,
    rag_loop_global_bypass_ms integer DEFAULT 600000,
    rag_loop_auto_fallback_enabled boolean DEFAULT true,
    rag_loop_auto_fallback_min_apply_samples integer DEFAULT 25,
    rag_loop_auto_fallback_consecutive_breaches integer DEFAULT 3,
    rag_loop_auto_fallback_cooldown_ms integer DEFAULT 900000,
    rag_loop_auto_recover_enabled boolean DEFAULT false,
    rag_loop_auto_fallback_breach_count integer DEFAULT 0,
    rag_loop_auto_fallback_last_breach_at timestamp without time zone,
    rag_loop_auto_fallback_last_triggered_at timestamp without time zone,
    rag_loop_auto_fallback_cooldown_until timestamp without time zone,
    rag_loop_auto_fallback_last_incident_id character varying(80),
    rag_loop_auto_fallback_last_incident_payload jsonb,
    rag_loop_auto_fallback_last_version character varying(64),
    rag_loop_auto_recover_last_attempt_version character varying(64),
    rag_loop_auto_recover_last_attempt_at timestamp without time zone,
    policy_recheck_skip_when_ai_confident_enabled boolean DEFAULT true,
    policy_recheck_confidence_gain_multiplier numeric(5,2) DEFAULT 2,
    rag_graph_enabled boolean DEFAULT false,
    rag_graph_weight numeric(4,2) DEFAULT 0.20,
    rag_graph_collection_enabled boolean DEFAULT true,
    rag_graph_director_enabled boolean DEFAULT true,
    rag_graph_studio_enabled boolean DEFAULT false,
    rag_graph_cast_enabled boolean DEFAULT false,
    rag_graph_genre_enabled boolean DEFAULT false,
    rag_graph_min_matches_to_apply integer DEFAULT 1,
    rag_graph_candidates_limit integer DEFAULT 20,
    image_embedding_local_api_key text,
    image_embedding_local_timeout_ms integer DEFAULT 15000,
    configuration_revision bigint DEFAULT 0 NOT NULL,
    configuration_write_tag uuid DEFAULT gen_random_uuid() NOT NULL,
    ollama_verification_capability_status character varying(40) DEFAULT 'not_checked'::character varying CONSTRAINT ai_provider_config_ollama_verification_capability_stat_not_null NOT NULL,
    ollama_verification_capability_fingerprint character(64),
    ollama_verification_capability_configuration_revision bigint,
    ollama_verification_capability_model_digest character(64),
    ollama_verification_capability_checked_at timestamp with time zone,
    ollama_verification_capability_error_code character varying(64),
    ollama_verification_capability_latency_ms integer,
    CONSTRAINT ai_cfg_alias_max_terms_chk CHECK (((rag_alias_max_terms >= 1) AND (rag_alias_max_terms <= 20))),
    CONSTRAINT ai_cfg_alias_min_token_len_chk CHECK (((rag_alias_min_token_length >= 1) AND (rag_alias_min_token_length <= 10))),
    CONSTRAINT ai_cfg_alias_source_policy_chk CHECK (((rag_alias_source_policy)::text = 'authoritative_only'::text)),
    CONSTRAINT ai_cfg_alias_weight_chk CHECK (((rag_alias_weight >= 0.00) AND (rag_alias_weight <= 1.00))),
    CONSTRAINT ai_cfg_auto_fallback_breach_count_chk CHECK (((rag_loop_auto_fallback_breach_count >= 0) AND (rag_loop_auto_fallback_breach_count <= 1000000))),
    CONSTRAINT ai_cfg_auto_fallback_consecutive_breaches_chk CHECK (((rag_loop_auto_fallback_consecutive_breaches >= 1) AND (rag_loop_auto_fallback_consecutive_breaches <= 100))),
    CONSTRAINT ai_cfg_auto_fallback_cooldown_ms_chk CHECK (((rag_loop_auto_fallback_cooldown_ms >= 0) AND (rag_loop_auto_fallback_cooldown_ms <= 86400000))),
    CONSTRAINT ai_cfg_auto_fallback_incident_payload_type_chk CHECK (((rag_loop_auto_fallback_last_incident_payload IS NULL) OR (jsonb_typeof(rag_loop_auto_fallback_last_incident_payload) = 'object'::text))),
    CONSTRAINT ai_cfg_auto_fallback_min_apply_samples_chk CHECK (((rag_loop_auto_fallback_min_apply_samples >= 1) AND (rag_loop_auto_fallback_min_apply_samples <= 1000000))),
    CONSTRAINT ai_cfg_cooldown_ai_chk CHECK (((rag_loop_cooldown_ai_ms >= 0) AND (rag_loop_cooldown_ai_ms <= 86400000))),
    CONSTRAINT ai_cfg_cooldown_rag_chk CHECK (((rag_loop_cooldown_rag_ms >= 0) AND (rag_loop_cooldown_rag_ms <= 86400000))),
    CONSTRAINT ai_cfg_cooldown_tmdb_chk CHECK (((rag_loop_cooldown_tmdb_ms >= 0) AND (rag_loop_cooldown_tmdb_ms <= 86400000))),
    CONSTRAINT ai_cfg_global_bypass_ms_chk CHECK (((rag_loop_global_bypass_ms >= 0) AND (rag_loop_global_bypass_ms <= 86400000))),
    CONSTRAINT ai_cfg_half_open_probe_chk CHECK (((rag_loop_half_open_probe_count >= 1) AND (rag_loop_half_open_probe_count <= 20))),
    CONSTRAINT ai_cfg_policy_recheck_ai_calls_chk CHECK (((policy_recheck_max_ai_calls_per_item >= 1) AND (policy_recheck_max_ai_calls_per_item <= 5))),
    CONSTRAINT ai_cfg_policy_recheck_attempts_chk CHECK (((policy_recheck_max_attempts >= 0) AND (policy_recheck_max_attempts <= 5))),
    CONSTRAINT ai_cfg_policy_recheck_conf_gain_mult_chk CHECK (((policy_recheck_confidence_gain_multiplier >= 1.0) AND (policy_recheck_confidence_gain_multiplier <= 10.0))),
    CONSTRAINT ai_cfg_policy_recheck_id_caps_shape_chk CHECK (((jsonb_typeof(policy_recheck_identifier_caps) = 'object'::text) AND (policy_recheck_identifier_caps ? 'keywords'::text) AND (policy_recheck_identifier_caps ? 'genres'::text) AND (policy_recheck_identifier_caps ? 'studios'::text) AND (policy_recheck_identifier_caps ? 'cast'::text) AND (((((policy_recheck_identifier_caps - 'keywords'::text) - 'genres'::text) - 'studios'::text) - 'cast'::text) = '{}'::jsonb) AND ((policy_recheck_identifier_caps ->> 'keywords'::text) ~ '^\d+$'::text) AND ((policy_recheck_identifier_caps ->> 'genres'::text) ~ '^\d+$'::text) AND ((policy_recheck_identifier_caps ->> 'studios'::text) ~ '^\d+$'::text) AND ((policy_recheck_identifier_caps ->> 'cast'::text) ~ '^\d+$'::text) AND ((((policy_recheck_identifier_caps ->> 'keywords'::text))::integer >= 0) AND (((policy_recheck_identifier_caps ->> 'keywords'::text))::integer <= 25)) AND ((((policy_recheck_identifier_caps ->> 'genres'::text))::integer >= 0) AND (((policy_recheck_identifier_caps ->> 'genres'::text))::integer <= 25)) AND ((((policy_recheck_identifier_caps ->> 'studios'::text))::integer >= 0) AND (((policy_recheck_identifier_caps ->> 'studios'::text))::integer <= 25)) AND ((((policy_recheck_identifier_caps ->> 'cast'::text))::integer >= 0) AND (((policy_recheck_identifier_caps ->> 'cast'::text))::integer <= 25)))),
    CONSTRAINT ai_cfg_policy_recheck_id_caps_type_chk CHECK ((jsonb_typeof(policy_recheck_identifier_caps) = 'object'::text)),
    CONSTRAINT ai_cfg_policy_recheck_metadata_attempts_chk CHECK (((policy_recheck_metadata_max_attempts >= 0) AND (policy_recheck_metadata_max_attempts <= 5))),
    CONSTRAINT ai_cfg_policy_recheck_min_conf_gain_chk CHECK (((policy_recheck_min_confidence_gain >= 0.00) AND (policy_recheck_min_confidence_gain <= 100.00))),
    CONSTRAINT ai_cfg_policy_recheck_min_margin_delta_chk CHECK (((policy_recheck_min_margin_delta >= 0.00) AND (policy_recheck_min_margin_delta <= 100.00))),
    CONSTRAINT ai_cfg_policy_recheck_min_sim_delta_chk CHECK (((policy_recheck_min_similarity_delta >= 0.00) AND (policy_recheck_min_similarity_delta <= 1.00))),
    CONSTRAINT ai_cfg_policy_recheck_missing_fields_chk CHECK (((policy_recheck_metadata_missing_fields_min >= 0) AND (policy_recheck_metadata_missing_fields_min <= 10))),
    CONSTRAINT ai_cfg_policy_recheck_source_chk CHECK (((policy_recheck_metadata_source)::text = 'authoritative_only'::text)),
    CONSTRAINT ai_cfg_policy_recheck_timeout_ms_chk CHECK (((policy_recheck_metadata_timeout_ms >= 100) AND (policy_recheck_metadata_timeout_ms <= 30000))),
    CONSTRAINT ai_cfg_rag_candidate_limit_chk CHECK (((rag_loop_candidate_limit >= 1) AND (rag_loop_candidate_limit <= 100))),
    CONSTRAINT ai_cfg_rag_conflict_margin_ratio_chk CHECK (((rag_conflict_max_similarity_margin_ratio >= 0.00) AND (rag_conflict_max_similarity_margin_ratio <= 1.00))),
    CONSTRAINT ai_cfg_rag_conflict_min_avg_sim_chk CHECK (((rag_conflict_min_avg_similarity >= 0.00) AND (rag_conflict_min_avg_similarity <= 1.00))),
    CONSTRAINT ai_cfg_rag_conflict_min_matches_chk CHECK (((rag_conflict_min_matches >= 1) AND (rag_conflict_min_matches <= 50))),
    CONSTRAINT ai_cfg_rag_conflict_min_votes_chk CHECK (((rag_conflict_min_votes_per_library >= 1) AND (rag_conflict_min_votes_per_library <= 10))),
    CONSTRAINT ai_cfg_rag_conflict_top_n_chk CHECK (((rag_conflict_top_n >= 1) AND (rag_conflict_top_n <= 50))),
    CONSTRAINT ai_cfg_rag_conflict_vote_gap_chk CHECK (((rag_conflict_max_vote_gap >= 0) AND (rag_conflict_max_vote_gap <= 10))),
    CONSTRAINT ai_cfg_rag_loop_mode_chk CHECK (((rag_loop_rollout_mode)::text = ANY (ARRAY[('shadow'::character varying)::text, ('apply'::character varying)::text]))),
    CONSTRAINT ai_cfg_rag_low_conf_chk CHECK (((rag_loop_low_confidence_threshold >= 0) AND (rag_loop_low_confidence_threshold <= 100))),
    CONSTRAINT ai_cfg_rag_max_pass_chk CHECK (((rag_loop_max_passes >= 1) AND (rag_loop_max_passes <= 2))),
    CONSTRAINT ai_cfg_rag_retry_low_signal_floor_chk CHECK (((rag_retry_low_signal_similarity_floor >= 0.00) AND (rag_retry_low_signal_similarity_floor <= 1.00))),
    CONSTRAINT ai_cfg_rag_retry_strategy_chk CHECK (((rag_retry_strategy)::text = ANY (ARRAY[('auto'::character varying)::text, ('hybrid'::character varying)::text, ('semantic'::character varying)::text]))),
    CONSTRAINT ai_cfg_resilience_error_rate_chk CHECK (((rag_loop_resilience_error_rate_threshold >= 0.00) AND (rag_loop_resilience_error_rate_threshold <= 1.00))),
    CONSTRAINT ai_cfg_resilience_min_samples_chk CHECK (((rag_loop_resilience_min_samples >= 1) AND (rag_loop_resilience_min_samples <= 10000))),
    CONSTRAINT ai_cfg_resilience_timeout_rate_chk CHECK (((rag_loop_resilience_timeout_rate_threshold >= 0.00) AND (rag_loop_resilience_timeout_rate_threshold <= 1.00))),
    CONSTRAINT ai_cfg_resilience_timeout_streak_chk CHECK (((rag_loop_resilience_timeout_streak_threshold >= 1) AND (rag_loop_resilience_timeout_streak_threshold <= 20))),
    CONSTRAINT ai_cfg_resilience_window_chk CHECK (((rag_loop_resilience_window_ms >= 1000) AND (rag_loop_resilience_window_ms <= 3600000))),
    CONSTRAINT ai_cfg_shadow_err_delta_chk CHECK (((rag_loop_shadow_max_error_rate_delta >= 0.0000) AND (rag_loop_shadow_max_error_rate_delta <= 1.0000))),
    CONSTRAINT ai_cfg_shadow_min_samples_chk CHECK (((rag_loop_shadow_min_samples >= 1) AND (rag_loop_shadow_min_samples <= 1000000))),
    CONSTRAINT ai_cfg_shadow_p95_delta_chk CHECK (((rag_loop_shadow_max_p95_latency_delta_ms >= 0) AND (rag_loop_shadow_max_p95_latency_delta_ms <= 600000))),
    CONSTRAINT ai_cfg_title_precedence_mode_chk CHECK (((rag_title_precedence_mode)::text = 'canonical_first'::text)),
    CONSTRAINT ai_cfg_trace_max_bytes_chk CHECK (((rag_loop_trace_max_bytes >= 256) AND (rag_loop_trace_max_bytes <= 131072))),
    CONSTRAINT ai_cfg_trace_max_events_chk CHECK (((rag_loop_trace_max_events >= 1) AND (rag_loop_trace_max_events <= 200))),
    CONSTRAINT ai_provider_config_jitter_factor_check CHECK (((jitter_factor >= (0)::numeric) AND (jitter_factor <= (1)::numeric))),
    CONSTRAINT ai_provider_config_ollama_verification_capability_latency_ck CHECK (((ollama_verification_capability_latency_ms IS NULL) OR (ollama_verification_capability_latency_ms >= 0))),
    CONSTRAINT ai_provider_config_ollama_verification_capability_status_ck CHECK (((ollama_verification_capability_status)::text = ANY (ARRAY[('not_checked'::character varying)::text, ('verification_ready'::character varying)::text, ('classification_only'::character varying)::text, ('unavailable'::character varying)::text, ('model_changed'::character varying)::text]))),
    CONSTRAINT ai_provider_config_retry_backoff_multiplier_check CHECK (((retry_backoff_multiplier >= 1.0) AND (retry_backoff_multiplier <= 5.0))),
    CONSTRAINT ai_provider_config_revision_ck CHECK ((configuration_revision >= 0)),
    CONSTRAINT formula_weights_sum_check CHECK ((((((formula_pattern_weight + formula_rule_weight) + formula_rag_weight) + formula_history_weight) >= (0.99)::double precision) AND ((((formula_pattern_weight + formula_rule_weight) + formula_rag_weight) + formula_history_weight) <= (1.01)::double precision)))
);


--
-- Name: COLUMN ai_provider_config.pattern_mining_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.pattern_mining_enabled IS 'Enable pattern-based classification (default true as of v0.37.0)';


--
-- Name: COLUMN ai_provider_config.pattern_rule_priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.pattern_rule_priority IS 'Priority between patterns and rules: rules_first or patterns_first';


--
-- Name: COLUMN ai_provider_config.pattern_ai_skip_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.pattern_ai_skip_threshold IS 'Skip AI when pattern confidence >= this threshold (0-100)';


--
-- Name: COLUMN ai_provider_config.pattern_notification_dismissed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.pattern_notification_dismissed IS 'User has dismissed the pattern feature notification banner';


--
-- Name: COLUMN ai_provider_config.formula_pattern_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.formula_pattern_weight IS 'Formula weight for pattern matching (0.0-1.0, default 0.40)';


--
-- Name: COLUMN ai_provider_config.formula_rule_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.formula_rule_weight IS 'Formula weight for library rules (0.0-1.0, default 0.30)';


--
-- Name: COLUMN ai_provider_config.formula_rag_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.formula_rag_weight IS 'Formula weight for RAG similarity (0.0-1.0, default 0.20)';


--
-- Name: COLUMN ai_provider_config.formula_history_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.formula_history_weight IS 'Formula weight for history matching (0.0-1.0, default 0.10)';


--
-- Name: COLUMN ai_provider_config.rag_retrieval_loop_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_retrieval_loop_enabled IS 'Enable bounded second-pass retrieval loop (default enabled).';


--
-- Name: COLUMN ai_provider_config.rag_loop_rollout_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_rollout_mode IS 'Second-pass rollout mode: shadow or apply (default apply).';


--
-- Name: COLUMN ai_provider_config.rag_loop_low_confidence_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_low_confidence_threshold IS 'AI fallback trigger threshold in percent.';


--
-- Name: COLUMN ai_provider_config.rag_loop_max_passes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_max_passes IS 'Maximum retrieval passes for each item.';


--
-- Name: COLUMN ai_provider_config.rag_loop_use_hybrid_on_retry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_use_hybrid_on_retry IS 'Force hybrid retrieval for retry path when enabled.';


--
-- Name: COLUMN ai_provider_config.rag_loop_conflict_detection_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_conflict_detection_enabled IS 'Enable conflict-based second-pass trigger evaluation.';


--
-- Name: COLUMN ai_provider_config.rag_retry_strategy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_retry_strategy IS 'Retry strategy selector: auto, hybrid, or semantic.';


--
-- Name: COLUMN ai_provider_config.rag_retry_low_signal_similarity_floor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_retry_low_signal_similarity_floor IS 'Low-signal floor for strategy selection.';


--
-- Name: COLUMN ai_provider_config.rag_retry_conflict_semantic_preferred; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_retry_conflict_semantic_preferred IS 'Prefer semantic retry for high-quality conflict cases.';


--
-- Name: COLUMN ai_provider_config.rag_retry_sparse_metadata_prefers_hybrid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_retry_sparse_metadata_prefers_hybrid IS 'Prefer hybrid retry when metadata is sparse.';


--
-- Name: COLUMN ai_provider_config.rag_loop_candidate_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_candidate_limit IS 'Candidate pool size for second-pass diagnostics.';


--
-- Name: COLUMN ai_provider_config.rag_conflict_top_n; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_conflict_top_n IS 'Top-N matches used for conflict detection.';


--
-- Name: COLUMN ai_provider_config.rag_conflict_min_matches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_conflict_min_matches IS 'Minimum candidate matches required before conflict logic runs.';


--
-- Name: COLUMN ai_provider_config.rag_conflict_min_votes_per_library; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_conflict_min_votes_per_library IS 'Minimum per-library votes required for conflict split.';


--
-- Name: COLUMN ai_provider_config.rag_conflict_max_vote_gap; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_conflict_max_vote_gap IS 'Maximum vote gap allowed for conflict classification.';


--
-- Name: COLUMN ai_provider_config.rag_conflict_max_similarity_margin_ratio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_conflict_max_similarity_margin_ratio IS 'Maximum top-two similarity margin ratio for conflict.';


--
-- Name: COLUMN ai_provider_config.rag_conflict_min_avg_similarity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_conflict_min_avg_similarity IS 'Minimum average similarity quality floor for conflict logic.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_below_prompt_threshold_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_below_prompt_threshold_enabled IS 'Enable targeted policy re-check for prompt_select outcomes (default enabled).';


--
-- Name: COLUMN ai_provider_config.policy_recheck_max_attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_max_attempts IS 'Maximum targeted policy re-check attempts per item.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_identifier_caps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_identifier_caps IS 'JSON caps for targeted identifiers (keywords, genres, studios, cast).';


--
-- Name: COLUMN ai_provider_config.policy_recheck_min_similarity_delta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_min_similarity_delta IS 'Minimum similarity improvement required for promoted outcomes.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_min_margin_delta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_min_margin_delta IS 'Minimum top-vs-second margin improvement required for promoted outcomes.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_min_confidence_gain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_min_confidence_gain IS 'Minimum confidence gain required for promoted outcomes.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_max_ai_calls_per_item; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_max_ai_calls_per_item IS 'Maximum AI calls allowed for a single item under re-check flow.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_metadata_enrichment_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_metadata_enrichment_enabled IS 'Enable authoritative metadata enrichment for policy re-check.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_metadata_missing_fields_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_metadata_missing_fields_min IS 'Minimum missing high-impact fields before enrichment is attempted.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_metadata_timeout_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_metadata_timeout_ms IS 'Timeout budget for metadata enrichment calls.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_metadata_max_attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_metadata_max_attempts IS 'Maximum metadata enrichment attempts per item.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_metadata_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_metadata_source IS 'Metadata source policy for re-check enrichment.';


--
-- Name: COLUMN ai_provider_config.rag_loop_shadow_min_samples; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_shadow_min_samples IS 'Minimum shadow sample size required before apply promotion.';


--
-- Name: COLUMN ai_provider_config.rag_loop_shadow_max_error_rate_delta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_shadow_max_error_rate_delta IS 'Maximum allowed error-rate delta for promotion gate.';


--
-- Name: COLUMN ai_provider_config.rag_loop_shadow_max_p95_latency_delta_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_shadow_max_p95_latency_delta_ms IS 'Maximum allowed p95 latency delta for promotion gate.';


--
-- Name: COLUMN ai_provider_config.rag_loop_trace_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_trace_enabled IS 'Enable rag loop trace persistence in classification metadata.';


--
-- Name: COLUMN ai_provider_config.rag_loop_trace_max_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_trace_max_events IS 'Maximum events/stages preserved in rag loop trace payload.';


--
-- Name: COLUMN ai_provider_config.rag_loop_trace_max_bytes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_trace_max_bytes IS 'Maximum serialized size of rag loop trace payload.';


--
-- Name: COLUMN ai_provider_config.rag_loop_trace_include_stage_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_trace_include_stage_metrics IS 'Include stage metrics in rag loop trace payload.';


--
-- Name: COLUMN ai_provider_config.policy_learning_second_pass_requires_manual_confirmation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_learning_second_pass_requires_manual_confirmation IS 'Require manual confirmation before learning from second-pass applied outcomes.';


--
-- Name: COLUMN ai_provider_config.policy_learning_include_shadow_feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_learning_include_shadow_feedback IS 'Allow shadow-only outcomes to participate in learning.';


--
-- Name: COLUMN ai_provider_config.policy_learning_allow_machine_only_second_pass_feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_learning_allow_machine_only_second_pass_feedback IS 'Allow machine-only pass2 outcomes to update learning artifacts.';


--
-- Name: COLUMN ai_provider_config.rag_alias_expansion_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_alias_expansion_enabled IS 'Enable authoritative alias expansion in second-pass retrieval text.';


--
-- Name: COLUMN ai_provider_config.rag_alias_max_terms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_alias_max_terms IS 'Maximum alias terms allowed in second-pass expansion.';


--
-- Name: COLUMN ai_provider_config.rag_alias_min_token_length; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_alias_min_token_length IS 'Minimum alias token length for non-CJK scripts.';


--
-- Name: COLUMN ai_provider_config.rag_alias_source_policy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_alias_source_policy IS 'Alias source policy for retrieval expansion.';


--
-- Name: COLUMN ai_provider_config.rag_title_precedence_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_title_precedence_mode IS 'Title precedence mode for canonical/original/alias handling.';


--
-- Name: COLUMN ai_provider_config.rag_alias_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_alias_weight IS 'Relative retrieval weight applied to alias terms.';


--
-- Name: COLUMN ai_provider_config.rag_loop_resilience_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_resilience_enabled IS 'Enable resilience cooldown controls for optional second-pass stages.';


--
-- Name: COLUMN ai_provider_config.rag_loop_resilience_window_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_resilience_window_ms IS 'Rolling window used by resilience breaker statistics.';


--
-- Name: COLUMN ai_provider_config.rag_loop_resilience_min_samples; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_resilience_min_samples IS 'Minimum sample size before resilience breaker triggers are evaluated.';


--
-- Name: COLUMN ai_provider_config.rag_loop_resilience_timeout_streak_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_resilience_timeout_streak_threshold IS 'Consecutive timeout count needed to open breaker.';


--
-- Name: COLUMN ai_provider_config.rag_loop_resilience_timeout_rate_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_resilience_timeout_rate_threshold IS 'Timeout-rate threshold to open breaker.';


--
-- Name: COLUMN ai_provider_config.rag_loop_resilience_error_rate_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_resilience_error_rate_threshold IS 'Non-timeout error-rate threshold to open breaker.';


--
-- Name: COLUMN ai_provider_config.rag_loop_cooldown_tmdb_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_cooldown_tmdb_ms IS 'Cooldown duration for tmdb enrichment breaker.';


--
-- Name: COLUMN ai_provider_config.rag_loop_cooldown_rag_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_cooldown_rag_ms IS 'Cooldown duration for rag pass2 breaker.';


--
-- Name: COLUMN ai_provider_config.rag_loop_cooldown_ai_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_cooldown_ai_ms IS 'Cooldown duration for ai rerun breaker.';


--
-- Name: COLUMN ai_provider_config.rag_loop_half_open_probe_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_half_open_probe_count IS 'Probe count required for half-open breaker recovery.';


--
-- Name: COLUMN ai_provider_config.rag_loop_global_bypass_multi_open_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_global_bypass_multi_open_enabled IS 'Enable global second-pass bypass when multiple breakers are open.';


--
-- Name: COLUMN ai_provider_config.rag_loop_global_bypass_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_global_bypass_ms IS 'Duration of global bypass when multi-breaker protection is activated.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_enabled IS 'Enable automatic rollout fallback from apply to shadow on sustained regressions.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_min_apply_samples; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_min_apply_samples IS 'Minimum apply-mode samples required before fallback gates are evaluated.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_consecutive_breaches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_consecutive_breaches IS 'Consecutive breach windows required before triggering automatic fallback.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_cooldown_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_cooldown_ms IS 'Cooldown duration after fallback to prevent mode-flapping.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_recover_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_recover_enabled IS 'Enable version-aware automatic re-enable of apply mode after fallback.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_breach_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_breach_count IS 'Current consecutive fallback breach counter.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_last_breach_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_last_breach_at IS 'Timestamp of the most recent observed fallback breach.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_last_triggered_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_last_triggered_at IS 'Timestamp of the last automatic fallback transition.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_cooldown_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_cooldown_until IS 'Timestamp until which fallback evaluation remains in cooldown.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_last_incident_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_last_incident_id IS 'Latest automatic fallback incident identifier.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_last_incident_payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_last_incident_payload IS 'Latest sanitized automatic fallback incident payload.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_fallback_last_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_fallback_last_version IS 'Application version that triggered the latest fallback.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_recover_last_attempt_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_recover_last_attempt_version IS 'Most recent app version used for auto-recover attempt.';


--
-- Name: COLUMN ai_provider_config.rag_loop_auto_recover_last_attempt_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.rag_loop_auto_recover_last_attempt_at IS 'Timestamp of most recent auto-recover attempt.';


--
-- Name: COLUMN ai_provider_config.policy_recheck_confidence_gain_multiplier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.policy_recheck_confidence_gain_multiplier IS 'Multiplier applied to minimum confidence gain threshold during second-pass recheck (1.0-10.0).';


--
-- Name: COLUMN ai_provider_config.configuration_write_tag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_provider_config.configuration_write_tag IS 'Opaque strong ETag value for conditional AI settings writes; rotated only by the AI settings write boundary.';


--
-- Name: ai_provider_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_provider_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_provider_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_provider_config_id_seq OWNED BY public.ai_provider_config.id;


--
-- Name: ai_usage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_log (
    id bigint NOT NULL,
    provider character varying(50),
    model text,
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    cost_usd numeric(10,6),
    request_type character varying(50),
    item_title character varying(500),
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp without time zone DEFAULT now()
)
WITH (autovacuum_vacuum_scale_factor='0.10', autovacuum_analyze_scale_factor='0.10');


--
-- Name: ai_usage_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_usage_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_usage_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_usage_log_id_seq OWNED BY public.ai_usage_log.id;


--
-- Name: ai_usage_monthly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_monthly (
    id integer NOT NULL,
    year_month character varying(7),
    provider character varying(50),
    total_requests integer DEFAULT 0,
    total_tokens integer DEFAULT 0,
    total_cost_usd numeric(10,6) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: ai_usage_monthly_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_usage_monthly_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_usage_monthly_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_usage_monthly_id_seq OWNED BY public.ai_usage_monthly.id;


--
-- Name: api_key_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key_audit (
    id integer NOT NULL,
    api_key_id integer,
    action character varying(50) NOT NULL,
    endpoint character varying(255),
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: api_key_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_key_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_key_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_key_audit_id_seq OWNED BY public.api_key_audit.id;


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    name character varying(100) DEFAULT 'API Key'::character varying NOT NULL,
    key_hash character varying(255) NOT NULL,
    key_prefix character varying(8) NOT NULL,
    permissions character varying(50) DEFAULT 'read_write'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    last_used_at timestamp without time zone,
    last_used_ip inet,
    is_active boolean DEFAULT true,
    expires_at timestamp without time zone
);


--
-- Name: TABLE api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.api_keys IS 'API key management for external integrations and automation';


--
-- Name: COLUMN api_keys.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.name IS 'User-friendly name for the API key';


--
-- Name: COLUMN api_keys.key_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.key_hash IS 'Hashed version of the API key for secure storage';


--
-- Name: COLUMN api_keys.key_prefix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8 characters of the API key for identification (exactly 8 chars)';


--
-- Name: COLUMN api_keys.permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.permissions IS 'Permission level: read_only, read_write, webhook_only, or admin';


--
-- Name: COLUMN api_keys.last_used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.last_used_at IS 'Timestamp when the key was last used for authentication';


--
-- Name: COLUMN api_keys.last_used_ip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.last_used_ip IS 'IP address from which the key was last used';


--
-- Name: COLUMN api_keys.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.is_active IS 'Whether the key is currently active and can be used';


--
-- Name: COLUMN api_keys.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.expires_at IS 'Optional expiration timestamp for the key';


--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: app_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_log (
    id bigint NOT NULL,
    level character varying(10) NOT NULL,
    module character varying(100) NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
)
WITH (autovacuum_vacuum_scale_factor='0.10', autovacuum_analyze_scale_factor='0.10');


--
-- Name: app_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_log_id_seq OWNED BY public.app_log.id;


--
-- Name: app_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_notifications (
    id integer NOT NULL,
    type character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    data jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    read_at timestamp without time zone,
    CONSTRAINT app_notifications_type_check CHECK (((type)::text = ANY (ARRAY[('info'::character varying)::text, ('warning'::character varying)::text, ('error'::character varying)::text, ('success'::character varying)::text])))
);


--
-- Name: app_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_notifications_id_seq OWNED BY public.app_notifications.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key character varying(100) NOT NULL,
    value text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: arr_profiles_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arr_profiles_cache (
    id integer NOT NULL,
    arr_type character varying(10) NOT NULL,
    profile_type character varying(50) NOT NULL,
    profile_id integer NOT NULL,
    profile_name character varying(255),
    profile_path character varying(500),
    profile_data jsonb,
    last_synced timestamp without time zone DEFAULT now(),
    CONSTRAINT arr_profiles_cache_arr_type_check CHECK (((arr_type)::text = ANY (ARRAY[('radarr'::character varying)::text, ('sonarr'::character varying)::text]))),
    CONSTRAINT arr_profiles_cache_profile_type_check CHECK (((profile_type)::text = ANY (ARRAY[('root_folder'::character varying)::text, ('quality_profile'::character varying)::text, ('tag'::character varying)::text])))
);


--
-- Name: arr_profiles_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.arr_profiles_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: arr_profiles_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.arr_profiles_cache_id_seq OWNED BY public.arr_profiles_cache.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    ip_address character varying(50),
    user_agent text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
)
WITH (autovacuum_vacuum_scale_factor='0.05', autovacuum_analyze_scale_factor='0.05');


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: auto_learned_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auto_learned_preferences (
    id integer NOT NULL,
    library_id integer NOT NULL,
    policy_id integer,
    preference_type character varying(50) NOT NULL,
    preference_value text NOT NULL,
    confidence_count integer DEFAULT 1 NOT NULL,
    source character varying(50) DEFAULT 'user_feedback'::character varying NOT NULL,
    learned_from_user_id character varying(100),
    learned_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'active'::character varying,
    reverted_at timestamp without time zone,
    reverted_by integer,
    revert_reason text
);


--
-- Name: auto_learned_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auto_learned_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auto_learned_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auto_learned_preferences_id_seq OWNED BY public.auto_learned_preferences.id;


--
-- Name: backfill_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backfill_runs (
    id integer NOT NULL,
    type character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    processed integer DEFAULT 0,
    total integer DEFAULT 0,
    error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: backfill_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.backfill_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backfill_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.backfill_runs_id_seq OWNED BY public.backfill_runs.id;


--
-- Name: backup_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_audit (
    id integer NOT NULL,
    operation character varying(50) NOT NULL,
    backup_type character varying(20) NOT NULL,
    filename character varying(255) NOT NULL,
    file_size bigint,
    status character varying(20) NOT NULL,
    error_message text,
    user_id integer,
    ip_address inet,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: backup_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.backup_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backup_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.backup_audit_id_seq OWNED BY public.backup_audit.id;


--
-- Name: backup_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_schedules (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    cron_schedule character varying(100) NOT NULL,
    backup_type character varying(20) DEFAULT 'encrypted'::character varying NOT NULL,
    password_encrypted text,
    include_patterns boolean DEFAULT true,
    retention_days integer DEFAULT 30,
    is_enabled boolean DEFAULT true,
    last_run_at timestamp without time zone,
    last_run_status character varying(20),
    last_run_error text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: backup_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.backup_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backup_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.backup_schedules_id_seq OWNED BY public.backup_schedules.id;


--
-- Name: candidate_bound_verification_capability_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_bound_verification_capability_receipts (
    id bigint NOT NULL,
    actor_id character varying(156) CONSTRAINT candidate_bound_verification_capability_recei_actor_id_not_null NOT NULL,
    before_status_id character varying(80) CONSTRAINT candidate_bound_verification_capabili_before_status_id_not_null NOT NULL,
    after_status_id character varying(80) CONSTRAINT candidate_bound_verification_capabilit_after_status_id_not_null NOT NULL,
    configuration_revision bigint CONSTRAINT candidate_bound_verification_ca_configuration_revision_not_null NOT NULL,
    receipt_version character varying(120) CONSTRAINT candidate_bound_verification_capabilit_receipt_version_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT candidate_bound_verification_capability_rec_created_at_not_null NOT NULL,
    CONSTRAINT cbv_capability_receipts_actor_ck CHECK (((actor_id)::text ~ '^user:[A-Za-z0-9:_-]{1,150}$'::text)),
    CONSTRAINT cbv_capability_receipts_revision_ck CHECK ((configuration_revision > 0)),
    CONSTRAINT cbv_capability_receipts_status_ck CHECK ((((before_status_id)::text = ANY (ARRAY[('verification_ready'::character varying)::text, ('primary_path_ineligible'::character varying)::text, ('budget_fallback_advisory'::character varying)::text, ('primary_and_fallback_ineligible'::character varying)::text])) AND ((after_status_id)::text = ANY (ARRAY[('verification_ready'::character varying)::text, ('primary_path_ineligible'::character varying)::text, ('budget_fallback_advisory'::character varying)::text, ('primary_and_fallback_ineligible'::character varying)::text])) AND ((before_status_id)::text <> (after_status_id)::text)))
);


--
-- Name: candidate_bound_verification_capability_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.candidate_bound_verification_capability_receipts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.candidate_bound_verification_capability_receipts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: clarification_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clarification_questions (
    id integer NOT NULL,
    question_text text NOT NULL,
    question_type character varying(50) NOT NULL,
    trigger_keywords text[],
    trigger_genres text[],
    response_options jsonb NOT NULL,
    priority integer DEFAULT 0,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: clarification_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clarification_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clarification_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clarification_questions_id_seq OWNED BY public.clarification_questions.id;


--
-- Name: clarification_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clarification_responses (
    id integer NOT NULL,
    classification_id bigint,
    question_id integer,
    discord_user_id character varying(100),
    response_value character varying(100),
    response_label character varying(255),
    confidence_before integer,
    confidence_after integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: clarification_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clarification_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clarification_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clarification_responses_id_seq OWNED BY public.clarification_responses.id;


--
-- Name: classification_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_corrections (
    id integer NOT NULL,
    classification_id bigint,
    original_library_id integer,
    corrected_library_id integer,
    corrected_by character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: classification_corrections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classification_corrections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classification_corrections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classification_corrections_id_seq OWNED BY public.classification_corrections.id;


--
-- Name: classification_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_embeddings (
    id integer NOT NULL,
    classification_id bigint NOT NULL,
    embedding_dims integer NOT NULL,
    provider character varying(50) NOT NULL,
    model text NOT NULL,
    is_stale boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    image_embedding public.vector(2000),
    image_embedding_dims integer,
    image_provider character varying(50),
    image_model character varying(100),
    image_embedding_hash character varying(64),
    image_embedding_size integer,
    image_embedding_source_url text,
    embedding public.vector(1024)
);


--
-- Name: classification_embeddings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classification_embeddings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classification_embeddings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classification_embeddings_id_seq OWNED BY public.classification_embeddings.id;


--
-- Name: classification_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_evidence (
    id bigint NOT NULL,
    scope character varying(50) NOT NULL,
    media_type character varying(20),
    library_id integer,
    tmdb_id integer,
    evidence_key character varying(255),
    evidence_data jsonb,
    provenance character varying(50) NOT NULL,
    confidence numeric(5,2),
    usage_count integer DEFAULT 0 NOT NULL,
    success_rate numeric(5,2),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_by character varying(100),
    source_classification_id bigint,
    source_system character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    CONSTRAINT classification_evidence_provenance_chk CHECK (((provenance)::text = ANY (ARRAY[('human_confirmed'::character varying)::text, ('policy_confirmed'::character varying)::text, ('discord_confirmed'::character varying)::text, ('retry_confirmed'::character varying)::text, ('manual_correction'::character varying)::text, ('mined'::character varying)::text, ('ai_only'::character varying)::text]))),
    CONSTRAINT classification_evidence_scope_chk CHECK (((scope)::text = ANY (ARRAY[('item_exact'::character varying)::text, ('genre'::character varying)::text, ('studio'::character varying)::text, ('franchise'::character varying)::text, ('certification'::character varying)::text, ('profile_affinity'::character varying)::text]))),
    CONSTRAINT classification_evidence_status_chk CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('candidate'::character varying)::text, ('decayed'::character varying)::text, ('archived'::character varying)::text])))
);


--
-- Name: classification_evidence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classification_evidence_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classification_evidence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classification_evidence_id_seq OWNED BY public.classification_evidence.id;


--
-- Name: classification_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_history (
    id bigint NOT NULL,
    tmdb_id integer,
    media_type character varying(20) NOT NULL,
    title character varying(500) NOT NULL,
    year integer,
    library_id integer,
    confidence numeric(5,2),
    method character varying(50),
    reason text,
    metadata jsonb,
    status character varying(20) DEFAULT 'completed'::character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT now(),
    clarification_status character varying(32),
    discord_message_id character varying(100),
    clarification_response jsonb,
    collection_id integer,
    library_name character varying(255),
    signals_json jsonb,
    pending_reason text,
    policy_question jsonb,
    search_text tsvector,
    profile_snapshot jsonb,
    retry_after timestamp without time zone,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    director_name character varying(255),
    primary_studio_name character varying(255),
    genre_names text[],
    cast_ids integer[],
    cast_names text[],
    pending_identity_key character varying(600),
    CONSTRAINT chk_classification_completed_has_library CHECK ((((status)::text IS DISTINCT FROM 'completed'::text) OR (library_id IS NOT NULL))),
    CONSTRAINT chk_classification_confidence_range CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (100)::numeric)))),
    CONSTRAINT classification_history_media_type_check CHECK (((media_type)::text = ANY (ARRAY[('movie'::character varying)::text, ('tv'::character varying)::text]))),
    CONSTRAINT classification_history_method_check CHECK (((method)::text = ANY (ARRAY[('existing_media'::character varying)::text, ('manual_correction'::character varying)::text, ('manual_classification'::character varying)::text, ('exact_match'::character varying)::text, ('learned_pattern'::character varying)::text, ('source_library'::character varying)::text, ('policy_auto'::character varying)::text, ('policy_prompt'::character varying)::text, ('policy_recheck'::character varying)::text, ('ai_verified'::character varying)::text, ('ai_analysis'::character varying)::text, ('ai_rerun'::character varying)::text, ('signal_calculation'::character varying)::text, ('fallback'::character varying)::text, ('queued_for_retry'::character varying)::text, ('custom_rule'::character varying)::text, ('rule_match'::character varying)::text, ('ai_fallback'::character varying)::text, ('holiday_detection'::character varying)::text, ('library_rule'::character varying)::text, ('rag_improved'::character varying)::text, ('authoritative_source_library'::character varying)::text, ('policy_engine'::character varying)::text, ('policy_candidate_adjudication'::character varying)::text]))),
    CONSTRAINT classification_history_status_check CHECK (((status)::text = ANY (ARRAY[('completed'::character varying)::text, ('failed'::character varying)::text, ('corrected'::character varying)::text, ('awaiting_decision'::character varying)::text, ('pending'::character varying)::text, ('pending_retry'::character varying)::text, ('verified'::character varying)::text, ('reclassified'::character varying)::text, ('routed'::character varying)::text])))
)
WITH (fillfactor='80', autovacuum_vacuum_scale_factor='0.05', autovacuum_analyze_scale_factor='0.05');


--
-- Name: COLUMN classification_history.profile_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.classification_history.profile_snapshot IS 'Library profile statistics snapshot at classification time, used for AI prompt context';


--
-- Name: COLUMN classification_history.retry_after; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.classification_history.retry_after IS 'Timestamp when the classification should be retried (for AI unavailable scenarios)';


--
-- Name: COLUMN classification_history.retry_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.classification_history.retry_count IS 'Number of retry attempts made (max 3)';


--
-- Name: COLUMN classification_history.max_retries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.classification_history.max_retries IS 'Maximum number of retry attempts allowed (default 3)';


--
-- Name: COLUMN classification_history.pending_identity_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.classification_history.pending_identity_key IS 'Stable unambiguous identity for the single active pending decision invariant.';


--
-- Name: classification_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classification_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classification_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classification_history_id_seq OWNED BY public.classification_history.id;


--
-- Name: classification_history_totals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_history_totals (
    singleton boolean DEFAULT true NOT NULL,
    successful_count bigint DEFAULT 0 NOT NULL,
    failed_count bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT classification_history_totals_singleton_check CHECK ((singleton = true))
);


--
-- Name: classification_queue_decision_witnesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_queue_decision_witnesses (
    queue_task_id bigint NOT NULL,
    classification_id bigint CONSTRAINT classification_queue_decision_witnes_classification_id_not_null NOT NULL,
    witness jsonb NOT NULL,
    fingerprint character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT classification_queue_decision_witnesses_fingerprint_check CHECK (((fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT classification_queue_decision_witnesses_witness_object_check CHECK ((jsonb_typeof(witness) = 'object'::text))
);


--
-- Name: TABLE classification_queue_decision_witnesses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.classification_queue_decision_witnesses IS 'Bounded, versioned queued classification outcomes for local evaluation; contains no raw request or provider evidence.';


--
-- Name: confidence_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.confidence_settings (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    description text,
    default_value text,
    validation_schema jsonb
);


--
-- Name: TABLE confidence_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.confidence_settings IS 'Configuration settings for confidence thresholds and behavior. 
   Policy thresholds control both classification AND Discord notification behavior.
   Discord display settings control what information is shown in notification messages.';


--
-- Name: confidence_settings_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.confidence_settings_audit (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    old_value text,
    new_value text,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT now(),
    change_reason text,
    ip_address inet
);


--
-- Name: confidence_settings_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.confidence_settings_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: confidence_settings_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.confidence_settings_audit_id_seq OWNED BY public.confidence_settings_audit.id;


--
-- Name: confidence_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.confidence_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: confidence_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.confidence_settings_id_seq OWNED BY public.confidence_settings.id;


--
-- Name: confidence_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.confidence_thresholds (
    id integer NOT NULL,
    tier character varying(20) NOT NULL,
    min_confidence integer NOT NULL,
    max_confidence integer NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: confidence_thresholds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.confidence_thresholds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: confidence_thresholds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.confidence_thresholds_id_seq OWNED BY public.confidence_thresholds.id;


--
-- Name: content_analysis_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_analysis_log (
    id integer NOT NULL,
    classification_id bigint,
    tmdb_id integer,
    detected_type character varying(50),
    confidence integer,
    reasoning text[],
    suggested_labels text[],
    overrides_genre boolean DEFAULT false,
    original_genres text[],
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: content_analysis_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.content_analysis_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: content_analysis_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.content_analysis_log_id_seq OWNED BY public.content_analysis_log.id;


--
-- Name: content_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_presets (
    id integer NOT NULL,
    key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    category character varying(50),
    signals jsonb NOT NULL,
    is_system boolean DEFAULT true,
    user_id integer,
    is_public boolean DEFAULT false,
    based_on_preset_id integer,
    usage_count integer DEFAULT 0,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE content_presets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.content_presets IS 'Reusable content signal definitions for classification (e.g., "Family Friendly", "Action Movies")';


--
-- Name: COLUMN content_presets.signals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.content_presets.signals IS 'JSONB configuration of content signals (genres, keywords, ratings, etc.)';


--
-- Name: content_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.content_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: content_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.content_presets_id_seq OWNED BY public.content_presets.id;


--
-- Name: custom_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_presets (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(10) DEFAULT '??????'::character varying,
    category character varying(50) DEFAULT 'custom'::character varying,
    signals jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: custom_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custom_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custom_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custom_presets_id_seq OWNED BY public.custom_presets.id;


--
-- Name: discovered_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discovered_patterns (
    id integer NOT NULL,
    pattern_type character varying(50) NOT NULL,
    pattern_value text NOT NULL,
    library_id integer NOT NULL,
    library_name character varying(255) NOT NULL,
    confidence numeric(4,2) DEFAULT 0.00 NOT NULL,
    sample_size integer DEFAULT 0 NOT NULL,
    support_count integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'discovered'::character varying,
    auto_approved boolean DEFAULT false,
    approved_by character varying(100),
    approved_at timestamp without time zone,
    rejected_by character varying(100),
    rejected_at timestamp without time zone,
    rejection_reason text,
    last_seen_at timestamp without time zone DEFAULT now(),
    discovered_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    deprecated_at timestamp without time zone
);


--
-- Name: TABLE discovered_patterns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.discovered_patterns IS 'DEPRECATED in v0.38.0 - Replaced by library_profiles. Data kept for historical reference.';


--
-- Name: discovered_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discovered_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discovered_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discovered_patterns_id_seq OWNED BY public.discovered_patterns.id;


--
-- Name: dismissed_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dismissed_patterns (
    id integer NOT NULL,
    library_id integer,
    pattern_type character varying(50) NOT NULL,
    pattern_value character varying(255) NOT NULL,
    dismissed_at timestamp without time zone DEFAULT now()
);


--
-- Name: dismissed_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dismissed_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dismissed_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dismissed_patterns_id_seq OWNED BY public.dismissed_patterns.id;


--
-- Name: embedding_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embedding_costs (
    id integer NOT NULL,
    provider character varying(50) NOT NULL,
    model character varying(100) NOT NULL,
    tokens integer DEFAULT 0 NOT NULL,
    items_embedded integer DEFAULT 1 NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    period_type character varying(20) DEFAULT 'daily'::character varying,
    period_start date DEFAULT CURRENT_DATE
);


--
-- Name: embedding_costs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.embedding_costs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: embedding_costs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.embedding_costs_id_seq OWNED BY public.embedding_costs.id;


--
-- Name: embedding_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embedding_errors (
    id integer NOT NULL,
    classification_id bigint,
    error_message text NOT NULL,
    stack_trace text,
    retry_count integer DEFAULT 0,
    resolved boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone
);


--
-- Name: embedding_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.embedding_errors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: embedding_errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.embedding_errors_id_seq OWNED BY public.embedding_errors.id;


--
-- Name: embedding_provider_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embedding_provider_availability (
    id integer DEFAULT 1 NOT NULL,
    availability_status character varying(20) DEFAULT 'available'::character varying NOT NULL,
    failure_count integer DEFAULT 0 NOT NULL,
    last_error text,
    last_failure_source character varying(50),
    last_failure_at timestamp with time zone,
    cooldown_until timestamp with time zone,
    probe_started_at timestamp with time zone,
    last_probe_at timestamp with time zone,
    last_recovered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT embedding_provider_availability_single_row CHECK ((id = 1)),
    CONSTRAINT embedding_provider_availability_status_chk CHECK (((availability_status)::text = ANY (ARRAY[('available'::character varying)::text, ('cooldown'::character varying)::text, ('probing'::character varying)::text])))
);


--
-- Name: enrichment_retry_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_retry_queue (
    id integer NOT NULL,
    media_item_id integer NOT NULL,
    enrichment_type character varying(20) DEFAULT 'tavily'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reason text,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    priority integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_attempt_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text
);


--
-- Name: TABLE enrichment_retry_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.enrichment_retry_queue IS 'Queue for items that need enrichment retry (e.g., OMDb failed, try Tavily)';


--
-- Name: enrichment_retry_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrichment_retry_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_retry_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrichment_retry_queue_id_seq OWNED BY public.enrichment_retry_queue.id;


--
-- Name: error_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_log (
    id bigint NOT NULL,
    error_id uuid DEFAULT gen_random_uuid(),
    level character varying(10) NOT NULL,
    module character varying(100) NOT NULL,
    message text NOT NULL,
    stack_trace text,
    request_context jsonb,
    system_context jsonb,
    metadata jsonb,
    resolved boolean DEFAULT false,
    resolved_at timestamp without time zone,
    resolution_notes text,
    created_at timestamp without time zone DEFAULT now(),
    rag_operation character varying(100),
    rag_context jsonb,
    duration_ms integer,
    recoverable boolean DEFAULT true,
    classification_id bigint,
    error_stage character varying(50),
    reason_code character varying(80),
    correlation_id uuid,
    sql_state character varying(10),
    CONSTRAINT error_log_error_stage_check CHECK (((error_stage IS NULL) OR ((error_stage)::text = ANY (ARRAY[('gate'::character varying)::text, ('enrichment'::character varying)::text, ('retrieval_pass2'::character varying)::text, ('policy_recheck'::character varying)::text, ('ai_rerun'::character varying)::text, ('trace'::character varying)::text])))),
    CONSTRAINT error_log_level_check CHECK (((level)::text = ANY (ARRAY[('ERROR'::character varying)::text, ('WARN'::character varying)::text, ('INFO'::character varying)::text, ('DEBUG'::character varying)::text]))),
    CONSTRAINT error_log_sql_state_format_check CHECK (((sql_state IS NULL) OR ((sql_state)::text ~ '^[A-Z0-9]{1,10}$'::text)))
)
WITH (autovacuum_vacuum_scale_factor='0.10', autovacuum_analyze_scale_factor='0.10');


--
-- Name: TABLE error_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.error_log IS 'Application error/warning logs for debugging and bug reports. Used by Settings > Error Logs UI. DO NOT DROP.';


--
-- Name: COLUMN error_log.classification_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_log.classification_id IS 'Classification history identifier associated with this error event.';


--
-- Name: COLUMN error_log.error_stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_log.error_stage IS 'Second-pass stage where the event occurred (gate, enrichment, retrieval_pass2, policy_recheck, ai_rerun, trace).';


--
-- Name: COLUMN error_log.reason_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_log.reason_code IS 'Stable reason code used for aggregation and diagnostics.';


--
-- Name: COLUMN error_log.correlation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_log.correlation_id IS 'Correlation identifier used to group related stage events.';


--
-- Name: COLUMN error_log.sql_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_log.sql_state IS 'SQLSTATE code captured for database-related failures.';


--
-- Name: error_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.error_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: error_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.error_log_id_seq OWNED BY public.error_log.id;


--
-- Name: inventory_observation_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_observation_activity (
    hour_slot smallint NOT NULL,
    bucket_at timestamp with time zone NOT NULL,
    captured bigint NOT NULL,
    unavailable bigint NOT NULL,
    CONSTRAINT inventory_observation_activity_bucket_at_check CHECK (isfinite(bucket_at)),
    CONSTRAINT inventory_observation_activity_bucket_at_check1 CHECK ((bucket_at = date_trunc('hour'::text, bucket_at, 'UTC'::text))),
    CONSTRAINT inventory_observation_activity_captured_check CHECK ((captured >= 0)),
    CONSTRAINT inventory_observation_activity_check CHECK (((captured + unavailable) <= '9007199254740991'::bigint)),
    CONSTRAINT inventory_observation_activity_check1 CHECK ((hour_slot = mod((floor((EXTRACT(epoch FROM bucket_at) / (3600)::numeric)))::bigint, (168)::bigint))),
    CONSTRAINT inventory_observation_activity_hour_slot_check CHECK (((hour_slot >= 0) AND (hour_slot <= 167))),
    CONSTRAINT inventory_observation_activity_unavailable_check CHECK ((unavailable >= 0))
);


--
-- Name: jwt_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jwt_secrets (
    id integer NOT NULL,
    secret character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone
);


--
-- Name: jwt_secrets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jwt_secrets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jwt_secrets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jwt_secrets_id_seq OWNED BY public.jwt_secrets.id;


--
-- Name: label_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.label_presets (
    id integer NOT NULL,
    category character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    media_type character varying(20),
    tmdb_match_field character varying(50),
    tmdb_match_values text[],
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT label_presets_category_check CHECK (((category)::text = ANY (ARRAY[('rating'::character varying)::text, ('content_type'::character varying)::text, ('genre'::character varying)::text, ('language'::character varying)::text]))),
    CONSTRAINT label_presets_media_type_check CHECK (((media_type)::text = ANY (ARRAY[('movie'::character varying)::text, ('tv'::character varying)::text, ('both'::character varying)::text])))
);


--
-- Name: label_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.label_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: label_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.label_presets_id_seq OWNED BY public.label_presets.id;


--
-- Name: learned_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learned_corrections (
    id integer NOT NULL,
    tmdb_id integer NOT NULL,
    media_type character varying(10) NOT NULL,
    original_library_id integer,
    corrected_library_id integer NOT NULL,
    title character varying(512),
    year integer,
    user_note text,
    corrected_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT learned_corrections_media_type_check CHECK (((media_type)::text = ANY (ARRAY[('movie'::character varying)::text, ('tv'::character varying)::text])))
);


--
-- Name: learned_corrections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learned_corrections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learned_corrections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learned_corrections_id_seq OWNED BY public.learned_corrections.id;


--
-- Name: learning_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_conflicts (
    id integer NOT NULL,
    library_id integer NOT NULL,
    conflict_type character varying(50) NOT NULL,
    preference_type character varying(50) NOT NULL,
    preference_value text NOT NULL,
    existing_signal_type character varying(50),
    existing_signal_value text,
    confirm_count integer DEFAULT 0,
    reject_count integer DEFAULT 0,
    net_confidence integer GENERATED ALWAYS AS ((confirm_count - reject_count)) STORED,
    resolution_status character varying(20) DEFAULT 'pending'::character varying,
    resolution_action character varying(50),
    resolved_at timestamp without time zone,
    resolved_by integer,
    resolution_notes text,
    conflict_detected_at timestamp without time zone DEFAULT now(),
    last_updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: learning_conflicts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_conflicts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_conflicts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_conflicts_id_seq OWNED BY public.learning_conflicts.id;


--
-- Name: learning_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_patterns (
    id integer NOT NULL,
    tmdb_id integer,
    media_type character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    library_id integer,
    pattern_type character varying(50),
    pattern_data jsonb,
    confidence numeric(5,2),
    usage_count integer DEFAULT 0,
    success_rate numeric(5,2) DEFAULT 100.00,
    metadata jsonb,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: learning_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_patterns_id_seq OWNED BY public.learning_patterns.id;


--
-- Name: learning_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_rate_limits (
    id integer NOT NULL,
    user_id character varying(100) NOT NULL,
    library_id integer NOT NULL,
    learn_timestamp timestamp without time zone DEFAULT now()
);


--
-- Name: learning_rate_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_rate_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_rate_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_rate_limits_id_seq OWNED BY public.learning_rate_limits.id;


--
-- Name: libraries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.libraries (
    id integer NOT NULL,
    media_server_id integer,
    external_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    media_type character varying(20) NOT NULL,
    priority integer DEFAULT 0,
    arr_type character varying(20),
    arr_id integer,
    root_folder character varying(500),
    quality_profile_id integer,
    radarr_settings jsonb DEFAULT '{}'::jsonb,
    sonarr_settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    auto_learn boolean DEFAULT true,
    item_count integer DEFAULT 0,
    classified_count integer DEFAULT 0,
    avg_confidence numeric(5,2) DEFAULT 0,
    last_analyzed_at timestamp with time zone,
    CONSTRAINT libraries_arr_type_check CHECK (((arr_type)::text = ANY (ARRAY[('radarr'::character varying)::text, ('sonarr'::character varying)::text]))),
    CONSTRAINT libraries_media_type_check CHECK (((media_type)::text = ANY (ARRAY[('movie'::character varying)::text, ('tv'::character varying)::text])))
);


--
-- Name: libraries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.libraries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: libraries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.libraries_id_seq OWNED BY public.libraries.id;


--
-- Name: library_arr_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_arr_mappings (
    id integer NOT NULL,
    library_id integer NOT NULL,
    arr_type character varying(10) NOT NULL,
    arr_config_id integer NOT NULL,
    arr_root_folder_id integer NOT NULL,
    arr_root_folder_path character varying(512) NOT NULL,
    quality_profile_id integer,
    plex_path_prefix character varying(512),
    arr_path_prefix character varying(512),
    classifarr_path_prefix character varying(512),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT library_arr_mappings_arr_type_check CHECK (((arr_type)::text = ANY (ARRAY[('radarr'::character varying)::text, ('sonarr'::character varying)::text])))
);


--
-- Name: library_arr_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_arr_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_arr_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_arr_mappings_id_seq OWNED BY public.library_arr_mappings.id;


--
-- Name: library_custom_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_custom_rules (
    id integer NOT NULL,
    library_id integer,
    name character varying(255) NOT NULL,
    description text,
    rule_json jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    deprecated boolean DEFAULT false,
    migrated_to_policy_id integer,
    migrated_at timestamp without time zone,
    migrated_by integer,
    migration_type character varying(50)
);


--
-- Name: COLUMN library_custom_rules.deprecated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_custom_rules.deprecated IS 'Marks rules that have been migrated to the new policy system';


--
-- Name: COLUMN library_custom_rules.migrated_to_policy_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_custom_rules.migrated_to_policy_id IS 'References the policy that replaced this rule';


--
-- Name: COLUMN library_custom_rules.migrated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_custom_rules.migrated_at IS 'Timestamp when rule was migrated to policy system';


--
-- Name: COLUMN library_custom_rules.migrated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_custom_rules.migrated_by IS 'User who performed the migration';


--
-- Name: COLUMN library_custom_rules.migration_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_custom_rules.migration_type IS 'Type of migration: preset, override, or manual';


--
-- Name: library_custom_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_custom_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_custom_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_custom_rules_id_seq OWNED BY public.library_custom_rules.id;


--
-- Name: library_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_labels (
    id integer NOT NULL,
    library_id integer,
    label_preset_id integer,
    rule_type character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT library_labels_rule_type_check CHECK (((rule_type)::text = ANY (ARRAY[('include'::character varying)::text, ('exclude'::character varying)::text])))
);


--
-- Name: library_labels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_labels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_labels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_labels_id_seq OWNED BY public.library_labels.id;


--
-- Name: library_observation_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_observation_points (
    sample_slot smallint NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    library_id integer NOT NULL,
    status text NOT NULL,
    acquisition_configured boolean NOT NULL,
    continuity_since timestamp with time zone NOT NULL,
    inventory_lower_bound integer NOT NULL,
    population_fingerprint text,
    inventory_rows integer,
    supported_rows integer,
    identified_rows integer,
    captured_rows integer,
    fresh_rows integer,
    keyword_rows integer,
    language_rows integer,
    measurement_version smallint DEFAULT 2 NOT NULL,
    scan_started_at timestamp with time zone,
    scanned_rows integer,
    restart_reason text,
    CONSTRAINT library_observation_points_check CHECK ((isfinite(continuity_since) AND (continuity_since <= observed_at))),
    CONSTRAINT library_observation_points_check1 CHECK ((sample_slot = mod((floor((EXTRACT(epoch FROM observed_at) / (300)::numeric)))::bigint, (2016)::bigint))),
    CONSTRAINT library_observation_points_check2 CHECK ((isfinite(scan_started_at) AND (scan_started_at <= observed_at))),
    CONSTRAINT library_observation_points_check3 CHECK ((((measurement_version = 2) AND (scan_started_at IS NULL) AND (scanned_rows IS NULL) AND (restart_reason IS NULL) AND (status = ANY (ARRAY['available'::text, 'capacity_exceeded'::text])) AND (inventory_lower_bound <= 20001)) OR ((measurement_version = 3) AND (scan_started_at IS NOT NULL) AND (scanned_rows IS NOT NULL) AND (scan_started_at >= (observed_at - '7 days'::interval)) AND (status = ANY (ARRAY['available'::text, 'in_progress'::text, 'invalidated'::text]))))),
    CONSTRAINT library_observation_points_check4 CHECK ((((status = 'available'::text) AND (population_fingerprint IS NOT NULL) AND (population_fingerprint ~ '^[a-f0-9]{64}$'::text) AND (num_nonnulls(inventory_rows, supported_rows, identified_rows, captured_rows, fresh_rows, keyword_rows, language_rows) = 7) AND (inventory_rows >= 0) AND (inventory_lower_bound = inventory_rows) AND ((measurement_version = 3) OR (inventory_rows <= 20000)) AND ((measurement_version = 2) OR (scanned_rows = inventory_rows)) AND ((supported_rows >= 0) AND (supported_rows <= inventory_rows)) AND ((identified_rows >= 0) AND (identified_rows <= supported_rows)) AND ((captured_rows >= 0) AND (captured_rows <= identified_rows)) AND ((fresh_rows >= 0) AND (fresh_rows <= captured_rows)) AND ((keyword_rows >= 0) AND (keyword_rows <= captured_rows)) AND ((language_rows >= 0) AND (language_rows <= captured_rows))) OR ((status <> 'available'::text) AND (population_fingerprint IS NULL) AND (num_nonnulls(inventory_rows, supported_rows, identified_rows, captured_rows, fresh_rows, keyword_rows, language_rows) = 0) AND (((status = 'capacity_exceeded'::text) AND (inventory_lower_bound = 20001)) OR ((status = 'in_progress'::text) AND (scanned_rows > 0) AND (inventory_lower_bound = (scanned_rows + 1))) OR ((status = 'invalidated'::text) AND (scanned_rows = 0) AND (inventory_lower_bound = 0)))))),
    CONSTRAINT library_observation_points_inventory_lower_bound_check CHECK ((inventory_lower_bound >= 0)),
    CONSTRAINT library_observation_points_library_id_check CHECK ((library_id > 0)),
    CONSTRAINT library_observation_points_measurement_version_check CHECK ((measurement_version = ANY (ARRAY[2, 3]))),
    CONSTRAINT library_observation_points_observed_at_check CHECK (isfinite(observed_at)),
    CONSTRAINT library_observation_points_restart_reason_check CHECK ((restart_reason = ANY (ARRAY['inventory_changed'::text, 'observation_clocks_changed'::text, 'sampling_gap'::text, 'configuration_changed'::text, 'expired'::text, 'clock_anomaly'::text, 'changed_before_write'::text]))),
    CONSTRAINT library_observation_points_sample_slot_check CHECK (((sample_slot >= 0) AND (sample_slot <= 2015))),
    CONSTRAINT library_observation_points_scanned_rows_check CHECK ((scanned_rows >= 0)),
    CONSTRAINT library_observation_points_status_check CHECK ((status = ANY (ARRAY['available'::text, 'capacity_exceeded'::text, 'in_progress'::text, 'invalidated'::text])))
);


--
-- Name: library_observation_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_observation_samples (
    hour_slot smallint NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    library_ids integer[] NOT NULL,
    excluded_library_count integer NOT NULL,
    acquisition_configured boolean NOT NULL,
    inventory_rows integer,
    supported_rows integer,
    identified_rows integer,
    captured_rows integer,
    fresh_rows integer,
    keyword_rows integer,
    language_rows integer,
    library_coverage_v1 jsonb,
    CONSTRAINT library_coverage_v1_bounded CHECK (((library_coverage_v1 IS NULL) OR ((status = 'available'::text) AND (octet_length((library_coverage_v1)::text) <= 16384) AND
CASE
    WHEN (jsonb_typeof(library_coverage_v1) = 'array'::text) THEN ((jsonb_array_length(library_coverage_v1) = cardinality(library_ids)) AND (jsonb_array_length(library_coverage_v1) <= 12))
    ELSE false
END))),
    CONSTRAINT library_observation_samples_check CHECK ((hour_slot = mod((floor((EXTRACT(epoch FROM observed_at) / (3600)::numeric)))::bigint, (168)::bigint))),
    CONSTRAINT library_observation_samples_check1 CHECK ((((status = 'available'::text) AND (num_nonnulls(inventory_rows, supported_rows, identified_rows, captured_rows, fresh_rows, keyword_rows, language_rows) = 7) AND ((inventory_rows >= 0) AND (inventory_rows <= 20000)) AND ((supported_rows >= 0) AND (supported_rows <= inventory_rows)) AND ((identified_rows >= 0) AND (identified_rows <= supported_rows)) AND ((captured_rows >= 0) AND (captured_rows <= identified_rows)) AND ((fresh_rows >= 0) AND (fresh_rows <= captured_rows)) AND ((keyword_rows >= 0) AND (keyword_rows <= captured_rows)) AND ((language_rows >= 0) AND (language_rows <= captured_rows))) OR ((status = 'capacity_exceeded'::text) AND (num_nonnulls(inventory_rows, supported_rows, identified_rows, captured_rows, fresh_rows, keyword_rows, language_rows) = 0)))),
    CONSTRAINT library_observation_samples_excluded_library_count_check CHECK ((excluded_library_count >= 0)),
    CONSTRAINT library_observation_samples_hour_slot_check CHECK (((hour_slot >= 0) AND (hour_slot <= 167))),
    CONSTRAINT library_observation_samples_library_ids_check CHECK ((cardinality(library_ids) <= 12)),
    CONSTRAINT library_observation_samples_observed_at_check CHECK (isfinite(observed_at)),
    CONSTRAINT library_observation_samples_status_check CHECK ((status = ANY (ARRAY['available'::text, 'capacity_exceeded'::text])))
);


--
-- Name: library_observation_sampling_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_observation_sampling_state (
    singleton boolean DEFAULT true NOT NULL,
    last_library_id integer DEFAULT 0 NOT NULL,
    ceiling_library_id integer DEFAULT 0 NOT NULL,
    active_library_count integer DEFAULT 0 CONSTRAINT library_observation_sampling_stat_active_library_count_not_null NOT NULL,
    last_sample_at timestamp with time zone,
    continuity_since timestamp with time zone,
    CONSTRAINT library_observation_sampling_state_active_library_count_check CHECK ((active_library_count >= 0)),
    CONSTRAINT library_observation_sampling_state_check CHECK ((ceiling_library_id >= last_library_id)),
    CONSTRAINT library_observation_sampling_state_check1 CHECK ((((last_sample_at IS NULL) AND (continuity_since IS NULL)) OR ((last_sample_at IS NOT NULL) AND (continuity_since IS NOT NULL) AND (continuity_since <= last_sample_at)))),
    CONSTRAINT library_observation_sampling_state_continuity_since_check CHECK (isfinite(continuity_since)),
    CONSTRAINT library_observation_sampling_state_last_library_id_check CHECK ((last_library_id >= 0)),
    CONSTRAINT library_observation_sampling_state_last_sample_at_check CHECK (isfinite(last_sample_at)),
    CONSTRAINT library_observation_sampling_state_singleton_check CHECK (singleton)
);


--
-- Name: library_observation_scan_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_observation_scan_progress (
    library_id integer NOT NULL,
    inventory_revision bigint NOT NULL,
    clock_revision bigint NOT NULL,
    after_id integer NOT NULL,
    scan_started_at timestamp with time zone NOT NULL,
    last_visit_at timestamp with time zone NOT NULL,
    continuity_since timestamp with time zone NOT NULL,
    acquisition_configured boolean CONSTRAINT library_observation_scan_progre_acquisition_configured_not_null NOT NULL,
    population_fingerprint text CONSTRAINT library_observation_scan_progre_population_fingerprint_not_null NOT NULL,
    inventory_rows integer NOT NULL,
    supported_rows integer NOT NULL,
    identified_rows integer NOT NULL,
    captured_rows integer NOT NULL,
    fresh_rows integer NOT NULL,
    keyword_rows integer NOT NULL,
    language_rows integer NOT NULL,
    CONSTRAINT library_observation_scan_progress_after_id_check CHECK ((after_id > 0)),
    CONSTRAINT library_observation_scan_progress_check CHECK ((isfinite(last_visit_at) AND (last_visit_at >= scan_started_at) AND (last_visit_at <= (scan_started_at + '7 days'::interval)))),
    CONSTRAINT library_observation_scan_progress_check1 CHECK (((supported_rows >= 0) AND (supported_rows <= inventory_rows))),
    CONSTRAINT library_observation_scan_progress_check2 CHECK (((identified_rows >= 0) AND (identified_rows <= supported_rows))),
    CONSTRAINT library_observation_scan_progress_check3 CHECK (((captured_rows >= 0) AND (captured_rows <= identified_rows))),
    CONSTRAINT library_observation_scan_progress_check4 CHECK (((fresh_rows >= 0) AND (fresh_rows <= captured_rows))),
    CONSTRAINT library_observation_scan_progress_check5 CHECK (((keyword_rows >= 0) AND (keyword_rows <= captured_rows))),
    CONSTRAINT library_observation_scan_progress_check6 CHECK (((language_rows >= 0) AND (language_rows <= captured_rows))),
    CONSTRAINT library_observation_scan_progress_clock_revision_check CHECK ((clock_revision >= 0)),
    CONSTRAINT library_observation_scan_progress_continuity_since_check CHECK (isfinite(continuity_since)),
    CONSTRAINT library_observation_scan_progress_inventory_revision_check CHECK ((inventory_revision >= 0)),
    CONSTRAINT library_observation_scan_progress_inventory_rows_check CHECK ((inventory_rows > 0)),
    CONSTRAINT library_observation_scan_progress_population_fingerprint_check CHECK ((population_fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT library_observation_scan_progress_scan_started_at_check CHECK (isfinite(scan_started_at))
);


--
-- Name: library_pattern_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_pattern_suggestions (
    id integer NOT NULL,
    library_id integer,
    detected_patterns jsonb DEFAULT '[]'::jsonb NOT NULL,
    pending_count integer DEFAULT 0,
    last_analyzed timestamp without time zone DEFAULT now(),
    notification_dismissed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: library_pattern_suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_pattern_suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_pattern_suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_pattern_suggestions_id_seq OWNED BY public.library_pattern_suggestions.id;


--
-- Name: library_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_policies (
    id integer NOT NULL,
    library_id integer,
    name character varying(255) NOT NULL,
    description text,
    enabled boolean DEFAULT true,
    priority integer DEFAULT 5,
    sort_order integer DEFAULT 0,
    auto_classify_threshold integer DEFAULT 85,
    prompt_threshold integer DEFAULT 60,
    require_ai_validation boolean DEFAULT true,
    trust_patterns boolean DEFAULT true,
    trust_rag boolean DEFAULT true,
    trust_history boolean DEFAULT true,
    preset_weight real,
    pattern_weight real,
    rag_weight real,
    history_weight real,
    combination_mode character varying(20) DEFAULT 'best_match'::character varying,
    notify_channels jsonb DEFAULT '["app"]'::jsonb,
    exclusive boolean DEFAULT false,
    source_library_ids jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by integer,
    profile_weight real DEFAULT 0.25 NOT NULL
);


--
-- Name: TABLE library_policies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.library_policies IS 'Policy-based classification rules for libraries with rich configuration and multi-policy support';


--
-- Name: COLUMN library_policies.auto_classify_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_policies.auto_classify_threshold IS 'Auto-classify when confidence >= this threshold (0-100)';


--
-- Name: COLUMN library_policies.prompt_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_policies.prompt_threshold IS 'Prompt user when confidence >= this threshold but < auto_classify_threshold';


--
-- Name: COLUMN library_policies.combination_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_policies.combination_mode IS 'How to combine multiple policies: best_match, weighted_average, consensus';


--
-- Name: COLUMN library_policies.source_library_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_policies.source_library_ids IS 'JSONB array of source library IDs from Plex/Emby/Jellyfin';


--
-- Name: library_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_policies_id_seq OWNED BY public.library_policies.id;


--
-- Name: library_profile_inventory_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_profile_inventory_state (
    library_id bigint NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    refreshed_revision bigint DEFAULT 0 NOT NULL,
    changed_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    observation_clock_revision bigint DEFAULT 0 CONSTRAINT library_profile_inventory_s_observation_clock_revision_not_null NOT NULL,
    CONSTRAINT library_profile_inventory_stat_observation_clock_revision_check CHECK ((observation_clock_revision >= 0)),
    CONSTRAINT library_profile_inventory_state_check CHECK ((refreshed_revision <= revision)),
    CONSTRAINT library_profile_inventory_state_refreshed_revision_check CHECK ((refreshed_revision >= 0)),
    CONSTRAINT library_profile_inventory_state_revision_check CHECK ((revision > 0))
);


--
-- Name: TABLE library_profile_inventory_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.library_profile_inventory_state IS 'Transactional observation-input revisions and claim-bound acknowledgement; runtime state, not verified labels or portable configuration.';


--
-- Name: library_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_profiles (
    id integer NOT NULL,
    library_id integer,
    rating_distribution jsonb DEFAULT '{}'::jsonb,
    genre_distribution jsonb DEFAULT '{}'::jsonb,
    studio_distribution jsonb DEFAULT '{}'::jsonb,
    keyword_distribution jsonb DEFAULT '{}'::jsonb,
    exclusion_ratings text[] DEFAULT '{}'::text[],
    exclusion_genres text[] DEFAULT '{}'::text[],
    exclusion_keywords text[] DEFAULT '{}'::text[],
    item_count integer DEFAULT 0,
    enriched_count integer DEFAULT 0,
    last_generated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    observation_summary jsonb
);


--
-- Name: COLUMN library_profiles.observation_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.library_profiles.observation_summary IS 'Versioned inventory-row prevalence, metadata coverage, and typed identity counts; observed evidence, not policy exclusions.';


--
-- Name: library_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_profiles_id_seq OWNED BY public.library_profiles.id;


--
-- Name: library_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_rules (
    id integer NOT NULL,
    library_id integer NOT NULL,
    rule_type character varying(50) NOT NULL,
    operator character varying(20) NOT NULL,
    value text NOT NULL,
    is_exception boolean DEFAULT false,
    priority integer DEFAULT 0,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE library_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.library_rules IS 'Restored critical table in v0.34.3';


--
-- Name: library_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_rules_id_seq OWNED BY public.library_rules.id;


--
-- Name: library_rules_v2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_rules_v2 (
    id integer NOT NULL,
    library_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE library_rules_v2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.library_rules_v2 IS 'Restored critical table in v0.34.3';


--
-- Name: library_rules_v2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.library_rules_v2_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: library_rules_v2_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.library_rules_v2_id_seq OWNED BY public.library_rules_v2.id;


--
-- Name: media_identity_review_previews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_identity_review_previews (
    actor_id integer NOT NULL,
    id uuid NOT NULL,
    item_id integer NOT NULL,
    source_version character varying(64) NOT NULL,
    candidate jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_identity_review_previews_candidate_check CHECK ((jsonb_typeof(candidate) = 'object'::text)),
    CONSTRAINT media_identity_review_previews_source_version_check CHECK (((source_version)::text ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: media_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_requests (
    id integer NOT NULL,
    overseerr_request_id integer,
    tmdb_id integer,
    tvdb_id integer,
    media_type character varying(20),
    title character varying(500),
    year integer,
    poster_path character varying(500),
    requested_by_username character varying(255),
    requested_by_email character varying(255),
    requested_by_avatar character varying(500),
    is_4k boolean DEFAULT false,
    requested_seasons text,
    request_status character varying(50) DEFAULT 'pending'::character varying,
    classification_id bigint,
    routed_to_library_id integer,
    routed_to_library_name character varying(255),
    arr_type character varying(20),
    arr_id integer,
    requested_at timestamp without time zone,
    approved_at timestamp without time zone,
    available_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: media_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_requests_id_seq OWNED BY public.media_requests.id;


--
-- Name: media_server; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_server (
    id integer NOT NULL,
    type character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    url character varying(500) NOT NULL,
    api_key character varying(500) NOT NULL,
    is_active boolean DEFAULT true,
    last_sync timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    client_identifier character varying(255),
    CONSTRAINT media_server_type_check CHECK (((type)::text = ANY (ARRAY[('plex'::character varying)::text, ('emby'::character varying)::text, ('jellyfin'::character varying)::text])))
);


--
-- Name: media_server_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_server_collections (
    id integer NOT NULL,
    media_server_id integer,
    library_id integer,
    external_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    item_count integer DEFAULT 0,
    last_synced timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: media_server_collections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_server_collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_server_collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_server_collections_id_seq OWNED BY public.media_server_collections.id;


--
-- Name: media_server_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_server_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_server_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_server_id_seq OWNED BY public.media_server.id;


--
-- Name: media_server_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_server_items (
    id integer NOT NULL,
    media_server_id integer,
    library_id integer,
    external_id character varying(100) NOT NULL,
    tmdb_id integer,
    imdb_id character varying(20),
    tvdb_id integer,
    title character varying(500) NOT NULL,
    original_title character varying(500),
    year integer,
    media_type character varying(10) NOT NULL,
    genres text[],
    tags text[],
    collections text[],
    studio character varying(255),
    content_rating character varying(20),
    added_at timestamp without time zone,
    metadata jsonb,
    last_synced timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    enrichment_status character varying(20) DEFAULT 'pending'::character varying,
    original_rating character varying(10),
    enrichment_provider_state character varying(20) DEFAULT 'none'::character varying NOT NULL,
    enrichment_deferred_reason text,
    inventory_tmdb_attempted_at timestamp with time zone,
    inventory_tmdb_fetched_at timestamp with time zone,
    CONSTRAINT media_server_items_enrichment_provider_state_check CHECK (((enrichment_provider_state)::text = ANY (ARRAY[('none'::character varying)::text, ('omdb'::character varying)::text, ('tavily'::character varying)::text, ('omdb+tavily'::character varying)::text, ('web_search'::character varying)::text, ('omdb+web_search'::character varying)::text]))),
    CONSTRAINT media_server_items_enrichment_status_check CHECK (((enrichment_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text, ('deferred'::character varying)::text, ('failed'::character varying)::text, ('not_needed'::character varying)::text])))
);


--
-- Name: COLUMN media_server_items.enrichment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_server_items.enrichment_status IS 'Explicit enrichment workflow state for the item (pending, processing, completed, deferred, failed, not_needed).';


--
-- Name: COLUMN media_server_items.original_rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_server_items.original_rating IS 'Original rating from Plex/Emby before normalization to MPAA standards';


--
-- Name: COLUMN media_server_items.enrichment_provider_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_server_items.enrichment_provider_state IS 'Provider outcome persisted on the item row. Tavily values are historical; web_search identifies provider-neutral enrichment.';


--
-- Name: COLUMN media_server_items.enrichment_deferred_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_server_items.enrichment_deferred_reason IS 'Explicit defer reason when enrichment is paused on an external dependency, such as Tavily monthly quota reset.';


--
-- Name: media_server_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_server_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_server_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_server_items_id_seq OWNED BY public.media_server_items.id;


--
-- Name: media_server_sync_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_server_sync_status (
    id integer NOT NULL,
    media_server_id integer,
    library_id integer,
    sync_type character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    items_total integer DEFAULT 0,
    items_processed integer DEFAULT 0,
    error_message text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT media_server_sync_status_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('running'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: media_server_sync_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_server_sync_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_server_sync_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_server_sync_status_id_seq OWNED BY public.media_server_sync_status.id;


--
-- Name: notification_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_config (
    id integer NOT NULL,
    type character varying(20) DEFAULT 'discord'::character varying NOT NULL,
    bot_token character varying(500),
    channel_id character varying(100),
    enabled boolean DEFAULT false,
    notify_on_classification boolean DEFAULT true,
    notify_on_error boolean DEFAULT true,
    notify_on_correction boolean DEFAULT true,
    show_poster boolean DEFAULT true,
    show_confidence boolean DEFAULT true,
    show_method boolean DEFAULT true,
    show_reason boolean DEFAULT true,
    show_metadata boolean DEFAULT false,
    enable_corrections boolean DEFAULT true,
    correction_buttons_count integer DEFAULT 3,
    include_library_dropdown boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    notify_on_system_errors boolean DEFAULT true NOT NULL,
    notify_on_pending_items boolean DEFAULT true NOT NULL,
    pending_mention_here boolean DEFAULT false NOT NULL,
    pending_mention_type character varying(20) DEFAULT 'none'::character varying NOT NULL,
    pending_mention_target_id character varying(100),
    pending_mention_target_label character varying(150),
    CONSTRAINT notification_config_pending_mention_type_check CHECK (((pending_mention_type)::text = ANY (ARRAY[('none'::character varying)::text, ('user'::character varying)::text, ('role'::character varying)::text])))
);


--
-- Name: notification_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_config_id_seq OWNED BY public.notification_config.id;


--
-- Name: ollama_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ollama_config (
    id integer NOT NULL,
    host character varying(500) DEFAULT 'host.docker.internal'::character varying NOT NULL,
    port integer DEFAULT 11434 NOT NULL,
    model text DEFAULT 'qwen3:14b'::character varying NOT NULL,
    temperature numeric(3,2) DEFAULT 0.30,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE ollama_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ollama_config IS 'Legacy Ollama configuration table. Actively used by Settings UI and classification. DO NOT DROP.';


--
-- Name: ollama_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ollama_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ollama_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ollama_config_id_seq OWNED BY public.ollama_config.id;


--
-- Name: ollama_verification_capability_test_outcomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ollama_verification_capability_test_outcomes (
    observed_on date CONSTRAINT ollama_verification_capability_test_outcom_observed_on_not_null NOT NULL,
    status_id character varying(40) NOT NULL,
    outcome_count bigint DEFAULT 1 CONSTRAINT ollama_verification_capability_test_outc_outcome_count_not_null NOT NULL,
    last_observed_at timestamp with time zone DEFAULT now() CONSTRAINT ollama_verification_capability_test_o_last_observed_at_not_null NOT NULL,
    CONSTRAINT ollama_verification_capability_test_outcomes_count_ck CHECK ((outcome_count > 0)),
    CONSTRAINT ollama_verification_capability_test_outcomes_status_ck CHECK (((status_id)::text = ANY (ARRAY[('verification_ready'::character varying)::text, ('classification_only'::character varying)::text, ('unavailable'::character varying)::text])))
);


--
-- Name: TABLE ollama_verification_capability_test_outcomes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ollama_verification_capability_test_outcomes IS 'Fixed 30-day daily counts of saved Ollama verification-test outcomes; contains no configuration or test content.';


--
-- Name: omdb_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.omdb_config (
    id integer NOT NULL,
    api_key character varying(255),
    is_active boolean DEFAULT true,
    daily_limit integer DEFAULT 1000,
    requests_today integer DEFAULT 0,
    last_reset_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: omdb_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.omdb_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: omdb_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.omdb_config_id_seq OWNED BY public.omdb_config.id;


--
-- Name: path_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_mappings (
    id integer NOT NULL,
    arr_path character varying(1024) NOT NULL,
    local_path character varying(1024) NOT NULL,
    is_active boolean DEFAULT true,
    verified boolean DEFAULT false,
    last_verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: path_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.path_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: path_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.path_mappings_id_seq OWNED BY public.path_mappings.id;


--
-- Name: pattern_analysis_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pattern_analysis_config (
    id integer DEFAULT 1 NOT NULL,
    analysis_frequency_hours integer DEFAULT 8,
    minimum_confidence integer DEFAULT 80,
    auto_suggest_enabled boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT single_row CHECK ((id = 1))
);


--
-- Name: pattern_match_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pattern_match_log (
    id integer NOT NULL,
    pattern_id integer NOT NULL,
    classification_id bigint NOT NULL,
    matched_value text,
    confidence_contribution numeric(4,2),
    suggestion_used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    was_correct boolean
);


--
-- Name: TABLE pattern_match_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pattern_match_log IS 'Tracking log for pattern matches and usage in classifications.';


--
-- Name: COLUMN pattern_match_log.was_correct; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pattern_match_log.was_correct IS 'Whether the pattern prediction was correct (true/false) for reinforcement learning';


--
-- Name: pattern_match_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pattern_match_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pattern_match_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pattern_match_log_id_seq OWNED BY public.pattern_match_log.id;


--
-- Name: policy_authoring_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_authoring_proposals (
    id bigint NOT NULL,
    proposal_reference character varying(96) NOT NULL,
    library_id integer NOT NULL,
    actor_id integer NOT NULL,
    proposal_revision character(64) NOT NULL,
    profile_fingerprint character(64) NOT NULL,
    policy_name character varying(255) NOT NULL,
    canonical_declared_intent jsonb NOT NULL,
    display_summary jsonb NOT NULL,
    state character varying(20) DEFAULT 'prepared'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_policy_id integer,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_authoring_proposals_consumption_shape_chk CHECK (((((state)::text = 'prepared'::text) AND (consumed_policy_id IS NULL) AND (consumed_at IS NULL)) OR (((state)::text = 'consumed'::text) AND (consumed_policy_id IS NOT NULL) AND (consumed_at IS NOT NULL)))),
    CONSTRAINT policy_authoring_proposals_payload_shape_chk CHECK (((jsonb_typeof(canonical_declared_intent) = 'object'::text) AND (jsonb_typeof(display_summary) = 'object'::text))),
    CONSTRAINT policy_authoring_proposals_reference_shape_chk CHECK (((proposal_reference)::text ~ '^[A-Za-z0-9_-]{32,96}$'::text)),
    CONSTRAINT policy_authoring_proposals_revision_shape_chk CHECK (((proposal_revision ~ '^[a-f0-9]{64}$'::text) AND (profile_fingerprint ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT policy_authoring_proposals_state_chk CHECK (((state)::text = ANY (ARRAY[('prepared'::character varying)::text, ('consumed'::character varying)::text])))
);


--
-- Name: policy_authoring_proposals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_authoring_proposals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_authoring_proposals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_authoring_proposals_id_seq OWNED BY public.policy_authoring_proposals.id;


--
-- Name: policy_authorized_outcome_source_event_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_authorized_outcome_source_event_receipts (
    id bigint NOT NULL,
    receipt_version smallint DEFAULT 1 CONSTRAINT policy_authorized_outcome_source_event_receipt_version_not_null NOT NULL,
    source_id character varying(80) CONSTRAINT policy_authorized_outcome_source_event_recei_source_id_not_null NOT NULL,
    source_event_id character varying(160) CONSTRAINT policy_authorized_outcome_source_event_source_event_id_not_null NOT NULL,
    command_fingerprint character(64) CONSTRAINT policy_authorized_outcome_source_e_command_fingerprint_not_null NOT NULL,
    classification_id bigint CONSTRAINT policy_authorized_outcome_source_eve_classification_id_not_null NOT NULL,
    destination_library_id bigint,
    final_outcome_status_id character varying(80) CONSTRAINT policy_authorized_outcome_sour_final_outcome_status_id_not_null NOT NULL,
    persistence_status_id character varying(32) CONSTRAINT policy_authorized_outcome_source_persistence_status_id_not_null NOT NULL,
    learning_tier_id character varying(40),
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_authorized_outcome_source_event_rece_created_at_not_null NOT NULL,
    CONSTRAINT policy_authorized_outcome_receipts_classification_chk CHECK ((classification_id > 0)),
    CONSTRAINT policy_authorized_outcome_receipts_destination_chk CHECK (((destination_library_id IS NULL) OR (destination_library_id > 0))),
    CONSTRAINT policy_authorized_outcome_receipts_fingerprint_chk CHECK ((command_fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_authorized_outcome_receipts_learning_shape_chk CHECK (((((persistence_status_id)::text = 'outcome_only'::text) AND (learning_tier_id IS NULL)) OR (((persistence_status_id)::text = 'ready'::text) AND ((learning_tier_id)::text = ANY (ARRAY[('exact_item_memory'::character varying)::text, ('compatibility_evidence'::character varying)::text, ('identity_evidence'::character varying)::text]))))),
    CONSTRAINT policy_authorized_outcome_receipts_outcome_status_chk CHECK (((final_outcome_status_id)::text = ANY (ARRAY[('resolved'::character varying)::text, ('routed'::character varying)::text, ('route_failed_missing_mapping'::character varying)::text]))),
    CONSTRAINT policy_authorized_outcome_receipts_persistence_status_chk CHECK (((persistence_status_id)::text = ANY (ARRAY[('ready'::character varying)::text, ('outcome_only'::character varying)::text]))),
    CONSTRAINT policy_authorized_outcome_receipts_source_chk CHECK (((source_id)::text = ANY (ARRAY[('manual_classification_change'::character varying)::text, ('operator_confirmation'::character varying)::text, ('discord_pending_answer'::character varying)::text, ('request_destination_choice'::character varying)::text, ('arr_routing_outcome'::character varying)::text]))),
    CONSTRAINT policy_authorized_outcome_receipts_source_event_chk CHECK (((char_length(btrim((source_event_id)::text)) >= 1) AND (char_length(btrim((source_event_id)::text)) <= 160))),
    CONSTRAINT policy_authorized_outcome_receipts_version_chk CHECK ((receipt_version = 1))
);


--
-- Name: policy_authorized_outcome_source_event_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_authorized_outcome_source_event_receipts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_authorized_outcome_source_event_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_authorized_outcome_source_event_receipts_id_seq OWNED BY public.policy_authorized_outcome_source_event_receipts.id;


--
-- Name: policy_backup_restore_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_backup_restore_verifications (
    id bigint NOT NULL,
    verification_version smallint DEFAULT 1 CONSTRAINT policy_backup_restore_verificatio_verification_version_not_null NOT NULL,
    restore_mode character varying(16) NOT NULL,
    backup_version character varying(64) NOT NULL,
    verification_status character varying(32) DEFAULT 'verified'::character varying CONSTRAINT policy_backup_restore_verification_verification_status_not_null NOT NULL,
    schema_parity_verified boolean CONSTRAINT policy_backup_restore_verificat_schema_parity_verified_not_null NOT NULL,
    native_authority_verified boolean CONSTRAINT policy_backup_restore_verifi_native_authority_verified_not_null NOT NULL,
    policy_library_mismatch_count integer CONSTRAINT policy_backup_restore_verif_policy_library_mismatch_co_not_null NOT NULL,
    verified_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_backup_restore_verifications_backup_version_chk CHECK (((char_length(btrim((backup_version)::text)) >= 1) AND (char_length(btrim((backup_version)::text)) <= 64))),
    CONSTRAINT policy_backup_restore_verifications_mismatch_count_chk CHECK ((policy_library_mismatch_count = 0)),
    CONSTRAINT policy_backup_restore_verifications_mode_chk CHECK (((restore_mode)::text = ANY (ARRAY[('replace'::character varying)::text, ('merge'::character varying)::text]))),
    CONSTRAINT policy_backup_restore_verifications_status_chk CHECK (((verification_status)::text = 'verified'::text)),
    CONSTRAINT policy_backup_restore_verifications_verified_shape_chk CHECK (((schema_parity_verified = true) AND (native_authority_verified = true) AND (policy_library_mismatch_count = 0))),
    CONSTRAINT policy_backup_restore_verifications_version_chk CHECK ((verification_version = 1))
);


--
-- Name: policy_backup_restore_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_backup_restore_verifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_backup_restore_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_backup_restore_verifications_id_seq OWNED BY public.policy_backup_restore_verifications.id;


--
-- Name: policy_candidate_correction_policy_change_decision_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_policy_change_decision_records (
    control_key character varying(64) CONSTRAINT policy_candidate_correction_policy_change_control_key_not_null1 NOT NULL,
    record_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_policy_chan_record_version_not_null NOT NULL,
    observation_hypothesis_id character varying(64) CONSTRAINT policy_candidate_correction__observation_hypothesis_id_not_null NOT NULL,
    decision_id character varying(64) CONSTRAINT policy_candidate_correction_policy_change__decision_id_not_null NOT NULL,
    rationale_id character varying(64) CONSTRAINT policy_candidate_correction_policy_change_rationale_id_not_null NOT NULL,
    revision integer DEFAULT 1 CONSTRAINT policy_candidate_correction_policy_change_dec_revision_not_null NOT NULL,
    created_by_actor_id integer CONSTRAINT policy_candidate_correction_polic_created_by_actor_id_not_null1 NOT NULL,
    updated_by_actor_id integer CONSTRAINT policy_candidate_correction_policy_updated_by_actor_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_policy_change_d_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_policy_change_d_updated_at_not_null NOT NULL,
    expires_at timestamp with time zone CONSTRAINT policy_candidate_correction_policy_change_d_expires_at_not_null NOT NULL,
    CONSTRAINT policy_candidate_correction_policy_change_decision_actor_chk CHECK (((created_by_actor_id > 0) AND (updated_by_actor_id > 0))),
    CONSTRAINT policy_candidate_correction_policy_change_decision_choice_chk CHECK (((decision_id)::text = ANY (ARRAY[('retain_current_policy'::character varying)::text, ('investigate_policy_evidence'::character varying)::text, ('prepare_manual_policy_change'::character varying)::text]))),
    CONSTRAINT policy_candidate_correction_policy_change_decision_hypothesis_c CHECK (((observation_hypothesis_id)::text ~ '^pco_[A-Za-z0-9_-]{32}$'::text)),
    CONSTRAINT policy_candidate_correction_policy_change_decision_key_chk CHECK (((control_key)::text = 'policy_change_decision_record'::text)),
    CONSTRAINT policy_candidate_correction_policy_change_decision_rationale_ch CHECK (((rationale_id)::text = ANY (ARRAY[('outcome_improved'::character varying)::text, ('outcome_unchanged_or_inconclusive'::character varying)::text, ('outcome_degraded'::character varying)::text, ('requires_contextual_review'::character varying)::text]))),
    CONSTRAINT policy_candidate_correction_policy_change_decision_revision_chk CHECK ((revision > 0)),
    CONSTRAINT policy_candidate_correction_policy_change_decision_timestamps_c CHECK (((created_at <= updated_at) AND (updated_at < expires_at))),
    CONSTRAINT policy_candidate_correction_policy_change_decision_version_chk CHECK ((record_version = 1))
);


--
-- Name: policy_candidate_correction_policy_change_outcome_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_policy_change_outcome_observations (
    control_key character varying(64) CONSTRAINT policy_candidate_correction_policy_change__control_key_not_null NOT NULL,
    observation_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_policy_observation_version_not_null NOT NULL,
    hypothesis_id character varying(64) CONSTRAINT policy_candidate_correction_policy_chang_hypothesis_id_not_null NOT NULL,
    source_receipt_id bigint CONSTRAINT policy_candidate_correction_policy_c_source_receipt_id_not_null NOT NULL,
    source_intent_version integer CONSTRAINT policy_candidate_correction_poli_source_intent_version_not_null NOT NULL,
    target_intent_version integer CONSTRAINT policy_candidate_correction_poli_target_intent_version_not_null NOT NULL,
    baseline_window_start_at timestamp with time zone CONSTRAINT policy_candidate_correction_p_baseline_window_start_at_not_null NOT NULL,
    baseline_window_end_at timestamp with time zone CONSTRAINT policy_candidate_correction_pol_baseline_window_end_at_not_null NOT NULL,
    followup_window_start_at timestamp with time zone CONSTRAINT policy_candidate_correction_p_followup_window_start_at_not_null NOT NULL,
    followup_window_end_at timestamp with time zone CONSTRAINT policy_candidate_correction_pol_followup_window_end_at_not_null NOT NULL,
    outcome_count bigint CONSTRAINT policy_candidate_correction_policy_chang_outcome_count_not_null NOT NULL,
    confirmed_leader_outcome_count bigint CONSTRAINT policy_candidate_correction_confirmed_leader_outcome_c_not_null NOT NULL,
    changed_to_candidate_outcome_count bigint CONSTRAINT policy_candidate_correction_changed_to_candidate_outco_not_null NOT NULL,
    changed_outside_candidates_outcome_count bigint CONSTRAINT policy_candidate_correction_changed_outside_candidates_not_null NOT NULL,
    routed_not_applicable_outcome_count bigint CONSTRAINT policy_candidate_correction_routed_not_applicable_outc_not_null NOT NULL,
    created_by_actor_id integer CONSTRAINT policy_candidate_correction_policy_created_by_actor_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_policy_change_o_created_at_not_null NOT NULL,
    expires_at timestamp with time zone CONSTRAINT policy_candidate_correction_policy_change_o_expires_at_not_null NOT NULL,
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_actor_chk CHECK ((created_by_actor_id > 0)),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_counts_chk CHECK (((outcome_count >= 0) AND (confirmed_leader_outcome_count >= 0) AND (changed_to_candidate_outcome_count >= 0) AND (changed_outside_candidates_outcome_count >= 0) AND (routed_not_applicable_outcome_count >= 0) AND (outcome_count = (((confirmed_leader_outcome_count + changed_to_candidate_outcome_count) + changed_outside_candidates_outcome_count) + routed_not_applicable_outcome_count)))),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_expiry_chk CHECK (((created_at < expires_at) AND (followup_window_end_at <= expires_at))),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_hypothesis_c CHECK (((hypothesis_id)::text ~ '^pco_[A-Za-z0-9_-]{32}$'::text)),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_key_chk CHECK (((control_key)::text = 'policy_change_outcome_observation'::text)),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_receipt_chk CHECK ((source_receipt_id > 0)),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_revision_chk CHECK (((source_intent_version > 0) AND (target_intent_version > source_intent_version))),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_version_chk CHECK ((observation_version = 1)),
    CONSTRAINT policy_candidate_correction_policy_change_outcomes_windows_chk CHECK (((baseline_window_start_at < baseline_window_end_at) AND (baseline_window_end_at <= followup_window_start_at) AND (followup_window_start_at < followup_window_end_at)))
);


--
-- Name: policy_candidate_correction_review_corpus_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_review_corpus_audit_events (
    id bigint CONSTRAINT policy_candidate_correction_review_corpus_audit_eve_id_not_null NOT NULL,
    event_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_review_corpu_event_version_not_null NOT NULL,
    action_id character varying(64) CONSTRAINT policy_candidate_correction_review_corpus_au_action_id_not_null NOT NULL,
    actor_id integer CONSTRAINT policy_candidate_correction_review_corpus_aud_actor_id_not_null NOT NULL,
    previous_configuration_revision character(64),
    configuration_revision character(64) CONSTRAINT policy_candidate_correction_re_configuration_revision_not_null1 NOT NULL,
    purpose_id character varying(96) CONSTRAINT policy_candidate_correction_review_corpus_a_purpose_id_not_null NOT NULL,
    required_safeguard_ids jsonb CONSTRAINT policy_candidate_correction_re_required_safeguard_ids_not_null1 NOT NULL,
    review_record_retention_days smallint CONSTRAINT policy_candidate_correctio_review_record_retention_da_not_null1 NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_review_corpus__occurred_at_not_null NOT NULL,
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_action_c CHECK (((action_id)::text = 'configuration_acknowledged'::text)),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_actor_ch CHECK ((actor_id > 0)),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_purpose_ CHECK (((purpose_id)::text = 'representative_historical_correction_review'::text)),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_retentio CHECK (((review_record_retention_days >= 7) AND (review_record_retention_days <= 90))),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_revision CHECK (((configuration_revision ~ '^[a-f0-9]{64}$'::text) AND ((previous_configuration_revision IS NULL) OR (previous_configuration_revision ~ '^[a-f0-9]{64}$'::text)))),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_safeguar CHECK (((jsonb_typeof(required_safeguard_ids) = 'array'::text) AND (jsonb_array_length(required_safeguard_ids) = 4))),
    CONSTRAINT policy_candidate_correction_review_corpus_audit_events_version_ CHECK ((event_version = 1))
);


--
-- Name: policy_candidate_correction_review_corpus_audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_candidate_correction_review_corpus_audit_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_candidate_correction_review_corpus_audit_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_candidate_correction_review_corpus_audit_events_id_seq OWNED BY public.policy_candidate_correction_review_corpus_audit_events.id;


--
-- Name: policy_candidate_correction_review_corpus_capture_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_review_corpus_capture_audit_events (
    id bigint CONSTRAINT policy_candidate_correction_review_corpus_capture_a_id_not_null NOT NULL,
    event_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_review_corp_event_version_not_null1 NOT NULL,
    action_id character varying(32) CONSTRAINT policy_candidate_correction_review_corpus_ca_action_id_not_null NOT NULL,
    actor_id integer,
    capture_id character(64) CONSTRAINT policy_candidate_correction_review_corpus__capture_id_not_null1 NOT NULL,
    capture_recorded_at timestamp with time zone CONSTRAINT policy_candidate_correction_review_capture_recorded_at_not_null NOT NULL,
    configuration_revision character(64) CONSTRAINT policy_candidate_correction_re_configuration_revision_not_null5 NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_review_corpus_occurred_at_not_null1 NOT NULL,
    CONSTRAINT pccrc_audit_action_ck CHECK (((action_id)::text = ANY (ARRAY[('capture_recorded'::character varying)::text, ('capture_expired'::character varying)::text]))),
    CONSTRAINT pccrc_audit_actor_ck CHECK (((actor_id IS NULL) OR (actor_id > 0))),
    CONSTRAINT pccrc_audit_capture_ck CHECK ((capture_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT pccrc_audit_expiry_actor_ck CHECK (((((action_id)::text = 'capture_expired'::text) AND (actor_id IS NULL)) OR (((action_id)::text = 'capture_recorded'::text) AND (actor_id IS NOT NULL)))),
    CONSTRAINT pccrc_audit_rev_ck CHECK ((configuration_revision ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT pccrc_audit_ver_ck CHECK ((event_version = 1))
);


--
-- Name: policy_candidate_correction_review_corpus_capture_audit__id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_candidate_correction_review_corpus_capture_audit__id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_candidate_correction_review_corpus_capture_audit__id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_candidate_correction_review_corpus_capture_audit__id_seq OWNED BY public.policy_candidate_correction_review_corpus_capture_audit_events.id;


--
-- Name: policy_candidate_correction_review_corpus_captures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_review_corpus_captures (
    capture_id character(64) CONSTRAINT policy_candidate_correction_review_corpus_c_capture_id_not_null NOT NULL,
    capture_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_review_cor_capture_version_not_null NOT NULL,
    purpose_id character varying(96) CONSTRAINT policy_candidate_correction_review_corpus__purpose_id_not_null1 NOT NULL,
    configuration_revision character(64) CONSTRAINT policy_candidate_correction_re_configuration_revision_not_null4 NOT NULL,
    score_margin_band_id character varying(16) CONSTRAINT policy_candidate_correction_revi_score_margin_band_id_not_null1 NOT NULL,
    selection_status_id character varying(40) CONSTRAINT policy_candidate_correction_revie_selection_status_id_not_null1 NOT NULL,
    evidence_source_states jsonb CONSTRAINT policy_candidate_correction_re_evidence_source_states_not_null1 NOT NULL,
    captured_by_actor_id integer CONSTRAINT policy_candidate_correction_revie_captured_by_actor_id_not_null NOT NULL,
    captured_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_review_corpus__captured_at_not_null NOT NULL,
    expires_at timestamp with time zone CONSTRAINT policy_candidate_correction_review_corpus_c_expires_at_not_null NOT NULL,
    CONSTRAINT pccrc_cap_actor_ck CHECK ((captured_by_actor_id > 0)),
    CONSTRAINT pccrc_cap_evidence_ck CHECK (((jsonb_typeof(evidence_source_states) = 'array'::text) AND (jsonb_array_length(evidence_source_states) = 5))),
    CONSTRAINT pccrc_cap_expiry_ck CHECK ((captured_at < expires_at)),
    CONSTRAINT pccrc_cap_id_ck CHECK ((capture_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT pccrc_cap_margin_ck CHECK (((score_margin_band_id)::text = ANY (ARRAY[('0_to_4'::character varying)::text, ('5_to_14'::character varying)::text, ('15_to_29'::character varying)::text, ('30_or_more'::character varying)::text]))),
    CONSTRAINT pccrc_cap_purpose_ck CHECK (((purpose_id)::text = 'representative_historical_correction_review'::text)),
    CONSTRAINT pccrc_cap_rev_ck CHECK ((configuration_revision ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT pccrc_cap_selection_ck CHECK (((selection_status_id)::text = ANY (ARRAY[('confirmed_candidate'::character varying)::text, ('changed_to_candidate'::character varying)::text, ('changed_outside_candidates'::character varying)::text, ('routed_not_applicable'::character varying)::text]))),
    CONSTRAINT pccrc_cap_ver_ck CHECK ((capture_version = 1))
);


--
-- Name: policy_candidate_correction_review_corpus_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_review_corpus_controls (
    control_key character varying(64) CONSTRAINT policy_candidate_correction_review_corpus__control_key_not_null NOT NULL,
    configuration_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_revi_configuration_version_not_null NOT NULL,
    purpose_id character varying(96) CONSTRAINT policy_candidate_correction_review_corpus_c_purpose_id_not_null NOT NULL,
    required_safeguard_ids jsonb CONSTRAINT policy_candidate_correction_rev_required_safeguard_ids_not_null NOT NULL,
    review_record_retention_days smallint CONSTRAINT policy_candidate_correction_review_record_retention_da_not_null NOT NULL,
    configuration_revision character(64) CONSTRAINT policy_candidate_correction_rev_configuration_revision_not_null NOT NULL,
    acknowledged_by_actor_id integer CONSTRAINT policy_candidate_correction_r_acknowledged_by_actor_id_not_null NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_review_cor_acknowledged_at_not_null NOT NULL,
    CONSTRAINT policy_candidate_correction_review_corpus_controls_actor_chk CHECK ((acknowledged_by_actor_id > 0)),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_key_chk CHECK (((control_key)::text = 'representative_review_corpus'::text)),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_purpose_chk CHECK (((purpose_id)::text = 'representative_historical_correction_review'::text)),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_retention_ch CHECK (((review_record_retention_days >= 7) AND (review_record_retention_days <= 90))),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_revision_chk CHECK ((configuration_revision ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_safeguards_c CHECK (((jsonb_typeof(required_safeguard_ids) = 'array'::text) AND (jsonb_array_length(required_safeguard_ids) = 4))),
    CONSTRAINT policy_candidate_correction_review_corpus_controls_version_chk CHECK ((configuration_version = 1))
);


--
-- Name: policy_candidate_correction_review_projection_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_review_projection_audit_events (
    id bigint CONSTRAINT policy_candidate_correction_review_projection_audit_id_not_null NOT NULL,
    event_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_review_proje_event_version_not_null NOT NULL,
    action_id character varying(32) CONSTRAINT policy_candidate_correction_review_projectio_action_id_not_null NOT NULL,
    actor_id integer,
    projection_created_at timestamp with time zone CONSTRAINT policy_candidate_correction_revi_projection_created_at_not_null NOT NULL,
    configuration_revision character(64) CONSTRAINT policy_candidate_correction_re_configuration_revision_not_null3 NOT NULL,
    item_count smallint CONSTRAINT policy_candidate_correction_review_project_item_count_not_null1 NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_review_project_occurred_at_not_null NOT NULL,
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_acti CHECK (((action_id)::text = ANY (ARRAY[('projection_created'::character varying)::text, ('projection_viewed'::character varying)::text, ('projection_expired'::character varying)::text]))),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_acto CHECK (((actor_id IS NULL) OR (actor_id > 0))),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_expi CHECK (((((action_id)::text = 'projection_expired'::text) AND (actor_id IS NULL)) OR (((action_id)::text <> 'projection_expired'::text) AND (actor_id IS NOT NULL)))),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_item CHECK (((item_count >= 0) AND (item_count <= 160))),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_revi CHECK ((configuration_revision ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_candidate_correction_review_projection_audit_events_vers CHECK ((event_version = 1))
);


--
-- Name: policy_candidate_correction_review_projection_audit_even_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_candidate_correction_review_projection_audit_even_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_candidate_correction_review_projection_audit_even_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_candidate_correction_review_projection_audit_even_id_seq OWNED BY public.policy_candidate_correction_review_projection_audit_events.id;


--
-- Name: policy_candidate_correction_review_projection_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_review_projection_items (
    snapshot_id character(64) CONSTRAINT policy_candidate_correction_review_projec_snapshot_id_not_null1 NOT NULL,
    ordinal smallint CONSTRAINT policy_candidate_correction_review_projection__ordinal_not_null NOT NULL,
    period_id character varying(16) CONSTRAINT policy_candidate_correction_review_projectio_period_id_not_null NOT NULL,
    score_margin_band_id character varying(16) CONSTRAINT policy_candidate_correction_revie_score_margin_band_id_not_null NOT NULL,
    selection_status_id character varying(40) CONSTRAINT policy_candidate_correction_review_selection_status_id_not_null NOT NULL,
    evidence_source_states jsonb CONSTRAINT policy_candidate_correction_rev_evidence_source_states_not_null NOT NULL,
    CONSTRAINT policy_candidate_correction_review_projection_items_evidence_ch CHECK (((jsonb_typeof(evidence_source_states) = 'array'::text) AND (jsonb_array_length(evidence_source_states) = 5))),
    CONSTRAINT policy_candidate_correction_review_projection_items_margin_chk CHECK (((score_margin_band_id)::text = ANY (ARRAY[('0_to_4'::character varying)::text, ('5_to_14'::character varying)::text, ('15_to_29'::character varying)::text, ('30_or_more'::character varying)::text]))),
    CONSTRAINT policy_candidate_correction_review_projection_items_ordinal_chk CHECK (((ordinal >= 1) AND (ordinal <= 160))),
    CONSTRAINT policy_candidate_correction_review_projection_items_period_chk CHECK (((period_id)::text = ANY (ARRAY[('previous'::character varying)::text, ('current'::character varying)::text]))),
    CONSTRAINT policy_candidate_correction_review_projection_items_selection_c CHECK (((selection_status_id)::text = ANY (ARRAY[('confirmed_candidate'::character varying)::text, ('changed_to_candidate'::character varying)::text, ('changed_outside_candidates'::character varying)::text, ('routed_not_applicable'::character varying)::text])))
);


--
-- Name: policy_candidate_correction_review_projections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_candidate_correction_review_projections (
    snapshot_id character(64) CONSTRAINT policy_candidate_correction_review_project_snapshot_id_not_null NOT NULL,
    projection_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_review__projection_version_not_null NOT NULL,
    purpose_id character varying(96) CONSTRAINT policy_candidate_correction_review_projecti_purpose_id_not_null NOT NULL,
    configuration_revision character(64) CONSTRAINT policy_candidate_correction_re_configuration_revision_not_null2 NOT NULL,
    previous_window_start_at timestamp with time zone CONSTRAINT policy_candidate_correction_r_previous_window_start_at_not_null NOT NULL,
    previous_window_end_at timestamp with time zone CONSTRAINT policy_candidate_correction_rev_previous_window_end_at_not_null NOT NULL,
    current_window_start_at timestamp with time zone CONSTRAINT policy_candidate_correction_re_current_window_start_at_not_null NOT NULL,
    current_window_end_at timestamp with time zone CONSTRAINT policy_candidate_correction_revi_current_window_end_at_not_null NOT NULL,
    sample_per_stratum smallint DEFAULT 5 CONSTRAINT policy_candidate_correction_review__sample_per_stratum_not_null NOT NULL,
    item_count smallint DEFAULT 0 CONSTRAINT policy_candidate_correction_review_projecti_item_count_not_null NOT NULL,
    created_by_actor_id integer CONSTRAINT policy_candidate_correction_review_created_by_actor_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_review_projecti_created_at_not_null NOT NULL,
    expires_at timestamp with time zone CONSTRAINT policy_candidate_correction_review_projecti_expires_at_not_null NOT NULL,
    CONSTRAINT policy_candidate_correction_review_projections_actor_chk CHECK ((created_by_actor_id > 0)),
    CONSTRAINT policy_candidate_correction_review_projections_expiry_chk CHECK ((created_at < expires_at)),
    CONSTRAINT policy_candidate_correction_review_projections_item_count_chk CHECK (((item_count >= 0) AND (item_count <= 160))),
    CONSTRAINT policy_candidate_correction_review_projections_purpose_chk CHECK (((purpose_id)::text = 'representative_historical_correction_review'::text)),
    CONSTRAINT policy_candidate_correction_review_projections_revision_chk CHECK ((configuration_revision ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_candidate_correction_review_projections_sample_chk CHECK (((sample_per_stratum >= 1) AND (sample_per_stratum <= 5))),
    CONSTRAINT policy_candidate_correction_review_projections_snapshot_id_chk CHECK ((snapshot_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_candidate_correction_review_projections_version_chk CHECK ((projection_version = 1)),
    CONSTRAINT policy_candidate_correction_review_projections_windows_chk CHECK (((previous_window_start_at < previous_window_end_at) AND (previous_window_end_at = current_window_start_at) AND (current_window_start_at < current_window_end_at)))
);


--
-- Name: policy_change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_change_log (
    id integer NOT NULL,
    policy_id integer,
    change_type character varying(50) NOT NULL,
    change_config jsonb,
    before_metrics jsonb,
    after_metrics jsonb,
    applied_by integer,
    applied_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE policy_change_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_change_log IS 'Audit trail of policy configuration changes for tracking and rollback';


--
-- Name: policy_change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_change_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_change_log_id_seq OWNED BY public.policy_change_log.id;


--
-- Name: policy_change_review_history_aggregates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_change_review_history_aggregates (
    period_start date CONSTRAINT policy_candidate_correction_policy_change_period_start_not_null NOT NULL,
    decision_id character varying(64) CONSTRAINT policy_candidate_correction_policy_change_decision_id_not_null1 NOT NULL,
    recorded_count integer DEFAULT 0 CONSTRAINT policy_candidate_correction_policy_chan_recorded_count_not_null NOT NULL,
    revised_count integer DEFAULT 0 CONSTRAINT policy_candidate_correction_policy_chang_revised_count_not_null NOT NULL,
    CONSTRAINT pcc_pcrh_counts_chk CHECK (((recorded_count >= 0) AND (revised_count >= 0) AND ((recorded_count + revised_count) > 0))),
    CONSTRAINT pcc_pcrh_decision_chk CHECK (((decision_id)::text = ANY (ARRAY[('retain_current_policy'::character varying)::text, ('investigate_policy_evidence'::character varying)::text, ('prepare_manual_policy_change'::character varying)::text])))
);


--
-- Name: policy_change_review_history_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_change_review_history_controls (
    control_key character varying(64) CONSTRAINT policy_candidate_correction_policy_change_control_key_not_null2 NOT NULL,
    record_version smallint DEFAULT 1 CONSTRAINT policy_candidate_correction_policy_cha_record_version_not_null1 NOT NULL,
    started_at timestamp with time zone DEFAULT now() CONSTRAINT policy_candidate_correction_policy_change_r_started_at_not_null NOT NULL,
    CONSTRAINT pcc_pcrh_control_key_chk CHECK (((control_key)::text = 'policy_change_review_history_summary'::text)),
    CONSTRAINT pcc_pcrh_control_version_chk CHECK ((record_version = 1))
);


--
-- Name: policy_feedback_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_feedback_log (
    id integer NOT NULL,
    tmdb_id integer NOT NULL,
    media_type character varying(20),
    title character varying(500),
    item_metadata jsonb,
    prompt_type character varying(30),
    original_scores jsonb,
    top_suggestion_library_id integer,
    top_suggestion_score real,
    selected_library_id integer,
    selected_policy_id integer,
    was_correction boolean,
    user_reason character varying(100),
    user_reason_text text,
    patterns_created jsonb DEFAULT '[]'::jsonb,
    signal_analysis jsonb,
    prompted_at timestamp with time zone DEFAULT now(),
    responded_at timestamp with time zone,
    response_time_seconds integer,
    source character varying(20) DEFAULT 'web'::character varying
);


--
-- Name: TABLE policy_feedback_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_feedback_log IS 'Captures user decisions and corrections for policy learning and improvement';


--
-- Name: COLUMN policy_feedback_log.was_correction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_feedback_log.was_correction IS 'True if user corrected an auto-classification decision';


--
-- Name: policy_feedback_evaluation; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.policy_feedback_evaluation WITH (security_invoker='true') AS
 SELECT feedback.id,
    feedback.tmdb_id,
    feedback.media_type,
    feedback.title,
    feedback.item_metadata,
    feedback.prompt_type,
    feedback.original_scores,
    feedback.top_suggestion_library_id,
    feedback.top_suggestion_score,
    feedback.selected_library_id,
    feedback.selected_policy_id,
    feedback.was_correction,
    feedback.user_reason,
    feedback.user_reason_text,
    feedback.patterns_created,
    feedback.signal_analysis,
    feedback.prompted_at,
    feedback.responded_at,
    feedback.response_time_seconds,
    feedback.source,
        CASE
            WHEN ((feedback.selected_library_id > 0) AND (feedback.top_suggestion_library_id > 0) AND (destination.is_active IS TRUE) AND (candidate.is_active IS TRUE) AND (policy.library_id = feedback.selected_library_id) AND ((destination.media_type)::text = (candidate.media_type)::text) AND ((feedback.media_type IS NULL) OR ((feedback.media_type)::text = (destination.media_type)::text)) AND isfinite(feedback.prompted_at) AND (feedback.prompted_at <= CURRENT_TIMESTAMP) AND (feedback.was_correction = (feedback.selected_library_id <> feedback.top_suggestion_library_id))) THEN (NOT feedback.was_correction)
            ELSE NULL::boolean
        END AS evaluation_correct
   FROM (((public.policy_feedback_log feedback
     LEFT JOIN public.libraries destination ON ((destination.id = feedback.selected_library_id)))
     LEFT JOIN public.libraries candidate ON ((candidate.id = feedback.top_suggestion_library_id)))
     LEFT JOIN public.library_policies policy ON ((policy.id = feedback.selected_policy_id)));


--
-- Name: VIEW policy_feedback_evaluation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.policy_feedback_evaluation IS 'Observed policy feedback with nullable correctness; null means incomplete, inconsistent or currently ineligible evidence.';


--
-- Name: policy_feedback_learning_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.policy_feedback_learning_stats WITH (security_invoker='true') AS
 WITH aggregates AS (
         SELECT policy.id AS policy_id,
            (count(feedback.id))::integer AS total_decisions,
            (count(feedback.evaluation_correct))::integer AS evaluated_decisions,
            (count(feedback.id) FILTER (WHERE (feedback.evaluation_correct IS NULL)))::integer AS unevaluated_decisions,
            (count(feedback.id) FILTER (WHERE ((feedback.prompt_type)::text = 'auto_classify'::text)))::integer AS auto_classified,
            (count(feedback.evaluation_correct) FILTER (WHERE ((feedback.prompt_type)::text = 'auto_classify'::text)))::integer AS evaluated_auto_classified,
            (count(feedback.id) FILTER (WHERE ((feedback.prompt_type)::text = 'ai_validate'::text)))::integer AS ai_validated,
            (count(feedback.id) FILTER (WHERE ((feedback.prompt_type)::text = ANY (ARRAY[('prompt_confirm'::character varying)::text, ('prompt_select'::character varying)::text]))))::integer AS user_prompted,
            (count(feedback.id) FILTER (WHERE (feedback.evaluation_correct IS FALSE)))::integer AS user_corrections,
            (avg((feedback.evaluation_correct)::integer))::real AS accuracy_rate,
            (avg((feedback.evaluation_correct)::integer) FILTER (WHERE ((feedback.prompt_type)::text = 'auto_classify'::text)))::real AS auto_accuracy_rate,
            (avg((feedback.evaluation_correct)::integer) FILTER (WHERE (feedback.prompted_at >= (CURRENT_TIMESTAMP - '7 days'::interval))))::real AS last_7_days_accuracy,
            (avg((feedback.evaluation_correct)::integer) FILTER (WHERE (feedback.prompted_at >= (CURRENT_TIMESTAMP - '30 days'::interval))))::real AS last_30_days_accuracy,
            max(feedback.prompted_at) FILTER (WHERE (isfinite(feedback.prompted_at) AND (feedback.prompted_at <= CURRENT_TIMESTAMP))) AS last_decision_at,
            max(feedback.prompted_at) FILTER (WHERE (feedback.evaluation_correct IS FALSE)) AS last_correction_at
           FROM (public.library_policies policy
             LEFT JOIN public.policy_feedback_evaluation feedback ON ((feedback.selected_policy_id = policy.id)))
          GROUP BY policy.id
        )
 SELECT policy_id,
    total_decisions,
    evaluated_decisions,
    unevaluated_decisions,
    auto_classified,
    evaluated_auto_classified,
    ai_validated,
    user_prompted,
    user_corrections,
    accuracy_rate,
    auto_accuracy_rate,
    last_7_days_accuracy,
    last_30_days_accuracy,
    last_decision_at,
    last_correction_at,
    ((evaluated_decisions)::real / (NULLIF(total_decisions, 0))::double precision) AS evaluation_coverage,
    (
        CASE
            WHEN ((last_7_days_accuracy IS NULL) OR (last_30_days_accuracy IS NULL)) THEN 'unknown'::text
            WHEN (last_7_days_accuracy > (last_30_days_accuracy + (0.05)::double precision)) THEN 'improving'::text
            WHEN (last_7_days_accuracy < (last_30_days_accuracy - (0.05)::double precision)) THEN 'declining'::text
            ELSE 'stable'::text
        END)::character varying(20) AS trend,
    CURRENT_TIMESTAMP AS updated_at
   FROM aggregates;


--
-- Name: VIEW policy_feedback_learning_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.policy_feedback_learning_stats IS 'Live policy observation totals, evaluated coverage and accuracy; unavailable accuracy is null. updated_at is calculation time.';


--
-- Name: policy_feedback_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_feedback_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_feedback_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_feedback_log_id_seq OWNED BY public.policy_feedback_log.id;


--
-- Name: policy_feedback_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_feedback_sources (
    classification_id bigint NOT NULL,
    feedback_id integer,
    intake character varying(20) NOT NULL,
    request_fingerprint text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT policy_feedback_sources_classification_id_check CHECK ((classification_id > 0)),
    CONSTRAINT policy_feedback_sources_intake_check CHECK (((intake)::text = ANY (ARRAY[('standalone'::character varying)::text, ('prompt'::character varying)::text]))),
    CONSTRAINT policy_feedback_sources_request_fingerprint_check CHECK ((request_fingerprint ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: TABLE policy_feedback_sources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_feedback_sources IS 'One feedback receipt per classification event; source IDs survive history retention and deleted feedback leaves a replay-blocking tombstone.';


--
-- Name: COLUMN policy_feedback_sources.classification_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_feedback_sources.classification_id IS 'Validated against locked classification_history at intake; intentionally no cascading history foreign key. Legacy feedback is not backfilled.';


--
-- Name: policy_identity_evidence_admissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_identity_evidence_admissions (
    id bigint NOT NULL,
    admission_version smallint DEFAULT 1 NOT NULL,
    source_id character varying(80) NOT NULL,
    source_event_id character varying(160) NOT NULL,
    classification_id bigint NOT NULL,
    library_id bigint NOT NULL,
    media_type character varying(20) NOT NULL,
    signal_type character varying(50) NOT NULL,
    evidence_key character varying(160) NOT NULL,
    authority_source_id character varying(64) CONSTRAINT policy_identity_evidence_admission_authority_source_id_not_null NOT NULL,
    authority_reference character varying(160) CONSTRAINT policy_identity_evidence_admission_authority_reference_not_null NOT NULL,
    authority_policy_id bigint,
    authority_intent_id bigint,
    authority_intent_version integer,
    authority_fingerprint character(64),
    actor_reference character varying(128),
    source_system character varying(80) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_identity_evidence_admissions_authority_shape_chk CHECK (((((authority_source_id)::text = 'operator_declared_intent'::text) AND (authority_policy_id IS NOT NULL) AND (authority_intent_id IS NOT NULL) AND (authority_intent_version IS NOT NULL) AND (authority_intent_version > 0) AND (authority_fingerprint IS NULL)) OR (((authority_source_id)::text = 'media_server_contents'::text) AND (authority_policy_id IS NULL) AND (authority_intent_id IS NULL) AND (authority_intent_version IS NULL) AND (authority_fingerprint ~ '^[a-f0-9]{64}$'::text)))),
    CONSTRAINT policy_identity_evidence_admissions_authority_source_chk CHECK (((authority_source_id)::text = ANY (ARRAY[('media_server_contents'::character varying)::text, ('operator_declared_intent'::character varying)::text]))),
    CONSTRAINT policy_identity_evidence_admissions_evidence_key_chk CHECK (((char_length(btrim((evidence_key)::text)) >= 3) AND (char_length(btrim((evidence_key)::text)) <= 160))),
    CONSTRAINT policy_identity_evidence_admissions_identifiers_chk CHECK (((classification_id > 0) AND (library_id > 0))),
    CONSTRAINT policy_identity_evidence_admissions_media_type_chk CHECK (((media_type)::text = ANY (ARRAY[('movie'::character varying)::text, ('tv'::character varying)::text]))),
    CONSTRAINT policy_identity_evidence_admissions_signal_type_chk CHECK (((signal_type)::text = ANY (ARRAY[('genres'::character varying)::text, ('keywords'::character varying)::text, ('studios'::character varying)::text, ('media_type'::character varying)::text]))),
    CONSTRAINT policy_identity_evidence_admissions_source_event_chk CHECK (((char_length(btrim((source_id)::text)) >= 1) AND (char_length(btrim((source_id)::text)) <= 80) AND ((char_length(btrim((source_event_id)::text)) >= 1) AND (char_length(btrim((source_event_id)::text)) <= 160)))),
    CONSTRAINT policy_identity_evidence_admissions_source_system_chk CHECK (((source_system)::text = 'policy_authorized_identity_admission'::text)),
    CONSTRAINT policy_identity_evidence_admissions_version_chk CHECK ((admission_version = 1))
);


--
-- Name: policy_identity_evidence_admissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_identity_evidence_admissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_identity_evidence_admissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_identity_evidence_admissions_id_seq OWNED BY public.policy_identity_evidence_admissions.id;


--
-- Name: policy_initial_intent_establishments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_initial_intent_establishments (
    id bigint NOT NULL,
    policy_id integer NOT NULL,
    library_id integer NOT NULL,
    intent_id bigint,
    migration_event_id bigint,
    rollback_snapshot_id bigint,
    idempotency_key character varying(128) NOT NULL,
    request_fingerprint character(64) CONSTRAINT policy_initial_intent_establishmen_request_fingerprint_not_null NOT NULL,
    authority_source_id character varying(50) CONSTRAINT policy_initial_intent_establishmen_authority_source_id_not_null NOT NULL,
    accepted_by integer NOT NULL,
    state character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    established_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_initial_intent_establishments_authority_source_chk CHECK (((authority_source_id)::text = 'operator_declared_intent'::text)),
    CONSTRAINT policy_initial_intent_establishments_fingerprint_shape_chk CHECK ((request_fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_initial_intent_establishments_idempotency_shape_chk CHECK (((idempotency_key)::text ~ '^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$'::text)),
    CONSTRAINT policy_initial_intent_establishments_state_chk CHECK (((state)::text = ANY (ARRAY[('pending'::character varying)::text, ('established'::character varying)::text]))),
    CONSTRAINT policy_initial_intent_establishments_state_reference_chk CHECK (((((state)::text = 'pending'::text) AND (intent_id IS NULL) AND (migration_event_id IS NULL) AND (rollback_snapshot_id IS NULL) AND (established_at IS NULL)) OR (((state)::text = 'established'::text) AND (intent_id IS NOT NULL) AND (migration_event_id IS NOT NULL) AND (rollback_snapshot_id IS NOT NULL) AND (established_at IS NOT NULL))))
);


--
-- Name: policy_initial_intent_establishments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_initial_intent_establishments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_initial_intent_establishments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_initial_intent_establishments_id_seq OWNED BY public.policy_initial_intent_establishments.id;


--
-- Name: policy_intent_migration_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_intent_migration_events (
    id bigint NOT NULL,
    intent_id bigint,
    policy_id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    actor_type character varying(40) NOT NULL,
    actor_id integer,
    source_version integer,
    target_version integer,
    reason_code character varying(80) NOT NULL,
    summary text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_intent_migration_events_actor_type_chk CHECK (((actor_type)::text = ANY (ARRAY[('operator'::character varying)::text, ('post_upgrade'::character varying)::text, ('reconciler'::character varying)::text, ('test_fixture'::character varying)::text, ('maintainer'::character varying)::text]))),
    CONSTRAINT policy_intent_migration_events_event_type_chk CHECK (((event_type)::text = ANY (ARRAY[('dry_run_reported'::character varying)::text, ('conversion_started'::character varying)::text, ('conversion_applied'::character varying)::text, ('conversion_failed'::character varying)::text, ('rollback_snapshot_created'::character varying)::text, ('rollback_applied'::character varying)::text, ('rollback_snapshot_payload_redacted'::character varying)::text, ('native_validated'::character varying)::text, ('legacy_deletion_ready'::character varying)::text, ('library_rebuild_replacement_applied'::character varying)::text, ('active_intent_integrity_repaired'::character varying)::text, ('reconciliation_reentry_approved'::character varying)::text, ('semantic_intent_authority_repaired'::character varying)::text, ('initial_intent_established'::character varying)::text, ('native_intent_change_applied'::character varying)::text]))),
    CONSTRAINT policy_intent_migration_events_metadata_shape_chk CHECK ((jsonb_typeof(metadata) = 'object'::text))
);


--
-- Name: policy_intent_migration_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_intent_migration_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_intent_migration_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_intent_migration_events_id_seq OWNED BY public.policy_intent_migration_events.id;


--
-- Name: policy_intent_rollback_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_intent_rollback_snapshots (
    id bigint NOT NULL,
    intent_id bigint NOT NULL,
    policy_id integer NOT NULL,
    snapshot_version integer NOT NULL,
    snapshot_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    payload_redacted boolean DEFAULT true NOT NULL,
    restore_path text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    restored_at timestamp with time zone,
    CONSTRAINT policy_intent_rollback_snapshots_payload_shape_chk CHECK ((jsonb_typeof(snapshot_payload) = 'object'::text)),
    CONSTRAINT policy_intent_rollback_snapshots_version_chk CHECK ((snapshot_version > 0)),
    CONSTRAINT policy_intent_rollback_snapshots_window_chk CHECK ((expires_at > created_at))
);


--
-- Name: policy_intent_rollback_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_intent_rollback_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_intent_rollback_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_intent_rollback_snapshots_id_seq OWNED BY public.policy_intent_rollback_snapshots.id;


--
-- Name: policy_intent_routing_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_intent_routing_targets (
    id bigint NOT NULL,
    intent_id bigint NOT NULL,
    library_id integer NOT NULL,
    arr_type character varying(20),
    arr_config_id integer,
    arr_root_folder_id integer,
    arr_root_folder_path text,
    quality_profile_id integer,
    target_status character varying(40) DEFAULT 'configured'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_intent_routing_targets_arr_type_chk CHECK (((arr_type IS NULL) OR ((arr_type)::text = ANY (ARRAY[('radarr'::character varying)::text, ('sonarr'::character varying)::text])))),
    CONSTRAINT policy_intent_routing_targets_status_chk CHECK (((target_status)::text = ANY (ARRAY[('configured'::character varying)::text, ('missing'::character varying)::text, ('disabled'::character varying)::text, ('review_required'::character varying)::text])))
);


--
-- Name: policy_intent_routing_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_intent_routing_targets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_intent_routing_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_intent_routing_targets_id_seq OWNED BY public.policy_intent_routing_targets.id;


--
-- Name: policy_intent_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_intent_rules (
    id bigint NOT NULL,
    intent_id bigint NOT NULL,
    intent_role character varying(40) NOT NULL,
    collection character varying(40) NOT NULL,
    signal_type character varying(50) NOT NULL,
    operator character varying(50) NOT NULL,
    "values" jsonb DEFAULT '{}'::jsonb NOT NULL,
    constraint_mode character varying(30),
    semantics character varying(30),
    source character varying(50),
    inference_state character varying(40) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_intent_rules_collection_chk CHECK (((collection)::text = ANY (ARRAY[('purpose'::character varying)::text, ('hard_limits'::character varying)::text, ('helpful_hints'::character varying)::text, ('avoid'::character varying)::text]))),
    CONSTRAINT policy_intent_rules_collection_role_chk CHECK (((((collection)::text = 'purpose'::text) AND ((intent_role)::text = 'purpose'::text)) OR (((collection)::text = 'hard_limits'::text) AND ((intent_role)::text = 'hard_limit'::text)) OR (((collection)::text = 'helpful_hints'::text) AND ((intent_role)::text = 'helpful_hint'::text)) OR (((collection)::text = 'avoid'::text) AND ((intent_role)::text = 'avoid'::text)))),
    CONSTRAINT policy_intent_rules_constraint_mode_chk CHECK (((constraint_mode IS NULL) OR ((constraint_mode)::text = ANY (ARRAY[('strict'::character varying)::text, ('advisory'::character varying)::text])))),
    CONSTRAINT policy_intent_rules_inference_state_chk CHECK (((inference_state)::text = ANY (ARRAY[('empty'::character varying)::text, ('inferred'::character varying)::text, ('partial'::character varying)::text]))),
    CONSTRAINT policy_intent_rules_operator_chk CHECK (((operator)::text = ANY (ARRAY[('require_all'::character varying)::text, ('require_any'::character varying)::text, ('prefer'::character varying)::text, ('include'::character varying)::text, ('exclude'::character varying)::text, ('max'::character varying)::text, ('range'::character varying)::text, ('runtime_range'::character varying)::text, ('configured'::character varying)::text]))),
    CONSTRAINT policy_intent_rules_role_chk CHECK (((intent_role)::text = ANY (ARRAY[('purpose'::character varying)::text, ('hard_limit'::character varying)::text, ('helpful_hint'::character varying)::text, ('avoid'::character varying)::text]))),
    CONSTRAINT policy_intent_rules_semantics_chk CHECK (((semantics IS NULL) OR ((semantics)::text = ANY (ARRAY[('identity'::character varying)::text, ('compatibility'::character varying)::text])))),
    CONSTRAINT policy_intent_rules_signal_type_chk CHECK (((signal_type)::text = ANY (ARRAY[('genres'::character varying)::text, ('keywords'::character varying)::text, ('studios'::character varying)::text, ('language'::character varying)::text, ('media_type'::character varying)::text, ('certifications'::character varying)::text, ('release_year'::character varying)::text, ('vote_average'::character varying)::text, ('runtime'::character varying)::text]))),
    CONSTRAINT policy_intent_rules_values_shape_chk CHECK ((jsonb_typeof("values") = 'object'::text))
);


--
-- Name: policy_intent_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_intent_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_intent_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_intent_rules_id_seq OWNED BY public.policy_intent_rules.id;


--
-- Name: policy_intent_template_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_intent_template_applications (
    id bigint NOT NULL,
    intent_id bigint NOT NULL,
    preset_id integer,
    preset_key character varying(100),
    preset_name character varying(255),
    weight numeric(6,3),
    signal_count integer DEFAULT 0 NOT NULL,
    link_state character varying(40) DEFAULT 'applied'::character varying NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_intent_template_applications_link_state_chk CHECK (((link_state)::text = ANY (ARRAY[('applied'::character varying)::text, ('removed'::character varying)::text, ('replaced'::character varying)::text, ('ignored'::character varying)::text]))),
    CONSTRAINT policy_intent_template_applications_signal_count_chk CHECK ((signal_count >= 0))
);


--
-- Name: policy_intent_template_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_intent_template_applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_intent_template_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_intent_template_applications_id_seq OWNED BY public.policy_intent_template_applications.id;


--
-- Name: policy_intent_validation_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_intent_validation_status (
    id bigint NOT NULL,
    intent_id bigint NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    status character varying(40) NOT NULL,
    validator_version character varying(80) NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    warning_count integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    validated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_intent_validation_status_error_count_chk CHECK ((error_count >= 0)),
    CONSTRAINT policy_intent_validation_status_errors_shape_chk CHECK ((jsonb_typeof(errors) = 'array'::text)),
    CONSTRAINT policy_intent_validation_status_schema_version_chk CHECK ((schema_version = 1)),
    CONSTRAINT policy_intent_validation_status_status_chk CHECK (((status)::text = ANY (ARRAY[('valid'::character varying)::text, ('invalid'::character varying)::text, ('warning'::character varying)::text]))),
    CONSTRAINT policy_intent_validation_status_warning_count_chk CHECK ((warning_count >= 0)),
    CONSTRAINT policy_intent_validation_status_warnings_shape_chk CHECK ((jsonb_typeof(warnings) = 'array'::text))
);


--
-- Name: policy_intent_validation_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_intent_validation_status_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_intent_validation_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_intent_validation_status_id_seq OWNED BY public.policy_intent_validation_status.id;


--
-- Name: policy_intents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_intents (
    id bigint NOT NULL,
    policy_id integer NOT NULL,
    library_id integer NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    intent_version integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    source character varying(40) NOT NULL,
    inference_state character varying(40) NOT NULL,
    review_behavior jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_status character varying(40) DEFAULT 'pending_validation'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    accepted_at timestamp with time zone,
    accepted_by integer,
    replaced_by_intent_id bigint,
    CONSTRAINT policy_intents_active_native_authority_header_chk CHECK (((active = false) OR (((source)::text = 'native_intent'::text) AND ((inference_state)::text = 'inferred'::text) AND ((validation_status)::text = ANY (ARRAY[('valid'::character varying)::text, ('warning'::character varying)::text]))))),
    CONSTRAINT policy_intents_inference_state_chk CHECK (((inference_state)::text = ANY (ARRAY[('empty'::character varying)::text, ('inferred'::character varying)::text, ('partial'::character varying)::text]))),
    CONSTRAINT policy_intents_intent_version_chk CHECK ((intent_version > 0)),
    CONSTRAINT policy_intents_review_behavior_shape_chk CHECK ((jsonb_typeof(review_behavior) = 'object'::text)),
    CONSTRAINT policy_intents_schema_version_chk CHECK ((schema_version = 1)),
    CONSTRAINT policy_intents_source_chk CHECK (((source)::text = ANY (ARRAY[('empty'::character varying)::text, ('legacy_presets'::character varying)::text, ('native_intent'::character varying)::text]))),
    CONSTRAINT policy_intents_validation_status_chk CHECK (((validation_status)::text = ANY (ARRAY[('pending_validation'::character varying)::text, ('valid'::character varying)::text, ('invalid'::character varying)::text, ('warning'::character varying)::text])))
);


--
-- Name: policy_intents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_intents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_intents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_intents_id_seq OWNED BY public.policy_intents.id;


--
-- Name: policy_learning_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_learning_stats (
    id integer NOT NULL,
    policy_id integer,
    total_decisions integer DEFAULT 0,
    auto_classified integer DEFAULT 0,
    ai_validated integer DEFAULT 0,
    user_prompted integer DEFAULT 0,
    user_corrections integer DEFAULT 0,
    accuracy_rate real,
    auto_accuracy_rate real,
    last_7_days_accuracy real,
    last_30_days_accuracy real,
    trend character varying(20),
    last_decision_at timestamp with time zone,
    last_correction_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE policy_learning_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_learning_stats IS 'Aggregate learning metrics for policy performance tracking and analysis';


--
-- Name: policy_learning_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_learning_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_learning_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_learning_stats_id_seq OWNED BY public.policy_learning_stats.id;


--
-- Name: policy_library_rebuild_execution_gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_library_rebuild_execution_gates (
    id bigint NOT NULL,
    policy_id integer NOT NULL,
    intent_id bigint NOT NULL,
    library_id integer NOT NULL,
    state character varying(40) NOT NULL,
    idempotency_key character varying(160) NOT NULL,
    transition_fingerprint character varying(64) CONSTRAINT policy_library_rebuild_executio_transition_fingerprint_not_null NOT NULL,
    proposal_fingerprint character varying(64) CONSTRAINT policy_library_rebuild_execution__proposal_fingerprint_not_null NOT NULL,
    rollback_plan_fingerprint character varying(64) CONSTRAINT policy_library_rebuild_execu_rollback_plan_fingerprint_not_null NOT NULL,
    actor_source_id character varying(40) NOT NULL,
    actor_reference character varying(64) NOT NULL,
    acceptance_expires_at timestamp with time zone CONSTRAINT policy_library_rebuild_execution_acceptance_expires_at_not_null NOT NULL,
    rollback_snapshot_id bigint,
    migration_event_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    replacement_intent_id bigint,
    replacement_event_id bigint,
    replacement_applied_at timestamp with time zone,
    verification_run_id bigint,
    verification_run_fingerprint character(64),
    CONSTRAINT policy_library_rebuild_execution_gates_acceptance_window_chk CHECK ((acceptance_expires_at > created_at)),
    CONSTRAINT policy_library_rebuild_execution_gates_actor_reference_chk CHECK (((actor_reference)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_library_rebuild_execution_gates_idempotency_key_chk CHECK (((idempotency_key)::text ~ '^policy:library_rebuild_acceptance:[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_library_rebuild_execution_gates_persisted_snapshot_chk CHECK ((((state)::text <> ALL (ARRAY[('snapshot_persisted'::character varying)::text, ('replacement_applied'::character varying)::text, ('rollback_applied'::character varying)::text])) OR ((rollback_snapshot_id IS NOT NULL) AND (migration_event_id IS NOT NULL)))),
    CONSTRAINT policy_library_rebuild_execution_gates_proposal_fingerprint_chk CHECK (((proposal_fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_library_rebuild_execution_gates_replacement_applied_chk CHECK ((((state)::text <> 'replacement_applied'::text) OR ((replacement_intent_id IS NOT NULL) AND (replacement_event_id IS NOT NULL) AND (replacement_applied_at IS NOT NULL)))),
    CONSTRAINT policy_library_rebuild_execution_gates_replacement_intent_chk CHECK (((replacement_intent_id IS NULL) OR (replacement_intent_id <> intent_id))),
    CONSTRAINT policy_library_rebuild_execution_gates_rollback_plan_fingerprin CHECK (((rollback_plan_fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_library_rebuild_execution_gates_state_chk CHECK (((state)::text = ANY (ARRAY[('snapshot_persisting'::character varying)::text, ('snapshot_persisted'::character varying)::text, ('acceptance_expired'::character varying)::text, ('replacement_applied'::character varying)::text, ('rollback_applied'::character varying)::text, ('invalidated'::character varying)::text]))),
    CONSTRAINT policy_library_rebuild_execution_gates_transition_fingerprint_c CHECK (((transition_fingerprint)::text ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_library_rebuild_execution_gates_verification_run_pair_ch CHECK ((((verification_run_id IS NULL) AND (verification_run_fingerprint IS NULL)) OR ((verification_run_id IS NOT NULL) AND (verification_run_fingerprint ~ '^[a-f0-9]{64}$'::text)))),
    CONSTRAINT policy_library_rebuild_execution_gates_verified_snapshot_chk CHECK ((((state)::text <> ALL (ARRAY[('snapshot_persisting'::character varying)::text, ('snapshot_persisted'::character varying)::text])) OR ((verification_run_id IS NOT NULL) AND (verification_run_fingerprint ~ '^[a-f0-9]{64}$'::text))))
);


--
-- Name: policy_library_rebuild_execution_gates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_library_rebuild_execution_gates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_library_rebuild_execution_gates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_library_rebuild_execution_gates_id_seq OWNED BY public.policy_library_rebuild_execution_gates.id;


--
-- Name: policy_migration_verification_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_migration_verification_runs (
    id bigint NOT NULL,
    run_version smallint DEFAULT 1 NOT NULL,
    policy_id integer NOT NULL,
    intent_id bigint NOT NULL,
    library_id integer NOT NULL,
    acceptance_transition_fingerprint character(64) CONSTRAINT policy_migration_verificati_acceptance_transition_fing_not_null NOT NULL,
    source_id character varying(120) NOT NULL,
    source_media_type character varying(20) NOT NULL,
    source_deterministic_order_id character varying(120) CONSTRAINT policy_migration_verificati_source_deterministic_order_not_null NOT NULL,
    source_maximum_classifications smallint CONSTRAINT policy_migration_verificati_source_maximum_classificat_not_null NOT NULL,
    source_rows_read integer NOT NULL,
    source_rows_considered integer CONSTRAINT policy_migration_verification_r_source_rows_considered_not_null NOT NULL,
    source_representative_classification_count smallint CONSTRAINT policy_migration_verificati_source_representative_clas_not_null NOT NULL,
    source_unusable_source_row_count integer CONSTRAINT policy_migration_verificati_source_unusable_source_row_not_null NOT NULL,
    source_rows_truncated boolean CONSTRAINT policy_migration_verification_ru_source_rows_truncated_not_null NOT NULL,
    source_coverage_sufficient boolean CONSTRAINT policy_migration_verificati_source_coverage_sufficient_not_null NOT NULL,
    source_audit_ok boolean NOT NULL,
    source_audit_issue_count smallint CONSTRAINT policy_migration_verification_source_audit_issue_count_not_null NOT NULL,
    verifier_status_id character varying(120) NOT NULL,
    verifier_fingerprint character(64) CONSTRAINT policy_migration_verification_run_verifier_fingerprint_not_null NOT NULL,
    verifier_difference_count integer CONSTRAINT policy_migration_verificatio_verifier_difference_count_not_null NOT NULL,
    verifier_emitted_difference_count integer CONSTRAINT policy_migration_verificati_verifier_emitted_differenc_not_null NOT NULL,
    verifier_differences_truncated boolean CONSTRAINT policy_migration_verificati_verifier_differences_trunc_not_null NOT NULL,
    verifier_audit_ok boolean NOT NULL,
    verifier_audit_issue_count smallint CONSTRAINT policy_migration_verificati_verifier_audit_issue_count_not_null NOT NULL,
    coordinator_audit_ok boolean CONSTRAINT policy_migration_verification_run_coordinator_audit_ok_not_null NOT NULL,
    coordinator_audit_issue_count smallint CONSTRAINT policy_migration_verificati_coordinator_audit_issue_co_not_null NOT NULL,
    idempotency_key character varying(160) NOT NULL,
    evaluated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_migration_verification_runs_coordinator_audit_chk CHECK (((coordinator_audit_ok = true) AND (coordinator_audit_issue_count = 0))),
    CONSTRAINT policy_migration_verification_runs_idempotency_chk CHECK (((idempotency_key)::text ~ '^policy:migration_verification:[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_migration_verification_runs_policy_context_chk CHECK (((policy_id > 0) AND (intent_id > 0) AND (library_id > 0))),
    CONSTRAINT policy_migration_verification_runs_source_chk CHECK ((((source_id)::text = 'persisted_destination_library_final_outcomes'::text) AND ((source_media_type)::text = ANY (ARRAY[('movie'::character varying)::text, ('tv'::character varying)::text])) AND ((source_deterministic_order_id)::text = 'created_at_desc_id_desc'::text))),
    CONSTRAINT policy_migration_verification_runs_source_summary_chk CHECK (((source_maximum_classifications >= 1) AND (source_maximum_classifications <= 100) AND (source_rows_read >= 0) AND (source_rows_considered >= source_representative_classification_count) AND ((source_representative_classification_count >= 1) AND (source_representative_classification_count <= source_maximum_classifications)) AND (source_unusable_source_row_count >= 0) AND (source_coverage_sufficient = true) AND (source_audit_ok = true) AND (source_audit_issue_count = 0))),
    CONSTRAINT policy_migration_verification_runs_transition_fingerprint_chk CHECK ((acceptance_transition_fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_migration_verification_runs_verifier_chk CHECK ((((verifier_status_id)::text = ANY (ARRAY[('no_migration_differences'::character varying)::text, ('review_required'::character varying)::text, ('blocked_by_migration_risk'::character varying)::text])) AND (verifier_fingerprint ~ '^[a-f0-9]{64}$'::text) AND (verifier_difference_count >= 0) AND ((verifier_emitted_difference_count >= 0) AND (verifier_emitted_difference_count <= verifier_difference_count)) AND (verifier_audit_ok = true) AND (verifier_audit_issue_count = 0))),
    CONSTRAINT policy_migration_verification_runs_version_chk CHECK ((run_version = 1))
);


--
-- Name: policy_migration_verification_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_migration_verification_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_migration_verification_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_migration_verification_runs_id_seq OWNED BY public.policy_migration_verification_runs.id;


--
-- Name: policy_native_intent_change_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_change_receipts (
    id bigint NOT NULL,
    receipt_version smallint DEFAULT 1 NOT NULL,
    policy_id integer NOT NULL,
    actor_id integer NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    command_fingerprint character(64) CONSTRAINT policy_native_intent_change_receip_command_fingerprint_not_null NOT NULL,
    source_intent_version integer CONSTRAINT policy_native_intent_change_rece_source_intent_version_not_null NOT NULL,
    target_intent_id bigint NOT NULL,
    target_intent_version integer CONSTRAINT policy_native_intent_change_rece_target_intent_version_not_null NOT NULL,
    migration_event_id bigint CONSTRAINT policy_native_intent_change_receipt_migration_event_id_not_null NOT NULL,
    applied_command_ids jsonb CONSTRAINT policy_native_intent_change_receip_applied_command_ids_not_null NOT NULL,
    result_status_id character varying(32) DEFAULT 'applied'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_native_intent_change_receipts_actor_chk CHECK ((actor_id > 0)),
    CONSTRAINT policy_native_intent_change_receipts_command_shape_chk CHECK (((jsonb_typeof(applied_command_ids) = 'array'::text) AND ((jsonb_array_length(applied_command_ids) >= 1) AND (jsonb_array_length(applied_command_ids) <= 6)))),
    CONSTRAINT policy_native_intent_change_receipts_fingerprint_shape_chk CHECK ((command_fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_native_intent_change_receipts_idempotency_shape_chk CHECK (((idempotency_key)::text ~ '^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$'::text)),
    CONSTRAINT policy_native_intent_change_receipts_result_status_chk CHECK (((result_status_id)::text = 'applied'::text)),
    CONSTRAINT policy_native_intent_change_receipts_version_chk CHECK ((receipt_version = 1)),
    CONSTRAINT policy_native_intent_change_receipts_version_order_chk CHECK (((source_intent_version > 0) AND (target_intent_version > source_intent_version)))
);


--
-- Name: policy_native_intent_change_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_native_intent_change_receipts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_native_intent_change_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_native_intent_change_receipts_id_seq OWNED BY public.policy_native_intent_change_receipts.id;


--
-- Name: policy_native_intent_reconciliation_alert_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_reconciliation_alert_states (
    alert_type_id character varying(80) CONSTRAINT policy_native_intent_reconciliation_aler_alert_type_id_not_null NOT NULL,
    alert_state character varying(40) CONSTRAINT policy_native_intent_reconciliation_alert__alert_state_not_null NOT NULL,
    first_detected_at timestamp with time zone CONSTRAINT policy_native_intent_reconciliation__first_detected_at_not_null NOT NULL,
    last_detected_at timestamp with time zone CONSTRAINT policy_native_intent_reconciliation_a_last_detected_at_not_null NOT NULL,
    last_notified_at timestamp with time zone,
    last_resolved_at timestamp with time zone,
    occurrence_count integer DEFAULT 0 CONSTRAINT policy_native_intent_reconciliation_a_occurrence_count_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_native_intent_reconciliation_alert_s_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT policy_native_intent_reconciliation_alert_s_updated_at_not_null NOT NULL,
    CONSTRAINT policy_native_intent_reconciliation_alert_occurrence_count_chk CHECK ((occurrence_count >= 0)),
    CONSTRAINT policy_native_intent_reconciliation_alert_resolution_shape_chk CHECK (((((alert_state)::text = 'firing'::text) AND (last_resolved_at IS NULL)) OR (((alert_state)::text = 'resolved'::text) AND (last_resolved_at IS NOT NULL)))),
    CONSTRAINT policy_native_intent_reconciliation_alert_state_chk CHECK (((alert_state)::text = ANY (ARRAY[('firing'::character varying)::text, ('resolved'::character varying)::text]))),
    CONSTRAINT policy_native_intent_reconciliation_alert_time_order_chk CHECK (((last_detected_at >= first_detected_at) AND ((last_notified_at IS NULL) OR (last_notified_at >= first_detected_at)) AND ((last_resolved_at IS NULL) OR (last_resolved_at >= first_detected_at)))),
    CONSTRAINT policy_native_intent_reconciliation_alert_type_chk CHECK (((alert_type_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text))
);


--
-- Name: policy_native_intent_reconciliation_control_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_reconciliation_control_events (
    id bigint NOT NULL,
    event_type character varying(50) CONSTRAINT policy_native_intent_reconciliation_control_event_type_not_null NOT NULL,
    reason_id character varying(80) CONSTRAINT policy_native_intent_reconciliation_control__reason_id_not_null NOT NULL,
    failure_category character varying(80),
    actor_type character varying(24) CONSTRAINT policy_native_intent_reconciliation_control_actor_type_not_null NOT NULL,
    actor_id integer,
    occurred_at timestamp with time zone DEFAULT now() CONSTRAINT policy_native_intent_reconciliation_contro_occurred_at_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_native_intent_reconciliation_control_created_at_not_null NOT NULL,
    CONSTRAINT policy_native_intent_reconciliation_control_events_actor_shape_ CHECK (((((actor_type)::text = 'system'::text) AND (actor_id IS NULL)) OR (((actor_type)::text = 'operator'::text) AND (actor_id IS NOT NULL) AND (actor_id > 0)))),
    CONSTRAINT policy_native_intent_reconciliation_control_events_actor_type_c CHECK (((actor_type)::text = ANY (ARRAY[('system'::character varying)::text, ('operator'::character varying)::text]))),
    CONSTRAINT policy_native_intent_reconciliation_control_events_failure_cate CHECK (((failure_category IS NULL) OR ((failure_category)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text))),
    CONSTRAINT policy_native_intent_reconciliation_control_events_reason_chk CHECK (((reason_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_control_events_type_chk CHECK (((event_type)::text = ANY (ARRAY[('automation_disabled'::character varying)::text, ('automation_enabled'::character varying)::text, ('circuit_opened'::character varying)::text, ('circuit_recovered'::character varying)::text, ('circuit_reset'::character varying)::text])))
);


--
-- Name: policy_native_intent_reconciliation_control_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_native_intent_reconciliation_control_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_native_intent_reconciliation_control_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_native_intent_reconciliation_control_events_id_seq OWNED BY public.policy_native_intent_reconciliation_control_events.id;


--
-- Name: policy_native_intent_reconciliation_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_reconciliation_controls (
    control_id smallint DEFAULT 1 CONSTRAINT policy_native_intent_reconciliation_control_control_id_not_null NOT NULL,
    automation_enabled boolean DEFAULT true CONSTRAINT policy_native_intent_reconciliation_automation_enabled_not_null NOT NULL,
    circuit_state character varying(32) DEFAULT 'closed'::character varying CONSTRAINT policy_native_intent_reconciliation_cont_circuit_state_not_null NOT NULL,
    recovery_requirement character varying(40) DEFAULT 'none'::character varying CONSTRAINT policy_native_intent_reconciliati_recovery_requirement_not_null NOT NULL,
    failure_count smallint DEFAULT 0 CONSTRAINT policy_native_intent_reconciliation_cont_failure_count_not_null NOT NULL,
    failure_window_started_at timestamp with time zone,
    last_failure_category character varying(80),
    opened_at timestamp with time zone,
    recovery_probe_started_at timestamp with time zone,
    recovered_at timestamp with time zone,
    manual_disabled_at timestamp with time zone,
    manual_disabled_reason_id character varying(80),
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT policy_native_intent_reconciliation_control_updated_at_not_null NOT NULL,
    CONSTRAINT policy_native_intent_reconciliation_controls_circuit_shape_chk CHECK (((((circuit_state)::text = 'closed'::text) AND ((recovery_requirement)::text = 'none'::text) AND (opened_at IS NULL) AND (recovery_probe_started_at IS NULL)) OR (((circuit_state)::text = 'open'::text) AND ((recovery_requirement)::text = ANY (ARRAY[('healthy_evaluation'::character varying)::text, ('admin_reset'::character varying)::text])) AND (opened_at IS NOT NULL) AND (recovery_probe_started_at IS NULL)) OR (((circuit_state)::text = 'half_open'::text) AND ((recovery_requirement)::text = 'healthy_evaluation'::text) AND (opened_at IS NOT NULL) AND (recovery_probe_started_at IS NOT NULL)))),
    CONSTRAINT policy_native_intent_reconciliation_controls_disabled_reason_ch CHECK (((manual_disabled_reason_id IS NULL) OR ((manual_disabled_reason_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text))),
    CONSTRAINT policy_native_intent_reconciliation_controls_disabled_shape_chk CHECK ((((automation_enabled = true) AND (manual_disabled_at IS NULL) AND (manual_disabled_reason_id IS NULL)) OR ((automation_enabled = false) AND (manual_disabled_at IS NOT NULL) AND (manual_disabled_reason_id IS NOT NULL)))),
    CONSTRAINT policy_native_intent_reconciliation_controls_failure_category_c CHECK (((last_failure_category IS NULL) OR ((last_failure_category)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text))),
    CONSTRAINT policy_native_intent_reconciliation_controls_failure_count_chk CHECK (((failure_count >= 0) AND (failure_count <= 3))),
    CONSTRAINT policy_native_intent_reconciliation_controls_id_chk CHECK ((control_id = 1)),
    CONSTRAINT policy_native_intent_reconciliation_controls_recovery_chk CHECK (((recovery_requirement)::text = ANY (ARRAY[('none'::character varying)::text, ('healthy_evaluation'::character varying)::text, ('admin_reset'::character varying)::text]))),
    CONSTRAINT policy_native_intent_reconciliation_controls_state_chk CHECK (((circuit_state)::text = ANY (ARRAY[('closed'::character varying)::text, ('open'::character varying)::text, ('half_open'::character varying)::text])))
);


--
-- Name: policy_native_intent_reconciliation_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_reconciliation_holds (
    policy_id integer NOT NULL,
    source_event_id bigint CONSTRAINT policy_native_intent_reconciliation_ho_source_event_id_not_null NOT NULL,
    hold_state character varying(32) DEFAULT 'active'::character varying NOT NULL,
    reason_id character varying(80) DEFAULT 'rollback_applied'::character varying NOT NULL,
    held_at timestamp with time zone DEFAULT now() NOT NULL,
    released_at timestamp with time zone,
    release_reason_id character varying(80),
    released_event_id bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_native_intent_reconciliation_holds_reason_chk CHECK (((reason_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_holds_release_after_hold_ch CHECK (((released_at IS NULL) OR (released_at >= held_at))),
    CONSTRAINT policy_native_intent_reconciliation_holds_release_reason_chk CHECK (((release_reason_id IS NULL) OR ((release_reason_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text))),
    CONSTRAINT policy_native_intent_reconciliation_holds_release_shape_chk CHECK (((((hold_state)::text = 'active'::text) AND (released_at IS NULL) AND (release_reason_id IS NULL) AND (released_event_id IS NULL)) OR (((hold_state)::text = 'released'::text) AND (released_at IS NOT NULL) AND (release_reason_id IS NOT NULL) AND (released_event_id IS NOT NULL)))),
    CONSTRAINT policy_native_intent_reconciliation_holds_state_chk CHECK (((hold_state)::text = ANY (ARRAY[('active'::character varying)::text, ('released'::character varying)::text])))
);


--
-- Name: policy_native_intent_reconciliation_outcomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_reconciliation_outcomes (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    policy_id integer NOT NULL,
    candidate_fingerprint character varying(71) CONSTRAINT policy_native_intent_reconciliat_candidate_fingerprint_not_null NOT NULL,
    candidate_status_id character varying(80) CONSTRAINT policy_native_intent_reconciliatio_candidate_status_id_not_null NOT NULL,
    outcome_state character varying(40) CONSTRAINT policy_native_intent_reconciliation_outc_outcome_state_not_null NOT NULL,
    reason_id character varying(80) NOT NULL,
    retry_not_before timestamp with time zone,
    evaluated_at timestamp with time zone CONSTRAINT policy_native_intent_reconciliation_outco_evaluated_at_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_native_intent_reconciliation_outcome_created_at_not_null NOT NULL,
    CONSTRAINT policy_native_intent_reconciliation_outcomes_candidate_status_c CHECK (((candidate_status_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_fingerprint_chk CHECK (((candidate_fingerprint)::text ~ '^sha256:[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_reason_id_chk CHECK (((reason_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_retry_after_evalua CHECK (((retry_not_before IS NULL) OR (retry_not_before >= evaluated_at))),
    CONSTRAINT policy_native_intent_reconciliation_outcomes_state_chk CHECK (((outcome_state)::text = ANY (ARRAY[('applied'::character varying)::text, ('already_native'::character varying)::text, ('deferred_retry'::character varying)::text, ('blocked_current_state'::character varying)::text, ('requires_maintenance'::character varying)::text, ('system_failure'::character varying)::text])))
);


--
-- Name: policy_native_intent_reconciliation_outcomes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_native_intent_reconciliation_outcomes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_native_intent_reconciliation_outcomes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_native_intent_reconciliation_outcomes_id_seq OWNED BY public.policy_native_intent_reconciliation_outcomes.id;


--
-- Name: policy_native_intent_reconciliation_restore_gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_reconciliation_restore_gates (
    gate_id smallint DEFAULT 1 CONSTRAINT policy_native_intent_reconciliation_restore_ga_gate_id_not_null NOT NULL,
    gate_state character varying(40) CONSTRAINT policy_native_intent_reconciliation_restore_gate_state_not_null NOT NULL,
    reason_id character varying(80) CONSTRAINT policy_native_intent_reconciliation_restore__reason_id_not_null NOT NULL,
    restore_token uuid,
    restore_started_at timestamp with time zone,
    restore_finished_at timestamp with time zone,
    verified_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT policy_native_intent_reconciliation_restore_updated_at_not_null NOT NULL,
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_finish_after_ CHECK (((restore_finished_at IS NULL) OR (restore_started_at IS NULL) OR (restore_finished_at >= restore_started_at))),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_id_chk CHECK ((gate_id = 1)),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_in_progress_s CHECK (((((gate_state)::text = 'restore_in_progress'::text) AND (restore_token IS NOT NULL) AND (restore_started_at IS NOT NULL) AND (restore_finished_at IS NULL) AND (verified_at IS NULL)) OR ((gate_state)::text <> 'restore_in_progress'::text))),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_reason_chk CHECK (((reason_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_state_chk CHECK (((gate_state)::text = ANY (ARRAY[('ready'::character varying)::text, ('restore_in_progress'::character varying)::text, ('requires_maintenance'::character varying)::text]))),
    CONSTRAINT policy_native_intent_reconciliation_restore_gates_verified_shap CHECK ((((gate_state)::text <> 'ready'::text) OR (restore_token IS NULL) OR ((restore_started_at IS NOT NULL) AND (restore_finished_at IS NOT NULL) AND (verified_at IS NOT NULL))))
);


--
-- Name: policy_native_intent_reconciliation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_reconciliation_runs (
    id bigint NOT NULL,
    run_key uuid NOT NULL,
    reconciler_version character varying(80) CONSTRAINT policy_native_intent_reconciliation_reconciler_version_not_null NOT NULL,
    run_state character varying(40) NOT NULL,
    source_status_id character varying(80) CONSTRAINT policy_native_intent_reconciliation_r_source_status_id_not_null NOT NULL,
    reason_id character varying(80) NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone NOT NULL,
    candidate_count integer DEFAULT 0 CONSTRAINT policy_native_intent_reconciliation_ru_candidate_count_not_null NOT NULL,
    converted_count integer DEFAULT 0 CONSTRAINT policy_native_intent_reconciliation_ru_converted_count_not_null NOT NULL,
    already_native_count integer DEFAULT 0 CONSTRAINT policy_native_intent_reconciliati_already_native_count_not_null NOT NULL,
    deferred_count integer DEFAULT 0 CONSTRAINT policy_native_intent_reconciliation_run_deferred_count_not_null NOT NULL,
    blocked_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    runtime_app_version character varying(80) DEFAULT 'unknown'::character varying CONSTRAINT policy_native_intent_reconciliatio_runtime_app_version_not_null NOT NULL,
    runtime_build_revision character varying(64),
    CONSTRAINT policy_native_intent_reconcile_runs_app_version_chk CHECK (((runtime_app_version)::text ~ '^[0-9A-Za-z][0-9A-Za-z._+-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconcile_runs_build_revision_chk CHECK (((runtime_build_revision IS NULL) OR ((runtime_build_revision)::text ~ '^[a-f0-9]{7,64}$'::text))),
    CONSTRAINT policy_native_intent_reconciliation_runs_count_total_chk CHECK ((candidate_count = ((((converted_count + already_native_count) + deferred_count) + blocked_count) + failed_count))),
    CONSTRAINT policy_native_intent_reconciliation_runs_counts_chk CHECK (((candidate_count >= 0) AND (converted_count >= 0) AND (already_native_count >= 0) AND (deferred_count >= 0) AND (blocked_count >= 0) AND (failed_count >= 0))),
    CONSTRAINT policy_native_intent_reconciliation_runs_finished_after_started CHECK ((finished_at >= started_at)),
    CONSTRAINT policy_native_intent_reconciliation_runs_reason_id_chk CHECK (((reason_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_runs_state_chk CHECK (((run_state)::text = ANY (ARRAY[('applied'::character varying)::text, ('evaluated'::character varying)::text, ('deferred'::character varying)::text, ('failed'::character varying)::text]))),
    CONSTRAINT policy_native_intent_reconciliation_runs_status_id_chk CHECK (((source_status_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text))
);


--
-- Name: policy_native_intent_reconciliation_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_native_intent_reconciliation_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_native_intent_reconciliation_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_native_intent_reconciliation_runs_id_seq OWNED BY public.policy_native_intent_reconciliation_runs.id;


--
-- Name: policy_native_intent_reconciliation_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_intent_reconciliation_states (
    policy_id integer NOT NULL,
    candidate_fingerprint character varying(71) CONSTRAINT policy_native_intent_reconcilia_candidate_fingerprint_not_null1 NOT NULL,
    candidate_status_id character varying(80) CONSTRAINT policy_native_intent_reconciliati_candidate_status_id_not_null1 NOT NULL,
    outcome_state character varying(40) CONSTRAINT policy_native_intent_reconciliation_stat_outcome_state_not_null NOT NULL,
    reason_id character varying(80) NOT NULL,
    retry_not_before timestamp with time zone,
    failure_count integer DEFAULT 0 CONSTRAINT policy_native_intent_reconciliation_stat_failure_count_not_null NOT NULL,
    evaluated_at timestamp with time zone CONSTRAINT policy_native_intent_reconciliation_state_evaluated_at_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_native_intent_reconciliation_states_candidate_status_chk CHECK (((candidate_status_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_states_failure_count_chk CHECK (((failure_count >= 0) AND (failure_count <= 3))),
    CONSTRAINT policy_native_intent_reconciliation_states_fingerprint_chk CHECK (((candidate_fingerprint)::text ~ '^sha256:[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_states_outcome_chk CHECK (((outcome_state)::text = ANY (ARRAY[('deferred_retry'::character varying)::text, ('blocked_current_state'::character varying)::text, ('requires_maintenance'::character varying)::text, ('system_failure'::character varying)::text]))),
    CONSTRAINT policy_native_intent_reconciliation_states_reason_chk CHECK (((reason_id)::text ~ '^[a-z0-9][a-z0-9_:-]{0,79}$'::text)),
    CONSTRAINT policy_native_intent_reconciliation_states_retry_after_eval_chk CHECK (((retry_not_before IS NULL) OR (retry_not_before >= evaluated_at))),
    CONSTRAINT policy_native_intent_reconciliation_states_retry_state_chk CHECK (((((outcome_state)::text = ANY (ARRAY[('deferred_retry'::character varying)::text, ('system_failure'::character varying)::text])) AND (retry_not_before IS NOT NULL)) OR (((outcome_state)::text = ANY (ARRAY[('blocked_current_state'::character varying)::text, ('requires_maintenance'::character varying)::text])) AND (retry_not_before IS NULL))))
);


--
-- Name: policy_native_profile_refresh_circuits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_native_profile_refresh_circuits (
    library_id bigint NOT NULL,
    source_event_id character varying(160) NOT NULL,
    circuit_state character varying(16) DEFAULT 'closed'::character varying NOT NULL,
    consecutive_failure_count smallint DEFAULT 0 CONSTRAINT policy_native_profile_refres_consecutive_failure_count_not_null NOT NULL,
    last_terminal_outbox_id bigint,
    last_failure_code character varying(80),
    opened_at timestamp with time zone,
    next_probe_at timestamp with time zone,
    probe_outbox_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_native_profile_refresh_circuits_empty_state_chk CHECK ((((consecutive_failure_count = 0) AND (last_terminal_outbox_id IS NULL) AND (last_failure_code IS NULL)) OR ((consecutive_failure_count > 0) AND (last_terminal_outbox_id IS NOT NULL) AND (last_failure_code IS NOT NULL)))),
    CONSTRAINT policy_native_profile_refresh_circuits_failure_code_chk CHECK (((last_failure_code IS NULL) OR ((last_failure_code)::text = ANY (ARRAY[('profile_refresh_configuration_invalid'::character varying)::text, ('profile_refresh_execution_failed'::character varying)::text, ('profile_refresh_lease_expired'::character varying)::text, ('profile_refresh_transient_dependency_failed'::character varying)::text, ('profile_refresh_unknown_failed'::character varying)::text])))),
    CONSTRAINT policy_native_profile_refresh_circuits_failure_count_chk CHECK (((consecutive_failure_count >= 0) AND (consecutive_failure_count <= 3))),
    CONSTRAINT policy_native_profile_refresh_circuits_library_chk CHECK ((library_id > 0)),
    CONSTRAINT policy_native_profile_refresh_circuits_lifecycle_chk CHECK (((((circuit_state)::text = 'closed'::text) AND (opened_at IS NULL) AND (next_probe_at IS NULL) AND (probe_outbox_id IS NULL)) OR (((circuit_state)::text = 'open'::text) AND (opened_at IS NOT NULL) AND (next_probe_at IS NOT NULL) AND (probe_outbox_id IS NULL)) OR (((circuit_state)::text = 'half_open'::text) AND (opened_at IS NOT NULL) AND (next_probe_at IS NULL) AND (probe_outbox_id IS NOT NULL)))),
    CONSTRAINT policy_native_profile_refresh_circuits_source_event_chk CHECK (((char_length(btrim((source_event_id)::text)) >= 1) AND (char_length(btrim((source_event_id)::text)) <= 160) AND (POSITION((':retry:'::text) IN (source_event_id)) = 0))),
    CONSTRAINT policy_native_profile_refresh_circuits_state_chk CHECK (((circuit_state)::text = ANY (ARRAY[('closed'::character varying)::text, ('open'::character varying)::text, ('half_open'::character varying)::text])))
);


--
-- Name: policy_observed_evidence_provenance_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_observed_evidence_provenance_snapshots (
    id bigint NOT NULL,
    establishment_id bigint CONSTRAINT policy_observed_evidence_provenance_s_establishment_id_not_null NOT NULL,
    policy_id integer CONSTRAINT policy_observed_evidence_provenance_snapshot_policy_id_not_null NOT NULL,
    library_id integer CONSTRAINT policy_observed_evidence_provenance_snapsho_library_id_not_null NOT NULL,
    intent_id bigint CONSTRAINT policy_observed_evidence_provenance_snapshot_intent_id_not_null NOT NULL,
    snapshot_version integer DEFAULT 1 CONSTRAINT policy_observed_evidence_provenance_s_snapshot_version_not_null NOT NULL,
    source_id character varying(64) CONSTRAINT policy_observed_evidence_provenance_snapshot_source_id_not_null NOT NULL,
    capture_state character varying(32) CONSTRAINT policy_observed_evidence_provenance_snap_capture_state_not_null NOT NULL,
    capture_reason_id character varying(64) CONSTRAINT policy_observed_evidence_provenance__capture_reason_id_not_null NOT NULL,
    profile_freshness_state character varying(32) CONSTRAINT policy_observed_evidence_prove_profile_freshness_state_not_null NOT NULL,
    source_profile_generated_at timestamp with time zone,
    source_profile_updated_at timestamp with time zone,
    evidence_fingerprint character(64) CONSTRAINT policy_observed_evidence_provenan_evidence_fingerprint_not_null NOT NULL,
    snapshot_payload jsonb DEFAULT '{}'::jsonb CONSTRAINT policy_observed_evidence_provenance_s_snapshot_payload_not_null NOT NULL,
    payload_redacted boolean DEFAULT false CONSTRAINT policy_observed_evidence_provenance_s_payload_redacted_not_null NOT NULL,
    redacted_at timestamp with time zone,
    expires_at timestamp with time zone CONSTRAINT policy_observed_evidence_provenance_snapsho_expires_at_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_observed_evidence_provenance_snapsho_created_at_not_null NOT NULL,
    CONSTRAINT policy_observed_evidence_provenance_capture_pair_chk CHECK (((((capture_state)::text = 'captured'::text) AND ((capture_reason_id)::text = 'stored_profile_captured'::text)) OR (((capture_state)::text = 'profile_unavailable'::text) AND ((capture_reason_id)::text = 'stored_profile_missing'::text)) OR (((capture_state)::text = 'profile_rejected'::text) AND ((capture_reason_id)::text = 'stored_profile_rejected'::text)))),
    CONSTRAINT policy_observed_evidence_provenance_capture_reason_chk CHECK (((capture_reason_id)::text = ANY (ARRAY[('stored_profile_captured'::character varying)::text, ('stored_profile_missing'::character varying)::text, ('stored_profile_rejected'::character varying)::text]))),
    CONSTRAINT policy_observed_evidence_provenance_capture_state_chk CHECK (((capture_state)::text = ANY (ARRAY[('captured'::character varying)::text, ('profile_unavailable'::character varying)::text, ('profile_rejected'::character varying)::text]))),
    CONSTRAINT policy_observed_evidence_provenance_fingerprint_shape_chk CHECK ((evidence_fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_observed_evidence_provenance_freshness_chk CHECK (((profile_freshness_state)::text = ANY (ARRAY[('current'::character varying)::text, ('stale'::character varying)::text, ('unavailable'::character varying)::text]))),
    CONSTRAINT policy_observed_evidence_provenance_payload_shape_chk CHECK (((jsonb_typeof(snapshot_payload) = 'object'::text) AND (octet_length((snapshot_payload)::text) <= 16384))),
    CONSTRAINT policy_observed_evidence_provenance_redaction_shape_chk CHECK ((((payload_redacted = false) AND (redacted_at IS NULL)) OR ((payload_redacted = true) AND (redacted_at IS NOT NULL)))),
    CONSTRAINT policy_observed_evidence_provenance_snapshot_version_chk CHECK ((snapshot_version = 1)),
    CONSTRAINT policy_observed_evidence_provenance_source_chk CHECK (((source_id)::text = 'stored_library_profile'::text))
);


--
-- Name: policy_observed_evidence_provenance_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_observed_evidence_provenance_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_observed_evidence_provenance_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_observed_evidence_provenance_snapshots_id_seq OWNED BY public.policy_observed_evidence_provenance_snapshots.id;


--
-- Name: policy_overlap_metrics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_overlap_metrics_snapshots (
    id bigint NOT NULL,
    session_id uuid NOT NULL,
    session_started_at timestamp with time zone NOT NULL,
    snapshot_reason character varying(64) DEFAULT 'periodic'::character varying NOT NULL,
    decision_delta integer DEFAULT 0 NOT NULL,
    total_decisions integer DEFAULT 0 NOT NULL,
    weak_evidence_primary_count integer DEFAULT 0 CONSTRAINT policy_overlap_metrics_snap_weak_evidence_primary_coun_not_null NOT NULL,
    weak_evidence_overlap_count integer DEFAULT 0 CONSTRAINT policy_overlap_metrics_snap_weak_evidence_overlap_coun_not_null NOT NULL,
    manual_review_recommended_count integer DEFAULT 0 CONSTRAINT policy_overlap_metrics_snap_manual_review_recommended__not_null NOT NULL,
    actions jsonb DEFAULT '{}'::jsonb NOT NULL,
    primary_viability_counts jsonb DEFAULT '{}'::jsonb CONSTRAINT policy_overlap_metrics_snapsh_primary_viability_counts_not_null NOT NULL,
    top_overlap_pairs jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE policy_overlap_metrics_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_overlap_metrics_snapshots IS 'Periodic persisted snapshots of aggregate policy overlap telemetry, including weak-evidence routing signals.';


--
-- Name: COLUMN policy_overlap_metrics_snapshots.session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_overlap_metrics_snapshots.session_id IS 'Runtime collector session identifier so cumulative counters can be segmented across restarts.';


--
-- Name: COLUMN policy_overlap_metrics_snapshots.snapshot_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_overlap_metrics_snapshots.snapshot_reason IS 'Reason the snapshot was persisted, such as decision_recorded or manual_flush.';


--
-- Name: COLUMN policy_overlap_metrics_snapshots.decision_delta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_overlap_metrics_snapshots.decision_delta IS 'Number of new policy decisions observed since the previous persisted snapshot for this process.';


--
-- Name: policy_overlap_metrics_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_overlap_metrics_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_overlap_metrics_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_overlap_metrics_snapshots_id_seq OWNED BY public.policy_overlap_metrics_snapshots.id;


--
-- Name: policy_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_overrides (
    id integer NOT NULL,
    policy_id integer,
    signal_type character varying(50) NOT NULL,
    override_config jsonb NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE policy_overrides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_overrides IS 'Advanced per-policy signal overrides for fine-tuning classification behavior';


--
-- Name: policy_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_overrides_id_seq OWNED BY public.policy_overrides.id;


--
-- Name: policy_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_presets (
    id integer NOT NULL,
    policy_id integer,
    preset_id integer,
    weight real DEFAULT 1.0,
    created_at timestamp with time zone DEFAULT now(),
    custom_signals jsonb,
    sort_order integer DEFAULT 0
);


--
-- Name: TABLE policy_presets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_presets IS 'Links policies to content presets with optional weight adjustments';


--
-- Name: COLUMN policy_presets.custom_signals; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_presets.custom_signals IS 'Per-policy customization of preset signals (overrides preset defaults)';


--
-- Name: policy_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_presets_id_seq OWNED BY public.policy_presets.id;


--
-- Name: policy_profile_refresh_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_profile_refresh_outbox (
    id bigint NOT NULL,
    outbox_version smallint DEFAULT 1 NOT NULL,
    source_id character varying(80) NOT NULL,
    source_event_id character varying(160) NOT NULL,
    classification_id bigint,
    library_id bigint NOT NULL,
    learning_operation_id character varying(80),
    learning_tier_id character varying(40),
    candidate_key character varying(160),
    refresh_reason_id character varying(80) NOT NULL,
    source_system character varying(80) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processing_state character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    attempt_count smallint DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    claim_token uuid,
    claimed_at timestamp with time zone,
    lease_expires_at timestamp with time zone,
    completed_at timestamp with time zone,
    failure_code character varying(80),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    request_type character varying(40) DEFAULT 'learning_evidence'::character varying NOT NULL,
    inventory_revision bigint,
    CONSTRAINT policy_profile_refresh_outbox_attempt_count_chk CHECK (((attempt_count >= 0) AND (attempt_count <= 3))),
    CONSTRAINT policy_profile_refresh_outbox_failure_code_chk CHECK (((failure_code IS NULL) OR ((char_length(btrim((failure_code)::text)) >= 1) AND (char_length(btrim((failure_code)::text)) <= 80)))),
    CONSTRAINT policy_profile_refresh_outbox_identifiers_chk CHECK (((library_id > 0) AND ((classification_id IS NULL) OR (classification_id > 0)))),
    CONSTRAINT policy_profile_refresh_outbox_processing_state_chk CHECK (((processing_state)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text]))),
    CONSTRAINT policy_profile_refresh_outbox_request_shape_chk CHECK (((((request_type)::text = 'learning_evidence'::text) AND (inventory_revision IS NULL) AND (classification_id IS NOT NULL) AND ((learning_operation_id)::text = ANY (ARRAY[('write_compatibility_evidence'::character varying)::text, ('write_identity_evidence'::character varying)::text])) AND ((learning_tier_id)::text = ANY (ARRAY[('compatibility_evidence'::character varying)::text, ('identity_evidence'::character varying)::text])) AND ((((learning_operation_id)::text = 'write_compatibility_evidence'::text) AND ((learning_tier_id)::text = 'compatibility_evidence'::text)) OR (((learning_operation_id)::text = 'write_identity_evidence'::text) AND ((learning_tier_id)::text = 'identity_evidence'::text))) AND ((char_length(btrim((candidate_key)::text)) >= 3) AND (char_length(btrim((candidate_key)::text)) <= 160)) AND ((refresh_reason_id)::text = 'profile_refresh_required'::text) AND ((source_system)::text = 'policy_authorized_profile_refresh'::text)) OR (((request_type)::text = 'native_readiness'::text) AND (inventory_revision IS NULL) AND (classification_id IS NULL) AND (learning_operation_id IS NULL) AND (learning_tier_id IS NULL) AND (candidate_key IS NULL) AND ((source_id)::text = 'native_policy_profile_readiness'::text) AND ((refresh_reason_id)::text = 'stale_library_profile'::text) AND ((source_system)::text = 'policy_native_readiness_profile_refresh'::text)) OR (((request_type)::text = 'inventory_change'::text) AND (inventory_revision IS NOT NULL) AND (inventory_revision > 0) AND (classification_id IS NULL) AND (learning_operation_id IS NULL) AND (learning_tier_id IS NULL) AND (candidate_key IS NULL) AND ((source_id)::text = 'library_inventory_observation'::text) AND ((refresh_reason_id)::text = 'library_inventory_changed'::text) AND ((source_system)::text = 'library_inventory_profile_refresh'::text)))),
    CONSTRAINT policy_profile_refresh_outbox_request_type_chk CHECK (((request_type)::text = ANY (ARRAY[('learning_evidence'::character varying)::text, ('native_readiness'::character varying)::text, ('inventory_change'::character varying)::text]))),
    CONSTRAINT policy_profile_refresh_outbox_source_event_chk CHECK (((char_length(btrim((source_id)::text)) >= 1) AND (char_length(btrim((source_id)::text)) <= 80) AND ((char_length(btrim((source_event_id)::text)) >= 1) AND (char_length(btrim((source_event_id)::text)) <= 160)))),
    CONSTRAINT policy_profile_refresh_outbox_version_chk CHECK ((outbox_version = 1)),
    CONSTRAINT policy_profile_refresh_outbox_worker_lifecycle_chk CHECK (((((processing_state)::text = 'pending'::text) AND (claim_token IS NULL) AND (claimed_at IS NULL) AND (lease_expires_at IS NULL) AND (completed_at IS NULL)) OR (((processing_state)::text = 'processing'::text) AND (claim_token IS NOT NULL) AND (claimed_at IS NOT NULL) AND (lease_expires_at IS NOT NULL) AND (completed_at IS NULL)) OR (((processing_state)::text = 'completed'::text) AND (claim_token IS NULL) AND (claimed_at IS NULL) AND (lease_expires_at IS NULL) AND (completed_at IS NOT NULL)) OR (((processing_state)::text = 'failed'::text) AND (claim_token IS NULL) AND (claimed_at IS NULL) AND (lease_expires_at IS NULL) AND (completed_at IS NULL))))
);


--
-- Name: policy_profile_refresh_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_profile_refresh_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_profile_refresh_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_profile_refresh_outbox_id_seq OWNED BY public.policy_profile_refresh_outbox.id;


--
-- Name: policy_runtime_historic_route_safety_refresh_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_runtime_historic_route_safety_refresh_receipt_items (
    receipt_id uuid CONSTRAINT policy_runtime_historic_route_safety_refre_receipt_id_not_null1 NOT NULL,
    classification_id bigint CONSTRAINT policy_runtime_historic_route_safety_classification_id_not_null NOT NULL,
    execution_status character varying(16) DEFAULT 'requested'::character varying CONSTRAINT policy_runtime_historic_route_safety__execution_status_not_null NOT NULL,
    reason_id character varying(120),
    retry_task_id bigint,
    queued_at timestamp with time zone,
    finalized_at timestamp with time zone,
    CONSTRAINT policy_runtime_historic_route_safety_refresh_receipt_items_queu CHECK (((((execution_status)::text = 'queued'::text) AND (retry_task_id IS NOT NULL) AND (queued_at IS NOT NULL)) OR (((execution_status)::text <> 'queued'::text) AND (retry_task_id IS NULL) AND (queued_at IS NULL)))),
    CONSTRAINT policy_runtime_historic_route_safety_refresh_receipt_items_stat CHECK (((execution_status)::text = ANY (ARRAY[('requested'::character varying)::text, ('queued'::character varying)::text, ('skipped'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: policy_runtime_historic_route_safety_refresh_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_runtime_historic_route_safety_refresh_receipts (
    receipt_id uuid CONSTRAINT policy_runtime_historic_route_safety_refres_receipt_id_not_null NOT NULL,
    actor_id character varying(160) CONSTRAINT policy_runtime_historic_route_safety_refresh__actor_id_not_null NOT NULL,
    requested_record_count smallint CONSTRAINT policy_runtime_historic_route_s_requested_record_count_not_null NOT NULL,
    receipt_version character varying(120) CONSTRAINT policy_runtime_historic_route_safety_r_receipt_version_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_runtime_historic_route_safety_refres_created_at_not_null NOT NULL,
    execution_finalized_at timestamp with time zone,
    CONSTRAINT policy_runtime_historic_route_safety_refresh_receipts_requested CHECK (((requested_record_count >= 1) AND (requested_record_count <= 50)))
);


--
-- Name: policy_runtime_pending_question_cleanup_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_runtime_pending_question_cleanup_audits (
    id bigint NOT NULL,
    audit_version smallint DEFAULT 1 CONSTRAINT policy_runtime_pending_question_cleanup__audit_version_not_null NOT NULL,
    classification_id bigint CONSTRAINT policy_runtime_pending_question_clea_classification_id_not_null NOT NULL,
    action_id character varying(80) CONSTRAINT policy_runtime_pending_question_cleanup_audi_action_id_not_null NOT NULL,
    reason_ids jsonb CONSTRAINT policy_runtime_pending_question_cleanup_aud_reason_ids_not_null NOT NULL,
    source_version character varying(120) CONSTRAINT policy_runtime_pending_question_cleanup_source_version_not_null NOT NULL,
    actor_id character varying(160) CONSTRAINT policy_runtime_pending_question_cleanup_audit_actor_id_not_null NOT NULL,
    result_status_id character varying(80) CONSTRAINT policy_runtime_pending_question_clean_result_status_id_not_null NOT NULL,
    replay_receipt uuid CONSTRAINT policy_runtime_pending_question_cleanup_replay_receipt_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT policy_runtime_pending_question_cleanup_aud_created_at_not_null NOT NULL,
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_action_chk CHECK (((action_id)::text = ANY (ARRAY[('none'::character varying)::text, ('regenerate_under_current_contract'::character varying)::text, ('mark_stale_require_retry'::character varying)::text, ('resolve_outcome_only'::character varying)::text, ('block_learning_permanently'::character varying)::text]))),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_actor_chk CHECK (((actor_id)::text ~ '^[A-Za-z0-9:_-]{1,160}$'::text)),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_classification_c CHECK ((classification_id > 0)),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_reason_ids_chk CHECK (public.is_policy_runtime_pending_question_cleanup_reason_ids(reason_ids)),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_source_chk CHECK (((source_version)::text = 'policy.runtime_pending_question_cleanup.v1'::text)),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_status_chk CHECK (((result_status_id)::text = ANY (ARRAY[('unchanged'::character varying)::text, ('queued_fresh_runtime_evaluation'::character varying)::text, ('resolved_outcome_only'::character varying)::text]))),
    CONSTRAINT policy_runtime_pending_question_cleanup_audits_version_chk CHECK ((audit_version = 1))
);


--
-- Name: policy_runtime_pending_question_cleanup_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_runtime_pending_question_cleanup_audits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_runtime_pending_question_cleanup_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_runtime_pending_question_cleanup_audits_id_seq OWNED BY public.policy_runtime_pending_question_cleanup_audits.id;


--
-- Name: policy_tuning_cohorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_tuning_cohorts (
    fingerprint text NOT NULL,
    policy_id integer NOT NULL,
    manifest jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_tuning_cohorts_fingerprint_check CHECK ((fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT policy_tuning_cohorts_manifest_check CHECK (((jsonb_typeof(manifest) = 'object'::text) AND (octet_length((manifest)::text) <= 4194304)))
);


--
-- Name: policy_tuning_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_tuning_suggestions (
    id integer NOT NULL,
    policy_id integer,
    suggestion_type character varying(30) NOT NULL,
    suggestion_config jsonb NOT NULL,
    supporting_feedback_ids integer[],
    confidence real,
    impact_estimate character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_at timestamp with time zone,
    reviewed_by integer,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    applied_at timestamp with time zone,
    applied_by integer,
    before_accuracy real,
    cohort_fingerprint text,
    evidence_fingerprint text,
    superseded_at timestamp with time zone
);


--
-- Name: TABLE policy_tuning_suggestions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.policy_tuning_suggestions IS 'AI-generated suggestions for improving policy configuration based on feedback';


--
-- Name: COLUMN policy_tuning_suggestions.applied_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_tuning_suggestions.applied_at IS 'Timestamp when suggestion was applied';


--
-- Name: COLUMN policy_tuning_suggestions.applied_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_tuning_suggestions.applied_by IS 'User who applied the suggestion';


--
-- Name: COLUMN policy_tuning_suggestions.before_accuracy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.policy_tuning_suggestions.before_accuracy IS 'Policy accuracy before applying suggestion (for impact tracking)';


--
-- Name: policy_tuning_suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policy_tuning_suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policy_tuning_suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policy_tuning_suggestions_id_seq OWNED BY public.policy_tuning_suggestions.id;


--
-- Name: post_upgrade_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_upgrade_tasks (
    id integer NOT NULL,
    task_id character varying(100) NOT NULL,
    version character varying(20) NOT NULL,
    description text,
    executed_at timestamp without time zone DEFAULT now()
);


--
-- Name: post_upgrade_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.post_upgrade_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: post_upgrade_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.post_upgrade_tasks_id_seq OWNED BY public.post_upgrade_tasks.id;


--
-- Name: radarr_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.radarr_config (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    url character varying(500) NOT NULL,
    api_key character varying(500) NOT NULL,
    protocol character varying(10) DEFAULT 'http'::character varying,
    host character varying(255) DEFAULT 'localhost'::character varying,
    port integer DEFAULT 7878,
    base_path character varying(100) DEFAULT ''::character varying,
    verify_ssl boolean DEFAULT true,
    timeout integer DEFAULT 30,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    media_server_id integer,
    quality_profile_id integer,
    minimum_availability character varying(50) DEFAULT 'released'::character varying
);


--
-- Name: radarr_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.radarr_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: radarr_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.radarr_config_id_seq OWNED BY public.radarr_config.id;


--
-- Name: rag_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_metrics (
    id integer NOT NULL,
    operation character varying(50) NOT NULL,
    duration_ms integer NOT NULL,
    items_processed integer DEFAULT 1,
    success boolean DEFAULT true,
    error_type character varying(100),
    metadata jsonb,
    period_type character varying(20) DEFAULT 'hourly'::character varying,
    period_start timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE rag_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rag_metrics IS 'Performance metrics for RAG operations (search, embedding, pattern mining).';


--
-- Name: rag_health_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.rag_health_summary AS
 SELECT count(*) FILTER (WHERE (created_at >= (now() - '24:00:00'::interval))) AS operations_24h,
    count(*) FILTER (WHERE (created_at >= (now() - '01:00:00'::interval))) AS operations_1h,
    count(*) FILTER (WHERE ((success = true) AND (created_at >= (now() - '24:00:00'::interval)))) AS successful_24h,
    count(*) FILTER (WHERE ((success = false) AND (created_at >= (now() - '24:00:00'::interval)))) AS failed_24h,
    avg(duration_ms) FILTER (WHERE (created_at >= (now() - '24:00:00'::interval))) AS avg_duration_ms_24h,
    count(*) FILTER (WHERE (((operation)::text = 'semantic_search'::text) AND (created_at >= (now() - '24:00:00'::interval)))) AS semantic_searches_24h,
    count(*) FILTER (WHERE (((operation)::text = 'hybrid_search'::text) AND (created_at >= (now() - '24:00:00'::interval)))) AS hybrid_searches_24h,
    count(*) FILTER (WHERE (((operation)::text = 'embedding_generation'::text) AND (created_at >= (now() - '24:00:00'::interval)))) AS embeddings_generated_24h,
    count(*) FILTER (WHERE (((operation)::text = 'pattern_mining'::text) AND (created_at >= (now() - '24:00:00'::interval)))) AS pattern_mining_runs_24h
   FROM public.rag_metrics;


--
-- Name: VIEW rag_health_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.rag_health_summary IS 'Real-time health dashboard for RAG operations.';


--
-- Name: rag_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_logs (
    id integer NOT NULL,
    level character varying(20) NOT NULL,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rag_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rag_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rag_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rag_logs_id_seq OWNED BY public.rag_logs.id;


--
-- Name: rag_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rag_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rag_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rag_metrics_id_seq OWNED BY public.rag_metrics.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    revoked_at timestamp without time zone,
    revoked_by_ip inet,
    user_agent text,
    device_info jsonb,
    remember_me boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.refresh_tokens IS 'Refresh tokens for secure JWT session management';


--
-- Name: COLUMN refresh_tokens.token_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.token_hash IS 'Hashed refresh token (plaintext never stored)';


--
-- Name: COLUMN refresh_tokens.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.expires_at IS 'Token expiration timestamp';


--
-- Name: COLUMN refresh_tokens.revoked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.revoked_at IS 'When token was revoked (null if active)';


--
-- Name: COLUMN refresh_tokens.device_info; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.device_info IS 'Optional device metadata for user session management';


--
-- Name: COLUMN refresh_tokens.remember_me; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.remember_me IS 'Whether this session was created with Remember Me enabled (30-day cookie lifetime)';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: scheduled_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_tasks (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    task_type character varying(50) DEFAULT 'library_scan'::character varying NOT NULL,
    library_id integer,
    cron_expression character varying(100),
    interval_minutes integer,
    enabled boolean DEFAULT true,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    run_count integer DEFAULT 0,
    last_result text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE scheduled_tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scheduled_tasks IS 'Scheduled tasks for periodic operations like library scans';


--
-- Name: COLUMN scheduled_tasks.task_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scheduled_tasks.task_type IS 'Type of task: library_scan, full_rescan, etc.';


--
-- Name: COLUMN scheduled_tasks.cron_expression; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scheduled_tasks.cron_expression IS 'Cron expression for complex schedules (optional)';


--
-- Name: COLUMN scheduled_tasks.interval_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scheduled_tasks.interval_minutes IS 'Simple interval in minutes (alternative to cron)';


--
-- Name: scheduled_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scheduled_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scheduled_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scheduled_tasks_id_seq OWNED BY public.scheduled_tasks.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: sonarr_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sonarr_config (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    url character varying(500) NOT NULL,
    api_key character varying(500) NOT NULL,
    protocol character varying(10) DEFAULT 'http'::character varying,
    host character varying(255) DEFAULT 'localhost'::character varying,
    port integer DEFAULT 8989,
    base_path character varying(100) DEFAULT ''::character varying,
    verify_ssl boolean DEFAULT true,
    timeout integer DEFAULT 30,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    media_server_id integer,
    quality_profile_id integer,
    monitor character varying(50) DEFAULT 'all'::character varying,
    series_type character varying(50) DEFAULT 'standard'::character varying
);


--
-- Name: sonarr_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sonarr_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sonarr_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sonarr_config_id_seq OWNED BY public.sonarr_config.id;


--
-- Name: source_library_policy_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_library_policy_links (
    id integer NOT NULL,
    source_library_id character varying(100) NOT NULL,
    source_type character varying(20) NOT NULL,
    source_name character varying(255),
    policy_id integer,
    auto_generated boolean DEFAULT false,
    confidence real,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE source_library_policy_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.source_library_policy_links IS 'Links source media server libraries (Plex/Emby/Jellyfin) to classification policies';


--
-- Name: source_library_policy_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.source_library_policy_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: source_library_policy_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.source_library_policy_links_id_seq OWNED BY public.source_library_policy_links.id;


--
-- Name: ssl_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ssl_config (
    id integer NOT NULL,
    enabled boolean DEFAULT false,
    cert_path character varying(500),
    key_path character varying(500),
    ca_path character varying(500),
    force_https boolean DEFAULT false,
    hsts_enabled boolean DEFAULT false,
    hsts_max_age integer DEFAULT 31536000,
    client_cert_required boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: ssl_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ssl_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ssl_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ssl_config_id_seq OWNED BY public.ssl_config.id;


--
-- Name: task_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_queue (
    id bigint NOT NULL,
    task_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    priority integer DEFAULT 0,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 5,
    error_message text,
    webhook_log_id integer,
    source character varying(50) DEFAULT 'webhook'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    next_retry_at timestamp without time zone DEFAULT now(),
    current_stage character varying(50) DEFAULT NULL::character varying,
    stage_index integer,
    stage_started_at timestamp without time zone,
    stage_history jsonb DEFAULT '[]'::jsonb,
    visible_at timestamp with time zone,
    CONSTRAINT task_queue_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text])))
)
WITH (fillfactor='75', autovacuum_vacuum_scale_factor='0.01', autovacuum_vacuum_threshold='50', autovacuum_analyze_scale_factor='0.05', autovacuum_vacuum_cost_delay='2', autovacuum_vacuum_insert_scale_factor='0.02', autovacuum_vacuum_insert_threshold='500');


--
-- Name: COLUMN task_queue.current_stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_queue.current_stage IS 'Current classification stage (queued, metadata_fetch, policy_eval, rag_analysis, signal_combine, ai_analysis, decision, notification)';


--
-- Name: COLUMN task_queue.stage_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_queue.stage_index IS 'Current classification stage index (1-8)';


--
-- Name: COLUMN task_queue.stage_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_queue.stage_started_at IS 'When the current classification stage started';


--
-- Name: COLUMN task_queue.stage_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_queue.stage_history IS 'JSON array of completed classification stages with timestamps and durations';


--
-- Name: task_queue_cleanup_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_queue_cleanup_history (
    id bigint NOT NULL,
    cleanup_type character varying(32) NOT NULL,
    trigger character varying(32) NOT NULL,
    retention_policy jsonb NOT NULL,
    max_total_rows integer NOT NULL,
    stale_rows_before integer DEFAULT 0 NOT NULL,
    total_rows_before integer DEFAULT 0 NOT NULL,
    total_rows_after integer DEFAULT 0 NOT NULL,
    cap_excess_before integer DEFAULT 0 NOT NULL,
    total_deleted integer DEFAULT 0 NOT NULL,
    age_deleted integer DEFAULT 0 NOT NULL,
    count_cap_deleted integer DEFAULT 0 NOT NULL,
    terminal_rows_before jsonb NOT NULL,
    terminal_rows_after jsonb NOT NULL,
    deleted_by_status jsonb NOT NULL,
    oldest_remaining_by_status jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cleanup_origin character varying(32) DEFAULT 'legacy'::character varying NOT NULL,
    CONSTRAINT task_queue_cleanup_history_age_deleted_check CHECK ((age_deleted >= 0)),
    CONSTRAINT task_queue_cleanup_history_cap_excess_before_check CHECK ((cap_excess_before >= 0)),
    CONSTRAINT task_queue_cleanup_history_cleanup_origin_check CHECK (((cleanup_origin)::text = ANY (ARRAY[('legacy'::character varying)::text, ('worker_startup'::character varying)::text, ('startup_delayed'::character varying)::text, ('cron'::character varying)::text]))),
    CONSTRAINT task_queue_cleanup_history_cleanup_type_check CHECK (((cleanup_type)::text = ANY (ARRAY[('startup'::character varying)::text, ('scheduled'::character varying)::text]))),
    CONSTRAINT task_queue_cleanup_history_count_cap_deleted_check CHECK ((count_cap_deleted >= 0)),
    CONSTRAINT task_queue_cleanup_history_max_total_rows_check CHECK ((max_total_rows > 0)),
    CONSTRAINT task_queue_cleanup_history_stale_rows_before_check CHECK ((stale_rows_before >= 0)),
    CONSTRAINT task_queue_cleanup_history_total_deleted_check CHECK ((total_deleted >= 0)),
    CONSTRAINT task_queue_cleanup_history_total_rows_after_check CHECK ((total_rows_after >= 0)),
    CONSTRAINT task_queue_cleanup_history_total_rows_before_check CHECK ((total_rows_before >= 0)),
    CONSTRAINT task_queue_cleanup_history_trigger_check CHECK (((trigger)::text = ANY (ARRAY[('age'::character varying)::text, ('count'::character varying)::text, ('age+count'::character varying)::text])))
);


--
-- Name: task_queue_cleanup_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_queue_cleanup_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_queue_cleanup_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_queue_cleanup_history_id_seq OWNED BY public.task_queue_cleanup_history.id;


--
-- Name: task_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_queue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_queue_id_seq OWNED BY public.task_queue.id;


--
-- Name: tavily_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tavily_config (
    id integer NOT NULL,
    api_key character varying(255),
    search_depth character varying(20) DEFAULT 'basic'::character varying,
    max_results integer DEFAULT 5,
    include_domains text[] DEFAULT ARRAY['imdb.com'::text, 'rottentomatoes.com'::text, 'myanimelist.net'::text, 'letterboxd.com'::text],
    exclude_domains text[] DEFAULT ARRAY[]::text[],
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: tavily_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tavily_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tavily_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tavily_config_id_seq OWNED BY public.tavily_config.id;


--
-- Name: tmdb_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tmdb_config (
    id integer NOT NULL,
    api_key character varying(500) NOT NULL,
    language character varying(10) DEFAULT 'en-US'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: tmdb_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tmdb_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tmdb_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tmdb_config_id_seq OWNED BY public.tmdb_config.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    must_change_password boolean DEFAULT false,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    failed_login_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('admin'::character varying)::text, ('user'::character varying)::text])))
);


--
-- Name: COLUMN users.failed_login_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.failed_login_count IS 'Consecutive failed login attempts since last successful login; reset to 0 on success';


--
-- Name: COLUMN users.locked_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.locked_until IS 'Account locked until this timestamp due to too many failed login attempts; NULL means not locked';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: web_search_provider_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_search_provider_cache (
    cache_key character(64) NOT NULL,
    provider_key character varying(40) NOT NULL,
    purpose character varying(60) NOT NULL,
    query_hash character(64) NOT NULL,
    request_fingerprint character(64) NOT NULL,
    query_preview character varying(160),
    response jsonb NOT NULL,
    result_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_hit_at timestamp with time zone,
    hit_count integer DEFAULT 0 NOT NULL,
    source_request_id character varying(160),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT web_search_provider_cache_hit_count_check CHECK ((hit_count >= 0)),
    CONSTRAINT web_search_provider_cache_provider_key_check CHECK (((provider_key)::text ~ '^[a-z0-9_-]{1,40}$'::text)),
    CONSTRAINT web_search_provider_cache_query_hash_check CHECK ((query_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT web_search_provider_cache_request_fingerprint_check CHECK ((request_fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT web_search_provider_cache_result_count_check CHECK (((result_count >= 0) AND (result_count <= 20)))
);


--
-- Name: TABLE web_search_provider_cache; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.web_search_provider_cache IS 'Provider-neutral normalized web-search response cache keyed by sanitized request fingerprint.';


--
-- Name: web_search_provider_calibration_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_search_provider_calibration_policies (
    purpose character varying(60) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    lookback_days integer DEFAULT 14 NOT NULL,
    minimum_samples integer DEFAULT 3 CONSTRAINT web_search_provider_calibration_polici_minimum_samples_not_null NOT NULL,
    maximum_priority_penalty integer DEFAULT 25 CONSTRAINT web_search_provider_calibrati_maximum_priority_penalty_not_null NOT NULL,
    outcome_weight integer DEFAULT 15 CONSTRAINT web_search_provider_calibration_policie_outcome_weight_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT web_search_provider_calibration_policies_lookback_days_check CHECK (((lookback_days >= 1) AND (lookback_days <= 90))),
    CONSTRAINT web_search_provider_calibration_policies_maximum_priority_penal CHECK (((maximum_priority_penalty >= 0) AND (maximum_priority_penalty <= 100))),
    CONSTRAINT web_search_provider_calibration_policies_minimum_samples_check CHECK (((minimum_samples >= 1) AND (minimum_samples <= 100))),
    CONSTRAINT web_search_provider_calibration_policies_outcome_weight_check CHECK (((outcome_weight >= 0) AND (outcome_weight <= 50))),
    CONSTRAINT web_search_provider_calibration_policies_purpose_check CHECK (((purpose)::text ~ '^[a-z0-9_-]{1,60}$'::text))
);


--
-- Name: TABLE web_search_provider_calibration_policies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.web_search_provider_calibration_policies IS 'Bounded per-purpose controls for web search provider quality calibration.';


--
-- Name: COLUMN web_search_provider_calibration_policies.purpose; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.web_search_provider_calibration_policies.purpose IS 'Stable web search purpose label, such as classification or metadata_enrichment.';


--
-- Name: COLUMN web_search_provider_calibration_policies.is_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.web_search_provider_calibration_policies.is_enabled IS 'When false, provider quality calibration is neutral for this purpose.';


--
-- Name: COLUMN web_search_provider_calibration_policies.lookback_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.web_search_provider_calibration_policies.lookback_days IS 'Usage and outcome lookback window in days.';


--
-- Name: COLUMN web_search_provider_calibration_policies.minimum_samples; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.web_search_provider_calibration_policies.minimum_samples IS 'Minimum samples before quality penalties can apply.';


--
-- Name: COLUMN web_search_provider_calibration_policies.maximum_priority_penalty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.web_search_provider_calibration_policies.maximum_priority_penalty IS 'Maximum priority points added to a lower-quality provider.';


--
-- Name: COLUMN web_search_provider_calibration_policies.outcome_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.web_search_provider_calibration_policies.outcome_weight IS 'Maximum score points deducted from downstream outcome feedback.';


--
-- Name: web_search_provider_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_search_provider_config (
    id integer NOT NULL,
    provider_key character varying(40) NOT NULL,
    display_name character varying(120) NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    api_key text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    soft_daily_limit integer,
    soft_monthly_limit integer,
    cooldown_until timestamp with time zone,
    last_success_at timestamp with time zone,
    last_error_at timestamp with time zone,
    last_error_code character varying(80),
    last_error_message text,
    last_error_http_status integer,
    legacy_source character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT web_search_provider_config_last_error_http_status_check CHECK (((last_error_http_status IS NULL) OR ((last_error_http_status >= 100) AND (last_error_http_status <= 599)))),
    CONSTRAINT web_search_provider_config_priority_check CHECK (((priority >= 0) AND (priority <= 1000))),
    CONSTRAINT web_search_provider_config_provider_key_check CHECK (((provider_key)::text ~ '^[a-z0-9_-]{1,40}$'::text)),
    CONSTRAINT web_search_provider_config_soft_daily_limit_check CHECK (((soft_daily_limit IS NULL) OR (soft_daily_limit >= 0))),
    CONSTRAINT web_search_provider_config_soft_monthly_limit_check CHECK (((soft_monthly_limit IS NULL) OR (soft_monthly_limit >= 0)))
);


--
-- Name: TABLE web_search_provider_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.web_search_provider_config IS 'Provider-neutral web-search configuration for Tavily, Brave, Serper, and future search providers.';


--
-- Name: web_search_provider_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.web_search_provider_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: web_search_provider_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.web_search_provider_config_id_seq OWNED BY public.web_search_provider_config.id;


--
-- Name: web_search_provider_guardrail_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_search_provider_guardrail_events (
    id bigint NOT NULL,
    purpose character varying(60) DEFAULT 'classification'::character varying NOT NULL,
    guardrail_code character varying(80) NOT NULL,
    severity character varying(20) NOT NULL,
    provider_key character varying(40),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT web_search_provider_guardrail_events_code_check CHECK (((guardrail_code)::text ~ '^[a-z0-9_]{1,80}$'::text)),
    CONSTRAINT web_search_provider_guardrail_events_provider_key_check CHECK (((provider_key IS NULL) OR ((provider_key)::text ~ '^[a-z0-9_-]{1,40}$'::text))),
    CONSTRAINT web_search_provider_guardrail_events_purpose_check CHECK (((purpose)::text ~ '^[a-z0-9_-]{1,60}$'::text)),
    CONSTRAINT web_search_provider_guardrail_events_severity_check CHECK (((severity)::text = ANY (ARRAY[('info'::character varying)::text, ('warning'::character varying)::text, ('critical'::character varying)::text])))
);


--
-- Name: TABLE web_search_provider_guardrail_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.web_search_provider_guardrail_events IS 'Sanitized calibration preview guardrail events for aggregate web search provider tuning analytics.';


--
-- Name: web_search_provider_guardrail_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.web_search_provider_guardrail_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: web_search_provider_guardrail_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.web_search_provider_guardrail_events_id_seq OWNED BY public.web_search_provider_guardrail_events.id;


--
-- Name: web_search_provider_health_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_search_provider_health_events (
    id bigint NOT NULL,
    provider_key character varying(40) NOT NULL,
    event_type character varying(40) NOT NULL,
    health_status character varying(40) NOT NULL,
    purpose character varying(60) DEFAULT 'classification'::character varying NOT NULL,
    operation character varying(60) DEFAULT 'search'::character varying NOT NULL,
    error_code character varying(80),
    error_http_status integer,
    retry_after_seconds integer,
    cooldown_until timestamp with time zone,
    correlation_id character varying(120),
    classification_id bigint,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT web_search_provider_health_events_error_http_status_check CHECK (((error_http_status IS NULL) OR ((error_http_status >= 100) AND (error_http_status <= 599)))),
    CONSTRAINT web_search_provider_health_events_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('success'::character varying)::text, ('error'::character varying)::text, ('cooldown_started'::character varying)::text]))),
    CONSTRAINT web_search_provider_health_events_health_status_check CHECK (((health_status)::text = ANY (ARRAY[('available'::character varying)::text, ('degraded'::character varying)::text, ('cooldown'::character varying)::text]))),
    CONSTRAINT web_search_provider_health_events_provider_key_check CHECK (((provider_key)::text ~ '^[a-z0-9_-]{1,40}$'::text)),
    CONSTRAINT web_search_provider_health_events_retry_after_check CHECK (((retry_after_seconds IS NULL) OR (retry_after_seconds >= 0)))
);


--
-- Name: TABLE web_search_provider_health_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.web_search_provider_health_events IS 'Sanitized web-search provider health, error, and cooldown events for operator diagnostics.';


--
-- Name: web_search_provider_health_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.web_search_provider_health_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: web_search_provider_health_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.web_search_provider_health_events_id_seq OWNED BY public.web_search_provider_health_events.id;


--
-- Name: web_search_provider_route_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_search_provider_route_decisions (
    id bigint NOT NULL,
    route_id uuid NOT NULL,
    purpose character varying(60) DEFAULT 'classification'::character varying NOT NULL,
    operation character varying(60) DEFAULT 'search'::character varying NOT NULL,
    outcome character varying(40) NOT NULL,
    selected_provider_key character varying(40),
    final_provider_key character varying(40),
    candidate_count integer DEFAULT 0 NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    candidates jsonb DEFAULT '[]'::jsonb NOT NULL,
    attempts jsonb DEFAULT '[]'::jsonb NOT NULL,
    correlation_id character varying(120),
    classification_id bigint,
    error_code character varying(80),
    error_http_status integer,
    duration_ms integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT web_search_provider_route_decisions_attempt_count_check CHECK (((attempt_count >= 0) AND (attempt_count <= 20))),
    CONSTRAINT web_search_provider_route_decisions_candidate_count_check CHECK (((candidate_count >= 0) AND (candidate_count <= 20))),
    CONSTRAINT web_search_provider_route_decisions_duration_ms_check CHECK (((duration_ms IS NULL) OR (duration_ms >= 0))),
    CONSTRAINT web_search_provider_route_decisions_error_http_status_check CHECK (((error_http_status IS NULL) OR ((error_http_status >= 100) AND (error_http_status <= 599)))),
    CONSTRAINT web_search_provider_route_decisions_final_provider_key_check CHECK (((final_provider_key IS NULL) OR ((final_provider_key)::text ~ '^[a-z0-9_-]{1,40}$'::text))),
    CONSTRAINT web_search_provider_route_decisions_outcome_check CHECK (((outcome)::text = ANY (ARRAY[('success'::character varying)::text, ('no_provider'::character varying)::text, ('failed'::character varying)::text, ('error'::character varying)::text]))),
    CONSTRAINT web_search_provider_route_decisions_selected_provider_key_check CHECK (((selected_provider_key IS NULL) OR ((selected_provider_key)::text ~ '^[a-z0-9_-]{1,40}$'::text)))
);


--
-- Name: TABLE web_search_provider_route_decisions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.web_search_provider_route_decisions IS 'Sanitized web-search provider routing decisions for operator diagnostics and post-request explainability.';


--
-- Name: web_search_provider_route_decisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.web_search_provider_route_decisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: web_search_provider_route_decisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.web_search_provider_route_decisions_id_seq OWNED BY public.web_search_provider_route_decisions.id;


--
-- Name: web_search_provider_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_search_provider_usage (
    id bigint NOT NULL,
    provider_key character varying(40) NOT NULL,
    purpose character varying(60) NOT NULL,
    operation character varying(60) DEFAULT 'search'::character varying NOT NULL,
    status character varying(40) NOT NULL,
    cost_units integer DEFAULT 1 NOT NULL,
    result_count integer DEFAULT 0 NOT NULL,
    duration_ms integer,
    searched_at timestamp with time zone DEFAULT now() NOT NULL,
    correlation_id uuid,
    classification_id bigint,
    error_code character varying(80),
    http_status integer,
    retryable boolean DEFAULT false NOT NULL,
    cooldown_eligible boolean DEFAULT false NOT NULL,
    retry_after_seconds integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT web_search_provider_usage_cost_units_check CHECK (((cost_units >= 0) AND (cost_units <= 1000))),
    CONSTRAINT web_search_provider_usage_duration_ms_check CHECK (((duration_ms IS NULL) OR (duration_ms >= 0))),
    CONSTRAINT web_search_provider_usage_http_status_check CHECK (((http_status IS NULL) OR ((http_status >= 100) AND (http_status <= 599)))),
    CONSTRAINT web_search_provider_usage_provider_key_check CHECK (((provider_key)::text ~ '^[a-z0-9_-]{1,40}$'::text)),
    CONSTRAINT web_search_provider_usage_result_count_check CHECK (((result_count >= 0) AND (result_count <= 20))),
    CONSTRAINT web_search_provider_usage_retry_after_seconds_check CHECK (((retry_after_seconds IS NULL) OR (retry_after_seconds >= 0))),
    CONSTRAINT web_search_provider_usage_status_check CHECK (((status)::text = ANY (ARRAY[('success'::character varying)::text, ('failed'::character varying)::text, ('skipped'::character varying)::text, ('rate_limited'::character varying)::text, ('quota_exhausted'::character varying)::text])))
);


--
-- Name: TABLE web_search_provider_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.web_search_provider_usage IS 'Append-only provider-neutral web-search usage and error events for quota-aware routing and observability.';


--
-- Name: web_search_provider_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.web_search_provider_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: web_search_provider_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.web_search_provider_usage_id_seq OWNED BY public.web_search_provider_usage.id;


--
-- Name: webhook_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_config (
    id integer NOT NULL,
    webhook_type character varying(50) DEFAULT 'overseerr'::character varying,
    secret_key character varying(255),
    process_pending boolean DEFAULT true,
    process_approved boolean DEFAULT true,
    process_auto_approved boolean DEFAULT true,
    process_declined boolean DEFAULT false,
    notify_on_receive boolean DEFAULT true,
    notify_on_error boolean DEFAULT true,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    name character varying(100),
    is_primary boolean DEFAULT false,
    manager_url character varying(500),
    include_specials boolean DEFAULT false
);


--
-- Name: webhook_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.webhook_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webhook_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.webhook_config_id_seq OWNED BY public.webhook_config.id;


--
-- Name: webhook_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_log (
    id integer NOT NULL,
    webhook_type character varying(50) DEFAULT 'overseerr'::character varying,
    notification_type character varying(50),
    event_name character varying(100),
    payload jsonb,
    media_title character varying(500),
    media_type character varying(20),
    tmdb_id integer,
    tvdb_id integer,
    request_id integer,
    requested_by_username character varying(255),
    requested_by_email character varying(255),
    is_4k boolean DEFAULT false,
    processing_status character varying(20) DEFAULT 'received'::character varying,
    classification_id bigint,
    routed_to_library character varying(255),
    error_message text,
    processing_time_ms integer,
    ip_address character varying(50),
    user_agent character varying(500),
    received_at timestamp without time zone DEFAULT now(),
    webhook_config_id integer
);


--
-- Name: webhook_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.webhook_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webhook_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.webhook_log_id_seq OWNED BY public.webhook_log.id;


--
-- Name: ai_provider_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_config ALTER COLUMN id SET DEFAULT nextval('public.ai_provider_config_id_seq'::regclass);


--
-- Name: ai_usage_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_log_id_seq'::regclass);


--
-- Name: ai_usage_monthly id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_monthly ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_monthly_id_seq'::regclass);


--
-- Name: api_key_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_audit ALTER COLUMN id SET DEFAULT nextval('public.api_key_audit_id_seq'::regclass);


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: app_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_log ALTER COLUMN id SET DEFAULT nextval('public.app_log_id_seq'::regclass);


--
-- Name: app_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications ALTER COLUMN id SET DEFAULT nextval('public.app_notifications_id_seq'::regclass);


--
-- Name: arr_profiles_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arr_profiles_cache ALTER COLUMN id SET DEFAULT nextval('public.arr_profiles_cache_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: auto_learned_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_learned_preferences ALTER COLUMN id SET DEFAULT nextval('public.auto_learned_preferences_id_seq'::regclass);


--
-- Name: backfill_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backfill_runs ALTER COLUMN id SET DEFAULT nextval('public.backfill_runs_id_seq'::regclass);


--
-- Name: backup_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_audit ALTER COLUMN id SET DEFAULT nextval('public.backup_audit_id_seq'::regclass);


--
-- Name: backup_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_schedules ALTER COLUMN id SET DEFAULT nextval('public.backup_schedules_id_seq'::regclass);


--
-- Name: clarification_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clarification_questions ALTER COLUMN id SET DEFAULT nextval('public.clarification_questions_id_seq'::regclass);


--
-- Name: clarification_responses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clarification_responses ALTER COLUMN id SET DEFAULT nextval('public.clarification_responses_id_seq'::regclass);


--
-- Name: classification_corrections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_corrections ALTER COLUMN id SET DEFAULT nextval('public.classification_corrections_id_seq'::regclass);


--
-- Name: classification_embeddings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_embeddings ALTER COLUMN id SET DEFAULT nextval('public.classification_embeddings_id_seq'::regclass);


--
-- Name: classification_evidence id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_evidence ALTER COLUMN id SET DEFAULT nextval('public.classification_evidence_id_seq'::regclass);


--
-- Name: classification_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_history ALTER COLUMN id SET DEFAULT nextval('public.classification_history_id_seq'::regclass);


--
-- Name: confidence_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_settings ALTER COLUMN id SET DEFAULT nextval('public.confidence_settings_id_seq'::regclass);


--
-- Name: confidence_settings_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_settings_audit ALTER COLUMN id SET DEFAULT nextval('public.confidence_settings_audit_id_seq'::regclass);


--
-- Name: confidence_thresholds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_thresholds ALTER COLUMN id SET DEFAULT nextval('public.confidence_thresholds_id_seq'::regclass);


--
-- Name: content_analysis_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_analysis_log ALTER COLUMN id SET DEFAULT nextval('public.content_analysis_log_id_seq'::regclass);


--
-- Name: content_presets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_presets ALTER COLUMN id SET DEFAULT nextval('public.content_presets_id_seq'::regclass);


--
-- Name: custom_presets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_presets ALTER COLUMN id SET DEFAULT nextval('public.custom_presets_id_seq'::regclass);


--
-- Name: discovered_patterns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_patterns ALTER COLUMN id SET DEFAULT nextval('public.discovered_patterns_id_seq'::regclass);


--
-- Name: dismissed_patterns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_patterns ALTER COLUMN id SET DEFAULT nextval('public.dismissed_patterns_id_seq'::regclass);


--
-- Name: embedding_costs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_costs ALTER COLUMN id SET DEFAULT nextval('public.embedding_costs_id_seq'::regclass);


--
-- Name: embedding_errors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_errors ALTER COLUMN id SET DEFAULT nextval('public.embedding_errors_id_seq'::regclass);


--
-- Name: enrichment_retry_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_retry_queue ALTER COLUMN id SET DEFAULT nextval('public.enrichment_retry_queue_id_seq'::regclass);


--
-- Name: error_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_log ALTER COLUMN id SET DEFAULT nextval('public.error_log_id_seq'::regclass);


--
-- Name: jwt_secrets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jwt_secrets ALTER COLUMN id SET DEFAULT nextval('public.jwt_secrets_id_seq'::regclass);


--
-- Name: label_presets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_presets ALTER COLUMN id SET DEFAULT nextval('public.label_presets_id_seq'::regclass);


--
-- Name: learned_corrections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learned_corrections ALTER COLUMN id SET DEFAULT nextval('public.learned_corrections_id_seq'::regclass);


--
-- Name: learning_conflicts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_conflicts ALTER COLUMN id SET DEFAULT nextval('public.learning_conflicts_id_seq'::regclass);


--
-- Name: learning_patterns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_patterns ALTER COLUMN id SET DEFAULT nextval('public.learning_patterns_id_seq'::regclass);


--
-- Name: learning_rate_limits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_rate_limits ALTER COLUMN id SET DEFAULT nextval('public.learning_rate_limits_id_seq'::regclass);


--
-- Name: libraries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libraries ALTER COLUMN id SET DEFAULT nextval('public.libraries_id_seq'::regclass);


--
-- Name: library_arr_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_arr_mappings ALTER COLUMN id SET DEFAULT nextval('public.library_arr_mappings_id_seq'::regclass);


--
-- Name: library_custom_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_custom_rules ALTER COLUMN id SET DEFAULT nextval('public.library_custom_rules_id_seq'::regclass);


--
-- Name: library_labels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_labels ALTER COLUMN id SET DEFAULT nextval('public.library_labels_id_seq'::regclass);


--
-- Name: library_pattern_suggestions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_pattern_suggestions ALTER COLUMN id SET DEFAULT nextval('public.library_pattern_suggestions_id_seq'::regclass);


--
-- Name: library_policies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_policies ALTER COLUMN id SET DEFAULT nextval('public.library_policies_id_seq'::regclass);


--
-- Name: library_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_profiles ALTER COLUMN id SET DEFAULT nextval('public.library_profiles_id_seq'::regclass);


--
-- Name: library_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_rules ALTER COLUMN id SET DEFAULT nextval('public.library_rules_id_seq'::regclass);


--
-- Name: library_rules_v2 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_rules_v2 ALTER COLUMN id SET DEFAULT nextval('public.library_rules_v2_id_seq'::regclass);


--
-- Name: media_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_requests ALTER COLUMN id SET DEFAULT nextval('public.media_requests_id_seq'::regclass);


--
-- Name: media_server id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server ALTER COLUMN id SET DEFAULT nextval('public.media_server_id_seq'::regclass);


--
-- Name: media_server_collections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_collections ALTER COLUMN id SET DEFAULT nextval('public.media_server_collections_id_seq'::regclass);


--
-- Name: media_server_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_items ALTER COLUMN id SET DEFAULT nextval('public.media_server_items_id_seq'::regclass);


--
-- Name: media_server_sync_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_sync_status ALTER COLUMN id SET DEFAULT nextval('public.media_server_sync_status_id_seq'::regclass);


--
-- Name: notification_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_config ALTER COLUMN id SET DEFAULT nextval('public.notification_config_id_seq'::regclass);


--
-- Name: ollama_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ollama_config ALTER COLUMN id SET DEFAULT nextval('public.ollama_config_id_seq'::regclass);


--
-- Name: omdb_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.omdb_config ALTER COLUMN id SET DEFAULT nextval('public.omdb_config_id_seq'::regclass);


--
-- Name: path_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_mappings ALTER COLUMN id SET DEFAULT nextval('public.path_mappings_id_seq'::regclass);


--
-- Name: pattern_match_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_match_log ALTER COLUMN id SET DEFAULT nextval('public.pattern_match_log_id_seq'::regclass);


--
-- Name: policy_authoring_proposals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_authoring_proposals ALTER COLUMN id SET DEFAULT nextval('public.policy_authoring_proposals_id_seq'::regclass);


--
-- Name: policy_authorized_outcome_source_event_receipts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_authorized_outcome_source_event_receipts ALTER COLUMN id SET DEFAULT nextval('public.policy_authorized_outcome_source_event_receipts_id_seq'::regclass);


--
-- Name: policy_backup_restore_verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_backup_restore_verifications ALTER COLUMN id SET DEFAULT nextval('public.policy_backup_restore_verifications_id_seq'::regclass);


--
-- Name: policy_candidate_correction_review_corpus_audit_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_corpus_audit_events ALTER COLUMN id SET DEFAULT nextval('public.policy_candidate_correction_review_corpus_audit_events_id_seq'::regclass);


--
-- Name: policy_candidate_correction_review_corpus_capture_audit_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_corpus_capture_audit_events ALTER COLUMN id SET DEFAULT nextval('public.policy_candidate_correction_review_corpus_capture_audit__id_seq'::regclass);


--
-- Name: policy_candidate_correction_review_projection_audit_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_projection_audit_events ALTER COLUMN id SET DEFAULT nextval('public.policy_candidate_correction_review_projection_audit_even_id_seq'::regclass);


--
-- Name: policy_change_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_change_log ALTER COLUMN id SET DEFAULT nextval('public.policy_change_log_id_seq'::regclass);


--
-- Name: policy_feedback_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_feedback_log ALTER COLUMN id SET DEFAULT nextval('public.policy_feedback_log_id_seq'::regclass);


--
-- Name: policy_identity_evidence_admissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_identity_evidence_admissions ALTER COLUMN id SET DEFAULT nextval('public.policy_identity_evidence_admissions_id_seq'::regclass);


--
-- Name: policy_initial_intent_establishments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments ALTER COLUMN id SET DEFAULT nextval('public.policy_initial_intent_establishments_id_seq'::regclass);


--
-- Name: policy_intent_migration_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_migration_events ALTER COLUMN id SET DEFAULT nextval('public.policy_intent_migration_events_id_seq'::regclass);


--
-- Name: policy_intent_rollback_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_rollback_snapshots ALTER COLUMN id SET DEFAULT nextval('public.policy_intent_rollback_snapshots_id_seq'::regclass);


--
-- Name: policy_intent_routing_targets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_routing_targets ALTER COLUMN id SET DEFAULT nextval('public.policy_intent_routing_targets_id_seq'::regclass);


--
-- Name: policy_intent_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_rules ALTER COLUMN id SET DEFAULT nextval('public.policy_intent_rules_id_seq'::regclass);


--
-- Name: policy_intent_template_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_template_applications ALTER COLUMN id SET DEFAULT nextval('public.policy_intent_template_applications_id_seq'::regclass);


--
-- Name: policy_intent_validation_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_validation_status ALTER COLUMN id SET DEFAULT nextval('public.policy_intent_validation_status_id_seq'::regclass);


--
-- Name: policy_intents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intents ALTER COLUMN id SET DEFAULT nextval('public.policy_intents_id_seq'::regclass);


--
-- Name: policy_learning_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_learning_stats ALTER COLUMN id SET DEFAULT nextval('public.policy_learning_stats_id_seq'::regclass);


--
-- Name: policy_library_rebuild_execution_gates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates ALTER COLUMN id SET DEFAULT nextval('public.policy_library_rebuild_execution_gates_id_seq'::regclass);


--
-- Name: policy_migration_verification_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_migration_verification_runs ALTER COLUMN id SET DEFAULT nextval('public.policy_migration_verification_runs_id_seq'::regclass);


--
-- Name: policy_native_intent_change_receipts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_change_receipts ALTER COLUMN id SET DEFAULT nextval('public.policy_native_intent_change_receipts_id_seq'::regclass);


--
-- Name: policy_native_intent_reconciliation_control_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_control_events ALTER COLUMN id SET DEFAULT nextval('public.policy_native_intent_reconciliation_control_events_id_seq'::regclass);


--
-- Name: policy_native_intent_reconciliation_outcomes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_outcomes ALTER COLUMN id SET DEFAULT nextval('public.policy_native_intent_reconciliation_outcomes_id_seq'::regclass);


--
-- Name: policy_native_intent_reconciliation_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_runs ALTER COLUMN id SET DEFAULT nextval('public.policy_native_intent_reconciliation_runs_id_seq'::regclass);


--
-- Name: policy_observed_evidence_provenance_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_observed_evidence_provenance_snapshots ALTER COLUMN id SET DEFAULT nextval('public.policy_observed_evidence_provenance_snapshots_id_seq'::regclass);


--
-- Name: policy_overlap_metrics_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_overlap_metrics_snapshots ALTER COLUMN id SET DEFAULT nextval('public.policy_overlap_metrics_snapshots_id_seq'::regclass);


--
-- Name: policy_overrides id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_overrides ALTER COLUMN id SET DEFAULT nextval('public.policy_overrides_id_seq'::regclass);


--
-- Name: policy_presets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_presets ALTER COLUMN id SET DEFAULT nextval('public.policy_presets_id_seq'::regclass);


--
-- Name: policy_profile_refresh_outbox id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_profile_refresh_outbox ALTER COLUMN id SET DEFAULT nextval('public.policy_profile_refresh_outbox_id_seq'::regclass);


--
-- Name: policy_runtime_pending_question_cleanup_audits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_runtime_pending_question_cleanup_audits ALTER COLUMN id SET DEFAULT nextval('public.policy_runtime_pending_question_cleanup_audits_id_seq'::regclass);


--
-- Name: policy_tuning_suggestions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_suggestions ALTER COLUMN id SET DEFAULT nextval('public.policy_tuning_suggestions_id_seq'::regclass);


--
-- Name: post_upgrade_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_upgrade_tasks ALTER COLUMN id SET DEFAULT nextval('public.post_upgrade_tasks_id_seq'::regclass);


--
-- Name: radarr_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radarr_config ALTER COLUMN id SET DEFAULT nextval('public.radarr_config_id_seq'::regclass);


--
-- Name: rag_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_logs ALTER COLUMN id SET DEFAULT nextval('public.rag_logs_id_seq'::regclass);


--
-- Name: rag_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_metrics ALTER COLUMN id SET DEFAULT nextval('public.rag_metrics_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: scheduled_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks ALTER COLUMN id SET DEFAULT nextval('public.scheduled_tasks_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: sonarr_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sonarr_config ALTER COLUMN id SET DEFAULT nextval('public.sonarr_config_id_seq'::regclass);


--
-- Name: source_library_policy_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_library_policy_links ALTER COLUMN id SET DEFAULT nextval('public.source_library_policy_links_id_seq'::regclass);


--
-- Name: ssl_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssl_config ALTER COLUMN id SET DEFAULT nextval('public.ssl_config_id_seq'::regclass);


--
-- Name: task_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_queue ALTER COLUMN id SET DEFAULT nextval('public.task_queue_id_seq'::regclass);


--
-- Name: task_queue_cleanup_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_queue_cleanup_history ALTER COLUMN id SET DEFAULT nextval('public.task_queue_cleanup_history_id_seq'::regclass);


--
-- Name: tavily_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tavily_config ALTER COLUMN id SET DEFAULT nextval('public.tavily_config_id_seq'::regclass);


--
-- Name: tmdb_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tmdb_config ALTER COLUMN id SET DEFAULT nextval('public.tmdb_config_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: web_search_provider_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_config ALTER COLUMN id SET DEFAULT nextval('public.web_search_provider_config_id_seq'::regclass);


--
-- Name: web_search_provider_guardrail_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_guardrail_events ALTER COLUMN id SET DEFAULT nextval('public.web_search_provider_guardrail_events_id_seq'::regclass);


--
-- Name: web_search_provider_health_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_health_events ALTER COLUMN id SET DEFAULT nextval('public.web_search_provider_health_events_id_seq'::regclass);


--
-- Name: web_search_provider_route_decisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_route_decisions ALTER COLUMN id SET DEFAULT nextval('public.web_search_provider_route_decisions_id_seq'::regclass);


--
-- Name: web_search_provider_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_usage ALTER COLUMN id SET DEFAULT nextval('public.web_search_provider_usage_id_seq'::regclass);


--
-- Name: webhook_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_config ALTER COLUMN id SET DEFAULT nextval('public.webhook_config_id_seq'::regclass);


--
-- Name: webhook_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_log ALTER COLUMN id SET DEFAULT nextval('public.webhook_log_id_seq'::regclass);


--
-- Name: ai_provider_capability_metrics ai_provider_capability_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_capability_metrics
    ADD CONSTRAINT ai_provider_capability_metrics_pkey PRIMARY KEY (provider_id, model, authority_mode);


--
-- Name: ai_provider_config ai_provider_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_provider_config
    ADD CONSTRAINT ai_provider_config_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_log ai_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_monthly ai_usage_monthly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_monthly
    ADD CONSTRAINT ai_usage_monthly_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_monthly ai_usage_monthly_year_month_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_monthly
    ADD CONSTRAINT ai_usage_monthly_year_month_provider_key UNIQUE (year_month, provider);


--
-- Name: api_key_audit api_key_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_audit
    ADD CONSTRAINT api_key_audit_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: app_log app_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_log
    ADD CONSTRAINT app_log_pkey PRIMARY KEY (id);


--
-- Name: app_notifications app_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications
    ADD CONSTRAINT app_notifications_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: arr_profiles_cache arr_profiles_cache_arr_type_profile_type_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arr_profiles_cache
    ADD CONSTRAINT arr_profiles_cache_arr_type_profile_type_profile_id_key UNIQUE (arr_type, profile_type, profile_id);


--
-- Name: arr_profiles_cache arr_profiles_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arr_profiles_cache
    ADD CONSTRAINT arr_profiles_cache_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auto_learned_preferences auto_learned_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_learned_preferences
    ADD CONSTRAINT auto_learned_preferences_pkey PRIMARY KEY (id);


--
-- Name: backfill_runs backfill_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backfill_runs
    ADD CONSTRAINT backfill_runs_pkey PRIMARY KEY (id);


--
-- Name: backup_audit backup_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_audit
    ADD CONSTRAINT backup_audit_pkey PRIMARY KEY (id);


--
-- Name: backup_schedules backup_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_schedules
    ADD CONSTRAINT backup_schedules_pkey PRIMARY KEY (id);


--
-- Name: candidate_bound_verification_capability_receipts candidate_bound_verification_capability_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_bound_verification_capability_receipts
    ADD CONSTRAINT candidate_bound_verification_capability_receipts_pkey PRIMARY KEY (id);


--
-- Name: candidate_bound_verification_capability_receipts cbv_capability_receipts_revision_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_bound_verification_capability_receipts
    ADD CONSTRAINT cbv_capability_receipts_revision_uq UNIQUE (configuration_revision);


--
-- Name: library_policies chk_library_policies_threshold_ladder; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.library_policies
    ADD CONSTRAINT chk_library_policies_threshold_ladder CHECK (((auto_classify_threshold >= 0) AND (auto_classify_threshold <= 95) AND (prompt_threshold >= 0) AND (prompt_threshold <= auto_classify_threshold))) NOT VALID;


--
-- Name: clarification_questions clarification_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clarification_questions
    ADD CONSTRAINT clarification_questions_pkey PRIMARY KEY (id);


--
-- Name: clarification_responses clarification_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clarification_responses
    ADD CONSTRAINT clarification_responses_pkey PRIMARY KEY (id);


--
-- Name: classification_corrections classification_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_corrections
    ADD CONSTRAINT classification_corrections_pkey PRIMARY KEY (id);


--
-- Name: classification_embeddings classification_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_embeddings
    ADD CONSTRAINT classification_embeddings_pkey PRIMARY KEY (id);


--
-- Name: classification_evidence classification_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_evidence
    ADD CONSTRAINT classification_evidence_pkey PRIMARY KEY (id);


--
-- Name: classification_history classification_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_history
    ADD CONSTRAINT classification_history_pkey PRIMARY KEY (id);


--
-- Name: classification_history_totals classification_history_totals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_history_totals
    ADD CONSTRAINT classification_history_totals_pkey PRIMARY KEY (singleton);


--
-- Name: classification_queue_decision_witnesses classification_queue_decision_witnesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_queue_decision_witnesses
    ADD CONSTRAINT classification_queue_decision_witnesses_pkey PRIMARY KEY (queue_task_id, classification_id);


--
-- Name: confidence_settings_audit confidence_settings_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_settings_audit
    ADD CONSTRAINT confidence_settings_audit_pkey PRIMARY KEY (id);


--
-- Name: confidence_settings confidence_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_settings
    ADD CONSTRAINT confidence_settings_pkey PRIMARY KEY (id);


--
-- Name: confidence_settings confidence_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_settings
    ADD CONSTRAINT confidence_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: confidence_thresholds confidence_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_thresholds
    ADD CONSTRAINT confidence_thresholds_pkey PRIMARY KEY (id);


--
-- Name: confidence_thresholds confidence_thresholds_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_thresholds
    ADD CONSTRAINT confidence_thresholds_tier_key UNIQUE (tier);


--
-- Name: content_analysis_log content_analysis_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_analysis_log
    ADD CONSTRAINT content_analysis_log_pkey PRIMARY KEY (id);


--
-- Name: content_presets content_presets_key_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_presets
    ADD CONSTRAINT content_presets_key_user_id_key UNIQUE (key, user_id);


--
-- Name: content_presets content_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_presets
    ADD CONSTRAINT content_presets_pkey PRIMARY KEY (id);


--
-- Name: custom_presets custom_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_presets
    ADD CONSTRAINT custom_presets_pkey PRIMARY KEY (id);


--
-- Name: discovered_patterns discovered_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_patterns
    ADD CONSTRAINT discovered_patterns_pkey PRIMARY KEY (id);


--
-- Name: dismissed_patterns dismissed_patterns_library_id_pattern_type_pattern_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_patterns
    ADD CONSTRAINT dismissed_patterns_library_id_pattern_type_pattern_value_key UNIQUE (library_id, pattern_type, pattern_value);


--
-- Name: dismissed_patterns dismissed_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_patterns
    ADD CONSTRAINT dismissed_patterns_pkey PRIMARY KEY (id);


--
-- Name: embedding_costs embedding_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_costs
    ADD CONSTRAINT embedding_costs_pkey PRIMARY KEY (id);


--
-- Name: embedding_errors embedding_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_errors
    ADD CONSTRAINT embedding_errors_pkey PRIMARY KEY (id);


--
-- Name: embedding_provider_availability embedding_provider_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_provider_availability
    ADD CONSTRAINT embedding_provider_availability_pkey PRIMARY KEY (id);


--
-- Name: enrichment_retry_queue enrichment_retry_queue_media_item_id_enrichment_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_retry_queue
    ADD CONSTRAINT enrichment_retry_queue_media_item_id_enrichment_type_key UNIQUE (media_item_id, enrichment_type);


--
-- Name: enrichment_retry_queue enrichment_retry_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_retry_queue
    ADD CONSTRAINT enrichment_retry_queue_pkey PRIMARY KEY (id);


--
-- Name: error_log error_log_error_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_log
    ADD CONSTRAINT error_log_error_id_key UNIQUE (error_id);


--
-- Name: error_log error_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_log
    ADD CONSTRAINT error_log_pkey PRIMARY KEY (id);


--
-- Name: inventory_observation_activity inventory_observation_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_observation_activity
    ADD CONSTRAINT inventory_observation_activity_pkey PRIMARY KEY (hour_slot);


--
-- Name: jwt_secrets jwt_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jwt_secrets
    ADD CONSTRAINT jwt_secrets_pkey PRIMARY KEY (id);


--
-- Name: label_presets label_presets_category_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_presets
    ADD CONSTRAINT label_presets_category_name_key UNIQUE (category, name);


--
-- Name: label_presets label_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.label_presets
    ADD CONSTRAINT label_presets_pkey PRIMARY KEY (id);


--
-- Name: learned_corrections learned_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learned_corrections
    ADD CONSTRAINT learned_corrections_pkey PRIMARY KEY (id);


--
-- Name: learned_corrections learned_corrections_tmdb_id_media_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learned_corrections
    ADD CONSTRAINT learned_corrections_tmdb_id_media_type_key UNIQUE (tmdb_id, media_type);


--
-- Name: learning_conflicts learning_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_conflicts
    ADD CONSTRAINT learning_conflicts_pkey PRIMARY KEY (id);


--
-- Name: learning_patterns learning_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_patterns
    ADD CONSTRAINT learning_patterns_pkey PRIMARY KEY (id);


--
-- Name: learning_patterns learning_patterns_tmdb_id_media_type_pattern_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_patterns
    ADD CONSTRAINT learning_patterns_tmdb_id_media_type_pattern_type_key UNIQUE (tmdb_id, media_type, pattern_type);


--
-- Name: learning_patterns learning_patterns_tmdb_media_type_pattern_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_patterns
    ADD CONSTRAINT learning_patterns_tmdb_media_type_pattern_type_key UNIQUE (tmdb_id, media_type, pattern_type);


--
-- Name: learning_rate_limits learning_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_rate_limits
    ADD CONSTRAINT learning_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: libraries libraries_media_server_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libraries
    ADD CONSTRAINT libraries_media_server_id_external_id_key UNIQUE (media_server_id, external_id);


--
-- Name: libraries libraries_name_media_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libraries
    ADD CONSTRAINT libraries_name_media_type_unique UNIQUE (name, media_type);


--
-- Name: libraries libraries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libraries
    ADD CONSTRAINT libraries_pkey PRIMARY KEY (id);


--
-- Name: library_arr_mappings library_arr_mappings_library_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_arr_mappings
    ADD CONSTRAINT library_arr_mappings_library_id_key UNIQUE (library_id);


--
-- Name: library_arr_mappings library_arr_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_arr_mappings
    ADD CONSTRAINT library_arr_mappings_pkey PRIMARY KEY (id);


--
-- Name: library_custom_rules library_custom_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_custom_rules
    ADD CONSTRAINT library_custom_rules_pkey PRIMARY KEY (id);


--
-- Name: library_labels library_labels_library_id_label_preset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_labels
    ADD CONSTRAINT library_labels_library_id_label_preset_id_key UNIQUE (library_id, label_preset_id);


--
-- Name: library_labels library_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_labels
    ADD CONSTRAINT library_labels_pkey PRIMARY KEY (id);


--
-- Name: library_observation_points library_observation_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_observation_points
    ADD CONSTRAINT library_observation_points_pkey PRIMARY KEY (sample_slot);


--
-- Name: library_observation_samples library_observation_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_observation_samples
    ADD CONSTRAINT library_observation_samples_pkey PRIMARY KEY (hour_slot);


--
-- Name: library_observation_sampling_state library_observation_sampling_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_observation_sampling_state
    ADD CONSTRAINT library_observation_sampling_state_pkey PRIMARY KEY (singleton);


--
-- Name: library_observation_scan_progress library_observation_scan_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_observation_scan_progress
    ADD CONSTRAINT library_observation_scan_progress_pkey PRIMARY KEY (library_id);


--
-- Name: library_pattern_suggestions library_pattern_suggestions_library_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_pattern_suggestions
    ADD CONSTRAINT library_pattern_suggestions_library_id_key UNIQUE (library_id);


--
-- Name: library_pattern_suggestions library_pattern_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_pattern_suggestions
    ADD CONSTRAINT library_pattern_suggestions_pkey PRIMARY KEY (id);


--
-- Name: library_policies library_policies_library_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_policies
    ADD CONSTRAINT library_policies_library_unique UNIQUE (library_id);


--
-- Name: library_policies library_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_policies
    ADD CONSTRAINT library_policies_pkey PRIMARY KEY (id);


--
-- Name: library_profile_inventory_state library_profile_inventory_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_profile_inventory_state
    ADD CONSTRAINT library_profile_inventory_state_pkey PRIMARY KEY (library_id);


--
-- Name: library_profiles library_profiles_library_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_profiles
    ADD CONSTRAINT library_profiles_library_id_key UNIQUE (library_id);


--
-- Name: library_profiles library_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_profiles
    ADD CONSTRAINT library_profiles_pkey PRIMARY KEY (id);


--
-- Name: library_rules library_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_rules
    ADD CONSTRAINT library_rules_pkey PRIMARY KEY (id);


--
-- Name: library_rules library_rules_unique_rule; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_rules
    ADD CONSTRAINT library_rules_unique_rule UNIQUE (library_id, rule_type, operator, value);


--
-- Name: library_rules_v2 library_rules_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_rules_v2
    ADD CONSTRAINT library_rules_v2_pkey PRIMARY KEY (id);


--
-- Name: media_identity_review_previews media_identity_review_previews_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_identity_review_previews
    ADD CONSTRAINT media_identity_review_previews_id_key UNIQUE (id);


--
-- Name: media_identity_review_previews media_identity_review_previews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_identity_review_previews
    ADD CONSTRAINT media_identity_review_previews_pkey PRIMARY KEY (actor_id);


--
-- Name: media_requests media_requests_overseerr_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_requests
    ADD CONSTRAINT media_requests_overseerr_request_id_key UNIQUE (overseerr_request_id);


--
-- Name: media_requests media_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_requests
    ADD CONSTRAINT media_requests_pkey PRIMARY KEY (id);


--
-- Name: media_server_collections media_server_collections_media_server_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_collections
    ADD CONSTRAINT media_server_collections_media_server_id_external_id_key UNIQUE (media_server_id, external_id);


--
-- Name: media_server_collections media_server_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_collections
    ADD CONSTRAINT media_server_collections_pkey PRIMARY KEY (id);


--
-- Name: media_server_items media_server_items_media_server_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_items
    ADD CONSTRAINT media_server_items_media_server_id_external_id_key UNIQUE (media_server_id, external_id);


--
-- Name: media_server_items media_server_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_items
    ADD CONSTRAINT media_server_items_pkey PRIMARY KEY (id);


--
-- Name: media_server media_server_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server
    ADD CONSTRAINT media_server_pkey PRIMARY KEY (id);


--
-- Name: media_server_sync_status media_server_sync_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_sync_status
    ADD CONSTRAINT media_server_sync_status_pkey PRIMARY KEY (id);


--
-- Name: notification_config notification_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_config
    ADD CONSTRAINT notification_config_pkey PRIMARY KEY (id);


--
-- Name: notification_config notification_config_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_config
    ADD CONSTRAINT notification_config_type_key UNIQUE (type);


--
-- Name: ollama_config ollama_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ollama_config
    ADD CONSTRAINT ollama_config_pkey PRIMARY KEY (id);


--
-- Name: ollama_verification_capability_test_outcomes ollama_verification_capability_test_outcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ollama_verification_capability_test_outcomes
    ADD CONSTRAINT ollama_verification_capability_test_outcomes_pkey PRIMARY KEY (observed_on, status_id);


--
-- Name: omdb_config omdb_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.omdb_config
    ADD CONSTRAINT omdb_config_pkey PRIMARY KEY (id);


--
-- Name: path_mappings path_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_mappings
    ADD CONSTRAINT path_mappings_pkey PRIMARY KEY (id);


--
-- Name: pattern_analysis_config pattern_analysis_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_analysis_config
    ADD CONSTRAINT pattern_analysis_config_pkey PRIMARY KEY (id);


--
-- Name: pattern_match_log pattern_match_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_match_log
    ADD CONSTRAINT pattern_match_log_pkey PRIMARY KEY (id);


--
-- Name: policy_authoring_proposals policy_authoring_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_authoring_proposals
    ADD CONSTRAINT policy_authoring_proposals_pkey PRIMARY KEY (id);


--
-- Name: policy_authoring_proposals policy_authoring_proposals_reference_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_authoring_proposals
    ADD CONSTRAINT policy_authoring_proposals_reference_unique UNIQUE (proposal_reference);


--
-- Name: policy_authorized_outcome_source_event_receipts policy_authorized_outcome_receipts_source_event_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_authorized_outcome_source_event_receipts
    ADD CONSTRAINT policy_authorized_outcome_receipts_source_event_unique UNIQUE (source_id, source_event_id);


--
-- Name: policy_authorized_outcome_source_event_receipts policy_authorized_outcome_source_event_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_authorized_outcome_source_event_receipts
    ADD CONSTRAINT policy_authorized_outcome_source_event_receipts_pkey PRIMARY KEY (id);


--
-- Name: policy_backup_restore_verifications policy_backup_restore_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_backup_restore_verifications
    ADD CONSTRAINT policy_backup_restore_verifications_pkey PRIMARY KEY (id);


--
-- Name: policy_candidate_correction_policy_change_decision_records policy_candidate_correction_polic_observation_hypothesis_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_policy_change_decision_records
    ADD CONSTRAINT policy_candidate_correction_polic_observation_hypothesis_id_key UNIQUE (observation_hypothesis_id);


--
-- Name: policy_candidate_correction_policy_change_decision_records policy_candidate_correction_policy_change_decision_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_policy_change_decision_records
    ADD CONSTRAINT policy_candidate_correction_policy_change_decision_records_pkey PRIMARY KEY (control_key);


--
-- Name: policy_candidate_correction_policy_change_outcome_observations policy_candidate_correction_policy_change_out_hypothesis_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_policy_change_outcome_observations
    ADD CONSTRAINT policy_candidate_correction_policy_change_out_hypothesis_id_key UNIQUE (hypothesis_id);


--
-- Name: policy_candidate_correction_policy_change_outcome_observations policy_candidate_correction_policy_change_outcome_observat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_policy_change_outcome_observations
    ADD CONSTRAINT policy_candidate_correction_policy_change_outcome_observat_pkey PRIMARY KEY (control_key);


--
-- Name: policy_change_review_history_aggregates policy_candidate_correction_policy_change_review_history_a_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_change_review_history_aggregates
    ADD CONSTRAINT policy_candidate_correction_policy_change_review_history_a_pkey PRIMARY KEY (period_start, decision_id);


--
-- Name: policy_change_review_history_controls policy_candidate_correction_policy_change_review_history_c_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_change_review_history_controls
    ADD CONSTRAINT policy_candidate_correction_policy_change_review_history_c_pkey PRIMARY KEY (control_key);


--
-- Name: policy_candidate_correction_review_corpus_audit_events policy_candidate_correction_review_corpus_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_corpus_audit_events
    ADD CONSTRAINT policy_candidate_correction_review_corpus_audit_events_pkey PRIMARY KEY (id);


--
-- Name: policy_candidate_correction_review_corpus_capture_audit_events policy_candidate_correction_review_corpus_capture_audit_ev_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_corpus_capture_audit_events
    ADD CONSTRAINT policy_candidate_correction_review_corpus_capture_audit_ev_pkey PRIMARY KEY (id);


--
-- Name: policy_candidate_correction_review_corpus_captures policy_candidate_correction_review_corpus_captures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_corpus_captures
    ADD CONSTRAINT policy_candidate_correction_review_corpus_captures_pkey PRIMARY KEY (capture_id);


--
-- Name: policy_candidate_correction_review_corpus_controls policy_candidate_correction_review_corpus_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_corpus_controls
    ADD CONSTRAINT policy_candidate_correction_review_corpus_controls_pkey PRIMARY KEY (control_key);


--
-- Name: policy_candidate_correction_review_projection_audit_events policy_candidate_correction_review_projection_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_projection_audit_events
    ADD CONSTRAINT policy_candidate_correction_review_projection_audit_events_pkey PRIMARY KEY (id);


--
-- Name: policy_candidate_correction_review_projection_items policy_candidate_correction_review_projection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_projection_items
    ADD CONSTRAINT policy_candidate_correction_review_projection_items_pkey PRIMARY KEY (snapshot_id, ordinal);


--
-- Name: policy_candidate_correction_review_projections policy_candidate_correction_review_projections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_projections
    ADD CONSTRAINT policy_candidate_correction_review_projections_pkey PRIMARY KEY (snapshot_id);


--
-- Name: policy_change_log policy_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_change_log
    ADD CONSTRAINT policy_change_log_pkey PRIMARY KEY (id);


--
-- Name: policy_feedback_log policy_feedback_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_feedback_log
    ADD CONSTRAINT policy_feedback_log_pkey PRIMARY KEY (id);


--
-- Name: policy_feedback_sources policy_feedback_sources_feedback_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_feedback_sources
    ADD CONSTRAINT policy_feedback_sources_feedback_id_key UNIQUE (feedback_id);


--
-- Name: policy_feedback_sources policy_feedback_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_feedback_sources
    ADD CONSTRAINT policy_feedback_sources_pkey PRIMARY KEY (classification_id);


--
-- Name: policy_identity_evidence_admissions policy_identity_evidence_admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_identity_evidence_admissions
    ADD CONSTRAINT policy_identity_evidence_admissions_pkey PRIMARY KEY (id);


--
-- Name: policy_identity_evidence_admissions policy_identity_evidence_admissions_source_event_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_identity_evidence_admissions
    ADD CONSTRAINT policy_identity_evidence_admissions_source_event_unique UNIQUE (source_id, source_event_id);


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_event_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_event_unique UNIQUE (migration_event_id);


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_idempotency_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_idempotency_unique UNIQUE (idempotency_key);


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_intent_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_intent_unique UNIQUE (intent_id);


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_pkey PRIMARY KEY (id);


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_policy_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_policy_unique UNIQUE (policy_id);


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_snapshot_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_snapshot_unique UNIQUE (rollback_snapshot_id);


--
-- Name: policy_intent_migration_events policy_intent_migration_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_migration_events
    ADD CONSTRAINT policy_intent_migration_events_pkey PRIMARY KEY (id);


--
-- Name: policy_intent_rollback_snapshots policy_intent_rollback_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_rollback_snapshots
    ADD CONSTRAINT policy_intent_rollback_snapshots_pkey PRIMARY KEY (id);


--
-- Name: policy_intent_routing_targets policy_intent_routing_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_routing_targets
    ADD CONSTRAINT policy_intent_routing_targets_pkey PRIMARY KEY (id);


--
-- Name: policy_intent_rules policy_intent_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_rules
    ADD CONSTRAINT policy_intent_rules_pkey PRIMARY KEY (id);


--
-- Name: policy_intent_template_applications policy_intent_template_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_template_applications
    ADD CONSTRAINT policy_intent_template_applications_pkey PRIMARY KEY (id);


--
-- Name: policy_intent_validation_status policy_intent_validation_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_validation_status
    ADD CONSTRAINT policy_intent_validation_status_pkey PRIMARY KEY (id);


--
-- Name: policy_intents policy_intents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intents
    ADD CONSTRAINT policy_intents_pkey PRIMARY KEY (id);


--
-- Name: policy_learning_stats policy_learning_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_learning_stats
    ADD CONSTRAINT policy_learning_stats_pkey PRIMARY KEY (id);


--
-- Name: policy_learning_stats policy_learning_stats_policy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_learning_stats
    ADD CONSTRAINT policy_learning_stats_policy_id_key UNIQUE (policy_id);


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_pkey PRIMARY KEY (id);


--
-- Name: policy_migration_verification_runs policy_migration_verification_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_migration_verification_runs
    ADD CONSTRAINT policy_migration_verification_runs_pkey PRIMARY KEY (id);


--
-- Name: policy_native_intent_change_receipts policy_native_intent_change_receipts_event_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_change_receipts
    ADD CONSTRAINT policy_native_intent_change_receipts_event_unique UNIQUE (migration_event_id);


--
-- Name: policy_native_intent_change_receipts policy_native_intent_change_receipts_idempotency_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_change_receipts
    ADD CONSTRAINT policy_native_intent_change_receipts_idempotency_unique UNIQUE (idempotency_key);


--
-- Name: policy_native_intent_change_receipts policy_native_intent_change_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_change_receipts
    ADD CONSTRAINT policy_native_intent_change_receipts_pkey PRIMARY KEY (id);


--
-- Name: policy_native_intent_change_receipts policy_native_intent_change_receipts_target_intent_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_change_receipts
    ADD CONSTRAINT policy_native_intent_change_receipts_target_intent_unique UNIQUE (target_intent_id);


--
-- Name: policy_native_intent_reconciliation_alert_states policy_native_intent_reconciliation_alert_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_alert_states
    ADD CONSTRAINT policy_native_intent_reconciliation_alert_states_pkey PRIMARY KEY (alert_type_id);


--
-- Name: policy_native_intent_reconciliation_control_events policy_native_intent_reconciliation_control_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_control_events
    ADD CONSTRAINT policy_native_intent_reconciliation_control_events_pkey PRIMARY KEY (id);


--
-- Name: policy_native_intent_reconciliation_controls policy_native_intent_reconciliation_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_controls
    ADD CONSTRAINT policy_native_intent_reconciliation_controls_pkey PRIMARY KEY (control_id);


--
-- Name: policy_native_intent_reconciliation_holds policy_native_intent_reconciliation_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_holds
    ADD CONSTRAINT policy_native_intent_reconciliation_holds_pkey PRIMARY KEY (policy_id);


--
-- Name: policy_native_intent_reconciliation_holds policy_native_intent_reconciliation_holds_released_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_holds
    ADD CONSTRAINT policy_native_intent_reconciliation_holds_released_event_id_key UNIQUE (released_event_id);


--
-- Name: policy_native_intent_reconciliation_holds policy_native_intent_reconciliation_holds_source_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_holds
    ADD CONSTRAINT policy_native_intent_reconciliation_holds_source_event_id_key UNIQUE (source_event_id);


--
-- Name: policy_native_intent_reconciliation_outcomes policy_native_intent_reconciliation_outcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_outcomes
    ADD CONSTRAINT policy_native_intent_reconciliation_outcomes_pkey PRIMARY KEY (id);


--
-- Name: policy_native_intent_reconciliation_outcomes policy_native_intent_reconciliation_outcomes_run_policy_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_outcomes
    ADD CONSTRAINT policy_native_intent_reconciliation_outcomes_run_policy_uniq UNIQUE (run_id, policy_id);


--
-- Name: policy_native_intent_reconciliation_restore_gates policy_native_intent_reconciliation_restore_gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_restore_gates
    ADD CONSTRAINT policy_native_intent_reconciliation_restore_gates_pkey PRIMARY KEY (gate_id);


--
-- Name: policy_native_intent_reconciliation_runs policy_native_intent_reconciliation_runs_key_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_runs
    ADD CONSTRAINT policy_native_intent_reconciliation_runs_key_uniq UNIQUE (run_key);


--
-- Name: policy_native_intent_reconciliation_runs policy_native_intent_reconciliation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_runs
    ADD CONSTRAINT policy_native_intent_reconciliation_runs_pkey PRIMARY KEY (id);


--
-- Name: policy_native_intent_reconciliation_states policy_native_intent_reconciliation_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_states
    ADD CONSTRAINT policy_native_intent_reconciliation_states_pkey PRIMARY KEY (policy_id);


--
-- Name: policy_native_profile_refresh_circuits policy_native_profile_refresh_circuits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_profile_refresh_circuits
    ADD CONSTRAINT policy_native_profile_refresh_circuits_pkey PRIMARY KEY (library_id, source_event_id);


--
-- Name: policy_observed_evidence_provenance_snapshots policy_observed_evidence_provenance_establishment_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_observed_evidence_provenance_snapshots
    ADD CONSTRAINT policy_observed_evidence_provenance_establishment_unique UNIQUE (establishment_id);


--
-- Name: policy_observed_evidence_provenance_snapshots policy_observed_evidence_provenance_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_observed_evidence_provenance_snapshots
    ADD CONSTRAINT policy_observed_evidence_provenance_snapshots_pkey PRIMARY KEY (id);


--
-- Name: policy_overlap_metrics_snapshots policy_overlap_metrics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_overlap_metrics_snapshots
    ADD CONSTRAINT policy_overlap_metrics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: policy_overrides policy_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_overrides
    ADD CONSTRAINT policy_overrides_pkey PRIMARY KEY (id);


--
-- Name: policy_presets policy_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_presets
    ADD CONSTRAINT policy_presets_pkey PRIMARY KEY (id);


--
-- Name: policy_presets policy_presets_policy_id_preset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_presets
    ADD CONSTRAINT policy_presets_policy_id_preset_id_key UNIQUE (policy_id, preset_id);


--
-- Name: policy_profile_refresh_outbox policy_profile_refresh_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_profile_refresh_outbox
    ADD CONSTRAINT policy_profile_refresh_outbox_pkey PRIMARY KEY (id);


--
-- Name: policy_profile_refresh_outbox policy_profile_refresh_outbox_source_event_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_profile_refresh_outbox
    ADD CONSTRAINT policy_profile_refresh_outbox_source_event_unique UNIQUE (source_id, source_event_id);


--
-- Name: policy_runtime_historic_route_safety_refresh_receipt_items policy_runtime_historic_route_safety_refresh_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_runtime_historic_route_safety_refresh_receipt_items
    ADD CONSTRAINT policy_runtime_historic_route_safety_refresh_receipt_items_pkey PRIMARY KEY (receipt_id, classification_id);


--
-- Name: policy_runtime_historic_route_safety_refresh_receipts policy_runtime_historic_route_safety_refresh_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_runtime_historic_route_safety_refresh_receipts
    ADD CONSTRAINT policy_runtime_historic_route_safety_refresh_receipts_pkey PRIMARY KEY (receipt_id);


--
-- Name: policy_runtime_pending_question_cleanup_audits policy_runtime_pending_question_cleanup_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_runtime_pending_question_cleanup_audits
    ADD CONSTRAINT policy_runtime_pending_question_cleanup_audits_pkey PRIMARY KEY (id);


--
-- Name: policy_runtime_pending_question_cleanup_audits policy_runtime_pending_question_cleanup_audits_replay_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_runtime_pending_question_cleanup_audits
    ADD CONSTRAINT policy_runtime_pending_question_cleanup_audits_replay_unique UNIQUE (replay_receipt);


--
-- Name: policy_tuning_cohorts policy_tuning_cohorts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_cohorts
    ADD CONSTRAINT policy_tuning_cohorts_pkey PRIMARY KEY (fingerprint);


--
-- Name: policy_tuning_suggestions policy_tuning_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_suggestions
    ADD CONSTRAINT policy_tuning_suggestions_pkey PRIMARY KEY (id);


--
-- Name: post_upgrade_tasks post_upgrade_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_upgrade_tasks
    ADD CONSTRAINT post_upgrade_tasks_pkey PRIMARY KEY (id);


--
-- Name: post_upgrade_tasks post_upgrade_tasks_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_upgrade_tasks
    ADD CONSTRAINT post_upgrade_tasks_task_id_key UNIQUE (task_id);


--
-- Name: radarr_config radarr_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radarr_config
    ADD CONSTRAINT radarr_config_pkey PRIMARY KEY (id);


--
-- Name: rag_logs rag_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_logs
    ADD CONSTRAINT rag_logs_pkey PRIMARY KEY (id);


--
-- Name: rag_metrics rag_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_metrics
    ADD CONSTRAINT rag_metrics_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: scheduled_tasks scheduled_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: sonarr_config sonarr_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sonarr_config
    ADD CONSTRAINT sonarr_config_pkey PRIMARY KEY (id);


--
-- Name: source_library_policy_links source_library_policy_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_library_policy_links
    ADD CONSTRAINT source_library_policy_links_pkey PRIMARY KEY (id);


--
-- Name: source_library_policy_links source_library_policy_links_source_library_id_source_type_p_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_library_policy_links
    ADD CONSTRAINT source_library_policy_links_source_library_id_source_type_p_key UNIQUE (source_library_id, source_type, policy_id);


--
-- Name: ssl_config ssl_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssl_config
    ADD CONSTRAINT ssl_config_pkey PRIMARY KEY (id);


--
-- Name: task_queue_cleanup_history task_queue_cleanup_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_queue_cleanup_history
    ADD CONSTRAINT task_queue_cleanup_history_pkey PRIMARY KEY (id);


--
-- Name: task_queue task_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT task_queue_pkey PRIMARY KEY (id);


--
-- Name: tavily_config tavily_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tavily_config
    ADD CONSTRAINT tavily_config_pkey PRIMARY KEY (id);


--
-- Name: tmdb_config tmdb_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tmdb_config
    ADD CONSTRAINT tmdb_config_pkey PRIMARY KEY (id);


--
-- Name: classification_embeddings unique_classification_embedding; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_embeddings
    ADD CONSTRAINT unique_classification_embedding UNIQUE (classification_id);


--
-- Name: auto_learned_preferences unique_library_preference; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_learned_preferences
    ADD CONSTRAINT unique_library_preference UNIQUE (library_id, preference_type, preference_value);


--
-- Name: discovered_patterns unique_pattern_per_library; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_patterns
    ADD CONSTRAINT unique_pattern_per_library UNIQUE (pattern_type, pattern_value, library_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: web_search_provider_cache web_search_provider_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_cache
    ADD CONSTRAINT web_search_provider_cache_pkey PRIMARY KEY (cache_key);


--
-- Name: web_search_provider_calibration_policies web_search_provider_calibration_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_calibration_policies
    ADD CONSTRAINT web_search_provider_calibration_policies_pkey PRIMARY KEY (purpose);


--
-- Name: web_search_provider_config web_search_provider_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_config
    ADD CONSTRAINT web_search_provider_config_pkey PRIMARY KEY (id);


--
-- Name: web_search_provider_config web_search_provider_config_provider_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_config
    ADD CONSTRAINT web_search_provider_config_provider_key_key UNIQUE (provider_key);


--
-- Name: web_search_provider_guardrail_events web_search_provider_guardrail_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_guardrail_events
    ADD CONSTRAINT web_search_provider_guardrail_events_pkey PRIMARY KEY (id);


--
-- Name: web_search_provider_health_events web_search_provider_health_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_health_events
    ADD CONSTRAINT web_search_provider_health_events_pkey PRIMARY KEY (id);


--
-- Name: web_search_provider_route_decisions web_search_provider_route_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_route_decisions
    ADD CONSTRAINT web_search_provider_route_decisions_pkey PRIMARY KEY (id);


--
-- Name: web_search_provider_route_decisions web_search_provider_route_decisions_route_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_route_decisions
    ADD CONSTRAINT web_search_provider_route_decisions_route_id_key UNIQUE (route_id);


--
-- Name: web_search_provider_usage web_search_provider_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_search_provider_usage
    ADD CONSTRAINT web_search_provider_usage_pkey PRIMARY KEY (id);


--
-- Name: webhook_config webhook_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_config
    ADD CONSTRAINT webhook_config_pkey PRIMARY KEY (id);


--
-- Name: webhook_log webhook_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_pkey PRIMARY KEY (id);


--
-- Name: idx_api_key_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_key_audit_action ON public.api_key_audit USING btree (action);


--
-- Name: idx_api_key_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_key_audit_created_at ON public.api_key_audit USING btree (created_at);


--
-- Name: idx_api_key_audit_key_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_key_audit_key_id ON public.api_key_audit USING btree (api_key_id);


--
-- Name: idx_api_keys_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_active ON public.api_keys USING btree (is_active);


--
-- Name: idx_api_keys_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_hash ON public.api_keys USING btree (key_hash);


--
-- Name: idx_api_keys_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_prefix ON public.api_keys USING btree (key_prefix);


--
-- Name: idx_app_log_created_at_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_log_created_at_brin ON public.app_log USING brin (created_at) WITH (pages_per_range='128');


--
-- Name: idx_app_log_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_log_level ON public.app_log USING btree (level);


--
-- Name: idx_app_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_notifications_created ON public.app_notifications USING btree (created_at DESC);


--
-- Name: idx_app_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_notifications_unread ON public.app_notifications USING btree (is_read, created_at DESC);


--
-- Name: idx_arr_profiles_cache_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_arr_profiles_cache_type ON public.arr_profiles_cache USING btree (arr_type, profile_type);


--
-- Name: idx_audit_log_created_at_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created_at_brin ON public.audit_log USING brin (created_at) WITH (pages_per_range='128');


--
-- Name: idx_audit_log_media_identity_receipt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_media_identity_receipt ON public.audit_log USING btree (user_id, ((metadata ->> 'reviewId'::text))) WHERE ((action)::text = 'media_identity_confirmed'::text);


--
-- Name: idx_audit_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user ON public.audit_log USING btree (user_id);


--
-- Name: idx_auto_learned_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auto_learned_library ON public.auto_learned_preferences USING btree (library_id);


--
-- Name: idx_auto_learned_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auto_learned_status ON public.auto_learned_preferences USING btree (status);


--
-- Name: idx_auto_learned_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auto_learned_type ON public.auto_learned_preferences USING btree (preference_type);


--
-- Name: idx_backfill_runs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backfill_runs_created_at ON public.backfill_runs USING btree (created_at DESC);


--
-- Name: idx_backfill_runs_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backfill_runs_type_status ON public.backfill_runs USING btree (type, status);


--
-- Name: idx_backup_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_audit_created ON public.backup_audit USING btree (created_at DESC);


--
-- Name: idx_backup_audit_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_audit_operation ON public.backup_audit USING btree (operation);


--
-- Name: idx_backup_audit_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_audit_status ON public.backup_audit USING btree (status);


--
-- Name: idx_backup_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_audit_user ON public.backup_audit USING btree (user_id);


--
-- Name: idx_backup_schedules_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_schedules_enabled ON public.backup_schedules USING btree (is_enabled);


--
-- Name: idx_backup_schedules_last_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_schedules_last_run ON public.backup_schedules USING btree (last_run_at DESC);


--
-- Name: idx_cbv_capability_receipts_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cbv_capability_receipts_actor_id ON public.candidate_bound_verification_capability_receipts USING btree (actor_id, id DESC);


--
-- Name: idx_clarification_responses_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clarification_responses_classification ON public.clarification_responses USING btree (classification_id);


--
-- Name: idx_clarification_responses_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clarification_responses_question ON public.clarification_responses USING btree (question_id);


--
-- Name: idx_classification_corrections_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_corrections_classification ON public.classification_corrections USING btree (classification_id);


--
-- Name: idx_classification_evidence_item_exact; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_classification_evidence_item_exact ON public.classification_evidence USING btree (scope, tmdb_id, media_type) WHERE (((scope)::text = 'item_exact'::text) AND (tmdb_id IS NOT NULL));


--
-- Name: idx_classification_evidence_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_evidence_library ON public.classification_evidence USING btree (library_id);


--
-- Name: idx_classification_evidence_related; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_classification_evidence_related ON public.classification_evidence USING btree (scope, media_type, library_id, evidence_key) WHERE ((scope)::text = ANY (ARRAY[('genre'::character varying)::text, ('studio'::character varying)::text, ('franchise'::character varying)::text, ('certification'::character varying)::text]));


--
-- Name: idx_classification_evidence_scope_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_evidence_scope_status ON public.classification_evidence USING btree (scope, status);


--
-- Name: idx_classification_evidence_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_evidence_tmdb ON public.classification_evidence USING btree (tmdb_id) WHERE (tmdb_id IS NOT NULL);


--
-- Name: idx_classification_history_active_pending_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_classification_history_active_pending_identity ON public.classification_history USING btree (pending_identity_key) WHERE (((status)::text = ANY (ARRAY[('awaiting_decision'::character varying)::text, ('pending_retry'::character varying)::text])) AND (pending_identity_key IS NOT NULL));


--
-- Name: idx_classification_history_active_pending_refresh_inventory; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_active_pending_refresh_inventory ON public.classification_history USING btree (id) WHERE ((status)::text = ANY (ARRAY[('awaiting_decision'::character varying)::text, ('pending_retry'::character varying)::text]));


--
-- Name: idx_classification_history_candidate_bound_verification_observe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_candidate_bound_verification_observe ON public.classification_history USING btree (created_at DESC) WHERE ((metadata #>> '{classification_details,candidate_bound_verification,version}'::text[]) = 'classification.candidate_bound_verification.v1'::text);


--
-- Name: idx_classification_history_canonical_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_canonical_outcome ON public.classification_history USING btree ((
CASE
    WHEN (tmdb_id IS NOT NULL) THEN ((('tmdb:'::text || (media_type)::text) || ':'::text) || (tmdb_id)::text)
    ELSE ((((('title:'::text || (media_type)::text) || ':'::text) || lower(TRIM(BOTH FROM title))) || ':'::text) || COALESCE((year)::text, ''::text))
END), (
CASE
    WHEN (((method)::text <> 'source_library'::text) AND ((status)::text = ANY (ARRAY[('completed'::character varying)::text, ('corrected'::character varying)::text, ('verified'::character varying)::text, ('routed'::character varying)::text]))) THEN 0
    WHEN (((method)::text <> 'source_library'::text) AND ((status)::text = ANY (ARRAY[('awaiting_decision'::character varying)::text, ('pending'::character varying)::text, ('pending_retry'::character varying)::text]))) THEN 1
    WHEN ((method)::text <> 'source_library'::text) THEN 2
    ELSE 3
END), created_at DESC, id DESC);


--
-- Name: idx_classification_history_cast_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_cast_ids ON public.classification_history USING gin (cast_ids public.gin__int_ops);


--
-- Name: idx_classification_history_clarified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_clarified ON public.classification_history USING btree (clarification_status) WHERE (clarification_status IS NOT NULL);


--
-- Name: idx_classification_history_collection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_collection_id ON public.classification_history USING btree (collection_id) WHERE (collection_id IS NOT NULL);


--
-- Name: idx_classification_history_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_created_at_desc ON public.classification_history USING btree (created_at DESC);


--
-- Name: idx_classification_history_current_library_retrieval_observe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_current_library_retrieval_observe ON public.classification_history USING btree (created_at DESC) WHERE ((metadata #>> '{classification_details,current_library_candidate_retrieval_telemetry,version}'::text[]) = 'current_library.candidate_retrieval_telemetry.v1'::text);


--
-- Name: idx_classification_history_director_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_director_name ON public.classification_history USING btree (director_name) WHERE (director_name IS NOT NULL);


--
-- Name: idx_classification_history_genre_names; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_genre_names ON public.classification_history USING gin (genre_names);


--
-- Name: idx_classification_history_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_library ON public.classification_history USING btree (library_id);


--
-- Name: idx_classification_history_library_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_library_name ON public.classification_history USING btree (library_name) WHERE (library_name IS NOT NULL);


--
-- Name: idx_classification_history_null_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_null_tmdb ON public.classification_history USING btree (library_id) WHERE (tmdb_id IS NULL);


--
-- Name: idx_classification_history_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_pending ON public.classification_history USING btree (status) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_classification_history_policy_candidate_correction_analytic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_policy_candidate_correction_analytic ON public.classification_history USING btree (created_at DESC) WHERE ((metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,version}'::text[]) = 'policy.candidate_correction_outcome_attribution.v1'::text);


--
-- Name: idx_classification_history_primary_studio_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_primary_studio_name ON public.classification_history USING btree (primary_studio_name) WHERE (primary_studio_name IS NOT NULL);


--
-- Name: idx_classification_history_profile_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_profile_snapshot ON public.classification_history USING gin (profile_snapshot);


--
-- Name: idx_classification_history_rag_trace_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_rag_trace_mode ON public.classification_history USING btree (((((metadata -> 'classification_details'::text) -> 'rag_loop_trace'::text) ->> 'mode'::text)));


--
-- Name: idx_classification_history_rag_trace_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_rag_trace_outcome ON public.classification_history USING btree ((((((metadata -> 'classification_details'::text) -> 'rag_loop_trace'::text) -> 'decision'::text) ->> 'outcome'::text)));


--
-- Name: idx_classification_history_retry_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_retry_queue ON public.classification_history USING btree (retry_after, status) WHERE (retry_after IS NOT NULL);


--
-- Name: idx_classification_history_route_safety_readiness; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_route_safety_readiness ON public.classification_history USING btree (created_at DESC) WHERE ((metadata #>> '{classification_details,route_safety,version}'::text[]) = 'classification.route_safety.v1'::text);


--
-- Name: idx_classification_history_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_title_trgm ON public.classification_history USING gin (title public.gin_trgm_ops);


--
-- Name: idx_classification_history_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_tmdb ON public.classification_history USING btree (tmdb_id);


--
-- Name: idx_classification_queue_decision_witnesses_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_queue_decision_witnesses_classification ON public.classification_queue_decision_witnesses USING btree (classification_id);


--
-- Name: idx_classification_queue_decision_witnesses_queue_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_queue_decision_witnesses_queue_created ON public.classification_queue_decision_witnesses USING btree (queue_task_id, created_at DESC);


--
-- Name: idx_classification_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_search ON public.classification_history USING gin (search_text);


--
-- Name: idx_confidence_audit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_confidence_audit_date ON public.confidence_settings_audit USING btree (changed_at DESC);


--
-- Name: idx_confidence_audit_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_confidence_audit_key ON public.confidence_settings_audit USING btree (setting_key);


--
-- Name: idx_confidence_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_confidence_audit_user ON public.confidence_settings_audit USING btree (changed_by);


--
-- Name: idx_content_analysis_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_analysis_classification ON public.content_analysis_log USING btree (classification_id);


--
-- Name: idx_content_analysis_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_analysis_tmdb ON public.content_analysis_log USING btree (tmdb_id);


--
-- Name: idx_content_presets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_presets_category ON public.content_presets USING btree (category);


--
-- Name: idx_content_presets_signals; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_presets_signals ON public.content_presets USING gin (signals);


--
-- Name: idx_content_presets_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_presets_system ON public.content_presets USING btree (is_system);


--
-- Name: idx_content_presets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_presets_user ON public.content_presets USING btree (user_id);


--
-- Name: idx_custom_presets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_presets_category ON public.custom_presets USING btree (category);


--
-- Name: idx_dismissed_patterns_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dismissed_patterns_library ON public.dismissed_patterns USING btree (library_id);


--
-- Name: idx_embedding_costs_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embedding_costs_period ON public.embedding_costs USING btree (period_start, provider);


--
-- Name: idx_embedding_errors_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embedding_errors_classification ON public.embedding_errors USING btree (classification_id);


--
-- Name: idx_embedding_errors_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embedding_errors_resolved ON public.embedding_errors USING btree (resolved);


--
-- Name: idx_embeddings_hnsw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embeddings_hnsw ON public.classification_embeddings USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_embeddings_image_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embeddings_image_hash ON public.classification_embeddings USING btree (image_embedding_hash, image_model, image_embedding_size) WHERE (image_embedding_hash IS NOT NULL);


--
-- Name: idx_embeddings_image_hnsw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embeddings_image_hnsw ON public.classification_embeddings USING hnsw (image_embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_embeddings_image_present; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embeddings_image_present ON public.classification_embeddings USING btree (image_provider, image_model) WHERE (image_embedding IS NOT NULL);


--
-- Name: idx_embeddings_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embeddings_provider ON public.classification_embeddings USING btree (provider, model);


--
-- Name: idx_embeddings_stale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embeddings_stale ON public.classification_embeddings USING btree (is_stale) WHERE (is_stale = true);


--
-- Name: idx_enrichment_retry_media_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_retry_media_item ON public.enrichment_retry_queue USING btree (media_item_id);


--
-- Name: idx_enrichment_retry_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_retry_priority ON public.enrichment_retry_queue USING btree (priority, created_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_enrichment_retry_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_retry_status ON public.enrichment_retry_queue USING btree (status, enrichment_type);


--
-- Name: idx_error_log_classification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_classification_id ON public.error_log USING btree (classification_id);


--
-- Name: idx_error_log_correlation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_correlation_id ON public.error_log USING btree (correlation_id);


--
-- Name: idx_error_log_created_at_brin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_created_at_brin ON public.error_log USING brin (created_at) WITH (pages_per_range='128');


--
-- Name: idx_error_log_error_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_error_id ON public.error_log USING btree (error_id);


--
-- Name: idx_error_log_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_level ON public.error_log USING btree (level);


--
-- Name: idx_error_log_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_module ON public.error_log USING btree (module);


--
-- Name: idx_error_log_rag_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_rag_operation ON public.error_log USING btree (rag_operation) WHERE (rag_operation IS NOT NULL);


--
-- Name: idx_error_log_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_resolved ON public.error_log USING btree (resolved);


--
-- Name: idx_error_log_stage_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_stage_reason ON public.error_log USING btree (error_stage, reason_code);


--
-- Name: idx_error_log_unresolved_errors; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_unresolved_errors ON public.error_log USING btree (created_at DESC) WHERE ((resolved = false) AND ((level)::text = 'ERROR'::text));


--
-- Name: idx_error_log_unresolved_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_unresolved_stage ON public.error_log USING btree (error_stage, created_at DESC) WHERE ((resolved = false) AND (error_stage IS NOT NULL));


--
-- Name: idx_historic_route_safety_refresh_receipts_actor_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historic_route_safety_refresh_receipts_actor_recent ON public.policy_runtime_historic_route_safety_refresh_receipts USING btree (actor_id, created_at DESC, receipt_id DESC);


--
-- Name: idx_learned_corrections_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learned_corrections_lookup ON public.learned_corrections USING btree (tmdb_id, media_type);


--
-- Name: idx_learning_conflicts_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_conflicts_library ON public.learning_conflicts USING btree (library_id);


--
-- Name: idx_learning_conflicts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_conflicts_status ON public.learning_conflicts USING btree (resolution_status);


--
-- Name: idx_learning_conflicts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_conflicts_type ON public.learning_conflicts USING btree (conflict_type);


--
-- Name: idx_learning_patterns_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_patterns_library ON public.learning_patterns USING btree (library_id);


--
-- Name: idx_learning_patterns_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_patterns_tmdb ON public.learning_patterns USING btree (tmdb_id);


--
-- Name: idx_learning_rate_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_rate_library ON public.learning_rate_limits USING btree (library_id, learn_timestamp);


--
-- Name: idx_learning_rate_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_rate_user ON public.learning_rate_limits USING btree (user_id, learn_timestamp);


--
-- Name: idx_legacy_rules_migrated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legacy_rules_migrated ON public.library_custom_rules USING btree (migrated_at) WHERE (migrated_at IS NULL);


--
-- Name: idx_legacy_rules_migration_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_legacy_rules_migration_type ON public.library_custom_rules USING btree (migration_type) WHERE (migration_type IS NOT NULL);


--
-- Name: idx_libraries_active_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libraries_active_order ON public.libraries USING btree (id) WHERE (is_active = true);


--
-- Name: idx_libraries_media_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libraries_media_server ON public.libraries USING btree (media_server_id);


--
-- Name: idx_libraries_media_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_libraries_media_type ON public.libraries USING btree (media_type);


--
-- Name: idx_library_arr_mappings_arr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_arr_mappings_arr ON public.library_arr_mappings USING btree (arr_type, arr_config_id);


--
-- Name: idx_library_arr_mappings_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_arr_mappings_library ON public.library_arr_mappings USING btree (library_id);


--
-- Name: idx_library_custom_rules_deprecated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_custom_rules_deprecated ON public.library_custom_rules USING btree (deprecated);


--
-- Name: idx_library_custom_rules_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_custom_rules_library ON public.library_custom_rules USING btree (library_id);


--
-- Name: idx_library_custom_rules_library_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_custom_rules_library_id ON public.library_custom_rules USING btree (library_id);


--
-- Name: idx_library_labels_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_labels_library ON public.library_labels USING btree (library_id);


--
-- Name: idx_library_pattern_suggestions_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_pattern_suggestions_pending ON public.library_pattern_suggestions USING btree (library_id) WHERE ((pending_count > 0) AND (notification_dismissed = false));


--
-- Name: idx_library_policies_library_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_policies_library_id ON public.library_policies USING btree (library_id);


--
-- Name: idx_library_policies_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_policies_priority ON public.library_policies USING btree (priority);


--
-- Name: idx_library_policies_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_policies_source ON public.library_policies USING gin (source_library_ids);


--
-- Name: idx_library_profile_inventory_dirty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_profile_inventory_dirty ON public.library_profile_inventory_state USING btree (changed_at, library_id) WHERE (revision > refreshed_revision);


--
-- Name: idx_library_profiles_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_profiles_library ON public.library_profiles USING btree (library_id);


--
-- Name: idx_library_rules_exception; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_rules_exception ON public.library_rules USING btree (is_exception);


--
-- Name: idx_library_rules_library_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_rules_library_id ON public.library_rules USING btree (library_id);


--
-- Name: idx_library_rules_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_rules_type ON public.library_rules USING btree (rule_type);


--
-- Name: idx_library_rules_v2_conditions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_rules_v2_conditions ON public.library_rules_v2 USING gin (conditions);


--
-- Name: idx_library_rules_v2_library_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_rules_v2_library_id ON public.library_rules_v2 USING btree (library_id);


--
-- Name: idx_media_collections_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_collections_library ON public.media_server_collections USING btree (library_id);


--
-- Name: idx_media_items_content_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_content_rating ON public.media_server_items USING btree (content_rating) WHERE (original_rating IS NULL);


--
-- Name: idx_media_items_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_library ON public.media_server_items USING btree (library_id);


--
-- Name: idx_media_items_library_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_library_order ON public.media_server_items USING btree (library_id, id);


--
-- Name: idx_media_items_media_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_media_server ON public.media_server_items USING btree (media_server_id);


--
-- Name: idx_media_items_media_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_media_type ON public.media_server_items USING btree (media_type);


--
-- Name: idx_media_items_original_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_original_rating ON public.media_server_items USING btree (original_rating);


--
-- Name: idx_media_items_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_items_tmdb ON public.media_server_items USING btree (tmdb_id);


--
-- Name: idx_media_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_requests_status ON public.media_requests USING btree (request_status);


--
-- Name: idx_media_requests_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_requests_tmdb ON public.media_requests USING btree (tmdb_id);


--
-- Name: idx_media_server_client_identifier; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_media_server_client_identifier ON public.media_server USING btree (client_identifier) WHERE (client_identifier IS NOT NULL);


--
-- Name: idx_media_server_items_enrichment_provider_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_server_items_enrichment_provider_state ON public.media_server_items USING btree (enrichment_provider_state);


--
-- Name: idx_media_server_items_enrichment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_server_items_enrichment_status ON public.media_server_items USING btree (enrichment_status);


--
-- Name: idx_media_server_items_identity_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_server_items_identity_review ON public.media_server_items USING btree (id) WHERE ((tmdb_id IS NULL) AND ((media_type)::text = ANY (ARRAY[('movie'::character varying)::text, ('tv'::character varying)::text])) AND (metadata @> '{"tmdb_resolution": {"status": "review_required", "version": 1}}'::jsonb));


--
-- Name: idx_media_server_type_url_legacy; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_media_server_type_url_legacy ON public.media_server USING btree (type, url) WHERE (client_identifier IS NULL);


--
-- Name: idx_path_mappings_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_path_mappings_active ON public.path_mappings USING btree (is_active);


--
-- Name: idx_path_mappings_arr_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_path_mappings_arr_path ON public.path_mappings USING btree (arr_path);


--
-- Name: idx_pattern_match_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pattern_match_classification ON public.pattern_match_log USING btree (classification_id);


--
-- Name: idx_pattern_match_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pattern_match_created ON public.pattern_match_log USING btree (created_at DESC);


--
-- Name: idx_pattern_match_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pattern_match_pattern ON public.pattern_match_log USING btree (pattern_id);


--
-- Name: idx_patterns_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patterns_confidence ON public.discovered_patterns USING btree (confidence DESC);


--
-- Name: idx_patterns_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patterns_library ON public.discovered_patterns USING btree (library_id);


--
-- Name: idx_patterns_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patterns_type_status ON public.discovered_patterns USING btree (pattern_type, status);


--
-- Name: idx_pccrc_capture_evaluation_active_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pccrc_capture_evaluation_active_revision ON public.policy_candidate_correction_review_corpus_captures USING btree (configuration_revision, expires_at, score_margin_band_id, selection_status_id);


--
-- Name: idx_policy_authoring_proposals_actor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_authoring_proposals_actor_created ON public.policy_authoring_proposals USING btree (actor_id, created_at DESC);


--
-- Name: idx_policy_authoring_proposals_library_state_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_authoring_proposals_library_state_expiry ON public.policy_authoring_proposals USING btree (library_id, state, expires_at);


--
-- Name: idx_policy_authorized_outcome_receipts_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_authorized_outcome_receipts_classification ON public.policy_authorized_outcome_source_event_receipts USING btree (classification_id, created_at DESC, id DESC);


--
-- Name: idx_policy_backup_restore_verifications_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_backup_restore_verifications_verified ON public.policy_backup_restore_verifications USING btree (verified_at DESC, id DESC);


--
-- Name: idx_policy_candidate_correction_review_corpus_audit_events_rece; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_candidate_correction_review_corpus_audit_events_rece ON public.policy_candidate_correction_review_corpus_audit_events USING btree (occurred_at DESC, id DESC);


--
-- Name: idx_policy_candidate_correction_review_corpus_capture_audit_eve; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_candidate_correction_review_corpus_capture_audit_eve ON public.policy_candidate_correction_review_corpus_capture_audit_events USING btree (occurred_at DESC, id DESC);


--
-- Name: idx_policy_candidate_correction_review_corpus_captures_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_candidate_correction_review_corpus_captures_expiry ON public.policy_candidate_correction_review_corpus_captures USING btree (expires_at, capture_id);


--
-- Name: idx_policy_candidate_correction_review_projection_audit_events_; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_candidate_correction_review_projection_audit_events_ ON public.policy_candidate_correction_review_projection_audit_events USING btree (occurred_at DESC, id DESC);


--
-- Name: idx_policy_candidate_correction_review_projections_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_candidate_correction_review_projections_active ON public.policy_candidate_correction_review_projections USING btree (configuration_revision, expires_at DESC, created_at DESC);


--
-- Name: idx_policy_change_log_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_change_log_date ON public.policy_change_log USING btree (applied_at);


--
-- Name: idx_policy_change_log_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_change_log_policy ON public.policy_change_log USING btree (policy_id);


--
-- Name: idx_policy_change_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_change_log_type ON public.policy_change_log USING btree (change_type);


--
-- Name: idx_policy_feedback_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_feedback_date ON public.policy_feedback_log USING btree (prompted_at);


--
-- Name: idx_policy_feedback_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_feedback_library ON public.policy_feedback_log USING btree (selected_library_id);


--
-- Name: idx_policy_feedback_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_feedback_policy ON public.policy_feedback_log USING btree (selected_policy_id);


--
-- Name: idx_policy_feedback_prompted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_feedback_prompted_at ON public.policy_feedback_log USING btree (prompted_at);


--
-- Name: idx_policy_feedback_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_feedback_tmdb ON public.policy_feedback_log USING btree (tmdb_id);


--
-- Name: idx_policy_feedback_was_correction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_feedback_was_correction ON public.policy_feedback_log USING btree (was_correction);


--
-- Name: idx_policy_identity_evidence_admissions_library_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_identity_evidence_admissions_library_created ON public.policy_identity_evidence_admissions USING btree (library_id, created_at DESC, id DESC);


--
-- Name: idx_policy_initial_intent_establishments_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_initial_intent_establishments_library ON public.policy_initial_intent_establishments USING btree (library_id, established_at DESC, id DESC);


--
-- Name: idx_policy_intent_migration_events_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intent_migration_events_state ON public.policy_intent_migration_events USING btree (policy_id, event_type, created_at);


--
-- Name: idx_policy_intent_rollback_snapshots_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intent_rollback_snapshots_expiry ON public.policy_intent_rollback_snapshots USING btree (policy_id, expires_at);


--
-- Name: idx_policy_intent_routing_targets_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intent_routing_targets_lookup ON public.policy_intent_routing_targets USING btree (intent_id, library_id, target_status);


--
-- Name: idx_policy_intent_rules_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intent_rules_lookup ON public.policy_intent_rules USING btree (intent_id, intent_role, signal_type);


--
-- Name: idx_policy_intent_rules_values_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intent_rules_values_gin ON public.policy_intent_rules USING gin ("values");


--
-- Name: idx_policy_intent_template_applications_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intent_template_applications_lookup ON public.policy_intent_template_applications USING btree (intent_id, preset_id);


--
-- Name: idx_policy_intent_validation_status_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intent_validation_status_lookup ON public.policy_intent_validation_status USING btree (intent_id, status, validated_at);


--
-- Name: idx_policy_intents_library_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intents_library_lookup ON public.policy_intents USING btree (library_id);


--
-- Name: idx_policy_intents_one_active_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_policy_intents_one_active_policy ON public.policy_intents USING btree (policy_id) WHERE (active = true);


--
-- Name: idx_policy_intents_policy_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intents_policy_lookup ON public.policy_intents USING btree (policy_id);


--
-- Name: idx_policy_intents_validation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_intents_validation_status ON public.policy_intents USING btree (validation_status);


--
-- Name: idx_policy_learning_stats_accuracy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_learning_stats_accuracy ON public.policy_learning_stats USING btree (accuracy_rate);


--
-- Name: idx_policy_learning_stats_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_learning_stats_policy ON public.policy_learning_stats USING btree (policy_id);


--
-- Name: idx_policy_library_rebuild_execution_gates_active_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_policy_library_rebuild_execution_gates_active_policy ON public.policy_library_rebuild_execution_gates USING btree (policy_id) WHERE ((state)::text = ANY (ARRAY[('snapshot_persisting'::character varying)::text, ('snapshot_persisted'::character varying)::text]));


--
-- Name: idx_policy_library_rebuild_execution_gates_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_policy_library_rebuild_execution_gates_idempotency ON public.policy_library_rebuild_execution_gates USING btree (idempotency_key);


--
-- Name: idx_policy_library_rebuild_execution_gates_replacement_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_library_rebuild_execution_gates_replacement_intent ON public.policy_library_rebuild_execution_gates USING btree (replacement_intent_id) WHERE (replacement_intent_id IS NOT NULL);


--
-- Name: idx_policy_library_rebuild_execution_gates_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_library_rebuild_execution_gates_snapshot ON public.policy_library_rebuild_execution_gates USING btree (rollback_snapshot_id) WHERE (rollback_snapshot_id IS NOT NULL);


--
-- Name: idx_policy_library_rebuild_execution_gates_transition; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_policy_library_rebuild_execution_gates_transition ON public.policy_library_rebuild_execution_gates USING btree (transition_fingerprint);


--
-- Name: idx_policy_library_rebuild_execution_gates_verification_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_library_rebuild_execution_gates_verification_run ON public.policy_library_rebuild_execution_gates USING btree (verification_run_id) WHERE (verification_run_id IS NOT NULL);


--
-- Name: idx_policy_migration_verification_runs_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_policy_migration_verification_runs_idempotency ON public.policy_migration_verification_runs USING btree (idempotency_key);


--
-- Name: idx_policy_migration_verification_runs_snapshot_gate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_migration_verification_runs_snapshot_gate ON public.policy_migration_verification_runs USING btree (policy_id, intent_id, library_id, verifier_status_id, created_at DESC, id DESC);


--
-- Name: idx_policy_migration_verification_runs_transition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_migration_verification_runs_transition ON public.policy_migration_verification_runs USING btree (policy_id, acceptance_transition_fingerprint, created_at DESC, id DESC);


--
-- Name: idx_policy_native_intent_change_receipts_actor_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_change_receipts_actor_policy ON public.policy_native_intent_change_receipts USING btree (actor_id, policy_id, created_at DESC, id DESC);


--
-- Name: idx_policy_native_intent_change_receipts_retention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_change_receipts_retention ON public.policy_native_intent_change_receipts USING btree (created_at, id);


--
-- Name: idx_policy_native_intent_reconciliation_control_events_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_reconciliation_control_events_occurred ON public.policy_native_intent_reconciliation_control_events USING btree (occurred_at DESC, id DESC);


--
-- Name: idx_policy_native_intent_reconciliation_holds_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_reconciliation_holds_active ON public.policy_native_intent_reconciliation_holds USING btree (policy_id, held_at) WHERE ((hold_state)::text = 'active'::text);


--
-- Name: idx_policy_native_intent_reconciliation_outcomes_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_reconciliation_outcomes_policy ON public.policy_native_intent_reconciliation_outcomes USING btree (policy_id, evaluated_at DESC, id DESC);


--
-- Name: idx_policy_native_intent_reconciliation_outcomes_retention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_reconciliation_outcomes_retention ON public.policy_native_intent_reconciliation_outcomes USING btree (created_at, id);


--
-- Name: idx_policy_native_intent_reconciliation_runs_finished; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_reconciliation_runs_finished ON public.policy_native_intent_reconciliation_runs USING btree (finished_at, id);


--
-- Name: idx_policy_native_intent_reconciliation_states_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_reconciliation_states_outcome ON public.policy_native_intent_reconciliation_states USING btree (outcome_state, evaluated_at, policy_id);


--
-- Name: idx_policy_native_intent_reconciliation_states_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_intent_reconciliation_states_retry ON public.policy_native_intent_reconciliation_states USING btree (retry_not_before, policy_id) WHERE ((outcome_state)::text = ANY (ARRAY[('deferred_retry'::character varying)::text, ('system_failure'::character varying)::text]));


--
-- Name: idx_policy_native_profile_refresh_circuits_probe_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_profile_refresh_circuits_probe_due ON public.policy_native_profile_refresh_circuits USING btree (next_probe_at, library_id) WHERE ((circuit_state)::text = 'open'::text);


--
-- Name: idx_policy_native_profile_refresh_circuits_retention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_native_profile_refresh_circuits_retention ON public.policy_native_profile_refresh_circuits USING btree (updated_at, library_id) WHERE ((circuit_state)::text = ANY (ARRAY[('closed'::character varying)::text, ('open'::character varying)::text, ('half_open'::character varying)::text]));


--
-- Name: idx_policy_observed_evidence_provenance_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_observed_evidence_provenance_expiry ON public.policy_observed_evidence_provenance_snapshots USING btree (expires_at, id) WHERE (payload_redacted = false);


--
-- Name: idx_policy_observed_evidence_provenance_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_observed_evidence_provenance_policy ON public.policy_observed_evidence_provenance_snapshots USING btree (policy_id, created_at DESC, id DESC);


--
-- Name: idx_policy_overlap_metrics_snapshots_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_overlap_metrics_snapshots_created_at ON public.policy_overlap_metrics_snapshots USING btree (created_at DESC);


--
-- Name: idx_policy_overlap_metrics_snapshots_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_overlap_metrics_snapshots_reason ON public.policy_overlap_metrics_snapshots USING btree (snapshot_reason, created_at DESC);


--
-- Name: idx_policy_overlap_metrics_snapshots_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_overlap_metrics_snapshots_session_id ON public.policy_overlap_metrics_snapshots USING btree (session_id, created_at DESC);


--
-- Name: idx_policy_overrides_policy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_overrides_policy_id ON public.policy_overrides USING btree (policy_id);


--
-- Name: idx_policy_overrides_signal_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_overrides_signal_type ON public.policy_overrides USING btree (signal_type);


--
-- Name: idx_policy_presets_policy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_presets_policy_id ON public.policy_presets USING btree (policy_id);


--
-- Name: idx_policy_presets_preset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_presets_preset_id ON public.policy_presets USING btree (preset_id);


--
-- Name: idx_policy_profile_refresh_outbox_active_library; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_policy_profile_refresh_outbox_active_library ON public.policy_profile_refresh_outbox USING btree (library_id) WHERE ((processing_state)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text]));


--
-- Name: idx_policy_profile_refresh_outbox_library_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_profile_refresh_outbox_library_created ON public.policy_profile_refresh_outbox USING btree (library_id, created_at, id);


--
-- Name: idx_policy_profile_refresh_outbox_pending_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_profile_refresh_outbox_pending_available ON public.policy_profile_refresh_outbox USING btree (available_at, created_at, id) WHERE ((processing_state)::text = 'pending'::text);


--
-- Name: idx_policy_profile_refresh_outbox_processing_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_profile_refresh_outbox_processing_lease ON public.policy_profile_refresh_outbox USING btree (lease_expires_at, id) WHERE ((processing_state)::text = 'processing'::text);


--
-- Name: idx_policy_runtime_pending_question_cleanup_audits_classificati; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_runtime_pending_question_cleanup_audits_classificati ON public.policy_runtime_pending_question_cleanup_audits USING btree (classification_id, created_at DESC, id DESC);


--
-- Name: idx_policy_tuning_cohorts_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_tuning_cohorts_policy ON public.policy_tuning_cohorts USING btree (policy_id);


--
-- Name: idx_policy_tuning_suggestions_cohort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_tuning_suggestions_cohort ON public.policy_tuning_suggestions USING btree (cohort_fingerprint);


--
-- Name: idx_post_upgrade_tasks_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_upgrade_tasks_task_id ON public.post_upgrade_tasks USING btree (task_id);


--
-- Name: idx_post_upgrade_tasks_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_upgrade_tasks_version ON public.post_upgrade_tasks USING btree (version);


--
-- Name: idx_profile_refresh_inventory_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_refresh_inventory_latest ON public.policy_profile_refresh_outbox USING btree (library_id, id DESC) WHERE ((request_type)::text = 'inventory_change'::text);


--
-- Name: idx_rag_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_logs_created_at ON public.rag_logs USING btree (created_at DESC);


--
-- Name: idx_rag_logs_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_logs_level ON public.rag_logs USING btree (level);


--
-- Name: idx_rag_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_logs_type ON public.rag_logs USING btree (type);


--
-- Name: idx_rag_metrics_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_metrics_operation ON public.rag_metrics USING btree (operation, period_start DESC);


--
-- Name: idx_rag_metrics_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_metrics_period ON public.rag_metrics USING btree (period_start DESC);


--
-- Name: idx_rag_metrics_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_metrics_success ON public.rag_metrics USING btree (success, operation);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_revoked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_revoked_at ON public.refresh_tokens USING btree (revoked_at) WHERE (revoked_at IS NOT NULL);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_scheduled_tasks_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_tasks_next_run ON public.scheduled_tasks USING btree (next_run_at) WHERE (enabled = true);


--
-- Name: idx_source_library_links_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_library_links_policy ON public.source_library_policy_links USING btree (policy_id);


--
-- Name: idx_source_library_links_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_source_library_links_source ON public.source_library_policy_links USING btree (source_library_id, source_type);


--
-- Name: idx_sync_status_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_status_library ON public.media_server_sync_status USING btree (library_id);


--
-- Name: idx_sync_status_media_server; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_status_media_server ON public.media_server_sync_status USING btree (media_server_id);


--
-- Name: idx_sync_status_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_status_status ON public.media_server_sync_status USING btree (status);


--
-- Name: idx_task_queue_active_item_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_task_queue_active_item_dedup ON public.task_queue USING btree (task_type, ((payload ->> 'media_item_id'::text))) WHERE ((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text]));


--
-- Name: idx_task_queue_active_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_active_stage ON public.task_queue USING btree (current_stage) WHERE (((status)::text = 'processing'::text) AND (current_stage IS NOT NULL));


--
-- Name: idx_task_queue_cleanup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_cleanup ON public.task_queue USING btree (created_at) WHERE ((status)::text = ANY (ARRAY[('completed'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text]));


--
-- Name: idx_task_queue_cleanup_history_cap_trim_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_cleanup_history_cap_trim_created_at ON public.task_queue_cleanup_history USING btree (created_at DESC) WHERE (count_cap_deleted > 0);


--
-- Name: idx_task_queue_cleanup_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_cleanup_history_created_at ON public.task_queue_cleanup_history USING btree (created_at DESC);


--
-- Name: idx_task_queue_cleanup_history_type_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_cleanup_history_type_created_at ON public.task_queue_cleanup_history USING btree (cleanup_type, created_at DESC);


--
-- Name: idx_task_queue_dequeue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_dequeue ON public.task_queue USING btree (priority DESC, created_at, next_retry_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_task_queue_next_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_next_retry ON public.task_queue USING btree (next_retry_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_task_queue_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_priority ON public.task_queue USING btree (priority DESC, created_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_task_queue_processing_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_processing_classification ON public.task_queue USING btree (id) WHERE (((status)::text = 'processing'::text) AND ((task_type)::text = 'classification'::text));


--
-- Name: idx_task_queue_processing_stale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_processing_stale ON public.task_queue USING btree (started_at) WHERE ((status)::text = 'processing'::text);


--
-- Name: idx_task_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_status ON public.task_queue USING btree (status);


--
-- Name: idx_task_queue_task_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_task_type_status ON public.task_queue USING btree (task_type, status);


--
-- Name: idx_task_queue_visible_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_visible_at ON public.task_queue USING btree (visible_at) WHERE (((status)::text = 'processing'::text) AND (visible_at IS NOT NULL));


--
-- Name: idx_tuning_suggestions_applied_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tuning_suggestions_applied_at ON public.policy_tuning_suggestions USING btree (applied_at);


--
-- Name: idx_tuning_suggestions_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tuning_suggestions_policy ON public.policy_tuning_suggestions USING btree (policy_id);


--
-- Name: idx_tuning_suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tuning_suggestions_status ON public.policy_tuning_suggestions USING btree (status);


--
-- Name: idx_tuning_suggestions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tuning_suggestions_type ON public.policy_tuning_suggestions USING btree (suggestion_type);


--
-- Name: idx_users_locked_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_locked_until ON public.users USING btree (locked_until) WHERE (locked_until IS NOT NULL);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_web_search_provider_cache_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_cache_expiry ON public.web_search_provider_cache USING btree (expires_at);


--
-- Name: idx_web_search_provider_cache_provider_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_cache_provider_purpose ON public.web_search_provider_cache USING btree (provider_key, purpose, expires_at DESC);


--
-- Name: idx_web_search_provider_cache_query_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_cache_query_hash ON public.web_search_provider_cache USING btree (query_hash);


--
-- Name: idx_web_search_provider_config_cooldown; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_config_cooldown ON public.web_search_provider_config USING btree (cooldown_until) WHERE (cooldown_until IS NOT NULL);


--
-- Name: idx_web_search_provider_config_enabled_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_config_enabled_priority ON public.web_search_provider_config USING btree (is_enabled, priority, provider_key);


--
-- Name: idx_web_search_provider_guardrail_events_code_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_guardrail_events_code_time ON public.web_search_provider_guardrail_events USING btree (guardrail_code, created_at DESC);


--
-- Name: idx_web_search_provider_guardrail_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_guardrail_events_created ON public.web_search_provider_guardrail_events USING btree (created_at DESC, id DESC);


--
-- Name: idx_web_search_provider_guardrail_events_provider_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_guardrail_events_provider_time ON public.web_search_provider_guardrail_events USING btree (provider_key, created_at DESC) WHERE (provider_key IS NOT NULL);


--
-- Name: idx_web_search_provider_guardrail_events_purpose_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_guardrail_events_purpose_time ON public.web_search_provider_guardrail_events USING btree (purpose, created_at DESC);


--
-- Name: idx_web_search_provider_health_events_cooldown; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_health_events_cooldown ON public.web_search_provider_health_events USING btree (cooldown_until DESC) WHERE (cooldown_until IS NOT NULL);


--
-- Name: idx_web_search_provider_health_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_health_events_created ON public.web_search_provider_health_events USING btree (created_at DESC, id DESC);


--
-- Name: idx_web_search_provider_health_events_provider_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_health_events_provider_time ON public.web_search_provider_health_events USING btree (provider_key, created_at DESC);


--
-- Name: idx_web_search_provider_health_events_type_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_health_events_type_time ON public.web_search_provider_health_events USING btree (event_type, created_at DESC);


--
-- Name: idx_web_search_provider_route_decisions_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_route_decisions_classification ON public.web_search_provider_route_decisions USING btree (classification_id) WHERE (classification_id IS NOT NULL);


--
-- Name: idx_web_search_provider_route_decisions_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_route_decisions_correlation ON public.web_search_provider_route_decisions USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);


--
-- Name: idx_web_search_provider_route_decisions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_route_decisions_created ON public.web_search_provider_route_decisions USING btree (created_at DESC, id DESC);


--
-- Name: idx_web_search_provider_route_decisions_final_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_route_decisions_final_time ON public.web_search_provider_route_decisions USING btree (final_provider_key, created_at DESC) WHERE (final_provider_key IS NOT NULL);


--
-- Name: idx_web_search_provider_route_decisions_outcome_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_route_decisions_outcome_time ON public.web_search_provider_route_decisions USING btree (outcome, created_at DESC);


--
-- Name: idx_web_search_provider_route_decisions_selected_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_route_decisions_selected_time ON public.web_search_provider_route_decisions USING btree (selected_provider_key, created_at DESC) WHERE (selected_provider_key IS NOT NULL);


--
-- Name: idx_web_search_provider_usage_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_usage_classification ON public.web_search_provider_usage USING btree (classification_id) WHERE (classification_id IS NOT NULL);


--
-- Name: idx_web_search_provider_usage_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_usage_correlation ON public.web_search_provider_usage USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);


--
-- Name: idx_web_search_provider_usage_provider_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_usage_provider_time ON public.web_search_provider_usage USING btree (provider_key, searched_at DESC);


--
-- Name: idx_web_search_provider_usage_searched_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_usage_searched_at ON public.web_search_provider_usage USING btree (searched_at);


--
-- Name: idx_web_search_provider_usage_status_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_search_provider_usage_status_time ON public.web_search_provider_usage USING btree (status, searched_at DESC);


--
-- Name: idx_webhook_log_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_config ON public.webhook_log USING btree (webhook_config_id);


--
-- Name: idx_webhook_log_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_received ON public.webhook_log USING btree (received_at DESC);


--
-- Name: idx_webhook_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_status ON public.webhook_log USING btree (processing_status);


--
-- Name: idx_webhook_log_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_tmdb ON public.webhook_log USING btree (tmdb_id);


--
-- Name: idx_webhook_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_log_type ON public.webhook_log USING btree (webhook_type);


--
-- Name: candidate_bound_verification_capability_receipts cbv_capability_receipts_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cbv_capability_receipts_append_only BEFORE DELETE OR UPDATE ON public.candidate_bound_verification_capability_receipts FOR EACH ROW EXECUTE FUNCTION public.enforce_cbv_capability_receipts_append_only();


--
-- Name: classification_history classification_history_totals_sync_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classification_history_totals_sync_trigger AFTER INSERT OR DELETE OR UPDATE OF status ON public.classification_history FOR EACH ROW EXECUTE FUNCTION public.sync_classification_history_totals();


--
-- Name: classification_history classification_search_text_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classification_search_text_trigger BEFORE INSERT OR UPDATE ON public.classification_history FOR EACH ROW EXECUTE FUNCTION public.update_classification_search_text();


--
-- Name: media_server_items library_observation_clock_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER library_observation_clock_update AFTER UPDATE ON public.media_server_items REFERENCING OLD TABLE AS old_items NEW TABLE AS new_items FOR EACH STATEMENT EXECUTE FUNCTION public.capture_library_observation_clock_change();


--
-- Name: media_server_items library_profile_inventory_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER library_profile_inventory_delete AFTER DELETE ON public.media_server_items REFERENCING OLD TABLE AS old_items FOR EACH STATEMENT EXECUTE FUNCTION public.capture_library_profile_inventory_change();


--
-- Name: media_server_items library_profile_inventory_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER library_profile_inventory_insert AFTER INSERT ON public.media_server_items REFERENCING NEW TABLE AS new_items FOR EACH STATEMENT EXECUTE FUNCTION public.capture_library_profile_inventory_change();


--
-- Name: media_server_items library_profile_inventory_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER library_profile_inventory_truncate AFTER TRUNCATE ON public.media_server_items FOR EACH STATEMENT EXECUTE FUNCTION public.capture_library_profile_inventory_change();


--
-- Name: media_server_items library_profile_inventory_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER library_profile_inventory_update AFTER UPDATE ON public.media_server_items REFERENCING OLD TABLE AS old_items NEW TABLE AS new_items FOR EACH STATEMENT EXECUTE FUNCTION public.capture_library_profile_inventory_change();


--
-- Name: policy_authorized_outcome_source_event_receipts policy_authorized_outcome_receipt_mutation_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_authorized_outcome_receipt_mutation_guard BEFORE DELETE OR UPDATE ON public.policy_authorized_outcome_source_event_receipts FOR EACH ROW EXECUTE FUNCTION public.guard_policy_authorized_outcome_receipt_mutation();


--
-- Name: policy_backup_restore_verifications policy_backup_restore_verification_mutation_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_backup_restore_verification_mutation_guard BEFORE DELETE OR UPDATE ON public.policy_backup_restore_verifications FOR EACH ROW EXECUTE FUNCTION public.guard_policy_backup_restore_verification_mutation();


--
-- Name: policy_candidate_correction_review_corpus_audit_events policy_candidate_correction_review_corpus_audit_event_mutation_; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_candidate_correction_review_corpus_audit_event_mutation_ BEFORE DELETE OR UPDATE ON public.policy_candidate_correction_review_corpus_audit_events FOR EACH ROW EXECUTE FUNCTION public.guard_policy_candidate_correction_review_corpus_audit_event_mut();


--
-- Name: policy_candidate_correction_review_corpus_capture_audit_events policy_candidate_correction_review_corpus_capture_audit_event_m; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_candidate_correction_review_corpus_capture_audit_event_m BEFORE DELETE OR UPDATE ON public.policy_candidate_correction_review_corpus_capture_audit_events FOR EACH ROW EXECUTE FUNCTION public.guard_policy_candidate_correction_review_corpus_capture_audit_e();


--
-- Name: policy_candidate_correction_review_projection_audit_events policy_candidate_correction_review_projection_audit_event_mutat; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_candidate_correction_review_projection_audit_event_mutat BEFORE DELETE OR UPDATE ON public.policy_candidate_correction_review_projection_audit_events FOR EACH ROW EXECUTE FUNCTION public.guard_policy_candidate_correction_review_projection_audit_event();


--
-- Name: policy_identity_evidence_admissions policy_identity_evidence_admission_mutation_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_identity_evidence_admission_mutation_guard BEFORE DELETE OR UPDATE ON public.policy_identity_evidence_admissions FOR EACH ROW EXECUTE FUNCTION public.guard_policy_identity_evidence_admission_mutation();


--
-- Name: policy_intent_rules policy_intent_rules_active_purpose_rule_chk; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER policy_intent_rules_active_purpose_rule_chk AFTER INSERT OR DELETE OR UPDATE ON public.policy_intent_rules DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_policy_intent_active_purpose_rule();


--
-- Name: policy_intents policy_intents_active_purpose_rule_chk; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER policy_intents_active_purpose_rule_chk AFTER INSERT OR UPDATE OF active, source, inference_state, validation_status ON public.policy_intents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_policy_intent_active_purpose_rule();


--
-- Name: policy_migration_verification_runs policy_migration_verification_run_mutation_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_migration_verification_run_mutation_guard BEFORE DELETE OR UPDATE ON public.policy_migration_verification_runs FOR EACH ROW EXECUTE FUNCTION public.guard_policy_migration_verification_run_mutation();


--
-- Name: policy_native_intent_change_receipts policy_native_intent_change_receipt_mutation_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_native_intent_change_receipt_mutation_guard BEFORE DELETE OR UPDATE ON public.policy_native_intent_change_receipts FOR EACH ROW EXECUTE FUNCTION public.guard_policy_native_intent_change_receipt_mutation();


--
-- Name: policy_observed_evidence_provenance_snapshots policy_observed_evidence_provenance_snapshot_update_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_observed_evidence_provenance_snapshot_update_guard BEFORE UPDATE ON public.policy_observed_evidence_provenance_snapshots FOR EACH ROW EXECUTE FUNCTION public.guard_policy_observed_evidence_provenance_snapshot_update();


--
-- Name: policy_runtime_pending_question_cleanup_audits policy_runtime_pending_question_cleanup_audit_mutation_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_runtime_pending_question_cleanup_audit_mutation_guard BEFORE DELETE OR UPDATE ON public.policy_runtime_pending_question_cleanup_audits FOR EACH ROW EXECUTE FUNCTION public.guard_policy_runtime_pending_question_cleanup_audit_mutation();


--
-- Name: policy_tuning_cohorts policy_tuning_cohorts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER policy_tuning_cohorts_immutable BEFORE UPDATE ON public.policy_tuning_cohorts FOR EACH ROW EXECUTE FUNCTION public.reject_policy_tuning_cohort_update();


--
-- Name: media_server_items reset_inventory_tmdb_observation_clocks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reset_inventory_tmdb_observation_clocks BEFORE UPDATE OF tmdb_id, media_type ON public.media_server_items FOR EACH ROW WHEN (((old.tmdb_id IS DISTINCT FROM new.tmdb_id) OR ((old.media_type)::text IS DISTINCT FROM (new.media_type)::text))) EXECUTE FUNCTION public.reset_inventory_tmdb_observation_clocks();


--
-- Name: classification_evidence trg_classification_evidence_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_classification_evidence_updated_at BEFORE UPDATE ON public.classification_evidence FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: embedding_provider_availability trg_embedding_provider_availability_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_embedding_provider_availability_updated_at BEFORE UPDATE ON public.embedding_provider_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: libraries trg_libraries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_libraries_updated_at BEFORE UPDATE ON public.libraries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: library_custom_rules trg_library_custom_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_library_custom_rules_updated_at BEFORE UPDATE ON public.library_custom_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_config trg_notification_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notification_config_updated_at BEFORE UPDATE ON public.notification_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ollama_config trg_ollama_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ollama_config_updated_at BEFORE UPDATE ON public.ollama_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: radarr_config trg_radarr_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radarr_config_updated_at BEFORE UPDATE ON public.radarr_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: settings trg_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sonarr_config trg_sonarr_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sonarr_config_updated_at BEFORE UPDATE ON public.sonarr_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tmdb_config trg_tmdb_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tmdb_config_updated_at BEFORE UPDATE ON public.tmdb_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: library_rules_v2 trigger_library_rules_v2_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_library_rules_v2_updated_at BEFORE UPDATE ON public.library_rules_v2 FOR EACH ROW EXECUTE FUNCTION public.update_library_rules_v2_updated_at();


--
-- Name: api_key_audit api_key_audit_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key_audit
    ADD CONSTRAINT api_key_audit_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: auto_learned_preferences auto_learned_preferences_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_learned_preferences
    ADD CONSTRAINT auto_learned_preferences_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: auto_learned_preferences auto_learned_preferences_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_learned_preferences
    ADD CONSTRAINT auto_learned_preferences_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: auto_learned_preferences auto_learned_preferences_reverted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_learned_preferences
    ADD CONSTRAINT auto_learned_preferences_reverted_by_fkey FOREIGN KEY (reverted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: backup_audit backup_audit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_audit
    ADD CONSTRAINT backup_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: backup_schedules backup_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_schedules
    ADD CONSTRAINT backup_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: clarification_responses clarification_responses_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clarification_responses
    ADD CONSTRAINT clarification_responses_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id);


--
-- Name: clarification_responses clarification_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clarification_responses
    ADD CONSTRAINT clarification_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.clarification_questions(id);


--
-- Name: classification_corrections classification_corrections_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_corrections
    ADD CONSTRAINT classification_corrections_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id) ON DELETE CASCADE;


--
-- Name: classification_corrections classification_corrections_corrected_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_corrections
    ADD CONSTRAINT classification_corrections_corrected_library_id_fkey FOREIGN KEY (corrected_library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: classification_embeddings classification_embeddings_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_embeddings
    ADD CONSTRAINT classification_embeddings_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id) ON DELETE CASCADE;


--
-- Name: classification_evidence classification_evidence_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_evidence
    ADD CONSTRAINT classification_evidence_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: classification_history classification_history_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_history
    ADD CONSTRAINT classification_history_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE SET NULL;


--
-- Name: classification_queue_decision_witnesses classification_queue_decision_witnesses_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_queue_decision_witnesses
    ADD CONSTRAINT classification_queue_decision_witnesses_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id) ON DELETE CASCADE;


--
-- Name: classification_queue_decision_witnesses classification_queue_decision_witnesses_queue_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_queue_decision_witnesses
    ADD CONSTRAINT classification_queue_decision_witnesses_queue_task_id_fkey FOREIGN KEY (queue_task_id) REFERENCES public.task_queue(id) ON DELETE CASCADE;


--
-- Name: confidence_settings_audit confidence_settings_audit_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confidence_settings_audit
    ADD CONSTRAINT confidence_settings_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: content_analysis_log content_analysis_log_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_analysis_log
    ADD CONSTRAINT content_analysis_log_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id);


--
-- Name: content_presets content_presets_based_on_preset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_presets
    ADD CONSTRAINT content_presets_based_on_preset_id_fkey FOREIGN KEY (based_on_preset_id) REFERENCES public.content_presets(id);


--
-- Name: content_presets content_presets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_presets
    ADD CONSTRAINT content_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: custom_presets custom_presets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_presets
    ADD CONSTRAINT custom_presets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: discovered_patterns discovered_patterns_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_patterns
    ADD CONSTRAINT discovered_patterns_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: dismissed_patterns dismissed_patterns_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_patterns
    ADD CONSTRAINT dismissed_patterns_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: embedding_errors embedding_errors_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_errors
    ADD CONSTRAINT embedding_errors_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id) ON DELETE CASCADE;


--
-- Name: enrichment_retry_queue enrichment_retry_queue_media_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_retry_queue
    ADD CONSTRAINT enrichment_retry_queue_media_item_id_fkey FOREIGN KEY (media_item_id) REFERENCES public.media_server_items(id) ON DELETE CASCADE;


--
-- Name: learned_corrections learned_corrections_corrected_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learned_corrections
    ADD CONSTRAINT learned_corrections_corrected_library_id_fkey FOREIGN KEY (corrected_library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: learned_corrections learned_corrections_original_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learned_corrections
    ADD CONSTRAINT learned_corrections_original_library_id_fkey FOREIGN KEY (original_library_id) REFERENCES public.libraries(id) ON DELETE SET NULL;


--
-- Name: learning_conflicts learning_conflicts_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_conflicts
    ADD CONSTRAINT learning_conflicts_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: learning_conflicts learning_conflicts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_conflicts
    ADD CONSTRAINT learning_conflicts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: learning_patterns learning_patterns_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_patterns
    ADD CONSTRAINT learning_patterns_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: learning_rate_limits learning_rate_limits_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_rate_limits
    ADD CONSTRAINT learning_rate_limits_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: libraries libraries_media_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.libraries
    ADD CONSTRAINT libraries_media_server_id_fkey FOREIGN KEY (media_server_id) REFERENCES public.media_server(id) ON DELETE CASCADE;


--
-- Name: library_arr_mappings library_arr_mappings_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_arr_mappings
    ADD CONSTRAINT library_arr_mappings_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_custom_rules library_custom_rules_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_custom_rules
    ADD CONSTRAINT library_custom_rules_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_custom_rules library_custom_rules_migrated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_custom_rules
    ADD CONSTRAINT library_custom_rules_migrated_by_fkey FOREIGN KEY (migrated_by) REFERENCES public.users(id);


--
-- Name: library_custom_rules library_custom_rules_migrated_to_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_custom_rules
    ADD CONSTRAINT library_custom_rules_migrated_to_policy_id_fkey FOREIGN KEY (migrated_to_policy_id) REFERENCES public.library_policies(id);


--
-- Name: library_labels library_labels_label_preset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_labels
    ADD CONSTRAINT library_labels_label_preset_id_fkey FOREIGN KEY (label_preset_id) REFERENCES public.label_presets(id) ON DELETE CASCADE;


--
-- Name: library_labels library_labels_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_labels
    ADD CONSTRAINT library_labels_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_observation_scan_progress library_observation_scan_progress_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_observation_scan_progress
    ADD CONSTRAINT library_observation_scan_progress_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_pattern_suggestions library_pattern_suggestions_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_pattern_suggestions
    ADD CONSTRAINT library_pattern_suggestions_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_policies library_policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_policies
    ADD CONSTRAINT library_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: library_policies library_policies_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_policies
    ADD CONSTRAINT library_policies_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_profile_inventory_state library_profile_inventory_state_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_profile_inventory_state
    ADD CONSTRAINT library_profile_inventory_state_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_profiles library_profiles_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_profiles
    ADD CONSTRAINT library_profiles_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_rules library_rules_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_rules
    ADD CONSTRAINT library_rules_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: library_rules_v2 library_rules_v2_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_rules_v2
    ADD CONSTRAINT library_rules_v2_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: media_identity_review_previews media_identity_review_previews_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_identity_review_previews
    ADD CONSTRAINT media_identity_review_previews_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: media_identity_review_previews media_identity_review_previews_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_identity_review_previews
    ADD CONSTRAINT media_identity_review_previews_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.media_server_items(id) ON DELETE CASCADE;


--
-- Name: media_requests media_requests_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_requests
    ADD CONSTRAINT media_requests_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id);


--
-- Name: media_requests media_requests_routed_to_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_requests
    ADD CONSTRAINT media_requests_routed_to_library_id_fkey FOREIGN KEY (routed_to_library_id) REFERENCES public.libraries(id);


--
-- Name: media_server_collections media_server_collections_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_collections
    ADD CONSTRAINT media_server_collections_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: media_server_collections media_server_collections_media_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_collections
    ADD CONSTRAINT media_server_collections_media_server_id_fkey FOREIGN KEY (media_server_id) REFERENCES public.media_server(id) ON DELETE CASCADE;


--
-- Name: media_server_items media_server_items_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_items
    ADD CONSTRAINT media_server_items_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: media_server_items media_server_items_media_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_items
    ADD CONSTRAINT media_server_items_media_server_id_fkey FOREIGN KEY (media_server_id) REFERENCES public.media_server(id) ON DELETE CASCADE;


--
-- Name: media_server_sync_status media_server_sync_status_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_sync_status
    ADD CONSTRAINT media_server_sync_status_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id);


--
-- Name: media_server_sync_status media_server_sync_status_media_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_server_sync_status
    ADD CONSTRAINT media_server_sync_status_media_server_id_fkey FOREIGN KEY (media_server_id) REFERENCES public.media_server(id) ON DELETE CASCADE;


--
-- Name: pattern_match_log pattern_match_log_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_match_log
    ADD CONSTRAINT pattern_match_log_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id) ON DELETE CASCADE;


--
-- Name: pattern_match_log pattern_match_log_pattern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_match_log
    ADD CONSTRAINT pattern_match_log_pattern_id_fkey FOREIGN KEY (pattern_id) REFERENCES public.discovered_patterns(id) ON DELETE CASCADE;


--
-- Name: policy_authoring_proposals policy_authoring_proposals_consumed_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_authoring_proposals
    ADD CONSTRAINT policy_authoring_proposals_consumed_policy_id_fkey FOREIGN KEY (consumed_policy_id) REFERENCES public.library_policies(id) ON DELETE SET NULL;


--
-- Name: policy_authoring_proposals policy_authoring_proposals_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_authoring_proposals
    ADD CONSTRAINT policy_authoring_proposals_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: policy_candidate_correction_review_projection_items policy_candidate_correction_review_projection__snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_candidate_correction_review_projection_items
    ADD CONSTRAINT policy_candidate_correction_review_projection__snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.policy_candidate_correction_review_projections(snapshot_id) ON DELETE CASCADE;


--
-- Name: policy_change_log policy_change_log_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_change_log
    ADD CONSTRAINT policy_change_log_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.users(id);


--
-- Name: policy_change_log policy_change_log_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_change_log
    ADD CONSTRAINT policy_change_log_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_feedback_log policy_feedback_log_selected_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_feedback_log
    ADD CONSTRAINT policy_feedback_log_selected_library_id_fkey FOREIGN KEY (selected_library_id) REFERENCES public.libraries(id);


--
-- Name: policy_feedback_log policy_feedback_log_selected_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_feedback_log
    ADD CONSTRAINT policy_feedback_log_selected_policy_id_fkey FOREIGN KEY (selected_policy_id) REFERENCES public.library_policies(id);


--
-- Name: policy_feedback_sources policy_feedback_sources_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_feedback_sources
    ADD CONSTRAINT policy_feedback_sources_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES public.policy_feedback_log(id) ON DELETE SET NULL;


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE RESTRICT;


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_migration_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_migration_event_id_fkey FOREIGN KEY (migration_event_id) REFERENCES public.policy_intent_migration_events(id) ON DELETE RESTRICT;


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_initial_intent_establishments policy_initial_intent_establishments_rollback_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_initial_intent_establishments
    ADD CONSTRAINT policy_initial_intent_establishments_rollback_snapshot_id_fkey FOREIGN KEY (rollback_snapshot_id) REFERENCES public.policy_intent_rollback_snapshots(id) ON DELETE RESTRICT;


--
-- Name: policy_intent_migration_events policy_intent_migration_events_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_migration_events
    ADD CONSTRAINT policy_intent_migration_events_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE SET NULL;


--
-- Name: policy_intent_migration_events policy_intent_migration_events_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_migration_events
    ADD CONSTRAINT policy_intent_migration_events_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_intent_rollback_snapshots policy_intent_rollback_snapshots_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_rollback_snapshots
    ADD CONSTRAINT policy_intent_rollback_snapshots_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE CASCADE;


--
-- Name: policy_intent_rollback_snapshots policy_intent_rollback_snapshots_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_rollback_snapshots
    ADD CONSTRAINT policy_intent_rollback_snapshots_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_intent_routing_targets policy_intent_routing_targets_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_routing_targets
    ADD CONSTRAINT policy_intent_routing_targets_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE CASCADE;


--
-- Name: policy_intent_routing_targets policy_intent_routing_targets_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_routing_targets
    ADD CONSTRAINT policy_intent_routing_targets_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: policy_intent_rules policy_intent_rules_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_rules
    ADD CONSTRAINT policy_intent_rules_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE CASCADE;


--
-- Name: policy_intent_template_applications policy_intent_template_applications_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_template_applications
    ADD CONSTRAINT policy_intent_template_applications_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE CASCADE;


--
-- Name: policy_intent_template_applications policy_intent_template_applications_preset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_template_applications
    ADD CONSTRAINT policy_intent_template_applications_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES public.content_presets(id) ON DELETE SET NULL;


--
-- Name: policy_intent_validation_status policy_intent_validation_status_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intent_validation_status
    ADD CONSTRAINT policy_intent_validation_status_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE CASCADE;


--
-- Name: policy_intents policy_intents_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intents
    ADD CONSTRAINT policy_intents_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: policy_intents policy_intents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intents
    ADD CONSTRAINT policy_intents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: policy_intents policy_intents_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intents
    ADD CONSTRAINT policy_intents_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: policy_intents policy_intents_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intents
    ADD CONSTRAINT policy_intents_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_intents policy_intents_replaced_by_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_intents
    ADD CONSTRAINT policy_intents_replaced_by_intent_id_fkey FOREIGN KEY (replaced_by_intent_id) REFERENCES public.policy_intents(id) ON DELETE SET NULL;


--
-- Name: policy_learning_stats policy_learning_stats_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_learning_stats
    ADD CONSTRAINT policy_learning_stats_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gat_replacement_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gat_replacement_intent_id_fkey FOREIGN KEY (replacement_intent_id) REFERENCES public.policy_intents(id) ON DELETE RESTRICT;


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gate_replacement_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gate_replacement_event_id_fkey FOREIGN KEY (replacement_event_id) REFERENCES public.policy_intent_migration_events(id) ON DELETE SET NULL;


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gate_rollback_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gate_rollback_snapshot_id_fkey FOREIGN KEY (rollback_snapshot_id) REFERENCES public.policy_intent_rollback_snapshots(id) ON DELETE RESTRICT;


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gates_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE CASCADE;


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gates_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gates_migration_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_migration_event_id_fkey FOREIGN KEY (migration_event_id) REFERENCES public.policy_intent_migration_events(id) ON DELETE SET NULL;


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gates_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_library_rebuild_execution_gates policy_library_rebuild_execution_gates_verification_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_library_rebuild_execution_gates
    ADD CONSTRAINT policy_library_rebuild_execution_gates_verification_run_id_fkey FOREIGN KEY (verification_run_id) REFERENCES public.policy_migration_verification_runs(id) ON DELETE RESTRICT;


--
-- Name: policy_migration_verification_runs policy_migration_verification_runs_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_migration_verification_runs
    ADD CONSTRAINT policy_migration_verification_runs_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE CASCADE;


--
-- Name: policy_migration_verification_runs policy_migration_verification_runs_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_migration_verification_runs
    ADD CONSTRAINT policy_migration_verification_runs_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: policy_migration_verification_runs policy_migration_verification_runs_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_migration_verification_runs
    ADD CONSTRAINT policy_migration_verification_runs_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_native_intent_change_receipts policy_native_intent_change_receipts_migration_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_change_receipts
    ADD CONSTRAINT policy_native_intent_change_receipts_migration_event_id_fkey FOREIGN KEY (migration_event_id) REFERENCES public.policy_intent_migration_events(id) ON DELETE RESTRICT;


--
-- Name: policy_native_intent_change_receipts policy_native_intent_change_receipts_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_change_receipts
    ADD CONSTRAINT policy_native_intent_change_receipts_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_native_intent_change_receipts policy_native_intent_change_receipts_target_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_change_receipts
    ADD CONSTRAINT policy_native_intent_change_receipts_target_intent_id_fkey FOREIGN KEY (target_intent_id) REFERENCES public.policy_intents(id) ON DELETE RESTRICT;


--
-- Name: policy_native_intent_reconciliation_holds policy_native_intent_reconciliation_hold_released_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_holds
    ADD CONSTRAINT policy_native_intent_reconciliation_hold_released_event_id_fkey FOREIGN KEY (released_event_id) REFERENCES public.policy_intent_migration_events(id) ON DELETE RESTRICT;


--
-- Name: policy_native_intent_reconciliation_holds policy_native_intent_reconciliation_holds_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_holds
    ADD CONSTRAINT policy_native_intent_reconciliation_holds_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_native_intent_reconciliation_holds policy_native_intent_reconciliation_holds_source_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_holds
    ADD CONSTRAINT policy_native_intent_reconciliation_holds_source_event_id_fkey FOREIGN KEY (source_event_id) REFERENCES public.policy_intent_migration_events(id) ON DELETE RESTRICT;


--
-- Name: policy_native_intent_reconciliation_outcomes policy_native_intent_reconciliation_outcomes_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_outcomes
    ADD CONSTRAINT policy_native_intent_reconciliation_outcomes_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_native_intent_reconciliation_outcomes policy_native_intent_reconciliation_outcomes_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_outcomes
    ADD CONSTRAINT policy_native_intent_reconciliation_outcomes_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.policy_native_intent_reconciliation_runs(id) ON DELETE CASCADE;


--
-- Name: policy_native_intent_reconciliation_states policy_native_intent_reconciliation_states_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_native_intent_reconciliation_states
    ADD CONSTRAINT policy_native_intent_reconciliation_states_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_observed_evidence_provenance_snapshots policy_observed_evidence_provenance_snaps_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_observed_evidence_provenance_snapshots
    ADD CONSTRAINT policy_observed_evidence_provenance_snaps_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.policy_initial_intent_establishments(id) ON DELETE CASCADE;


--
-- Name: policy_observed_evidence_provenance_snapshots policy_observed_evidence_provenance_snapshots_intent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_observed_evidence_provenance_snapshots
    ADD CONSTRAINT policy_observed_evidence_provenance_snapshots_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.policy_intents(id) ON DELETE CASCADE;


--
-- Name: policy_observed_evidence_provenance_snapshots policy_observed_evidence_provenance_snapshots_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_observed_evidence_provenance_snapshots
    ADD CONSTRAINT policy_observed_evidence_provenance_snapshots_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: policy_observed_evidence_provenance_snapshots policy_observed_evidence_provenance_snapshots_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_observed_evidence_provenance_snapshots
    ADD CONSTRAINT policy_observed_evidence_provenance_snapshots_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_overrides policy_overrides_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_overrides
    ADD CONSTRAINT policy_overrides_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_presets policy_presets_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_presets
    ADD CONSTRAINT policy_presets_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_presets policy_presets_preset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_presets
    ADD CONSTRAINT policy_presets_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES public.content_presets(id) ON DELETE CASCADE;


--
-- Name: policy_runtime_historic_route_safety_refresh_receipt_items policy_runtime_historic_route_safety_refresh_re_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_runtime_historic_route_safety_refresh_receipt_items
    ADD CONSTRAINT policy_runtime_historic_route_safety_refresh_re_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.policy_runtime_historic_route_safety_refresh_receipts(receipt_id) ON DELETE CASCADE;


--
-- Name: policy_tuning_cohorts policy_tuning_cohorts_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_cohorts
    ADD CONSTRAINT policy_tuning_cohorts_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_tuning_suggestions policy_tuning_suggestions_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_suggestions
    ADD CONSTRAINT policy_tuning_suggestions_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.users(id);


--
-- Name: policy_tuning_suggestions policy_tuning_suggestions_cohort_fingerprint_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_suggestions
    ADD CONSTRAINT policy_tuning_suggestions_cohort_fingerprint_fkey FOREIGN KEY (cohort_fingerprint) REFERENCES public.policy_tuning_cohorts(fingerprint);


--
-- Name: policy_tuning_suggestions policy_tuning_suggestions_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_suggestions
    ADD CONSTRAINT policy_tuning_suggestions_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: policy_tuning_suggestions policy_tuning_suggestions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_suggestions
    ADD CONSTRAINT policy_tuning_suggestions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: radarr_config radarr_config_media_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radarr_config
    ADD CONSTRAINT radarr_config_media_server_id_fkey FOREIGN KEY (media_server_id) REFERENCES public.media_server(id) ON DELETE SET NULL;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: scheduled_tasks scheduled_tasks_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;


--
-- Name: sonarr_config sonarr_config_media_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sonarr_config
    ADD CONSTRAINT sonarr_config_media_server_id_fkey FOREIGN KEY (media_server_id) REFERENCES public.media_server(id) ON DELETE SET NULL;


--
-- Name: source_library_policy_links source_library_policy_links_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_library_policy_links
    ADD CONSTRAINT source_library_policy_links_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


--
-- Name: task_queue task_queue_webhook_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_queue
    ADD CONSTRAINT task_queue_webhook_log_id_fkey FOREIGN KEY (webhook_log_id) REFERENCES public.webhook_log(id) ON DELETE SET NULL;


--
-- Name: webhook_log webhook_log_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id);


--
-- Name: webhook_log webhook_log_webhook_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_log
    ADD CONSTRAINT webhook_log_webhook_config_id_fkey FOREIGN KEY (webhook_config_id) REFERENCES public.webhook_config(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--




-- Migration tracking table
CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    applied_at timestamp without time zone DEFAULT now(),
    migration_type character varying(50) DEFAULT 'sql'::character varying,
    description text,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY (id),
    CONSTRAINT schema_migrations_filename_key UNIQUE (filename)
);

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;
ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);
CREATE INDEX idx_schema_migrations_applied ON public.schema_migrations USING btree (applied_at DESC);
CREATE INDEX idx_schema_migrations_type ON public.schema_migrations USING btree (migration_type);
COMMENT ON TABLE public.schema_migrations IS 'Tracks applied database migrations. Supports both legacy numeric (001_name.sql) and timestamp-based (20260201_150000_name.sql) formats.';



-- ============================================================
-- Seed Data (from data-only migrations, auto-appended by scripts/dump-schema.mjs)
-- These INSERT statements are idempotent (ON CONFLICT DO NOTHING / DO UPDATE).
-- ============================================================

SELECT pg_catalog.set_config('search_path', 'public', false);

-- === Seed: 005_add_require_all_confirmations_setting.sql ===
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

-- Migration: Add require_all_confirmations setting
-- This setting allows users to request confirmation for all classifications,
-- regardless of confidence level

INSERT INTO settings (key, value) 
VALUES ('require_all_confirmations', 'false')
ON CONFLICT (key) DO NOTHING;

-- === Seed: 006_add_clarification_settings.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Migration: Add AI Clarification Settings
-- These settings control the AI-driven clarification system

-- Add enable_clarification setting
INSERT INTO
    settings (key, value)
VALUES (
        'enable_clarification',
        'true'
    ) ON CONFLICT (key) DO NOTHING;

-- Add clarification_threshold setting (default 75%)
INSERT INTO
    settings (key, value)
VALUES (
        'clarification_threshold',
        '75'
    ) ON CONFLICT (key) DO NOTHING;

-- === Seed: 019_cleanup_omdb_config.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Cleanup duplicate OMDb configuration rows
-- Preserves existing configuration and consolidates to id=1

-- === Seed: 043_seed_content_presets.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- v0.37.0: Content Presets Seed Data
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration seeds the content_presets table with 46 comprehensive
-- presets covering all categories for real-world Plex/Emby/Jellyfin library
-- classification.
-- 
-- Related Issue: #95
-- Depends on: #91 (PR #105) - Policy Database Schema
-- Parent Epic: #82 (v0.37.0 Formula-Based Classification Engine)
-- ═══════════════════════════════════════════════════════════════════════════


-- ============================================================================
-- SIGNAL SCHEMA REFERENCE (TypeScript)
-- ============================================================================
-- interface PresetSignals {
--     certifications?: {
--         mode: 'include' | 'exclude' | 'max';
--         include?: string[];
--         exclude?: string[];
--         max?: string;
--         weight?: number;
--     };
--     genres?: {
--         prefer?: string[];
--         require_any?: string[];
--         require_all?: string[];
--         exclude?: string[];
--         weight?: number;
--     };
--     keywords?: {
--         prefer?: string[];
--         require_any?: string[];
--         exclude?: string[];
--         weight?: number;
--     };
--     studios?: {
--         prefer?: string[];
--         require_any?: string[];
--         exclude?: string[];
--         weight?: number;
--     };
--     release_year?: {
--         min?: number;
--         max?: number;
--         weight?: number;
--     };
--     vote_average?: {
--         min?: number;
--         max?: number;
--         weight?: number;
--     };
--     runtime?: {
--         min_minutes?: number;
--         max_minutes?: number;
--         weight?: number;
--     };
--     language?: {
--         prefer?: string[];
--         require_any?: string[];
--         exclude?: string[];
--         weight?: number;
--     };
--     media_type?: {
--         include: ('movie' | 'tv')[];
--     };
-- }
-- ============================================================================

-- ============================================================================
-- CONTENT PRESETS SEED DATA
-- ============================================================================
-- Insert system presets with idempotency using ON CONFLICT
-- user_id = NULL for system presets (allows unique constraint to work)
-- ============================================================================

INSERT INTO content_presets (key, name, description, icon, category, signals, is_system, display_order)
VALUES
-- ============================================================================
-- CATEGORY: AUDIENCE (display_order 1-4)
-- ============================================================================
('family_friendly', 'Family-Friendly', 'Content suitable for all ages. Excludes R-rated and adult content.', '👨‍👩‍👧‍👦', 'audience',
 '{"certifications": {"mode": "include", "include": ["G", "PG", "PG-13", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14"], "exclude": ["R", "NC-17", "TV-MA"], "weight": 1.5}, "genres": {"prefer": ["Animation", "Family", "Comedy", "Adventure"], "exclude": ["Horror"], "weight": 1.0}, "keywords": {"exclude": ["gore", "explicit", "adult", "violence", "drug use"], "weight": 0.5}}',
 true, 1),

('kids_only', 'Kids Only', 'Content specifically for young children (ages 2-7).', '🧒', 'audience',
 '{"certifications": {"mode": "include", "include": ["G", "TV-Y", "TV-Y7", "TV-G"], "weight": 2.0}, "genres": {"require_any": ["Animation", "Family"], "weight": 1.5}, "runtime": {"max_minutes": 120, "weight": 0.3}, "keywords": {"prefer": ["children", "kids", "educational", "cartoon"], "exclude": ["scary", "dark", "violence"], "weight": 0.8}}',
 true, 2),

('teen', 'Teen Content', 'Content appropriate for teenagers (13-17).', '🎒', 'audience',
 '{"certifications": {"mode": "include", "include": ["PG", "PG-13", "TV-PG", "TV-14"], "weight": 1.5}, "genres": {"prefer": ["Action", "Adventure", "Comedy", "Science Fiction", "Fantasy"], "weight": 1.0}}',
 true, 3),

('adult_only', 'Adult Only', 'Mature content for adults only (18+).', '🔞', 'audience',
 '{"certifications": {"mode": "include", "include": ["R", "NC-17", "TV-MA"], "weight": 2.0}, "genres": {"prefer": ["Thriller", "Horror", "Crime", "Drama"], "weight": 0.8}, "keywords": {"prefer": ["mature", "adult", "graphic"], "weight": 0.5}}',
 true, 4),

-- ============================================================================
-- CATEGORY: GENRE (display_order 10-24)
-- ============================================================================
('animated', 'Animated Content', 'All animation including cartoons, CGI, and anime.', '🎨', 'genre',
 '{"genres": {"require_any": ["Animation"], "weight": 2.0}, "keywords": {"prefer": ["animated", "animation", "cartoon", "cgi", "pixar", "dreamworks", "ghibli"], "weight": 0.5}}',
 true, 10),

('anime', 'Anime', 'Japanese animation specifically.', '⛩️', 'genre',
 '{"genres": {"require_any": ["Animation"], "weight": 1.0}, "keywords": {"require_any": ["anime"], "prefer": ["manga", "shonen", "seinen", "shojo", "ghibli", "japanese animation"], "weight": 1.5}, "language": {"prefer": ["ja"], "weight": 1.0}}',
 true, 11),

('action_adventure', 'Action & Adventure', 'High-energy action and adventure content.', '💥', 'genre',
 '{"genres": {"require_any": ["Action", "Adventure"], "prefer": ["Thriller"], "weight": 2.0}, "keywords": {"prefer": ["action", "adventure", "hero", "battle", "fight", "explosion"], "weight": 0.5}}',
 true, 12),

('comedy', 'Comedy', 'Comedies, sitcoms, and humorous content.', '😂', 'genre',
 '{"genres": {"require_any": ["Comedy"], "weight": 2.0}, "keywords": {"prefer": ["funny", "humor", "comedy", "parody", "satire"], "weight": 0.5}}',
 true, 13),

('horror_scary', 'Horror & Scary', 'Horror movies and scary content.', '👻', 'genre',
 '{"genres": {"require_any": ["Horror"], "prefer": ["Thriller"], "weight": 2.0}, "keywords": {"prefer": ["horror", "scary", "slasher", "supernatural", "haunted", "zombie", "vampire", "ghost"], "weight": 1.0}}',
 true, 14),

('drama', 'Drama', 'Dramatic films and series.', '🎭', 'genre',
 '{"genres": {"require_any": ["Drama"], "exclude": ["Comedy"], "weight": 2.0}}',
 true, 15),

('romance', 'Romance', 'Romantic movies and series.', '💕', 'genre',
 '{"genres": {"require_any": ["Romance"], "prefer": ["Drama", "Comedy"], "weight": 2.0}, "keywords": {"prefer": ["love", "romance", "romantic", "relationship"], "weight": 0.5}}',
 true, 16),

('scifi', 'Science Fiction', 'Science fiction and futuristic content.', '🚀', 'genre',
 '{"genres": {"require_any": ["Science Fiction"], "prefer": ["Adventure", "Action"], "weight": 2.0}, "keywords": {"prefer": ["sci-fi", "space", "future", "alien", "robot", "technology"], "weight": 0.5}}',
 true, 17),

('fantasy', 'Fantasy', 'Fantasy and magical content.', '🧙', 'genre',
 '{"genres": {"require_any": ["Fantasy"], "prefer": ["Adventure", "Action"], "weight": 2.0}, "keywords": {"prefer": ["magic", "wizard", "dragon", "mythical", "supernatural", "fairy tale"], "weight": 0.5}}',
 true, 18),

('documentary', 'Documentary', 'Documentaries and non-fiction.', '📚', 'genre',
 '{"genres": {"require_any": ["Documentary"], "weight": 2.0}, "keywords": {"prefer": ["documentary", "real", "true story", "biography"], "weight": 0.5}}',
 true, 19),

('crime_mystery', 'Crime & Mystery', 'Crime dramas, mysteries, and thrillers.', '🔍', 'genre',
 '{"genres": {"require_any": ["Crime", "Mystery"], "prefer": ["Thriller", "Drama"], "weight": 2.0}, "keywords": {"prefer": ["detective", "murder", "investigation", "crime", "police"], "weight": 0.5}}',
 true, 20),

('western', 'Western', 'Western films and series.', '🤠', 'genre',
 '{"genres": {"require_any": ["Western"], "weight": 2.0}, "keywords": {"prefer": ["cowboy", "western", "frontier", "wild west"], "weight": 0.5}}',
 true, 21),

('musical', 'Musical', 'Musicals and music-focused content.', '🎵', 'genre',
 '{"genres": {"require_any": ["Music"], "weight": 2.0}, "keywords": {"prefer": ["musical", "singing", "dance", "broadway", "concert"], "weight": 1.0}}',
 true, 22),

('sports', 'Sports', 'Sports movies and documentaries.', '⚽', 'genre',
 '{"genres": {"require_any": ["Sports"], "weight": 2.0}, "keywords": {"prefer": ["sports", "football", "basketball", "baseball", "soccer", "athlete"], "weight": 0.8}}',
 true, 23),

('war', 'War', 'War films and military content.', '⚔️', 'genre',
 '{"genres": {"require_any": ["War"], "prefer": ["History", "Drama", "Action"], "weight": 2.0}, "keywords": {"prefer": ["war", "military", "soldier", "battle", "army"], "weight": 0.5}}',
 true, 24),

-- ============================================================================
-- CATEGORY: TEMPORAL (display_order 40-44)
-- ============================================================================
('classic_films', 'Classic Films', 'Movies released before 1980.', '🎞️', 'temporal',
 '{"release_year": {"max": 1979, "weight": 2.0}, "media_type": {"include": ["movie"]}}',
 true, 40),

('golden_age', 'Golden Age (1930-1960)', 'Films from Hollywood Golden Age.', '🌟', 'temporal',
 '{"release_year": {"min": 1930, "max": 1960, "weight": 2.0}, "media_type": {"include": ["movie"]}}',
 true, 41),

('80s', '1980s', 'Content from the 1980s.', '📼', 'temporal',
 '{"release_year": {"min": 1980, "max": 1989, "weight": 2.0}}',
 true, 42),

('90s', '1990s', 'Content from the 1990s.', '💿', 'temporal',
 '{"release_year": {"min": 1990, "max": 1999, "weight": 2.0}}',
 true, 43),

('recent_releases', 'Recent Releases', 'Content from the last 2 years.', '🆕', 'temporal',
 '{"release_year": {"min": 2025, "weight": 2.0}}',
 true, 44),

-- ============================================================================
-- CATEGORY: QUALITY (display_order 50-51)
-- ============================================================================
('highly_rated', 'Highly Rated', 'Content with 7.0+ rating on TMDB.', '⭐', 'quality',
 '{"vote_average": {"min": 7.0, "weight": 1.5}}',
 true, 50),

('hidden_gems', 'Hidden Gems', 'Lesser-known but highly rated content.', '💎', 'quality',
 '{"vote_average": {"min": 7.0, "weight": 1.5}, "keywords": {"prefer": ["indie", "independent", "art house"], "weight": 0.5}}',
 true, 51),

-- ============================================================================
-- CATEGORY: FRANCHISE (display_order 55-61)
-- ============================================================================
('marvel_mcu', 'Marvel MCU', 'Marvel Cinematic Universe films and shows.', '🦸', 'franchise',
 '{"studios": {"require_any": ["Marvel Studios"], "weight": 2.0}, "keywords": {"prefer": ["marvel", "mcu", "avengers", "superhero"], "weight": 1.0}}',
 true, 55),

('dc_universe', 'DC Universe', 'DC Comics films and shows.', '🦇', 'franchise',
 '{"studios": {"require_any": ["DC Entertainment", "DC Films", "DC Studios"], "weight": 2.0}, "keywords": {"prefer": ["dc", "batman", "superman", "justice league", "superhero"], "weight": 1.0}}',
 true, 56),

('star_wars', 'Star Wars', 'Star Wars films and series.', '🌌', 'franchise',
 '{"studios": {"require_any": ["Lucasfilm"], "weight": 1.5}, "keywords": {"require_any": ["star wars"], "prefer": ["jedi", "sith", "force", "skywalker"], "weight": 2.0}}',
 true, 57),

('disney', 'Disney', 'Walt Disney Animation Studios films.', '🏰', 'franchise',
 '{"studios": {"require_any": ["Walt Disney Pictures", "Walt Disney Animation Studios"], "weight": 2.0}}',
 true, 58),

('pixar', 'Pixar', 'Pixar Animation Studios films.', '🎯', 'franchise',
 '{"studios": {"require_any": ["Pixar"], "weight": 2.0}}',
 true, 59),

('ghibli', 'Studio Ghibli', 'Studio Ghibli animated films.', '🌸', 'franchise',
 '{"studios": {"require_any": ["Studio Ghibli"], "weight": 2.0}, "keywords": {"prefer": ["ghibli", "miyazaki"], "weight": 1.0}}',
 true, 60),

('dreamworks', 'DreamWorks', 'DreamWorks Animation films.', '🌙', 'franchise',
 '{"studios": {"require_any": ["DreamWorks Animation"], "weight": 2.0}}',
 true, 61),

-- ============================================================================
-- CATEGORY: REGIONAL (display_order 70-74)
-- ============================================================================
('hollywood', 'Hollywood', 'American/Hollywood productions.', '🇺🇸', 'regional',
 '{"language": {"require_any": ["en"], "weight": 1.5}, "studios": {"prefer": ["Warner Bros.", "Universal Pictures", "Paramount", "20th Century Studios", "Sony Pictures"], "weight": 1.0}}',
 true, 70),

('british', 'British', 'British productions.', '🇬🇧', 'regional',
 '{"language": {"require_any": ["en"], "weight": 0.5}, "studios": {"prefer": ["BBC", "Working Title", "Aardman"], "weight": 1.5}, "keywords": {"prefer": ["british", "uk", "england", "bbc"], "weight": 1.0}}',
 true, 71),

('bollywood', 'Bollywood', 'Indian/Bollywood productions.', '🇮🇳', 'regional',
 '{"language": {"require_any": ["hi", "ta", "te"], "weight": 2.0}, "keywords": {"prefer": ["bollywood", "indian"], "weight": 1.0}}',
 true, 72),

('korean', 'Korean', 'Korean films and dramas.', '🇰🇷', 'regional',
 '{"language": {"require_any": ["ko"], "weight": 2.0}, "keywords": {"prefer": ["korean", "k-drama", "kdrama"], "weight": 1.0}}',
 true, 73),

('foreign', 'Foreign/International', 'Non-English language films.', '🌍', 'regional',
 '{"language": {"exclude": ["en"], "weight": 2.0}}',
 true, 74),

-- ============================================================================
-- CATEGORY: SEASONAL (display_order 80-81)
-- ============================================================================
('christmas_holiday', 'Christmas & Holiday', 'Christmas and holiday seasonal content.', '🎄', 'seasonal',
 '{"keywords": {"require_any": ["christmas", "holiday", "santa", "xmas"], "prefer": ["winter", "snow", "festive"], "weight": 2.0}, "genres": {"prefer": ["Family", "Comedy", "Romance"], "weight": 0.5}}',
 true, 80),

('halloween', 'Halloween', 'Halloween and spooky seasonal content.', '🎃', 'seasonal',
 '{"keywords": {"require_any": ["halloween"], "prefer": ["spooky", "scary", "witch", "monster", "haunted"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Thriller", "Fantasy"], "weight": 0.8}}',
 true, 81),

-- ============================================================================
-- CATEGORY: TV-SPECIFIC (display_order 85-90)
-- ============================================================================
('tv_sitcom', 'Sitcoms', 'Situation comedies with short episodes.', '📺', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Comedy"], "weight": 1.5}, "runtime": {"max_minutes": 35, "weight": 1.0}, "keywords": {"prefer": ["sitcom", "laugh track", "comedy series"], "weight": 0.5}}',
 true, 85),

('tv_drama', 'Drama Series', 'Dramatic TV series.', '🎬', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Drama"], "exclude": ["Comedy"], "weight": 2.0}}',
 true, 86),

('tv_reality', 'Reality TV', 'Reality and competition shows.', '🏆', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Reality"], "weight": 2.0}, "keywords": {"prefer": ["reality", "competition", "contest", "dating"], "weight": 1.0}}',
 true, 87),

('tv_animated', 'Animated Series', 'Animated TV series (non-anime).', '✏️', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Animation"], "weight": 2.0}, "keywords": {"exclude": ["anime"], "weight": 0.5}}',
 true, 88),

('tv_anime', 'Anime Series', 'Japanese animated TV series.', '🎌', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Animation"], "weight": 1.0}, "keywords": {"require_any": ["anime"], "weight": 2.0}, "language": {"prefer": ["ja"], "weight": 1.0}}',
 true, 89),

('tv_miniseries', 'Miniseries', 'Limited series and miniseries.', '📖', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"prefer": ["miniseries", "limited series", "mini-series"], "weight": 2.0}}',
 true, 90)

ON CONFLICT (key, user_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    signals = EXCLUDED.signals,
    is_system = EXCLUDED.is_system,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Log successful completion

-- === Seed: 044_expand_content_presets.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- v0.37.0: Expand Content Presets (46 → 168)
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration expands content presets from 46 to 168 comprehensive presets
-- covering all real-world classification scenarios for Plex/Emby/Jellyfin.
-- 
-- Related Issue: #95 (Content Presets)
-- Depends on: Migration 043 (Initial 46 Content Presets)
-- Parent Epic: #82 (v0.37.0 Formula-Based Classification Engine)
-- ═══════════════════════════════════════════════════════════════════════════


-- ============================================================================
-- CONTENT PRESETS EXPANSION - 122 NEW PRESETS
-- ============================================================================
-- Insert system presets with idempotency using ON CONFLICT
-- user_id = NULL for system presets (allows unique constraint to work)
-- ============================================================================

INSERT INTO content_presets (key, name, description, icon, category, signals, is_system, display_order)
VALUES
-- ============================================================================
-- CATEGORY: AUDIENCE - 4 new presets (display_order 5-8)
-- ============================================================================
('kids_older', 'Older Kids', 'Content for ages 8-12, PG content appropriate for older children.', '🎒', 'audience',
 '{"certifications": {"mode": "include", "include": ["PG", "TV-PG"], "weight": 1.5}, "genres": {"prefer": ["Adventure", "Comedy", "Animation", "Family"], "weight": 1.0}, "keywords": {"prefer": ["kids", "children", "adventure"], "exclude": ["scary", "violence"], "weight": 0.5}}',
 true, 5),

('young_adult', 'Young Adult', 'Content for ages 17-25, PG-13/R rated young adult themes.', '🎓', 'audience',
 '{"certifications": {"mode": "include", "include": ["PG-13", "R", "TV-14"], "weight": 1.5}, "genres": {"prefer": ["Drama", "Romance", "Action", "Science Fiction"], "weight": 1.0}, "keywords": {"prefer": ["coming of age", "teen", "young adult"], "weight": 0.8}}',
 true, 6),

('date_night', 'Date Night', 'Romance and comedy content perfect for couples.', '💑', 'audience',
 '{"genres": {"require_any": ["Romance", "Comedy"], "prefer": ["Drama"], "exclude": ["Horror"], "weight": 2.0}, "keywords": {"prefer": ["romantic", "love", "relationship"], "exclude": ["gore", "violence"], "weight": 0.8}}',
 true, 7),

('background', 'Background Viewing', 'Light casual content suitable for background viewing.', '🛋️', 'audience',
 '{"genres": {"prefer": ["Comedy", "Reality", "Documentary"], "exclude": ["Horror", "Thriller"], "weight": 1.0}, "runtime": {"max_minutes": 45, "weight": 0.5}, "keywords": {"prefer": ["light", "casual", "relaxing"], "weight": 0.5}}',
 true, 8),

-- ============================================================================
-- CATEGORY: GENRE CORE - 5 new presets (display_order 25-29)
-- ============================================================================
('action', 'Action', 'High-octane action films and series.', '💥', 'genre',
 '{"genres": {"require_any": ["Action"], "weight": 2.0}, "keywords": {"prefer": ["action", "fight", "battle", "explosion", "chase"], "weight": 0.5}}',
 true, 25),

('thriller', 'Thriller', 'Suspenseful thriller content.', '😰', 'genre',
 '{"genres": {"require_any": ["Thriller"], "weight": 2.0}, "keywords": {"prefer": ["suspense", "tension", "thriller"], "weight": 0.5}}',
 true, 26),

('mystery', 'Mystery', 'Mystery and detective content.', '🔍', 'genre',
 '{"genres": {"require_any": ["Mystery"], "weight": 2.0}, "keywords": {"prefer": ["mystery", "detective", "investigation", "whodunit"], "weight": 0.5}}',
 true, 27),

('history', 'Historical', 'Historical films and series.', '🏛️', 'genre',
 '{"genres": {"require_any": ["History"], "weight": 2.0}, "keywords": {"prefer": ["historical", "period", "history", "based on true events"], "weight": 0.5}}',
 true, 28),

('biographical', 'Biographical', 'Biography and biopic content.', '📖', 'genre',
 '{"keywords": {"require_any": ["biography", "biopic", "based on true story"], "weight": 2.0}, "genres": {"prefer": ["Drama", "History"], "weight": 0.8}}',
 true, 29),

-- ============================================================================
-- CATEGORY: GENRE SUBGENRES - 25 new presets (display_order 30-54)
-- ============================================================================
('action_comedy', 'Action Comedy', 'Action films with comedic elements.', '🤣', 'genre',
 '{"genres": {"require_all": ["Action", "Comedy"], "weight": 2.0}}',
 true, 30),

('romantic_comedy', 'Romantic Comedy', 'Romantic comedies and rom-coms.', '💕', 'genre',
 '{"genres": {"require_all": ["Romance", "Comedy"], "weight": 2.0}}',
 true, 31),

('dark_comedy', 'Dark Comedy', 'Comedy with dark or morbid themes.', '🖤', 'genre',
 '{"genres": {"require_any": ["Comedy"], "weight": 1.0}, "keywords": {"require_any": ["dark comedy", "black comedy"], "weight": 2.0}}',
 true, 32),

('standup', 'Stand-Up Comedy', 'Stand-up comedy specials and performances.', '🎤', 'genre',
 '{"genres": {"require_any": ["Comedy"], "weight": 1.0}, "keywords": {"require_any": ["stand-up", "standup", "comedy special"], "weight": 2.0}}',
 true, 33),

('horror_comedy', 'Horror Comedy', 'Horror films with comedic elements.', '👻', 'genre',
 '{"genres": {"require_all": ["Horror", "Comedy"], "weight": 2.0}}',
 true, 34),

('slasher', 'Slasher', 'Slasher horror films.', '🔪', 'genre',
 '{"genres": {"require_any": ["Horror"], "weight": 1.5}, "keywords": {"require_any": ["slasher", "serial killer", "knife"], "weight": 2.0}}',
 true, 35),

('psychological_horror', 'Psychological Horror', 'Psychological and mind-bending horror.', '🧠', 'genre',
 '{"genres": {"require_any": ["Horror", "Thriller"], "weight": 1.5}, "keywords": {"require_any": ["psychological", "mind", "paranoia"], "weight": 2.0}}',
 true, 36),

('supernatural', 'Supernatural', 'Supernatural and paranormal content.', '👁️', 'genre',
 '{"keywords": {"require_any": ["supernatural", "paranormal", "ghost", "spirit"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Thriller", "Fantasy"], "weight": 1.0}}',
 true, 37),

('monster', 'Monster Movies', 'Monster and creature features.', '🦖', 'genre',
 '{"keywords": {"require_any": ["monster", "creature", "kaiju"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Science Fiction", "Action"], "weight": 1.0}}',
 true, 38),

('zombie', 'Zombie', 'Zombie films and series.', '🧟', 'genre',
 '{"keywords": {"require_any": ["zombie", "undead", "walking dead"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Thriller"], "weight": 1.0}}',
 true, 39),

('vampire', 'Vampire', 'Vampire films and series.', '🧛', 'genre',
 '{"keywords": {"require_any": ["vampire", "dracula", "bloodsucker"], "weight": 2.0}, "genres": {"prefer": ["Horror", "Fantasy"], "weight": 1.0}}',
 true, 40),

('psychological_thriller', 'Psychological Thriller', 'Mind-bending psychological thrillers.', '😰', 'genre',
 '{"genres": {"require_any": ["Thriller"], "weight": 1.5}, "keywords": {"require_any": ["psychological", "mind game", "paranoia"], "weight": 2.0}}',
 true, 41),

('spy', 'Spy/Espionage', 'Spy and espionage thrillers.', '🕵️', 'genre',
 '{"keywords": {"require_any": ["spy", "espionage", "secret agent", "intelligence"], "weight": 2.0}, "genres": {"prefer": ["Thriller", "Action"], "weight": 1.0}}',
 true, 42),

('heist', 'Heist', 'Heist and caper films.', '💰', 'genre',
 '{"keywords": {"require_any": ["heist", "robbery", "caper", "theft"], "weight": 2.0}, "genres": {"prefer": ["Crime", "Thriller", "Action"], "weight": 1.0}}',
 true, 43),

('disaster', 'Disaster', 'Disaster and survival films.', '🌋', 'genre',
 '{"keywords": {"require_any": ["disaster", "earthquake", "tornado", "tsunami", "survival"], "weight": 2.0}, "genres": {"prefer": ["Action", "Thriller"], "weight": 1.0}}',
 true, 44),

('martial_arts', 'Martial Arts', 'Martial arts action films.', '🥋', 'genre',
 '{"keywords": {"require_any": ["martial arts", "kung fu", "karate", "wushu"], "weight": 2.0}, "genres": {"prefer": ["Action"], "weight": 1.0}}',
 true, 45),

('noir', 'Film Noir', 'Film noir and neo-noir.', '🎩', 'genre',
 '{"keywords": {"require_any": ["noir", "neo-noir", "detective noir"], "weight": 2.0}, "genres": {"prefer": ["Crime", "Thriller", "Mystery"], "weight": 1.0}}',
 true, 46),

('cyberpunk', 'Cyberpunk', 'Cyberpunk and tech-dystopia.', '🤖', 'genre',
 '{"keywords": {"require_any": ["cyberpunk", "cyber", "hacker", "dystopia"], "weight": 2.0}, "genres": {"prefer": ["Science Fiction"], "weight": 1.0}}',
 true, 47),

('space_opera', 'Space Opera', 'Epic space opera adventures.', '🌌', 'genre',
 '{"keywords": {"require_any": ["space opera", "space adventure", "galaxy"], "weight": 2.0}, "genres": {"require_any": ["Science Fiction"], "weight": 1.5}}',
 true, 48),

('post_apocalyptic', 'Post-Apocalyptic', 'Post-apocalyptic survival content.', '☢️', 'genre',
 '{"keywords": {"require_any": ["post-apocalyptic", "apocalypse", "wasteland", "end of world"], "weight": 2.0}, "genres": {"prefer": ["Science Fiction", "Action"], "weight": 1.0}}',
 true, 49),

('dystopian', 'Dystopian', 'Dystopian future scenarios.', '🏚️', 'genre',
 '{"keywords": {"require_any": ["dystopian", "dystopia", "totalitarian"], "weight": 2.0}, "genres": {"prefer": ["Science Fiction", "Drama"], "weight": 1.0}}',
 true, 50),

('superhero', 'Superhero', 'Superhero films and series.', '🦸', 'genre',
 '{"keywords": {"require_any": ["superhero", "super hero", "comic book"], "weight": 2.0}, "genres": {"prefer": ["Action", "Science Fiction", "Fantasy"], "weight": 1.0}}',
 true, 51),

('courtroom', 'Courtroom Drama', 'Legal and courtroom dramas.', '⚖️', 'genre',
 '{"keywords": {"require_any": ["courtroom", "legal", "lawyer", "trial"], "weight": 2.0}, "genres": {"prefer": ["Drama", "Crime"], "weight": 1.0}}',
 true, 52),

('medical', 'Medical Drama', 'Medical dramas and hospital settings.', '🏥', 'genre',
 '{"keywords": {"require_any": ["medical", "hospital", "doctor", "surgeon"], "weight": 2.0}, "genres": {"prefer": ["Drama"], "weight": 1.0}}',
 true, 53),

('political', 'Political', 'Political dramas and thrillers.', '🏛️', 'genre',
 '{"keywords": {"require_any": ["political", "politics", "election", "government"], "weight": 2.0}, "genres": {"prefer": ["Drama", "Thriller"], "weight": 1.0}}',
 true, 54),

-- ============================================================================
-- CATEGORY: GENRE SPECIAL INTEREST - 15 new presets (display_order 55-69)
-- ============================================================================
('true_crime', 'True Crime', 'True crime documentaries and series.', '🔎', 'genre',
 '{"keywords": {"require_any": ["true crime", "murder", "investigation"], "weight": 2.0}, "genres": {"prefer": ["Documentary", "Crime"], "weight": 1.0}}',
 true, 55),

('nature', 'Nature & Wildlife', 'Nature and wildlife documentaries.', '🦁', 'genre',
 '{"keywords": {"require_any": ["nature", "wildlife", "animal", "planet earth"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 56),

('science', 'Science & Tech', 'Science and technology documentaries.', '🔬', 'genre',
 '{"keywords": {"require_any": ["science", "technology", "physics", "space", "cosmos"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 57),

('travel', 'Travel & Culture', 'Travel and cultural documentaries.', '✈️', 'genre',
 '{"keywords": {"require_any": ["travel", "culture", "journey", "world"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 58),

('food', 'Food & Cooking', 'Food and cooking content.', '🍳', 'genre',
 '{"keywords": {"require_any": ["food", "cooking", "chef", "culinary", "cuisine"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 59),

('music_doc', 'Music Documentary', 'Music documentaries and biopics.', '🎸', 'genre',
 '{"keywords": {"require_any": ["music", "musician", "band", "singer"], "weight": 2.0}, "genres": {"require_any": ["Documentary", "Music"], "weight": 1.5}}',
 true, 60),

('art_culture', 'Art & Culture', 'Art and cultural documentaries.', '🎨', 'genre',
 '{"keywords": {"require_any": ["art", "artist", "painting", "sculpture", "museum"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 61),

('faith_spiritual', 'Faith & Spiritual', 'Faith-based and spiritual content.', '🙏', 'genre',
 '{"keywords": {"require_any": ["faith", "spiritual", "religion", "christian", "gospel"], "weight": 2.0}, "genres": {"prefer": ["Documentary", "Drama"], "weight": 0.8}}',
 true, 62),

('educational', 'Educational', 'Educational and instructional content.', '📚', 'genre',
 '{"keywords": {"require_any": ["educational", "learning", "instructional", "tutorial"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 63),

('conspiracy', 'Conspiracy/Unexplained', 'Conspiracy and unexplained mysteries.', '👽', 'genre',
 '{"keywords": {"require_any": ["conspiracy", "mystery", "unexplained", "paranormal", "ufo"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 64),

('sports_doc', 'Sports Documentary', 'Sports documentaries and films.', '🏆', 'genre',
 '{"keywords": {"require_any": ["sports", "athlete", "championship"], "weight": 2.0}, "genres": {"require_any": ["Documentary", "Sports"], "weight": 1.5}}',
 true, 65),

('concert', 'Concert Films', 'Concert films and live performances.', '🎤', 'genre',
 '{"keywords": {"require_any": ["concert", "live performance", "tour"], "weight": 2.0}, "genres": {"prefer": ["Music", "Documentary"], "weight": 1.0}}',
 true, 66),

('behind_scenes', 'Behind the Scenes', 'Behind-the-scenes and making-of documentaries.', '🎬', 'genre',
 '{"keywords": {"require_any": ["behind the scenes", "making of", "documentary"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 67),

('interview', 'Interview/Talk', 'Interview and talk-based content.', '💬', 'genre',
 '{"keywords": {"require_any": ["interview", "conversation", "talk"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 68),

('essay', 'Video Essay', 'Video essays and analytical content.', '📝', 'genre',
 '{"keywords": {"require_any": ["video essay", "essay", "analysis", "critique"], "weight": 2.0}, "genres": {"prefer": ["Documentary"], "weight": 1.0}}',
 true, 69),

-- ============================================================================
-- CATEGORY: FRANCHISE - 18 new presets (display_order 70-88)
-- ============================================================================
('illumination', 'Illumination', 'Illumination Entertainment animated films.', '🍌', 'franchise',
 '{"studios": {"require_any": ["Illumination Entertainment", "Illumination"], "weight": 2.0}}',
 true, 70),

('sony_animation', 'Sony Animation', 'Sony Pictures Animation films.', '🕷️', 'franchise',
 '{"studios": {"require_any": ["Sony Pictures Animation"], "weight": 2.0}}',
 true, 71),

('laika', 'Laika', 'Laika stop-motion animated films.', '🎭', 'franchise',
 '{"studios": {"require_any": ["Laika"], "weight": 2.0}}',
 true, 73),

('blue_sky', 'Blue Sky', 'Blue Sky Studios animated films.', '🧊', 'franchise',
 '{"studios": {"require_any": ["Blue Sky Studios"], "weight": 2.0}}',
 true, 74),

('marvel_other', 'Marvel (Non-MCU)', 'Marvel films outside the MCU.', '🕷️', 'franchise',
 '{"keywords": {"require_any": ["marvel"], "weight": 2.0}, "studios": {"exclude": ["Marvel Studios"], "weight": 1.0}}',
 true, 75),

('star_trek', 'Star Trek', 'Star Trek films and series.', '🖖', 'franchise',
 '{"keywords": {"require_any": ["star trek", "enterprise", "starfleet"], "weight": 2.0}}',
 true, 76),

('harry_potter', 'Wizarding World', 'Harry Potter and Wizarding World films.', '⚡', 'franchise',
 '{"keywords": {"require_any": ["harry potter", "wizarding world", "fantastic beasts"], "weight": 2.0}}',
 true, 77),

('lotr', 'Middle-earth', 'Lord of the Rings and Middle-earth content.', '💍', 'franchise',
 '{"keywords": {"require_any": ["lord of the rings", "hobbit", "middle-earth"], "weight": 2.0}}',
 true, 78),

('james_bond', 'James Bond', 'James Bond 007 films.', '🍸', 'franchise',
 '{"keywords": {"require_any": ["james bond", "007"], "weight": 2.0}}',
 true, 79),

('fast_furious', 'Fast & Furious', 'Fast & Furious franchise films.', '🚗', 'franchise',
 '{"keywords": {"require_any": ["fast and furious", "fast & furious"], "weight": 2.0}}',
 true, 80),

('jurassic', 'Jurassic', 'Jurassic Park/World franchise films.', '🦖', 'franchise',
 '{"keywords": {"require_any": ["jurassic park", "jurassic world"], "weight": 2.0}}',
 true, 81),

('monsterverse', 'Monsterverse', 'Legendary Monsterverse films.', '🦍', 'franchise',
 '{"keywords": {"require_any": ["monsterverse", "godzilla", "kong"], "weight": 2.0}}',
 true, 82),

('conjuring', 'Conjuring Universe', 'The Conjuring Universe horror films.', '👁️', 'franchise',
 '{"keywords": {"require_any": ["conjuring", "annabelle", "nun", "valak"], "weight": 2.0}}',
 true, 83),

('a24', 'A24', 'A24 independent films.', '🅰️', 'franchise',
 '{"studios": {"require_any": ["A24"], "weight": 2.0}}',
 true, 84),

('blumhouse', 'Blumhouse', 'Blumhouse Productions horror films.', '🎃', 'franchise',
 '{"studios": {"require_any": ["Blumhouse Productions", "Blumhouse"], "weight": 2.0}}',
 true, 85),

('neon', 'Neon', 'Neon independent films.', '💡', 'franchise',
 '{"studios": {"require_any": ["Neon"], "weight": 2.0}}',
 true, 86),

('searchlight', 'Searchlight', 'Searchlight Pictures films.', '🔦', 'franchise',
 '{"studios": {"require_any": ["Searchlight Pictures", "Fox Searchlight"], "weight": 2.0}}',
 true, 87),

('focus', 'Focus Features', 'Focus Features films.', '🎯', 'franchise',
 '{"studios": {"require_any": ["Focus Features"], "weight": 2.0}}',
 true, 88),

-- ============================================================================
-- CATEGORY: TEMPORAL - 7 new presets (display_order 89-95)
-- ============================================================================
('silent_era', 'Silent Era', 'Silent films from before 1930.', '🎬', 'temporal',
 '{"release_year": {"max": 1929, "weight": 2.0}, "media_type": {"include": ["movie"]}}',
 true, 89),

('new_hollywood', 'New Hollywood', 'New Hollywood era films (1967-1980).', '🎥', 'temporal',
 '{"release_year": {"min": 1967, "max": 1980, "weight": 2.0}, "media_type": {"include": ["movie"]}}',
 true, 90),

('2000s', '2000s', 'Content from the 2000s decade.', '📀', 'temporal',
 '{"release_year": {"min": 2000, "max": 2009, "weight": 2.0}}',
 true, 91),

('2010s', '2010s', 'Content from the 2010s decade.', '📱', 'temporal',
 '{"release_year": {"min": 2010, "max": 2019, "weight": 2.0}}',
 true, 92),

('2020s', '2020s', 'Content from the 2020s decade.', '🦠', 'temporal',
 '{"release_year": {"min": 2020, "max": 2029, "weight": 2.0}}',
 true, 93),

('retro', 'Retro', 'Retro content from before 2000.', '📺', 'temporal',
 '{"release_year": {"max": 1999, "weight": 2.0}}',
 true, 94),

('modern', 'Modern', 'Modern content from 2000 onwards.', '🎬', 'temporal',
 '{"release_year": {"min": 2000, "weight": 2.0}}',
 true, 95),

-- ============================================================================
-- CATEGORY: QUALITY - 8 new presets (display_order 96-103)
-- ============================================================================
('critically_acclaimed', 'Critically Acclaimed', 'Critically acclaimed with high review scores.', '🏆', 'quality',
 '{"vote_average": {"min": 8.0, "weight": 2.0}}',
 true, 96),

('popular', 'Popular', 'Popular and widely watched content.', '📈', 'quality',
 '{"keywords": {"prefer": ["popular", "trending", "blockbuster"], "weight": 1.5}}',
 true, 97),

('cult_classic', 'Cult Classics', 'Cult classic films with devoted followings.', '🕯️', 'quality',
 '{"keywords": {"require_any": ["cult classic", "cult film"], "weight": 2.0}}',
 true, 98),

('award_winners', 'Award Winners', 'Award-winning films and series.', '🏅', 'quality',
 '{"keywords": {"prefer": ["oscar", "academy award", "emmy", "golden globe"], "weight": 1.5}, "vote_average": {"min": 7.5, "weight": 1.0}}',
 true, 99),

('indie', 'Independent', 'Independent and art house films.', '🎭', 'quality',
 '{"keywords": {"require_any": ["independent", "indie", "art house"], "weight": 2.0}}',
 true, 100),

('blockbuster', 'Blockbusters', 'Big-budget blockbuster films.', '💰', 'quality',
 '{"keywords": {"require_any": ["blockbuster", "big budget"], "weight": 1.5}, "genres": {"prefer": ["Action", "Science Fiction", "Adventure"], "weight": 0.8}}',
 true, 101),

('underrated', 'Underrated', 'Underrated and overlooked gems.', '🤫', 'quality',
 '{"keywords": {"require_any": ["underrated", "overlooked", "hidden"], "weight": 2.0}}',
 true, 102),

('so_bad_good', 'So Bad It''s Good', 'So bad they''re good, guilty pleasure films.', '🧀', 'quality',
 '{"keywords": {"require_any": ["so bad", "guilty pleasure", "campy"], "weight": 2.0}}',
 true, 103),

-- ============================================================================
-- CATEGORY: SEASONAL - 6 new presets (display_order 104-109)
-- ============================================================================
('thanksgiving', 'Thanksgiving', 'Thanksgiving-themed content.', '🦃', 'seasonal',
 '{"keywords": {"require_any": ["thanksgiving", "turkey day"], "weight": 2.0}, "genres": {"prefer": ["Family", "Comedy", "Drama"], "weight": 0.5}}',
 true, 104),

('valentines', 'Valentine''s Day', 'Valentine''s Day romantic content.', '💘', 'seasonal',
 '{"keywords": {"require_any": ["valentine", "valentines day"], "weight": 2.0}, "genres": {"prefer": ["Romance", "Comedy"], "weight": 1.0}}',
 true, 105),

('easter', 'Easter', 'Easter-themed family content.', '🐰', 'seasonal',
 '{"keywords": {"require_any": ["easter", "bunny", "egg"], "weight": 2.0}, "genres": {"prefer": ["Family", "Animation"], "weight": 0.5}}',
 true, 106),

('new_years', 'New Year''s', 'New Year''s celebration content.', '🎆', 'seasonal',
 '{"keywords": {"require_any": ["new year", "new years eve"], "weight": 2.0}, "genres": {"prefer": ["Comedy", "Romance", "Drama"], "weight": 0.5}}',
 true, 107),

('summer', 'Summer Vibes', 'Summer-themed light content.', '☀️', 'seasonal',
 '{"keywords": {"require_any": ["summer", "beach", "vacation"], "weight": 2.0}, "genres": {"prefer": ["Comedy", "Romance", "Adventure"], "weight": 0.5}}',
 true, 108),

('winter', 'Winter/Cozy', 'Winter and cozy content.', '❄️', 'seasonal',
 '{"keywords": {"require_any": ["winter", "snow", "cozy"], "weight": 2.0}, "genres": {"prefer": ["Drama", "Romance", "Family"], "weight": 0.5}}',
 true, 109),

-- ============================================================================
-- CATEGORY: REGIONAL - 20 new presets (display_order 110-129)
-- ============================================================================
('english', 'English', 'English-language content.', '🇺🇸', 'regional',
 '{"language": {"require_any": ["en"], "weight": 2.0}}',
 true, 110),

('australian', 'Australian', 'Australian productions.', '🇦🇺', 'regional',
 '{"language": {"require_any": ["en"], "weight": 1.0}, "keywords": {"prefer": ["australian", "australia", "aussie"], "weight": 1.5}}',
 true, 111),

('canadian', 'Canadian', 'Canadian productions.', '🇨🇦', 'regional',
 '{"language": {"require_any": ["en", "fr"], "weight": 1.0}, "keywords": {"prefer": ["canadian", "canada"], "weight": 1.5}}',
 true, 112),

('japanese', 'Japanese', 'Japanese films (non-anime).', '🇯🇵', 'regional',
 '{"language": {"require_any": ["ja"], "weight": 2.0}, "keywords": {"exclude": ["anime"], "weight": 1.0}}',
 true, 113),

('chinese', 'Chinese', 'Chinese-language films.', '🇨🇳', 'regional',
 '{"language": {"require_any": ["zh"], "weight": 2.0}}',
 true, 114),

('hong_kong', 'Hong Kong', 'Hong Kong cinema.', '🇭🇰', 'regional',
 '{"language": {"require_any": ["zh", "yue"], "weight": 2.0}, "keywords": {"prefer": ["hong kong"], "weight": 1.0}}',
 true, 115),

('taiwanese', 'Taiwanese', 'Taiwanese films.', '🇹🇼', 'regional',
 '{"language": {"require_any": ["zh"], "weight": 2.0}, "keywords": {"prefer": ["taiwanese", "taiwan"], "weight": 1.0}}',
 true, 116),

('indian', 'Indian', 'Indian films (Bollywood, Tollywood, etc).', '🇮🇳', 'regional',
 '{"language": {"require_any": ["hi", "ta", "te", "ml"], "weight": 2.0}}',
 true, 117),

('spanish', 'Spanish', 'Spanish-language films from Spain.', '🇪🇸', 'regional',
 '{"language": {"require_any": ["es"], "weight": 2.0}, "keywords": {"prefer": ["spanish", "spain"], "weight": 0.5}}',
 true, 118),

('latin_american', 'Latin American', 'Latin American films and series.', '🌎', 'regional',
 '{"language": {"require_any": ["es", "pt"], "weight": 2.0}, "keywords": {"prefer": ["latin", "latinoamérica"], "weight": 0.5}}',
 true, 119),

('mexican', 'Mexican', 'Mexican films and series.', '🇲🇽', 'regional',
 '{"language": {"require_any": ["es"], "weight": 2.0}, "keywords": {"prefer": ["mexican", "mexico"], "weight": 1.0}}',
 true, 120),

('brazilian', 'Brazilian', 'Brazilian films and series.', '🇧🇷', 'regional',
 '{"language": {"require_any": ["pt"], "weight": 2.0}, "keywords": {"prefer": ["brazilian", "brazil"], "weight": 1.0}}',
 true, 121),

('french', 'French', 'French-language films.', '🇫🇷', 'regional',
 '{"language": {"require_any": ["fr"], "weight": 2.0}}',
 true, 122),

('german', 'German', 'German-language films.', '🇩🇪', 'regional',
 '{"language": {"require_any": ["de"], "weight": 2.0}}',
 true, 123),

('italian', 'Italian', 'Italian-language films.', '🇮🇹', 'regional',
 '{"language": {"require_any": ["it"], "weight": 2.0}}',
 true, 124),

('scandinavian', 'Scandinavian', 'Scandinavian films and series.', '🇸🇪', 'regional',
 '{"language": {"require_any": ["sv", "no", "da", "fi"], "weight": 2.0}}',
 true, 125),

('russian', 'Russian', 'Russian-language films.', '🇷🇺', 'regional',
 '{"language": {"require_any": ["ru"], "weight": 2.0}}',
 true, 126),

('turkish', 'Turkish', 'Turkish-language films and series.', '🇹🇷', 'regional',
 '{"language": {"require_any": ["tr"], "weight": 2.0}}',
 true, 127),

('thai', 'Thai', 'Thai-language films and series.', '🇹🇭', 'regional',
 '{"language": {"require_any": ["th"], "weight": 2.0}}',
 true, 128),

('arabic', 'Arabic', 'Arabic-language films and series.', '🇸🇦', 'regional',
 '{"language": {"require_any": ["ar"], "weight": 2.0}}',
 true, 129),

-- ============================================================================
-- CATEGORY: TV - 14 new presets (display_order 130-143)
-- ============================================================================
('tv_procedural', 'Procedural', 'TV procedural dramas.', '🚔', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["procedural", "case of the week"], "weight": 2.0}, "genres": {"prefer": ["Crime", "Drama"], "weight": 1.0}}',
 true, 130),

('tv_soap', 'Soap Opera', 'Soap operas and melodramas.', '💔', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["soap opera", "telenovela"], "weight": 2.0}, "genres": {"prefer": ["Drama"], "weight": 1.0}}',
 true, 131),

('tv_anthology', 'Anthology', 'Anthology series.', '📚', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["anthology", "anthology series"], "weight": 2.0}}',
 true, 132),

('tv_variety', 'Variety Show', 'Variety and sketch shows.', '🎪', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["variety", "sketch"], "weight": 2.0}, "genres": {"prefer": ["Comedy"], "weight": 1.0}}',
 true, 133),

('tv_talk', 'Talk Show', 'Talk shows and interviews.', '🎙️', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["talk show", "interview show"], "weight": 2.0}}',
 true, 134),

('tv_game', 'Game Show', 'Game shows and competitions.', '🎲', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["game show", "quiz"], "weight": 2.0}}',
 true, 135),

('tv_news', 'News', 'News programs.', '📰', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["news", "newscast"], "weight": 2.0}}',
 true, 136),

('tv_kids', 'Kids TV', 'Children''s television programs.', '🧒', 'tv',
 '{"media_type": {"include": ["tv"]}, "certifications": {"mode": "include", "include": ["TV-Y", "TV-Y7", "TV-G"], "weight": 2.0}, "genres": {"prefer": ["Family", "Animation"], "weight": 1.0}}',
 true, 137),

('tv_dating', 'Dating Shows', 'Dating and relationship reality shows.', '💕', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["dating", "dating show", "bachelor"], "weight": 2.0}, "genres": {"prefer": ["Reality"], "weight": 1.0}}',
 true, 138),

('tv_cooking', 'Cooking Shows', 'Cooking and food competition shows.', '👨‍🍳', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["cooking show", "chef", "baking"], "weight": 2.0}}',
 true, 139),

('tv_true_crime', 'True Crime Series', 'True crime TV series.', '🔎', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["true crime"], "weight": 2.0}, "genres": {"prefer": ["Documentary", "Crime"], "weight": 1.0}}',
 true, 140),

('tv_late_night', 'Late Night', 'Late night talk and variety shows.', '🌙', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["late night", "tonight show"], "weight": 2.0}}',
 true, 141),

('tv_daytime', 'Daytime', 'Daytime television programming.', '☀️', 'tv',
 '{"media_type": {"include": ["tv"]}, "keywords": {"require_any": ["daytime"], "weight": 2.0}}',
 true, 142),

('tv_documentary', 'Doc Series', 'Documentary television series.', '📚', 'tv',
 '{"media_type": {"include": ["tv"]}, "genres": {"require_any": ["Documentary"], "weight": 2.0}}',
 true, 143)

ON CONFLICT (key, user_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    signals = EXCLUDED.signals,
    is_system = EXCLUDED.is_system,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Log successful completion

-- === Seed: 046_event_detection_presets.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- v0.37.0: Event Detection Presets
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration migrates event detection from hardcoded detectEventContent()
-- to PolicyEngine presets, enabling policy-based event classification.
--
-- Related Issue: #98 (AI Optimization & Event Detection Migration)
-- Parent Epic: #82 (v0.37.0 Formula-Based Classification Engine)
-- ═══════════════════════════════════════════════════════════════════════════


-- ============================================================================
-- EVENT DETECTION PRESETS - 6 new presets
-- ============================================================================
-- These presets replace the hardcoded event detection logic in detectEventContent()
-- Event types: holiday, sports, ppv, concert, standup, awards
-- ============================================================================

INSERT INTO
    content_presets (
        key,
        name,
        description,
        icon,
        category,
        signals,
        is_system,
        display_order
    )
VALUES
    -- Holiday Content
    (
        'event_holiday',
        'Holiday & Seasonal',
        'Christmas, Halloween, and seasonal content',
        '🎄',
        'events',
        '{"keywords": {"require_any": ["christmas", "xmas", "santa", "santa claus", "north pole", "reindeer", "rudolph", "frosty", "snowman", "christmas eve", "yuletide", "noel", "nativity", "scrooge", "grinch", "krampus", "nutcracker", "polar express", "mistletoe", "candy cane", "gingerbread", "halloween", "trick or treat", "haunted", "hanukkah", "chanukah", "kwanzaa", "thanksgiving", "easter", "valentines day", "new years eve"], "weight": 2.0}, "base_confidence": 95}',
        true,
        200
    ),

-- Sports Content
(
    'event_sports',
    'Sports & Athletics',
    'Sports events, documentaries, and athletics',
    '🏈',
    'events',
    '{"keywords": {"require_any": ["nfl", "nba", "mlb", "nhl", "mls", "fifa", "uefa", "premier league", "super bowl", "world series", "stanley cup", "world cup", "championship", "playoffs", "tournament", "olympics", "olympic games", "espn", "sports documentary", "football game", "basketball game", "baseball game", "hockey game", "soccer match", "tennis match", "golf tournament", "motorsports", "nascar", "formula 1", "f1", "grand prix", "marathon", "30 for 30"], "weight": 2.0}, "genres": {"prefer": ["Sport", "Documentary"], "weight": 0.5}, "base_confidence": 92}',
    true,
    201
),

-- PPV/Combat Sports
(
    'event_ppv',
    'PPV & Combat Sports',
    'UFC, MMA, boxing, wrestling events',
    '🥊',
    'events',
    '{"keywords": {"require_any": ["ufc", "mma", "ultimate fighting", "bellator", "pride fc", "one championship", "mixed martial arts", "cage fight", "octagon", "boxing", "heavyweight", "middleweight", "welterweight", "title fight", "championship bout", "knockout", "wwe", "wrestling", "wrestlemania", "royal rumble", "summerslam", "aew", "pro wrestling", "smackdown", "pay per view", "ppv", "fight night", "main event"], "weight": 2.0}, "base_confidence": 93}',
    true,
    202
),

-- Concert/Live Music
(
    'event_concert',
    'Concert & Live Music',
    'Live concerts, music festivals, performances',
    '🎵',
    'events',
    '{"keywords": {"require_any": ["concert", "live performance", "live tour", "world tour", "music festival", "coachella", "lollapalooza", "glastonbury", "rock concert", "pop concert", "symphony", "orchestra", "unplugged", "acoustic session", "mtv unplugged", "live album", "concert film", "tour documentary"], "weight": 2.0}, "genres": {"prefer": ["Music", "Documentary"], "weight": 0.5}, "base_confidence": 90}',
    true,
    203
),

-- Stand-up Comedy
(
    'event_standup',
    'Stand-up Comedy',
    'Comedy specials and stand-up performances',
    '🎤',
    'events',
    '{"keywords": {"require_any": ["stand-up", "standup", "comedy special", "netflix special", "hbo special", "live at the apollo", "def comedy jam", "comedian", "comedy tour", "comedy central", "roast", "just for laughs", "improv", "one-man show", "one-woman show"], "weight": 2.0}, "genres": {"prefer": ["Comedy"], "weight": 0.8}, "base_confidence": 90}',
    true,
    204
),

-- Awards Shows
(
    'event_awards',
    'Awards & Ceremonies',
    'Award shows, galas, red carpet events',
    '🏆',
    'events',
    '{"keywords": {"require_any": ["oscars", "academy awards", "emmys", "golden globes", "grammys", "tony awards", "bafta", "mtv awards", "vma", "ama", "billboard awards", "peoples choice", "critics choice", "sag awards", "bet awards", "award ceremony", "award show", "red carpet"], "weight": 2.0}, "base_confidence": 88}',
    true,
    205
) ON CONFLICT (key, user_id) DO
UPDATE
SET
    signals = EXCLUDED.signals,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================================================
-- MIGRATION HELPER: Auto-attach event presets to libraries with event_detection_type
-- ============================================================================
-- This function migrates existing libraries using event_detection_type to use
-- the new event presets via PolicyEngine
-- ============================================================================




-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that event presets were created successfully

-- === Seed: 20260201_010000_add_discord_display_options.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Migration: Add Discord Display Options Settings
-- Created: 2026-02-01
-- Related: PR #254 (Remove duplicate confidence threshold sliders)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add Discord display option settings
INSERT INTO confidence_settings (setting_key, setting_value, description, default_value)
VALUES
  (
    'discord_include_signal_breakdown',
    'true',
    'Always include AI signal breakdown in Discord verification messages',
    'true'
  ),
  (
    'discord_show_similar_items',
    'true',
    'Show top 3 similar items already in library in Discord messages',
    'true'
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  default_value = EXCLUDED.default_value;

-- Add comment explaining these settings
COMMENT ON TABLE confidence_settings IS 
  'Configuration settings for confidence thresholds and behavior. 
   Policy thresholds control both classification AND Discord notification behavior.
   Discord display settings control what information is shown in notification messages.';

-- === Seed: 20260226_002000_seed_runtime_security_defaults.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- Migration: Seed runtime security defaults for existing deployments
-- Purpose:
--   Ensure required runtime-security keys exist for upgraded installs
--   without overriding admin-configured values.

INSERT INTO settings (key, value)
VALUES
  ('force_secure_cookies', 'false'),
  ('csrf_protection', 'true'),
  ('cors_origin', '')
ON CONFLICT (key) DO NOTHING;

-- === Seed: 20260309_140000_task_queue_retention.sql ===
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- Migration: 20260309_140000_task_queue_retention.sql
--
-- Root cause of OOM crash (March 2026):
--   task_queue accumulated 300 000+ completed rows with no TTL/retention policy.
--   The heavy NOT EXISTS / COUNT(*) queries that run every 5 minutes (gap
--   analysis, stats) scanned the entire bloated table under GC pressure,
--   driving the Node.js heap to its 4 GB auto-cap and triggering an OOM kill.
--
-- What this migration does:
--
--   1. Adds a partial B-tree index on created_at for completed/failed/cancelled
--      rows so that the daily scheduler cleanup (DELETE WHERE status IN (...) AND
--      created_at < NOW() - INTERVAL 'N days') runs in O(log n) instead of a
--      full sequential scan.  Without this index the cleanup is as expensive as
--      the original growth-inducing queries.
--
--   2. Seeds the `task_queue_retention_days` setting (default 7).  The scheduler
--      job reads this value; operators can raise it (e.g. 30) to retain more
--      history.  A value of 0 disables automatic cleanup.
--
--   3. One-time emergency purge: deletes completed/failed/cancelled rows older
--      than 7 days in batches of 10 000 to avoid locking the table for an
--      extended period.  Runs only if the bloated-row count exceeds 1 000.
--      Safe to re-run; the DELETE is idempotent.

-- 1. Partial cleanup index (O(log n) for TTL deletes)
CREATE INDEX IF NOT EXISTS idx_task_queue_cleanup
    ON task_queue (created_at)
    WHERE status IN ('completed', 'failed', 'cancelled');

-- 2. Retention-days setting (configurable, default 7 days)
INSERT INTO settings (key, value)
VALUES ('task_queue_retention_days', '7')
ON CONFLICT (key) DO NOTHING;

-- 3. One-time emergency purge (batched to avoid long locks).
--    Wrapped in a DO block so it only runs when significant bloat exists.

-- === Seed: 20260514_121500_normalize_task_queue_retention_setting.sql ===
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- Migration: 20260514_121500_normalize_task_queue_retention_setting.sql
--
-- Why this exists:
--   1. The original task_queue retention migration seeded
--      settings.task_queue_retention_days, but that seed was never carried into
--      the schema snapshot used for fresh installs.
--   2. As a result, some current installations legitimately have no
--      task_queue_retention_days row even though the code and migration comments
--      expect one to exist.
--   3. We now treat 0 as a valid operator value that disables age-based cleanup
--      while keeping the total-row cap safety valve active.
--
-- What this migration does:
--   - Ensures task_queue_retention_days exists for all installs.
--   - Normalizes invalid stored values back to the default of 7.
--   - Preserves valid non-negative integers, including 0.

INSERT INTO settings (key, value)
VALUES ('task_queue_retention_days', '7')
ON CONFLICT (key) DO NOTHING;

UPDATE settings
SET
    value = CASE
        WHEN btrim(value) ~ '^[0-9]+$' THEN btrim(value)
        ELSE '7'
    END,
    updated_at = NOW()
WHERE key = 'task_queue_retention_days'
  AND (
      value IS NULL
      OR value <> btrim(value)
      OR NOT (btrim(value) ~ '^[0-9]+$')
  );

-- === Seed: 20260514_161500_add_task_queue_status_retention_settings.sql ===
-- ============================================================================
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- ============================================================================
-- Migration: 20260514_161500_add_task_queue_status_retention_settings.sql
-- Purpose:
--   Extend task_queue cleanup to use status-aware retention windows instead of
--   one shared age limit for completed, failed, and cancelled rows.
--
-- Behavior:
--   - Preserves the existing completed-row setting:
--       settings.task_queue_retention_days (default 7)
--   - Adds failed-row retention:
--       settings.task_queue_failed_retention_days (default 30)
--   - Adds cancelled-row retention:
--       settings.task_queue_cancelled_retention_days (default 3)
--   - Normalizes invalid values to defaults while preserving valid
--     non-negative integers, including 0 to disable age cleanup per status.
-- ============================================================================

INSERT INTO settings (key, value)
VALUES
    ('task_queue_failed_retention_days', '30'),
    ('task_queue_cancelled_retention_days', '3')
ON CONFLICT (key) DO NOTHING;

UPDATE settings
SET value = CASE key
        WHEN 'task_queue_retention_days' THEN '7'
        WHEN 'task_queue_failed_retention_days' THEN '30'
        WHEN 'task_queue_cancelled_retention_days' THEN '3'
    END,
    updated_at = NOW()
WHERE key IN (
    'task_queue_retention_days',
    'task_queue_failed_retention_days',
    'task_queue_cancelled_retention_days'
)
  AND (
      value IS NULL
      OR value <> btrim(value)
      OR NOT (btrim(value) ~ '^[0-9]+$')
  );

-- === Seed: 20260517_235500_reconcile_clarification_seed_data.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- Migration: Reconcile missing clarification seed data
-- Purpose:
--   Fresh installs that bootstrap from database/schema/current.sql can mark
--   historical mixed migrations as already applied without replaying their
--   seed INSERT statements. This migration restores the default
--   confidence_thresholds rows and clarification_questions rows when they are
--   absent, without disturbing customized installs.
-- @seed-reconciliation snapshot-required

INSERT INTO confidence_thresholds (
  tier,
  min_confidence,
  max_confidence,
  action,
  description
)
VALUES
  (
    'auto',
    90,
    100,
    'auto_route',
    'Automatically route without interaction'
  ),
  (
    'verify',
    70,
    89,
    'verify_buttons',
    'Show Yes/No verification buttons'
  ),
  (
    'clarify',
    50,
    69,
    'clarify_questions',
    'Ask clarifying questions'
  ),
  (
    'manual',
    0,
    49,
    'manual_selection',
    'Request manual library selection'
  )
ON CONFLICT (tier) DO NOTHING;

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'Is this a stand-up comedy special?',
  'content_type',
  ARRAY['stand-up', 'comedy special', 'standup', 'live comedy'],
  ARRAY['Documentary', 'Comedy'],
  '{"yes": {"label": "Stand-Up Special", "confidence_boost": 30}, "no": {"label": "Regular Content", "confidence_boost": -10}}'::jsonb,
  10,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'Is this a stand-up comedy special?'
);

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'Is this a concert or live music performance?',
  'content_type',
  ARRAY['concert', 'live performance', 'tour', 'music festival'],
  ARRAY['Documentary', 'Music'],
  '{"yes": {"label": "Concert Film", "confidence_boost": 30}, "no": {"label": "Regular Content", "confidence_boost": -10}}'::jsonb,
  9,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'Is this a concert or live music performance?'
);

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'Is this an adult animated show (like South Park, Family Guy)?',
  'content_type',
  ARRAY['adult animation', 'adult cartoon', 'animated sitcom'],
  ARRAY['Animation', 'Comedy'],
  '{"yes": {"label": "Adult Animation", "confidence_boost": 30}, "no": {"label": "Family Animation", "confidence_boost": -10}}'::jsonb,
  8,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'Is this an adult animated show (like South Park, Family Guy)?'
);

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'Is this a reality competition show?',
  'content_type',
  ARRAY['reality', 'competition', 'contestants', 'elimination'],
  ARRAY['Reality', 'Documentary'],
  '{"yes": {"label": "Reality Competition", "confidence_boost": 30}, "no": {"label": "Regular Show", "confidence_boost": -10}}'::jsonb,
  7,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'Is this a reality competition show?'
);

INSERT INTO clarification_questions (
  question_text,
  question_type,
  trigger_keywords,
  trigger_genres,
  response_options,
  priority,
  enabled
)
SELECT
  'What language is this content primarily in?',
  'language',
  ARRAY[]::text[],
  ARRAY[]::text[],
  '{"english": {"label": "English", "confidence_boost": 40}, "japanese": {"label": "Japanese", "confidence_boost": 40}, "korean": {"label": "Korean", "confidence_boost": 40}, "other": {"label": "Other Language", "confidence_boost": 0}}'::jsonb,
  5,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM clarification_questions
  WHERE question_text = 'What language is this content primarily in?'
);

-- === Seed: 20260518_011500_reconcile_bootstrap_sensitive_seed_data.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Reconcile bootstrap-sensitive seed data that originally lived inside older
-- mixed DDL+seed migrations. Fresh installs that bootstrap from
-- database/schema/current.sql mark those older migrations as already applied,
-- so any omitted seed rows must be restored forward-only here.
-- @seed-reconciliation snapshot-required

INSERT INTO ai_provider_config (
    id,
    primary_provider,
    heartbeat_timeout,
    heartbeat_interval,
    max_wait_time
)
VALUES (
    1,
    'none',
    30000,
    5000,
    60000
)
ON CONFLICT (id) DO UPDATE
SET
    primary_provider = COALESCE(ai_provider_config.primary_provider, EXCLUDED.primary_provider),
    heartbeat_timeout = COALESCE(ai_provider_config.heartbeat_timeout, EXCLUDED.heartbeat_timeout),
    heartbeat_interval = COALESCE(ai_provider_config.heartbeat_interval, EXCLUDED.heartbeat_interval),
    max_wait_time = COALESCE(ai_provider_config.max_wait_time, EXCLUDED.max_wait_time);

INSERT INTO pattern_analysis_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES
    ('classifarr_media_path', NULL),
    ('library_mapping_complete', 'false'),
    ('reclassification_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES
    ('log_retention_days', '30'),
    ('error_log_retention_days', '90'),
    ('log_level', 'INFO'),
    ('pattern_sync_frequency', 'daily'),
    ('profile_batch_size', '100'),
    ('profile_auto_generate', 'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO confidence_settings (
    setting_key,
    setting_value,
    description,
    default_value
)
VALUES
    ('weight_source_library', '100', 'Source library signal weight', '100'),
    ('weight_manual_correction', '100', 'Manual correction signal weight', '100'),
    ('weight_existing_media', '100', 'Existing media signal weight', '100'),
    ('weight_exact_match', '100', 'Exact match signal weight', '100'),
    ('weight_event_detection', '30', 'Event detection signal weight', '30'),
    ('weight_custom_rule', '35', 'Custom rule signal weight', '35'),
    ('weight_collection_match', '25', 'Collection match signal weight', '25'),
    ('weight_learned_pattern', '20', 'Learned pattern signal weight', '20'),
    ('weight_content_analysis', '15', 'Content analysis signal weight', '15'),
    ('weight_keyword_match', '10', 'Keyword match signal weight', '10'),
    ('weight_genre_match', '10', 'Genre match signal weight', '10'),
    ('confidence_threshold', '80', 'Global confidence threshold', '80')
ON CONFLICT (setting_key) DO UPDATE
SET
    description = COALESCE(confidence_settings.description, EXCLUDED.description),
    default_value = COALESCE(confidence_settings.default_value, EXCLUDED.default_value);

INSERT INTO embedding_provider_availability (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- === Seed: 20260518_013000_reconcile_low_priority_seed_data.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Reconcile lower-priority seed data that affects fresh-install semantic
-- parity with migrated installs but does not block core startup. These rows
-- historically lived inside mixed DDL+seed migrations and could be skipped
-- when bootstrap installs loaded database/schema/current.sql and marked the
-- historical migrations as already applied.
-- @seed-reconciliation snapshot-required

INSERT INTO settings (key, value)
VALUES ('rag_log_retention_days', '30')
ON CONFLICT (key) DO NOTHING;

INSERT INTO confidence_settings (
    setting_key,
    setting_value,
    description,
    default_value
)
VALUES
    ('policy_auto_classify_threshold', '85', 'Confidence % for auto-classification', '85'),
    ('policy_prompt_threshold', '60', 'Confidence % for user confirmation prompt', '60'),
    ('discord_auto_route_threshold', '85', 'Discord info-only message threshold', '85'),
    ('discord_verify_threshold', '60', 'Discord Yes/No verification threshold', '60'),
    ('discord_enhanced_details_threshold', '60', 'Discord detailed breakdown threshold', '60'),
    ('learning_genre_threshold', '3', 'Confirmations needed to learn genre preference', '3'),
    ('learning_keyword_threshold', '5', 'Confirmations needed to learn keyword preference', '5'),
    ('learning_studio_threshold', '2', 'Confirmations needed to learn studio preference', '2'),
    ('learning_min_confidence_rate', '75', 'Minimum % of confirms vs rejects', '75'),
    ('learning_conflict_strategy', 'escalate', 'Conflict resolution: block, escalate, auto_resolve', 'escalate'),
    ('learning_auto_resolve_threshold', '7', 'Confirmations to override exclusion', '7'),
    ('learning_multi_genre_strategy', 'weighted', 'Multi-genre learning: primary_only, weighted, all', 'weighted'),
    ('learning_max_per_user_day', '50', 'Max auto-learns per user per day', '50'),
    ('learning_max_per_library_hour', '20', 'Max auto-learns per library per hour', '20'),
    ('learning_lookback_days', '30', 'Days of feedback to consider', '30')
ON CONFLICT (setting_key) DO UPDATE
SET
    description = COALESCE(confidence_settings.description, EXCLUDED.description),
    default_value = COALESCE(confidence_settings.default_value, EXCLUDED.default_value);

-- === Seed: 20260614_110500_reconcile_web_search_provider_seed_data.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.

-- Reconcile provider-neutral web-search seed data that was introduced in a
-- mixed DDL+DML migration. Fresh installs bootstrap from database/schema/current.sql
-- and schema-only dumps omit DML unless it is explicitly replayed.
-- @seed-reconciliation snapshot-required

INSERT INTO web_search_provider_config (
    provider_key,
    display_name,
    is_enabled,
    priority,
    config
)
VALUES
    ('tavily', 'Tavily', false, 10, '{}'::jsonb),
    ('brave', 'Brave Search', false, 20, '{}'::jsonb),
    ('serper', 'Serper.dev', false, 30, '{}'::jsonb)
ON CONFLICT (provider_key) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    priority = LEAST(web_search_provider_config.priority, EXCLUDED.priority),
    config = CASE
        WHEN web_search_provider_config.config = '{}'::jsonb THEN EXCLUDED.config
        ELSE web_search_provider_config.config
    END,
    updated_at = NOW();

INSERT INTO web_search_provider_config (
    provider_key,
    display_name,
    is_enabled,
    priority,
    api_key,
    config,
    legacy_source,
    updated_at
)
SELECT
    'tavily',
    'Tavily',
    COALESCE(t.is_active, false),
    10,
    NULLIF(t.api_key, ''),
    jsonb_strip_nulls(jsonb_build_object(
        'searchDepth', t.search_depth,
        'maxResults', t.max_results,
        'includeDomains', t.include_domains,
        'excludeDomains', t.exclude_domains
    )),
    'tavily_config',
    NOW()
FROM tavily_config t
ORDER BY t.id DESC
LIMIT 1
ON CONFLICT (provider_key) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    is_enabled = web_search_provider_config.is_enabled OR EXCLUDED.is_enabled,
    priority = LEAST(web_search_provider_config.priority, EXCLUDED.priority),
    api_key = COALESCE(web_search_provider_config.api_key, EXCLUDED.api_key),
    config = web_search_provider_config.config || EXCLUDED.config,
    legacy_source = COALESCE(web_search_provider_config.legacy_source, EXCLUDED.legacy_source),
    updated_at = NOW();

-- === Seed: 20260625_011500_reconcile_web_search_provider_retention_seed_data.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- @seed-reconciliation snapshot-required
--
-- Reconcile default provider usage retention for fresh installs and upgraded
-- installs. The original retention migration also creates an index, so the
-- schema snapshot generator treats it as schema-bearing and does not splice
-- its INSERT into current.sql. Keep this data-only migration in the seed list
-- so fresh-install snapshots receive the same runtime default as migrations.

INSERT INTO settings (key, value)
VALUES ('web_search_provider_usage_retention_days', '62')
ON CONFLICT (key) DO NOTHING;

-- === Seed: 20260625_030000_add_web_search_provider_route_decision_retention.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- @seed-reconciliation snapshot-required
--
-- Keep sanitized provider route decisions long enough for operator diagnosis
-- while bounding append-only diagnostic growth. The route decision table already
-- has an indexed created_at/id path from its creation migration, so this slice
-- only needs the runtime setting seed.

INSERT INTO settings (key, value)
VALUES ('web_search_provider_route_decision_retention_days', '30')
ON CONFLICT (key) DO NOTHING;

-- === Seed: 20260625_041500_add_web_search_provider_health_retention.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

-- @seed-reconciliation snapshot-required
--
-- Keep sanitized provider health/cooldown diagnostics long enough for
-- operator troubleshooting while bounding append-only diagnostic growth.
-- The health event table already has an indexed created_at/id path from its
-- creation migration, so this slice only needs the runtime setting seed.

INSERT INTO settings (key, value)
VALUES ('web_search_provider_health_event_retention_days', '30')
ON CONFLICT (key) DO NOTHING;

-- === Seed: 20260625_051500_reconcile_web_search_provider_calibration_policy_seed_data.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- Licensed under GPL-3.0 - See LICENSE file for details.
-- @seed-reconciliation snapshot-required

-- Keep fresh installs and upgraded installs aligned on the default
-- classification calibration policy without overwriting user tuning.
INSERT INTO web_search_provider_calibration_policies (
    purpose,
    is_enabled,
    lookback_days,
    minimum_samples,
    maximum_priority_penalty,
    outcome_weight
)
VALUES (
    'classification',
    true,
    14,
    3,
    25,
    15
)
ON CONFLICT (purpose) DO NOTHING;

-- === Seed: 20260625_060000_reconcile_web_search_provider_guardrail_threshold_seed_data.sql ===
-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
-- Licensed under GPL-3.0 - See LICENSE file for details.
-- @seed-reconciliation snapshot-required

-- Keep fresh installs and upgraded installs aligned on default preview
-- guardrail thresholds without overwriting operator tuning.
INSERT INTO settings (key, value)
VALUES (
    'web_search_provider_guardrail_thresholds',
    '{"enabled":true,"lowSampleMultiplier":1,"recentHealthLookbackCount":10,"selectionChangeSeverity":"info","lowSampleSeverity":"warning","healthIssueSeverity":"warning","cooldownSeverity":"critical","noProviderSeverity":"critical"}'
)
ON CONFLICT (key) DO NOTHING;

-- === Seed: 20260905_210000_seed_library_sampling_state.sql ===
-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- @seed-reconciliation snapshot-required
-- Fresh schema snapshots omit runtime rows; never reset an existing cursor.
INSERT INTO public.library_observation_sampling_state (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- Mark all migrations as applied (prevents re-running)
SELECT pg_catalog.set_config('search_path', 'public', false);
INSERT INTO public.schema_migrations (filename, applied_at)
SELECT 
  filename,
  NOW()
FROM unnest(ARRAY[
    '001_add_arr_settings.sql',
    '002_add_arr_connection_fields.sql',
    '003_media_server_content_confidence.sql',
    '004_enhanced_logging.sql',
    '005_add_require_all_confirmations_setting.sql',
    '006_add_clarification_settings.sql',
    '007_add_clarification_response.sql',
    '008_add_task_queue.sql',
    '009_add_multi_manager.sql',
    '010_add_scheduled_tasks.sql',
    '011_add_library_rules.sql',
    '011_remove_email_column.sql',
    '012_add_library_custom_rules.sql',
    '013_unify_library_rules.sql',
    '014_add_classification_methods.sql',
    '015_add_library_rules_unique_constraint.sql',
    '016_add_omdb_config.sql',
    '017_add_ai_providers.sql',
    '018_update_ollama_default.sql',
    '019_cleanup_omdb_config.sql',
    '020_add_pattern_analysis.sql',
    '021_add_dismissed_patterns.sql',
    '022_library_arr_mappings.sql',
    '023_learned_corrections.sql',
    '024_arr_media_server_link.sql',
    '025_event_detection_type.sql',
    '026_path_mappings.sql',
    '027_add_collection_tracking.sql',
    '028_confidence_settings.sql',
    '031_add_rag_embeddings.sql',
    '032_allow_null_tmdb_in_classification_history.sql',
    '033_enrichment_retry_queue.sql',
    '034_cleanup_unused_tables.sql',
    '035_restore_error_log.sql',
    '036_restore_ollama_config.sql',
    '037_restore_missing_tables.sql',
    '038_add_event_sub_type.sql',
    '039_rag_enhancements.sql',
    '040_pattern_configuration.sql',
    '041_formula_engine_weights.sql',
    '042_policy_driven_schema.sql',
    '043_seed_content_presets.sql',
    '044_add_tuning_suggestion_tracking.sql',
    '044_expand_content_presets.sql',
    '045_legacy_migration_tracking.sql',
    '046_event_detection_presets.sql',
    '047_policy_preset_custom_signals.sql',
    '048_library_profiles.sql',
    '049_expand_classification_methods.sql',
    '050_expand_classification_status.sql',
    '051_custom_presets_and_policy_constraints.sql',
    '052_rating_normalization.sql',
    '053_add_arr_quality_profiles.sql',
    '054_add_embedding_provider_config.sql',
    '055_add_heartbeat_config.sql',
    '056_add_backfill_config.sql',
    '057_add_rag_monitoring.sql',
    '058_add_profile_snapshot.sql',
    '059_add_retry_config_enhancements.sql',
    '060_add_profile_weight.sql',
    '061_fix_embedding_dimensions.sql',
    '062_post_upgrade_tasks.sql',
    '063_fix_discord_enabled_flag.sql',
    '064_backfill_library_associations.sql',
    '065_add_retry_support.sql',
    '066_arr_library_mapping_preservation.sql',
    '067_add_api_keys.sql',
    '068_add_classification_phase_tracking.sql',
    '069_discord_arr_fixes.sql',
    '070_add_webhook_exclude_specials.sql',
    '071_expand_classification_status_for_verification.sql',
    '072_remove_event_detection.sql',
    '073_add_auto_learning_tables.sql',
    '074_expand_confidence_settings.sql',
    '075_add_backup_tables.sql',
    '076_remove_duplicate_discord_thresholds.sql',
    '20260201_000000_convert_to_timestamp_migrations.sql',
    '20260201_010000_add_discord_display_options.sql',
    '20260201_015000_add_media_server_unique_constraint.sql',
    '20260201_020000_cleanup_duplicate_plex_servers.sql',
    '20260201_200000_add_client_identifier.sql',
    '20260204_113801_add_image_embedding_config.sql',
    '20260204_130648_add_image_embedding_columns.sql',
    '20260204_130700_add_image_embedding_settings.sql',
    '20260204_133020_add_rag_image_weights.sql',
    '20260205_112500_add_image_embedding_models_cache.sql',
    '20260206_130000_align_learning_patterns_schema.sql',
    '20260211_090000_add_rag_loop_core_config.sql',
    '20260211_090100_add_rag_loop_governance_config.sql',
    '20260211_090200_add_rag_loop_error_observability.sql',
    '20260211_090300_add_rag_loop_trace_query_indexes.sql',
    '20260211_090400_enable_rag_loop_apply_defaults.sql',
    '20260211_090500_add_rag_loop_auto_fallback_config.sql',
    '20260217_083749_add_routed_status.sql',
    '20260217_192610_fix_classification_method_constraint.sql',
    '20260217_224200_add_missing_classification_methods.sql',
    '20260217_233000_add_policy_recheck_method.sql',
    '20260218_082300_add_ai_rerun_method.sql',
    '20260218_150000_backfill_missing_rag_text_hnsw_index.sql',
    '20260218_223500_defer_tavily_exhausted_retries.sql',
    '20260218_231500_restore_tavily_quota_rows_to_pending.sql',
    '20260219_010500_add_policy_recheck_skip_when_ai_confident.sql',
    '20260224_130000_add_api_key_audit.sql',
    '20260224_140000_add_refresh_tokens.sql',
    '20260226_002000_seed_runtime_security_defaults.sql',
    '20260303_123026_extend_search_text_tsvector.sql',
    '20260303_130000_add_policy_recheck_confidence_gain_multiplier.sql',
    '20260305_100000_optimize_task_queue_indexes.sql',
    '20260305_100100_add_updated_at_triggers.sql',
    '20260305_110000_add_security_cleanup_indexes.sql',
    '20260305_120000_add_classification_history_check_constraints.sql',
    '20260305_130000_validate_classification_history_constraints.sql',
    '20260305_150000_add_task_queue_item_dedup_index.sql',
    '20260305_200000_enable_pg_stat_statements.sql',
    '20260305_200100_enable_pg_trgm.sql',
    '20260305_200200_enable_pg_prewarm.sql',
    '20260305_200300_fillfactor_hot_update_tables.sql',
    '20260305_200400_autovacuum_tuning.sql',
    '20260305_200500_bigint_primary_keys.sql',
    '20260305_200600_brin_log_indexes.sql',
    '20260305_200700_bigint_classification_history_pk.sql',
    '20260305_200800_bigint_error_log_classification_id.sql',
    '20260306_000000_add_task_queue_visible_at.sql',
    '20260307_000000_add_rag_log_cleanup_and_indexes.sql',
    '20260309_120000_add_rag_graph_relationship_columns.sql',
    '20260309_120100_add_rag_graph_config_columns.sql',
    '20260309_140000_task_queue_retention.sql',
    '20260310_100000_add_remember_me_to_refresh_tokens.sql',
    '20260310_110000_add_login_lockout_to_users.sql',
    '20260313_120000_task_queue_insert_autovacuum.sql',
    '20260313_233000_auto_drop_legacy_incompatible_policy_presets.sql',
    '20260314_213000_add_task_queue_task_type_status_index.sql',
    '20260321_134500_migrate_custom_presets_into_content_presets.sql',
    '20260327_235000_add_embedding_provider_availability.sql',
    '20260328_020500_drop_embedding_retry_queue.sql',
    '20260404_120000_add_classification_evidence.sql',
    '20260410_100000_add_embedding_service_auth.sql',
    '20260410_110000_add_discord_system_errors_flag.sql',
    '20260418_120000_add_library_policy_threshold_check.sql',
    '20260422_120000_add_task_queue_processing_classification_index.sql',
    '20260425_120000_widen_ai_model_identifiers.sql',
    '20260425_121000_fix_image_embedding_defaults.sql',
    '20260514_121500_normalize_task_queue_retention_setting.sql',
    '20260514_153000_add_classification_history_totals.sql',
    '20260514_161500_add_task_queue_status_retention_settings.sql',
    '20260514_173000_add_task_queue_cleanup_history.sql',
    '20260516_183500_reconcile_pg_stat_statements_state.sql',
    '20260517_123000_explicit_enrichment_item_state.sql',
    '20260517_235500_reconcile_clarification_seed_data.sql',
    '20260518_011500_reconcile_bootstrap_sensitive_seed_data.sql',
    '20260518_013000_reconcile_low_priority_seed_data.sql',
    '20260524_203000_add_policy_overlap_metric_snapshots.sql',
    '20260613_110000_add_enrichment_status_not_needed.sql',
    '20260614_103000_add_web_search_provider_storage.sql',
    '20260614_110500_reconcile_web_search_provider_seed_data.sql',
    '20260614_170000_fix_mismatched_tmdb_ids.sql',
    '20260617_120000_add_strict_animated_only_preset.sql',
    '20260617_180000_repair_missing_text_hnsw_index.sql',
    '20260618_120000_add_web_search_provider_cache.sql',
    '20260624_210000_add_web_search_enrichment_state.sql',
    '20260624_220000_add_web_search_provider_retention.sql',
    '20260625_011500_reconcile_web_search_provider_retention_seed_data.sql',
    '20260625_020000_add_web_search_provider_route_decisions.sql',
    '20260625_030000_add_web_search_provider_route_decision_retention.sql',
    '20260625_040000_add_web_search_provider_health_events.sql',
    '20260625_041500_add_web_search_provider_health_retention.sql',
    '20260625_050000_add_web_search_provider_calibration_policies.sql',
    '20260625_051500_reconcile_web_search_provider_calibration_policy_seed_data.sql',
    '20260625_060000_reconcile_web_search_provider_guardrail_threshold_seed_data.sql',
    '20260625_061500_add_web_search_provider_guardrail_events.sql',
    '20260625_063000_add_discord_pending_item_notifications.sql',
    '20260625_064500_add_discord_pending_mention_targets.sql',
    '20260701_160000_add_policy_intent_native_storage.sql',
    '20260711_090000_rename_classification_progress_stages.sql',
    '20260711_090100_correct_classification_progress_stage_comments.sql',
    '20260712_120000_add_policy_library_rebuild_execution_gates.sql',
    '20260712_130000_add_policy_library_rebuild_replacement_references.sql',
    '20260713_150000_enforce_single_active_policy_intent.sql',
    '20260714_090000_add_policy_rollback_snapshot_retention_event.sql',
    '20260715_120000_add_native_intent_reconciliation_actor.sql',
    '20260715_130000_add_native_intent_reconciliation_ledger.sql',
    '20260715_131000_harden_native_intent_reconciliation_ledger_constraints.sql',
    '20260715_140000_add_native_intent_reconciliation_state.sql',
    '20260715_150000_add_native_intent_reconciliation_lifecycle_guards.sql',
    '20260715_160000_add_native_intent_reconciliation_control.sql',
    '20260716_020000_add_native_intent_reconciliation_alert_states.sql',
    '20260716_030000_add_native_intent_reconciliation_runtime_provenance.sql',
    '20260716_040000_enforce_semantic_native_intent_authority.sql',
    '20260716_050000_add_policy_initial_intent_establishments.sql',
    '20260722_120000_add_policy_observed_evidence_provenance.sql',
    '20260725_190000_add_policy_backup_restore_verifications.sql',
    '20260726_090000_add_policy_authorized_outcome_source_event_receipts.sql',
    '20260726_110000_add_policy_identity_evidence_admissions.sql',
    '20260726_120000_add_policy_profile_refresh_outbox.sql',
    '20260726_130000_add_policy_profile_refresh_outbox_worker_state.sql',
    '20260726_140000_generalize_policy_profile_refresh_outbox.sql',
    '20260728_120000_add_policy_native_profile_refresh_circuits.sql',
    '20260729_140000_add_policy_migration_verification_runs.sql',
    '20260729_150000_bind_policy_library_rebuild_verification_runs.sql',
    '20260803_120000_add_policy_authoring_proposals.sql',
    '20260803_130000_add_ai_provider_capability_metrics.sql',
    '20260804_120000_add_policy_runtime_pending_question_cleanup_audits.sql',
    '20260808_140000_upgrade_pgvector_to_0_8_6.sql',
    '20260808_150000_privacy_bound_recovery_diagnostics.sql',
    '20260808_160000_single_active_pending_classification.sql',
    '20260808_170000_policy_confirmation_pending_reason.sql',
    '20260809_010000_add_canonical_history_outcome_index.sql',
    '20260809_020000_add_task_queue_cleanup_origin.sql',
    '20260810_120000_add_active_pending_refresh_inventory_index.sql',
    '20260810_140000_add_historic_route_safety_refresh_receipts.sql',
    '20260812_100000_add_candidate_bound_verification_metrics_index.sql',
    '20260812_110000_add_historic_route_safety_refresh_recent_receipt_index.sql',
    '20260813_100000_add_verification_capability_change_receipts.sql',
    '20260813_110000_enforce_ai_provider_configuration_revision_integrity.sql',
    '20260813_120000_add_ai_settings_write_precondition.sql',
    '20260816_173000_add_native_intent_change_applied_event.sql',
    '20260816_180000_add_native_intent_change_receipts.sql',
    '20260817_030000_add_native_intent_change_receipt_retention_guard.sql',
    '20260822_140000_add_classification_queue_decision_witnesses.sql',
    '20260828_100000_add_ollama_verification_capability_state.sql',
    '20260829_100000_add_ollama_verification_runtime_mismatch_metrics.sql',
    '20260829_110000_add_ollama_verification_capability_outcome_history.sql',
    '20260830_100000_add_current_library_candidate_retrieval_metrics_index.sql',
    '20260830_110000_add_policy_candidate_correction_analytics_metrics_index.sql',
    '20260830_120000_add_policy_candidate_correction_review_corpus_control_plane.sql',
    '20260830_130000_add_policy_candidate_correction_review_projection.sql',
    '20260831_090000_add_route_safety_readiness_metrics_index.sql',
    '20260831_120000_add_policy_change_outcome_observation.sql',
    '20260831_140000_add_policy_change_decision_record.sql',
    '20260831_170000_add_policy_change_review_history_summary.sql',
    '20260831_170100_rename_policy_change_review_history_tables.sql',
    '20260831_235000_add_policy_candidate_adjudication_method.sql',
    '20260901_090000_add_policy_candidate_correction_review_corpus_capture.sql',
    '20260901_100000_add_policy_candidate_correction_review_corpus_capture_evaluation_index.sql',
    '20260905_100000_add_media_identity_review_previews.sql',
    '20260905_120000_add_media_identity_receipt_lookup_index.sql',
    '20260905_140000_add_library_profile_observation_summary.sql',
    '20260905_150000_add_inventory_profile_refresh.sql',
    '20260905_160000_add_inventory_tmdb_observations.sql',
    '20260905_170000_add_observation_acquisition_history.sql',
    '20260905_180000_preserve_observation_language_presence.sql',
    '20260905_190000_add_library_coverage_trends.sql',
    '20260905_200000_add_fair_library_sampling.sql',
    '20260905_210000_seed_library_sampling_state.sql',
    '20260906_090000_add_incremental_library_coverage.sql',
    '20260906_230000_add_suggestion_cohort_provenance.sql',
    '20260907_010000_add_feedback_evaluation_views.sql',
    '20260907_020000_add_feedback_source_receipts.sql'
]) AS filename
ON CONFLICT (filename) DO NOTHING;

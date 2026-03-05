-- Classifarr Database Schema Snapshot
-- Generated: 2026-03-03T16:51:02.201Z
-- Latest Migration: 20260303_130000_add_policy_recheck_confidence_gain_multiplier.sql
-- 
-- ⚠️  FOR FRESH INSTALLS ONLY
-- ⚠️  Existing installations should use migrations/
-- 
-- This file represents the complete database state after all migrations.

--
-- PostgreSQL database dump
--


-- Dumped from database version 15.15 (Debian 15.15-1.pgdg12+1)
-- Dumped by pg_dump version 15.15 (Debian 15.15-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


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

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
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
-- Name: ai_provider_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_provider_config (
    id integer NOT NULL,
    primary_provider character varying(50) DEFAULT 'none'::character varying,
    api_endpoint character varying(500),
    api_key character varying(500),
    model character varying(100),
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
    ollama_model character varying(100) DEFAULT 'llama3.2'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    embedding_provider character varying(50) DEFAULT 'auto'::character varying,
    embedding_model character varying(100),
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
    embedding_ollama_model character varying(100),
    embedding_cloud_provider character varying(50),
    embedding_cloud_api_key character varying(500),
    embedding_cloud_model character varying(100),
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
    image_embedding_provider_mode character varying(30) DEFAULT 'same'::character varying,
    image_embedding_local_host character varying(255),
    image_embedding_local_port integer DEFAULT 11434,
    image_embedding_local_model character varying(100),
    image_embedding_cloud_provider character varying(50),
    image_embedding_cloud_api_key text,
    image_embedding_cloud_model character varying(100),
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
    CONSTRAINT ai_cfg_rag_loop_mode_chk CHECK (((rag_loop_rollout_mode)::text = ANY ((ARRAY['shadow'::character varying, 'apply'::character varying])::text[]))),
    CONSTRAINT ai_cfg_rag_low_conf_chk CHECK (((rag_loop_low_confidence_threshold >= 0) AND (rag_loop_low_confidence_threshold <= 100))),
    CONSTRAINT ai_cfg_rag_max_pass_chk CHECK (((rag_loop_max_passes >= 1) AND (rag_loop_max_passes <= 2))),
    CONSTRAINT ai_cfg_rag_retry_low_signal_floor_chk CHECK (((rag_retry_low_signal_similarity_floor >= 0.00) AND (rag_retry_low_signal_similarity_floor <= 1.00))),
    CONSTRAINT ai_cfg_rag_retry_strategy_chk CHECK (((rag_retry_strategy)::text = ANY ((ARRAY['auto'::character varying, 'hybrid'::character varying, 'semantic'::character varying])::text[]))),
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
    CONSTRAINT ai_provider_config_retry_backoff_multiplier_check CHECK (((retry_backoff_multiplier >= 1.0) AND (retry_backoff_multiplier <= 5.0))),
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
    id integer NOT NULL,
    provider character varying(50),
    model character varying(100),
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    cost_usd numeric(10,6),
    request_type character varying(50),
    item_title character varying(500),
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: ai_usage_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_usage_log_id_seq
    AS integer
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
    id integer NOT NULL,
    level character varying(10) NOT NULL,
    module character varying(100) NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: app_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_log_id_seq
    AS integer
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
    CONSTRAINT app_notifications_type_check CHECK (((type)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying, 'success'::character varying])::text[])))
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
    CONSTRAINT arr_profiles_cache_arr_type_check CHECK (((arr_type)::text = ANY ((ARRAY['radarr'::character varying, 'sonarr'::character varying])::text[]))),
    CONSTRAINT arr_profiles_cache_profile_type_check CHECK (((profile_type)::text = ANY ((ARRAY['root_folder'::character varying, 'quality_profile'::character varying, 'tag'::character varying])::text[])))
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
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    ip_address character varying(50),
    user_agent text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
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
    classification_id integer,
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
    classification_id integer,
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
    classification_id integer NOT NULL,
    embedding public.vector(768) NOT NULL,
    embedding_dims integer NOT NULL,
    provider character varying(50) NOT NULL,
    model character varying(100) NOT NULL,
    is_stale boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    image_embedding public.vector(2000),
    image_embedding_dims integer,
    image_provider character varying(50),
    image_model character varying(100),
    image_embedding_hash character varying(64),
    image_embedding_size integer,
    image_embedding_source_url text
);


--
-- Name: COLUMN classification_embeddings.embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.classification_embeddings.embedding IS 'Vector embedding (dimensions match configured model: nomic-embed-text=768, mxbai-embed-large=1024, text-embedding-3-small=1536, etc.)';


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
-- Name: classification_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_history (
    id integer NOT NULL,
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
    CONSTRAINT classification_history_media_type_check CHECK (((media_type)::text = ANY ((ARRAY['movie'::character varying, 'tv'::character varying])::text[]))),
    CONSTRAINT classification_history_method_check CHECK (((method)::text = ANY ((ARRAY['existing_media'::character varying, 'manual_correction'::character varying, 'manual_classification'::character varying, 'exact_match'::character varying, 'learned_pattern'::character varying, 'source_library'::character varying, 'policy_auto'::character varying, 'policy_prompt'::character varying, 'policy_recheck'::character varying, 'ai_verified'::character varying, 'ai_analysis'::character varying, 'ai_rerun'::character varying, 'signal_calculation'::character varying, 'fallback'::character varying, 'queued_for_retry'::character varying, 'custom_rule'::character varying, 'rule_match'::character varying, 'ai_fallback'::character varying, 'holiday_detection'::character varying, 'library_rule'::character varying, 'rag_improved'::character varying, 'authoritative_source_library'::character varying, 'policy_engine'::character varying])::text[]))),
    CONSTRAINT classification_history_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'failed'::character varying, 'corrected'::character varying, 'awaiting_decision'::character varying, 'pending'::character varying, 'pending_retry'::character varying, 'verified'::character varying, 'reclassified'::character varying, 'routed'::character varying])::text[])))
);


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
-- Name: classification_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classification_history_id_seq
    AS integer
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
    classification_id integer,
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
    classification_id integer,
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
-- Name: embedding_retry_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embedding_retry_queue (
    id integer NOT NULL,
    classification_id integer NOT NULL,
    attempt_count integer DEFAULT 0,
    max_attempts integer DEFAULT 5,
    last_error text,
    next_retry_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: embedding_retry_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.embedding_retry_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: embedding_retry_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.embedding_retry_queue_id_seq OWNED BY public.embedding_retry_queue.id;


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
    id integer NOT NULL,
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
    classification_id integer,
    error_stage character varying(50),
    reason_code character varying(80),
    correlation_id uuid,
    sql_state character varying(10),
    CONSTRAINT error_log_error_stage_check CHECK (((error_stage IS NULL) OR ((error_stage)::text = ANY ((ARRAY['gate'::character varying, 'enrichment'::character varying, 'retrieval_pass2'::character varying, 'policy_recheck'::character varying, 'ai_rerun'::character varying, 'trace'::character varying])::text[])))),
    CONSTRAINT error_log_level_check CHECK (((level)::text = ANY ((ARRAY['ERROR'::character varying, 'WARN'::character varying, 'INFO'::character varying, 'DEBUG'::character varying])::text[]))),
    CONSTRAINT error_log_sql_state_format_check CHECK (((sql_state IS NULL) OR ((sql_state)::text ~ '^[A-Z0-9]{1,10}$'::text)))
);


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
    AS integer
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
    CONSTRAINT label_presets_category_check CHECK (((category)::text = ANY ((ARRAY['rating'::character varying, 'content_type'::character varying, 'genre'::character varying, 'language'::character varying])::text[]))),
    CONSTRAINT label_presets_media_type_check CHECK (((media_type)::text = ANY ((ARRAY['movie'::character varying, 'tv'::character varying, 'both'::character varying])::text[])))
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
    CONSTRAINT learned_corrections_media_type_check CHECK (((media_type)::text = ANY ((ARRAY['movie'::character varying, 'tv'::character varying])::text[])))
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
    CONSTRAINT libraries_arr_type_check CHECK (((arr_type)::text = ANY ((ARRAY['radarr'::character varying, 'sonarr'::character varying])::text[]))),
    CONSTRAINT libraries_media_type_check CHECK (((media_type)::text = ANY ((ARRAY['movie'::character varying, 'tv'::character varying])::text[])))
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
    CONSTRAINT library_arr_mappings_arr_type_check CHECK (((arr_type)::text = ANY ((ARRAY['radarr'::character varying, 'sonarr'::character varying])::text[])))
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
    CONSTRAINT library_labels_rule_type_check CHECK (((rule_type)::text = ANY ((ARRAY['include'::character varying, 'exclude'::character varying])::text[])))
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
    updated_at timestamp without time zone DEFAULT now()
);


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
    classification_id integer,
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
    CONSTRAINT media_server_type_check CHECK (((type)::text = ANY ((ARRAY['plex'::character varying, 'emby'::character varying, 'jellyfin'::character varying])::text[])))
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
    original_rating character varying(10)
);


--
-- Name: COLUMN media_server_items.original_rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_server_items.original_rating IS 'Original rating from Plex/Emby before normalization to MPAA standards';


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
    CONSTRAINT media_server_sync_status_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
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
    updated_at timestamp without time zone DEFAULT now()
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
    model character varying(100) DEFAULT 'qwen3:14b'::character varying NOT NULL,
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
    classification_id integer NOT NULL,
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
    was_correction boolean DEFAULT false,
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
    before_accuracy real
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
 SELECT count(*) FILTER (WHERE (rag_metrics.created_at >= (now() - '24:00:00'::interval))) AS operations_24h,
    count(*) FILTER (WHERE (rag_metrics.created_at >= (now() - '01:00:00'::interval))) AS operations_1h,
    count(*) FILTER (WHERE ((rag_metrics.success = true) AND (rag_metrics.created_at >= (now() - '24:00:00'::interval)))) AS successful_24h,
    count(*) FILTER (WHERE ((rag_metrics.success = false) AND (rag_metrics.created_at >= (now() - '24:00:00'::interval)))) AS failed_24h,
    avg(rag_metrics.duration_ms) FILTER (WHERE (rag_metrics.created_at >= (now() - '24:00:00'::interval))) AS avg_duration_ms_24h,
    count(*) FILTER (WHERE (((rag_metrics.operation)::text = 'semantic_search'::text) AND (rag_metrics.created_at >= (now() - '24:00:00'::interval)))) AS semantic_searches_24h,
    count(*) FILTER (WHERE (((rag_metrics.operation)::text = 'hybrid_search'::text) AND (rag_metrics.created_at >= (now() - '24:00:00'::interval)))) AS hybrid_searches_24h,
    count(*) FILTER (WHERE (((rag_metrics.operation)::text = 'embedding_generation'::text) AND (rag_metrics.created_at >= (now() - '24:00:00'::interval)))) AS embeddings_generated_24h,
    count(*) FILTER (WHERE (((rag_metrics.operation)::text = 'pattern_mining'::text) AND (rag_metrics.created_at >= (now() - '24:00:00'::interval)))) AS pattern_mining_runs_24h
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
    device_info jsonb
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
-- Name: schema_migrations_new_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schema_migrations_new_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


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
    id integer NOT NULL,
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
    current_phase character varying(50) DEFAULT NULL::character varying,
    phase_index integer,
    phase_started_at timestamp without time zone,
    phase_history jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT task_queue_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: COLUMN task_queue.current_phase; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_queue.current_phase IS 'Current classification phase (queued, metadata_fetch, policy_eval, rag_analysis, signal_combine, decision, notification)';


--
-- Name: COLUMN task_queue.phase_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_queue.phase_index IS 'Current phase index (1-7)';


--
-- Name: COLUMN task_queue.phase_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_queue.phase_started_at IS 'When the current phase started';


--
-- Name: COLUMN task_queue.phase_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_queue.phase_history IS 'JSON array of completed phases with timestamps and durations';


--
-- Name: task_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_queue_id_seq
    AS integer
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
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying])::text[])))
);


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
    classification_id integer,
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
-- Name: embedding_retry_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_retry_queue ALTER COLUMN id SET DEFAULT nextval('public.embedding_retry_queue_id_seq'::regclass);


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
-- Name: policy_change_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_change_log ALTER COLUMN id SET DEFAULT nextval('public.policy_change_log_id_seq'::regclass);


--
-- Name: policy_feedback_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_feedback_log ALTER COLUMN id SET DEFAULT nextval('public.policy_feedback_log_id_seq'::regclass);


--
-- Name: policy_learning_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_learning_stats ALTER COLUMN id SET DEFAULT nextval('public.policy_learning_stats_id_seq'::regclass);


--
-- Name: policy_overrides id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_overrides ALTER COLUMN id SET DEFAULT nextval('public.policy_overrides_id_seq'::regclass);


--
-- Name: policy_presets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_presets ALTER COLUMN id SET DEFAULT nextval('public.policy_presets_id_seq'::regclass);


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
-- Name: webhook_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_config ALTER COLUMN id SET DEFAULT nextval('public.webhook_config_id_seq'::regclass);


--
-- Name: webhook_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_log ALTER COLUMN id SET DEFAULT nextval('public.webhook_log_id_seq'::regclass);


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
-- Name: classification_history classification_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_history
    ADD CONSTRAINT classification_history_pkey PRIMARY KEY (id);


--
-- Name: classification_history chk_classification_confidence_range; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.classification_history
    ADD CONSTRAINT chk_classification_confidence_range
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100))
    NOT VALID;


--
-- Name: classification_history chk_classification_completed_has_library; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.classification_history
    ADD CONSTRAINT chk_classification_completed_has_library
    CHECK (status IS DISTINCT FROM 'completed' OR library_id IS NOT NULL)
    NOT VALID;


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
-- Name: embedding_retry_queue embedding_retry_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_retry_queue
    ADD CONSTRAINT embedding_retry_queue_pkey PRIMARY KEY (id);


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
-- Name: idx_app_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_log_created_at ON public.app_log USING btree (created_at DESC);


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
-- Name: idx_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created_at ON public.audit_log USING btree (created_at);


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
-- Name: idx_classification_history_tmdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classification_history_tmdb ON public.classification_history USING btree (tmdb_id);


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
-- Name: idx_embedding_retry_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_embedding_retry_pending ON public.embedding_retry_queue USING btree (next_retry_at, status) WHERE ((status)::text = 'pending'::text);


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
-- Name: idx_error_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_created_at ON public.error_log USING btree (created_at DESC);


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
-- Name: idx_error_log_unresolved_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_unresolved_stage ON public.error_log USING btree (error_stage, created_at DESC) WHERE ((resolved = false) AND (error_stage IS NOT NULL));


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
-- Name: idx_policy_learning_stats_accuracy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_learning_stats_accuracy ON public.policy_learning_stats USING btree (accuracy_rate);


--
-- Name: idx_policy_learning_stats_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_learning_stats_policy ON public.policy_learning_stats USING btree (policy_id);


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
-- Name: idx_post_upgrade_tasks_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_upgrade_tasks_task_id ON public.post_upgrade_tasks USING btree (task_id);


--
-- Name: idx_post_upgrade_tasks_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_upgrade_tasks_version ON public.post_upgrade_tasks USING btree (version);


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
-- Name: idx_task_queue_active_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_active_phase ON public.task_queue USING btree (current_phase) WHERE (((status)::text = 'processing'::text) AND (current_phase IS NOT NULL));


--
-- Name: idx_task_queue_next_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_next_retry ON public.task_queue USING btree (next_retry_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_task_queue_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_priority ON public.task_queue USING btree (priority DESC, created_at) WHERE ((status)::text = 'pending'::text);


CREATE INDEX idx_task_queue_processing_stale ON public.task_queue USING btree (started_at) WHERE ((status)::text = 'processing'::text);


--
-- Name: idx_task_queue_dequeue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_dequeue ON public.task_queue USING btree (priority DESC, created_at, next_retry_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_task_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_queue_status ON public.task_queue USING btree (status);


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
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


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
-- Name: classification_history classification_search_text_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classification_search_text_trigger BEFORE INSERT OR UPDATE ON public.classification_history FOR EACH ROW EXECUTE FUNCTION public.update_classification_search_text();


--
-- Name: library_rules_v2 trigger_library_rules_v2_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_library_rules_v2_updated_at BEFORE UPDATE ON public.library_rules_v2 FOR EACH ROW EXECUTE FUNCTION public.update_library_rules_v2_updated_at();


--
-- Name: radarr_config trg_radarr_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radarr_config_updated_at BEFORE UPDATE ON public.radarr_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sonarr_config trg_sonarr_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sonarr_config_updated_at BEFORE UPDATE ON public.sonarr_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ollama_config trg_ollama_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ollama_config_updated_at BEFORE UPDATE ON public.ollama_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tmdb_config trg_tmdb_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tmdb_config_updated_at BEFORE UPDATE ON public.tmdb_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_config trg_notification_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notification_config_updated_at BEFORE UPDATE ON public.notification_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: libraries trg_libraries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_libraries_updated_at BEFORE UPDATE ON public.libraries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: library_custom_rules trg_library_custom_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_library_custom_rules_updated_at BEFORE UPDATE ON public.library_custom_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: settings trg_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


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
-- Name: classification_history classification_history_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_history
    ADD CONSTRAINT classification_history_library_id_fkey FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE SET NULL;


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
-- Name: embedding_retry_queue embedding_retry_queue_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_retry_queue
    ADD CONSTRAINT embedding_retry_queue_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.classification_history(id) ON DELETE CASCADE;


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
-- Name: policy_learning_stats policy_learning_stats_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_learning_stats
    ADD CONSTRAINT policy_learning_stats_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.library_policies(id) ON DELETE CASCADE;


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
-- Name: policy_tuning_suggestions policy_tuning_suggestions_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_tuning_suggestions
    ADD CONSTRAINT policy_tuning_suggestions_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.users(id);


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




-- ============================================================
-- Seed Data (from data-only migrations, auto-appended by scripts/dump-schema.js)
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

-- Migration tracking table
-- (excluded via --exclude-table=schema_migrations but required for tracking)
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);

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
    '20260305_130000_validate_classification_history_constraints.sql'
]) AS filename
ON CONFLICT (filename) DO NOTHING;

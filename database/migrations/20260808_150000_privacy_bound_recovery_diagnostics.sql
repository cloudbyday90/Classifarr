/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Retry, recovery, and RAG diagnostic records are operator-visible. Historical
 * records could contain raw upstream messages, stack traces, source metadata,
 * or configuration-derived details. Keep only bounded, actionable identifiers.
 */

-- Queue rows survive restarts and are visible to operators. Replace historical
-- exception text with the same fixed vocabulary used by the runtime worker.
UPDATE task_queue
SET error_message = CASE
    WHEN error_message = 'Recovered: visibility timeout expired'
        THEN 'task_visibility_timeout_recovered'
    WHEN error_message = 'Reset on startup - previous worker crashed'
        THEN 'task_startup_stale_recovered'
    WHEN error_message = 'Reset by graceful shutdown'
        THEN 'task_graceful_shutdown_recovered'
    WHEN error_message = 'task_unknown_type'
        THEN 'task_unknown_type'
    WHEN error_message = 'task_visibility_timeout_recovered'
        THEN 'task_visibility_timeout_recovered'
    WHEN error_message = 'task_startup_stale_recovered'
        THEN 'task_startup_stale_recovered'
    WHEN error_message = 'task_graceful_shutdown_recovered'
        THEN 'task_graceful_shutdown_recovered'
    ELSE 'task_processing_failed'
END
WHERE error_message IS NOT NULL;

-- RAG stage events are structured operational records. Redact historical raw
-- error text, stacks, traces, source metadata, and rollout payloads while
-- preserving the bounded dimensions used for aggregation and remediation.
WITH stage_projection AS (
    SELECT
        id,
        CASE
            WHEN error_stage IN ('gate', 'enrichment', 'retrieval_pass2', 'policy_recheck', 'ai_rerun', 'trace')
                THEN error_stage
            ELSE NULL
        END AS stage,
        CASE
            WHEN metadata->>'outcome' ~ '^[a-z0-9_]{1,80}$'
                THEN metadata->>'outcome'
            ELSE 'event'
        END AS outcome,
        CASE
            WHEN reason_code ~ '^[a-z0-9_]{1,80}$'
                THEN reason_code
            ELSE 'rag_stage_failure'
        END AS bounded_reason_code,
        CASE
            WHEN metadata->>'fallback_action' ~ '^[a-z0-9_]{1,80}$'
                THEN metadata->>'fallback_action'
            ELSE NULL
        END AS fallback_action,
        CASE
            WHEN metadata->>'rollout_mode' ~ '^[a-z0-9_]{1,80}$'
                THEN metadata->>'rollout_mode'
            ELSE NULL
        END AS rollout_mode,
        CASE
            WHEN metadata->>'strategy' ~ '^[a-z0-9_]{1,80}$'
                THEN metadata->>'strategy'
            ELSE NULL
        END AS strategy,
        CASE
            WHEN metadata->>'trigger' ~ '^[a-z0-9_]{1,80}$'
                THEN metadata->>'trigger'
            ELSE NULL
        END AS trigger,
        CASE
            WHEN (metadata->>'recoverable') IN ('true', 'false')
                THEN (metadata->>'recoverable')::boolean
            ELSE NULL
        END AS recoverable
    FROM error_log
    WHERE module = 'RAG'
      AND metadata->>'event_type' = 'rag_second_pass_stage'
)
UPDATE error_log AS log
SET message = format(
        'Second-pass stage %s %s (%s)',
        COALESCE(projection.stage, 'unknown'),
        projection.outcome,
        projection.bounded_reason_code
    ),
    stack_trace = NULL,
    metadata = jsonb_strip_nulls(jsonb_build_object(
        'event_type', 'rag_second_pass_stage',
        'stage', projection.stage,
        'outcome', projection.outcome,
        'reason_code', projection.bounded_reason_code,
        'fallback_action', projection.fallback_action,
        'rollout_mode', projection.rollout_mode,
        'strategy', projection.strategy,
        'trigger', projection.trigger,
        'recoverable', projection.recoverable
    )),
    rag_context = jsonb_strip_nulls(jsonb_build_object(
        'stage', projection.stage,
        'outcome', projection.outcome,
        'reason_code', projection.bounded_reason_code,
        'fallback_action', projection.fallback_action,
        'strategy', projection.strategy,
        'trigger', projection.trigger
    )),
    classification_id = NULL,
    correlation_id = NULL,
    reason_code = projection.bounded_reason_code
FROM stage_projection AS projection
WHERE log.id = projection.id;

-- Generic historical RAG failures used the raw Error message and context.
-- Preserve only the fixed operation and error-category identifiers.
WITH failure_projection AS (
    SELECT
        id,
        CASE
            WHEN rag_operation ~ '^[a-z0-9_]{1,80}$'
                THEN rag_operation
            ELSE 'unknown'
        END AS operation,
        CASE
            WHEN metadata->>'errorType' ~ '^[a-z0-9_]{1,80}$'
                THEN metadata->>'errorType'
            ELSE 'unknown'
        END AS error_type
    FROM error_log
    WHERE module = 'RAG'
      AND metadata ? 'errorType'
      AND COALESCE(metadata->>'event_type', '') <> 'rag_second_pass_stage'
)
UPDATE error_log AS log
SET message = format('RAG operation %s failed (%s)', projection.operation, projection.error_type),
    stack_trace = NULL,
    metadata = jsonb_build_object(
        'event_type', 'rag_operation_failure',
        'error_type', projection.error_type
    ),
    rag_context = jsonb_build_object(
        'operation', projection.operation,
        'error_type', projection.error_type
    ),
    classification_id = NULL,
    correlation_id = NULL,
    reason_code = 'rag_operation_failed'
FROM failure_projection AS projection
WHERE log.id = projection.id;

-- Second-pass metric rows must aggregate only. Remove per-item identifiers,
-- traces, and any retained source/configuration metadata from historical rows.
UPDATE rag_metrics
SET metadata = jsonb_strip_nulls(jsonb_build_object(
    'stage', CASE WHEN metadata->>'stage' ~ '^[a-z0-9_]{1,80}$' THEN metadata->>'stage' END,
    'outcome', CASE WHEN metadata->>'outcome' ~ '^[a-z0-9_]{1,80}$' THEN metadata->>'outcome' END,
    'reason_code', CASE WHEN metadata->>'reason_code' ~ '^[a-z0-9_]{1,80}$' THEN metadata->>'reason_code' END,
    'sql_state', CASE WHEN metadata->>'sql_state' ~ '^[A-Z0-9]{5}$' THEN metadata->>'sql_state' END,
    'recoverable', CASE WHEN (metadata->>'recoverable') IN ('true', 'false') THEN (metadata->>'recoverable')::boolean END,
    'duration_ms', CASE WHEN metadata->>'duration_ms' ~ '^[0-9]{1,12}$' THEN (metadata->>'duration_ms')::bigint END
))
WHERE operation IN ('second_pass_retrieval_pass2', 'second_pass_gate_pass1');

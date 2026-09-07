-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Preserve observations; unknown evidence is not a correctness label.
ALTER TABLE policy_feedback_log ALTER COLUMN was_correction SET DEFAULT NULL;

CREATE OR REPLACE VIEW policy_feedback_evaluation WITH (security_invoker = true) AS
SELECT feedback.*,
    CASE WHEN feedback.selected_library_id > 0 AND feedback.top_suggestion_library_id > 0
        AND destination.is_active IS TRUE AND candidate.is_active IS TRUE
        AND policy.library_id = feedback.selected_library_id
        AND destination.media_type = candidate.media_type
        AND (feedback.media_type IS NULL OR feedback.media_type = destination.media_type)
        AND isfinite(feedback.prompted_at) AND feedback.prompted_at <= CURRENT_TIMESTAMP
        AND feedback.was_correction = (feedback.selected_library_id <> feedback.top_suggestion_library_id)
        THEN NOT feedback.was_correction
        ELSE NULL
    END AS evaluation_correct
FROM policy_feedback_log feedback
LEFT JOIN libraries destination ON destination.id = feedback.selected_library_id
LEFT JOIN libraries candidate ON candidate.id = feedback.top_suggestion_library_id
LEFT JOIN library_policies policy ON policy.id = feedback.selected_policy_id;

COMMENT ON VIEW policy_feedback_evaluation IS
    'Observed policy feedback with nullable correctness; null means incomplete, inconsistent or currently ineligible evidence.';

CREATE OR REPLACE VIEW policy_feedback_learning_stats WITH (security_invoker = true) AS
WITH aggregates AS (
    SELECT policy.id AS policy_id,
        count(feedback.id)::integer AS total_decisions,
        count(feedback.evaluation_correct)::integer AS evaluated_decisions,
        count(feedback.id) FILTER (WHERE feedback.evaluation_correct IS NULL)::integer AS unevaluated_decisions,
        count(feedback.id) FILTER (WHERE feedback.prompt_type = 'auto_classify')::integer AS auto_classified,
        count(feedback.evaluation_correct) FILTER (WHERE feedback.prompt_type = 'auto_classify')::integer AS evaluated_auto_classified,
        count(feedback.id) FILTER (WHERE feedback.prompt_type = 'ai_validate')::integer AS ai_validated,
        count(feedback.id) FILTER (WHERE feedback.prompt_type IN ('prompt_confirm','prompt_select'))::integer AS user_prompted,
        count(feedback.id) FILTER (WHERE feedback.evaluation_correct IS FALSE)::integer AS user_corrections,
        avg(feedback.evaluation_correct::integer)::real AS accuracy_rate,
        avg(feedback.evaluation_correct::integer) FILTER (WHERE feedback.prompt_type = 'auto_classify')::real AS auto_accuracy_rate,
        avg(feedback.evaluation_correct::integer) FILTER (WHERE feedback.prompted_at >= CURRENT_TIMESTAMP - INTERVAL '7 days')::real AS last_7_days_accuracy,
        avg(feedback.evaluation_correct::integer) FILTER (WHERE feedback.prompted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days')::real AS last_30_days_accuracy,
        max(feedback.prompted_at) FILTER (WHERE isfinite(feedback.prompted_at) AND feedback.prompted_at <= CURRENT_TIMESTAMP) AS last_decision_at,
        max(feedback.prompted_at) FILTER (WHERE feedback.evaluation_correct IS FALSE) AS last_correction_at
    FROM library_policies policy
    LEFT JOIN policy_feedback_evaluation feedback ON feedback.selected_policy_id = policy.id
    GROUP BY policy.id
)
SELECT aggregates.*,
    evaluated_decisions::real / NULLIF(total_decisions, 0) AS evaluation_coverage,
    CASE WHEN last_7_days_accuracy IS NULL OR last_30_days_accuracy IS NULL THEN 'unknown'
        WHEN last_7_days_accuracy > last_30_days_accuracy + 0.05 THEN 'improving'
        WHEN last_7_days_accuracy < last_30_days_accuracy - 0.05 THEN 'declining'
        ELSE 'stable'
    END::varchar(20) AS trend,
    CURRENT_TIMESTAMP AS updated_at
FROM aggregates;

COMMENT ON VIEW policy_feedback_learning_stats IS
    'Live policy observation totals, evaluated coverage and accuracy; unavailable accuracy is null. updated_at is calculation time.';

-- Repair compatibility caches without changing original feedback or frozen cohorts.
UPDATE policy_learning_stats cache SET
    total_decisions = current.total_decisions,
    auto_classified = current.auto_classified,
    ai_validated = current.ai_validated,
    user_prompted = current.user_prompted,
    user_corrections = current.user_corrections,
    accuracy_rate = current.accuracy_rate,
    auto_accuracy_rate = current.auto_accuracy_rate,
    last_7_days_accuracy = current.last_7_days_accuracy,
    last_30_days_accuracy = current.last_30_days_accuracy,
    trend = current.trend,
    last_decision_at = current.last_decision_at,
    last_correction_at = current.last_correction_at,
    updated_at = CURRENT_TIMESTAMP
FROM policy_feedback_learning_stats current
WHERE cache.policy_id = current.policy_id;

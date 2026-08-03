import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { safeParseJson, SEED_INTEGRITY_CACHE_TTL_MS } from './clarificationUtils.mjs';
import { getRuntimeQuestionNormalizationStatus } from './policyRuntimeQuestionNormalizer.mjs';

const logger = createLogger('ClarificationQueries');

export function createSeedIntegrityState(cacheTtlMs) {
    return {
        snapshot: null,
        warnings: new Set(),
        cacheTtlMs: Number.isFinite(Number(cacheTtlMs)) ? Number(cacheTtlMs) : SEED_INTEGRITY_CACHE_TTL_MS,
    };
}

export function invalidateSeedIntegrityCache(state) {
    state.snapshot = null;
}

export async function getSeedIntegritySummary(state, { force = false } = {}) {
    const now = Date.now();
    if (!force && state.snapshot && (now - state.snapshot.checkedAt) < state.cacheTtlMs) {
        return state.snapshot.summary;
    }

    try {
        const result = await db.query(`
            SELECT
                (SELECT COUNT(*)::int FROM confidence_thresholds) AS threshold_count,
                (SELECT COUNT(*)::int FROM clarification_questions) AS question_count
        `);

        const row = result.rows[0] || {};
        const summary = {
            thresholdCount: Number.parseInt(row.threshold_count, 10) || 0,
            questionCount: Number.parseInt(row.question_count, 10) || 0,
        };

        state.snapshot = {
            checkedAt: now,
            summary,
        };

        return summary;
    } catch (error) {
        logger.error('Error checking clarification seed integrity', { error: error.message });
        return null;
    }
}

export async function auditSeedIntegrity(state, { source = 'runtime' } = {}) {
    const summary = await getSeedIntegritySummary(state);
    if (!summary) {
        return null;
    }

    const missing = [];
    if (summary.thresholdCount === 0) {
        missing.push('confidence_thresholds');
    }
    if (summary.questionCount === 0) {
        missing.push('clarification_questions');
    }

    if (missing.length === 0) {
        return summary;
    }

    const warningKey = missing.slice().sort().join('|');
    if (!state.warnings.has(warningKey)) {
        state.warnings.add(warningKey);
        logger.warn('Clarification seed data missing or incomplete; fallback clarification behavior will be used', {
            source,
            missing,
            thresholdCount: summary.thresholdCount,
            questionCount: summary.questionCount,
        });
    }

    return summary;
}

export async function getPendingClassifications(policyQuestionContext) {
    try {
        const result = await db.query(
            `SELECT 
               ch.*,
               l.name as suggested_library_name,
               l.arr_type
             FROM classification_history ch
             LEFT JOIN libraries l ON l.id = ch.library_id
             WHERE ch.status IN ('awaiting_decision', 'pending_retry')
             ORDER BY
               CASE ch.status WHEN 'awaiting_decision' THEN 0 ELSE 1 END,
               ch.created_at DESC`
        );
        const contextVersionCache = new Map();
        const {
            buildQuestionContextCacheKey,
            extractQuestionContext,
            getPolicyQuestionContextVersion,
            isPolicyQuestionStale,
        } = policyQuestionContext;

        const items = await Promise.all(result.rows.map(async (row) => {
            const parsedQuestion = row.policy_question
                ? (typeof row.policy_question === 'string'
                    ? safeParseJson(row.policy_question)
                    : row.policy_question)
                : null;

            if (!parsedQuestion) {
                return {
                    ...row,
                    policy_question: null,
                    policy_question_stale: false,
                    policy_question_current_context_version: null,
                    policy_question_stale_reason: null,
                };
            }

            const normalizationStatus = getRuntimeQuestionNormalizationStatus(parsedQuestion);
            if (!normalizationStatus.actionable) {
                return {
                    ...row,
                    policy_question: parsedQuestion,
                    policy_question_stale: true,
                    policy_question_current_context_version: null,
                    policy_question_stale_reason: normalizationStatus.reason,
                };
            }

            const context = extractQuestionContext(parsedQuestion);
            const cacheKey = buildQuestionContextCacheKey(context);

            let currentContextVersion = contextVersionCache.get(cacheKey);
            if (currentContextVersion === undefined) {
                currentContextVersion = await getPolicyQuestionContextVersion(db, context);
                contextVersionCache.set(cacheKey, currentContextVersion);
            }

            const questionStale = isPolicyQuestionStale(parsedQuestion, currentContextVersion);

            return {
                ...row,
                policy_question: parsedQuestion,
                policy_question_stale: questionStale,
                policy_question_current_context_version: currentContextVersion,
                policy_question_stale_reason: questionStale ? 'policy_context_changed' : null,
            };
        }));

        return items;
    } catch (error) {
        logger.error('Error getting pending classifications', { error: error.message });
        return [];
    }
}

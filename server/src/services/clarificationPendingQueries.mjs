import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { SEED_INTEGRITY_CACHE_TTL_MS } from './clarificationUtils.mjs';
import { createPendingQuestionFreshnessReader } from './pendingQuestionFreshness.mjs';
import { ServiceUnavailableError } from '../utils/appError.mjs';
import { isDatabaseStatementTimeoutError } from '../utils/databaseStatementTimeout.mjs';

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

async function loadPendingClassifications() {
    let result;
    try {
        result = await db.query(
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
    } catch (error) {
        if (isDatabaseStatementTimeoutError(error)) throw error;
        throw new ServiceUnavailableError('Pending reviews could not be loaded. Refresh pending decisions to try again.', {
            code: 'pending_reviews_unavailable',
        });
    }
    return result.rows;
}

export async function getPendingClassifications(policyQuestionContext) {
    const rows = await loadPendingClassifications();
    return Promise.all(rows.map(createPendingQuestionFreshnessReader(db, policyQuestionContext)));
}

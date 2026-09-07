/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createLogger } from '../utils/logger.mjs';
import { EVIDENCE_COVERAGE_GROUP_LIMIT, readEvidenceCoverageSnapshot } from './evidenceCoverageQuery.mjs';

const logger = createLogger('EvidenceCoverage');
const version = 'evidence.coverage.v1';
const historyFields = ['events', 'imported_observations', 'original_candidates', 'linked_feedback'];
const feedbackFields = ['observations', 'source_bound', 'evaluated', 'unevaluated'];

function count(value) {
    const number = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)) ? Number(value) : NaN;
    if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid evidence count');
    return number;
}

function counts(row, fields) {
    return Object.fromEntries(fields.map(field => [field, count(row[field])]));
}

function population(totals, groups, groupCount, fields) {
    const project = row => {
        const result = counts(row, fields);
        const denominator = result.events ?? result.observations;
        if (Object.values(result).some(value => value > denominator)) throw new Error('Inconsistent evidence counts');
        if ('observations' in result) {
            if (result.evaluated + result.unevaluated !== denominator) throw new Error('Inconsistent evaluation counts');
            result.evaluation_coverage = denominator === 0 ? null : result.evaluated / denominator;
        }
        return result;
    };
    const totalGroups = count(groupCount);
    if (!Array.isArray(groups) || groups.length !== Math.min(totalGroups, EVIDENCE_COVERAGE_GROUP_LIMIT)) {
        throw new Error('Incomplete evidence groups');
    }
    return { totals: project(totals), group_count: totalGroups, truncated: totalGroups > groups.length,
        groups: groups.map(row => ({ library_id: row.library_id, library_name: row.library_name,
            library_active: row.library_active, method: row.method, ...project(row) })) };
}

export function buildEvidenceCoverage(snapshot) {
    const captured = snapshot?.captured_at == null ? NaN : new Date(snapshot.captured_at).getTime();
    if (!Number.isFinite(captured)) throw new Error('Invalid evidence snapshot time');
    return { version, status: 'available', scope: 'all_retained', captured_at: new Date(captured).toISOString(),
        group_limit: EVIDENCE_COVERAGE_GROUP_LIMIT,
        history: population(snapshot.history_totals, snapshot.history_groups, snapshot.history_group_count, historyFields),
        feedback: population(snapshot.feedback_totals, snapshot.feedback_groups, snapshot.feedback_group_count, feedbackFields),
        deleted_feedback_receipts: count(snapshot.deleted_feedback_receipts) };
}

export async function readEvidenceCoverage(db) {
    try {
        return buildEvidenceCoverage(await readEvidenceCoverageSnapshot(db));
    } catch (error) {
        logger.warn('Evidence coverage unavailable', { code: error.code || 'READ_FAILED' });
        return { version, status: 'unavailable', scope: 'all_retained', captured_at: null,
            history: null, feedback: null, deleted_feedback_receipts: null };
    }
}

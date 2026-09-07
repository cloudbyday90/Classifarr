/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createLogger } from '../utils/logger.mjs';
import { EVIDENCE_COVERAGE_GROUP_LIMIT, readEvidenceCoverageSnapshot } from './evidenceCoverageQuery.mjs';
import { evidenceCount as count, evidenceCounts as counts, reconcileEvidenceGroups } from './evidenceCoverageProjection.mjs';
import { buildEvidenceMethodAttribution } from './evidenceMethodAttribution.mjs';
import { buildDailyProvenanceCoverage } from './dailyProvenanceCoverage.mjs';
import { buildHistoryRecordingTimeCoverage } from './historyRecordingTimeCoverage.mjs';
import { buildUtcProvenanceCoverage } from './utcProvenanceCoverage.mjs';

const logger = createLogger('EvidenceCoverage');
const version = 'evidence.coverage.v2';
const lifecycleFields = ['completed_events', 'pending_events', 'retry_events', 'other_events'];
const candidateFields = ['original_candidates', 'candidate_no_proposal', 'candidate_invalid', 'candidate_not_applicable', 'candidate_unrecorded'];
const historyFields = ['events', ...lifecycleFields, ...candidateFields, 'imported_observations', 'linked_feedback'];
const feedbackFields = ['observations', 'source_bound', 'evaluated', 'unevaluated'];

function population(totals, groups, groupCount, fields) {
    const project = row => {
        const result = counts(row, fields);
        const denominator = result.events ?? result.observations;
        if (Object.values(result).some(value => value > denominator)) throw new Error('Inconsistent evidence counts');
        if ('events' in result && lifecycleFields.reduce((sum, field) => sum + result[field], 0) !== denominator) {
            throw new Error('Inconsistent history lifecycle counts');
        }
        if ('events' in result && candidateFields.reduce((sum, field) => sum + result[field], 0) !== denominator) {
            throw new Error('Inconsistent candidate capture counts');
        }
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
    const result = { totals: project(totals), group_count: totalGroups, truncated: totalGroups > groups.length,
        groups: groups.map(row => ({ library_id: row.library_id, library_name: row.library_name,
            library_active: row.library_active, method: row.method, ...project(row) })) };
    reconcileEvidenceGroups(result.totals, result.groups, fields, result.truncated);
    return result;
}

export function buildEvidenceCoverage(snapshot) {
    const captured = snapshot?.captured_at == null ? NaN : new Date(snapshot.captured_at).getTime();
    if (!Number.isFinite(captured)) throw new Error('Invalid evidence snapshot time');
    const history = population(snapshot.history_totals, snapshot.history_groups, snapshot.history_group_count, historyFields);
    const attribution = buildEvidenceMethodAttribution(snapshot, history.totals.events, EVIDENCE_COVERAGE_GROUP_LIMIT);
    const recordingCoverage = buildHistoryRecordingTimeCoverage(snapshot.recording_time_coverage, history.totals.events);
    return { version, status: 'available', scope: 'all_retained', captured_at: new Date(captured).toISOString(),
        group_limit: EVIDENCE_COVERAGE_GROUP_LIMIT,
        history,
        feedback: population(snapshot.feedback_totals, snapshot.feedback_groups, snapshot.feedback_group_count, feedbackFields),
        history_attribution: attribution,
        recording_time_coverage: recordingCoverage,
        utc_provenance_trend: buildUtcProvenanceCoverage(snapshot.utc_provenance_trend, attribution.totals,
            recordingCoverage, new Date(captured).toISOString().slice(0, 10)),
        provenance_trend: buildDailyProvenanceCoverage(snapshot.provenance_trend, attribution.totals),
        deleted_feedback_receipts: count(snapshot.deleted_feedback_receipts) };
}

export async function readEvidenceCoverage(db) {
    try {
        return buildEvidenceCoverage(await readEvidenceCoverageSnapshot(db));
    } catch (error) {
        logger.warn('Evidence coverage unavailable', { code: error.code || 'READ_FAILED' });
        return { version, status: 'unavailable', scope: 'all_retained', captured_at: null,
            history: null, feedback: null, history_attribution: null, provenance_trend: null,
            recording_time_coverage: null, utc_provenance_trend: null, deleted_feedback_receipts: null };
    }
}

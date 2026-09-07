/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CLASSIFIER_CAPTURE_METHODS, NON_CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { evidenceCount, reconcileEvidenceGroups } from './evidenceCoverageProjection.mjs';
import { PROVENANCE_STATUSES as statuses, PROVENANCE_COUNT_FIELDS as fields, projectProvenanceCounts } from './evidenceProvenanceProjection.mjs';

const methods = new Set([...CLASSIFIER_CAPTURE_METHODS, ...NON_CLASSIFIER_CAPTURE_METHODS]);
const sources = new Set([null, 'policy_ranked', 'signal_ranked', 'decision_proposal', 'signal_proposal']);

export function buildEvidenceMethodAttribution(snapshot, historyEvents, limit) {
    const totals = projectProvenanceCounts(snapshot.attribution_totals);
    if (totals.events !== historyEvents) {
        throw new Error('Inconsistent attribution totals');
    }
    const groupCount = evidenceCount(snapshot.attribution_group_count);
    if (!Array.isArray(snapshot.attribution_groups) || snapshot.attribution_groups.length !== Math.min(groupCount, limit)) {
        throw new Error('Incomplete attribution groups');
    }
    const keys = new Set();
    const groups = snapshot.attribution_groups.map(row => {
        const { original_method, candidate_source, recorded_method, provenance_status } = row;
        const captured = provenance_status === 'captured';
        if (!statuses.includes(provenance_status) || typeof recorded_method !== 'string' || !recorded_method
            || (captured ? !methods.has(original_method) || !sources.has(candidate_source)
                : original_method !== null || candidate_source !== null)) throw new Error('Invalid attribution dimensions');
        const key = JSON.stringify([row.library_id, original_method, candidate_source, recorded_method, provenance_status]);
        if (keys.has(key)) throw new Error('Duplicate attribution group');
        keys.add(key);
        return { library_id: row.library_id, library_name: row.library_name, library_active: row.library_active,
            original_method, candidate_source, recorded_method, provenance_status, events: evidenceCount(row.events) };
    });
    const truncated = groupCount > groups.length;
    reconcileEvidenceGroups(totals, groups.map(row => ({ ...row,
        ...Object.fromEntries(statuses.map(status => [`${status}_events`, row.provenance_status === status ? row.events : 0])),
    })), fields, truncated);
    return { totals, group_count: groupCount, truncated, groups };
}

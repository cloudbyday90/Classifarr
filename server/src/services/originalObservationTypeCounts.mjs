/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evidenceCounts } from './evidenceCoverageProjection.mjs';

export const OBSERVATION_TYPES = Object.freeze(['imported_membership', 'manual_action', 'classifier_workflow', 'unknown_origin']);
export const OBSERVATION_TYPE_FIELDS = Object.freeze(OBSERVATION_TYPES.map(type => `${type}_events`));

export function projectOriginalObservationTypes(row, windowCounts) {
    const counts = evidenceCounts(row, OBSERVATION_TYPE_FIELDS);
    const known = counts.imported_membership_events + counts.manual_action_events + counts.classifier_workflow_events;
    if (!Number.isSafeInteger(known) || known > windowCounts.captured_events
        || known + counts.unknown_origin_events !== windowCounts.events) throw new Error('Inconsistent original observation types');
    return counts;
}

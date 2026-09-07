/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function emptyLibraryUtcSnapshot() {
    return { utc_library_totals: { retained_events: 0, events: 0, captured_events: 0, unrecorded_events: 0,
        invalid_events: 0, unsupported_events: 0, older_events: 0, future_events: 0, unknown_events: 0,
        imported_membership_events: 0, manual_action_events: 0, classifier_workflow_events: 0, unknown_origin_events: 0 },
    utc_library_group_count: 0, utc_library_groups: [] };
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildEvidenceMethodAttribution } from '../services/evidenceMethodAttribution.mjs';

const fixture = () => ({ attribution_totals: { events: '4', captured_events: '1', unrecorded_events: '1', invalid_events: '1', unsupported_events: '1' },
    attribution_group_count: '4', attribution_groups: ['captured', 'unrecorded', 'invalid', 'unsupported'].map(status => ({
        library_id: 1, library_name: 'Library', library_active: false, recorded_method: 'manual_classification',
        original_method: status === 'captured' ? 'policy_auto' : null,
        candidate_source: status === 'captured' ? 'policy_ranked' : null, provenance_status: status, events: '1',
        metadata: 'PRIVATE', title: 'PRIVATE',
    })) });
const build = (snapshot = fixture(), total = 4, limit = 200) => buildEvidenceMethodAttribution(snapshot, total, limit);

test('projects original and recorded methods, partitions provenance and omits raw fields', () => {
    const result = build();
    expect(result.totals).toEqual({ events: 4, captured_events: 1, unrecorded_events: 1, invalid_events: 1, unsupported_events: 1 });
    expect(result.groups[0]).toEqual({ library_id: 1, library_name: 'Library', library_active: false,
        original_method: 'policy_auto', candidate_source: 'policy_ranked', recorded_method: 'manual_classification',
        provenance_status: 'captured', events: 1 });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each([null, undefined, false, -1, 1.5, '9007199254740992'])('rejects invalid count %s', value => {
    const snapshot = fixture();
    snapshot.attribution_groups[0].events = value;
    expect(() => build(snapshot)).toThrow('Invalid evidence count');
});

test.each(['history_total', 'partition', 'category', 'missing_group', 'duplicate', 'method', 'source', 'status', 'invented_origin'])('rejects inconsistent %s', kind => {
    const snapshot = fixture();
    if (kind === 'history_total') return expect(() => build(snapshot, 5)).toThrow('Inconsistent attribution totals');
    if (kind === 'partition') snapshot.attribution_totals.invalid_events = 0;
    if (kind === 'category') Object.assign(snapshot.attribution_totals, { captured_events: 0, invalid_events: 2 });
    if (kind === 'missing_group') snapshot.attribution_groups.pop();
    if (kind === 'duplicate') snapshot.attribution_groups[1] = snapshot.attribution_groups[0];
    if (kind === 'method') snapshot.attribution_groups[0].original_method = 'future';
    if (kind === 'source') snapshot.attribution_groups[0].candidate_source = 'selected_library';
    if (kind === 'status') snapshot.attribution_groups[0].provenance_status = 'future';
    if (kind === 'invented_origin') snapshot.attribution_groups[1].original_method = 'manual_classification';
    expect(() => build(snapshot)).toThrow();
});

test('capped rows do not replace global counts or exceed a hidden status total', () => {
    const snapshot = fixture();
    snapshot.attribution_groups = snapshot.attribution_groups.slice(0, 2);
    expect(build(snapshot, 4, 2)).toMatchObject({ group_count: 4, truncated: true, totals: { events: 4, invalid_events: 1 } });
    Object.assign(snapshot.attribution_totals, { captured_events: 0, invalid_events: 2 });
    expect(() => build(snapshot, 4, 2)).toThrow('Inconsistent evidence group totals');
});

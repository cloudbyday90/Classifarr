/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildHistoryRecordingTimeCoverage as project } from '../services/historyRecordingTimeCoverage.mjs';

test('projects empty and mixed recording-time populations without inventing legacy instants', () => {
    expect(project({ events: '0', recorded_events: '0', unknown_events: '0' }, 0))
        .toEqual({ events: 0, recorded_events: 0, unknown_events: 0 });
    expect(project({ events: '5', recorded_events: '2', unknown_events: '3' }, 5))
        .toEqual({ events: 5, recorded_events: 2, unknown_events: 3 });
});

test.each([undefined, null, -1, 0.5, false, 'bad', '9007199254740992', 2])('rejects invalid or unreconciled counts: %s', value => {
    expect(() => project({ events: 2, recorded_events: value, unknown_events: 1 }, 2)).toThrow();
});

test('rejects a total that disagrees with retained history', () => {
    expect(() => project({ events: 2, recorded_events: 1, unknown_events: 1 }, 3)).toThrow();
});

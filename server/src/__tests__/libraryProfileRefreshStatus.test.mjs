/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';

const readAt = '2026-09-23T12:00:00.000Z';
const earlier = '2026-09-23T11:00:00.000Z';
const later = '2026-09-23T13:00:00.000Z';

function row(libraryId, overrides = {}) {
    return {
        library_id: libraryId, name: `Library ${libraryId}`, is_active: true,
        source_revision: '1', acknowledged_revision: '1', profile_revision: '1',
        has_inventory: true, has_profile: true, processing_state: null, available_at: null,
        lease_expires_at: null, probe_at: null, read_at: readAt,
        ...overrides,
    };
}

test('projects distinct recovery states from one bounded read without mutation', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [
        row(1),
        row(2, { source_revision: null, acknowledged_revision: null, profile_revision: null,
            has_inventory: false, has_profile: false }),
        row(13, { profile_revision: null, has_inventory: false, has_profile: false }),
        row(3, { profile_revision: null }),
        row(12, { source_revision: null, acknowledged_revision: null, profile_revision: null,
            has_inventory: false, has_profile: true }),
        row(14, { has_inventory: false }),
        row(4, { source_revision: '2' }),
        row(5, { source_revision: '2', processing_state: 'pending', available_at: earlier }),
        row(6, { source_revision: '2', processing_state: 'processing', lease_expires_at: later }),
        row(7, { source_revision: '2', processing_state: 'pending', available_at: later }),
        row(8, { source_revision: '2', processing_state: 'failed', probe_at: later }),
        row(9, { source_revision: '2', processing_state: 'failed', probe_at: earlier }),
        row(10, { source_revision: '2', is_active: false, processing_state: 'pending' }),
        row(11, { source_revision: '2', processing_state: 'processing', lease_expires_at: earlier }),
    ] }) };

    const report = await readLibraryProfileRefreshStatus(db);

    expect(report.libraries.map(library => library.statusId)).toEqual([
        'current', 'no_inventory', 'no_inventory', 'unverified', 'unverified', 'unverified',
        'waiting', 'queued', 'processing',
        'retry_wait', 'cooldown', 'waiting', 'paused', 'waiting',
    ]);
    expect(report.summary).toMatchObject({ current: 1, waiting: 3, cooldown: 1, paused: 1 });
    expect(report.libraries[9].retryAt).toBe(later);
    expect(report.libraries[10].retryAt).toBe(later);
    expect(report.libraries[11].retryAt).toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('SELECT library.id');
    expect(db.query.mock.calls[0][1][1]).toBe(201);
});

test('preserves bigint revisions and marks an incomplete window', async () => {
    const rows = Array.from({ length: 201 }, (_, index) => row(index + 1));
    rows[0] = row(1, { source_revision: '9007199254740994', acknowledged_revision: '9007199254740993',
        profile_revision: '9007199254740993' });
    const report = await readLibraryProfileRefreshStatus({ query: async () => ({ rows }) });
    expect(report.windowTruncated).toBe(true);
    expect(report.libraryCount).toBe(200);
    expect(report.libraries[0]).toMatchObject({ sourceRevision: '9007199254740994', statusId: 'waiting' });
});

test('fails closed on an invalid revision rather than reporting a current profile', async () => {
    await expect(readLibraryProfileRefreshStatus({ query: async () => ({ rows: [row(1, {
        source_revision: '9e3',
    })] }) })).rejects.toThrow('invalid revision');
});

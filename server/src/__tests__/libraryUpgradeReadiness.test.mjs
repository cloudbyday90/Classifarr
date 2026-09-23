/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readLibraryUpgradeReadiness } from '../services/libraryUpgradeReadiness.mjs';

const counts = {
    observed_at: '2026-09-23T12:00:00.000Z', library_count: 3, active_count: 2,
    movie_count: 1, tv_count: 1, other_count: 1, missing_profile_count: 1,
    current_count: 1, queued_count: 1, processing_count: 0, retry_wait_count: 0,
    cooldown_count: 0, waiting_count: 0, paused_count: 1, unverified_count: 0,
    no_inventory_count: 0, covered_count: 1, issue_count: 3, conflict_count: 2,
    invalid_provider_count: 1, invalid_type_count: 0, enrollment_recorded: true,
};

test('reads a whole-installation aggregate without returning media or provider data', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [counts] }) };
    const report = await readLibraryUpgradeReadiness(db);
    expect(report).toMatchObject({
        libraryCount: 3, activeLibraryCount: 2,
        mediaTypes: { movie: 1, tv: 1, other: 1 },
        profile: { current: 1, queued: 1, paused: 1, missing: 1 },
        sourceIdentity: { completeCaptureLibraryCount: 1, unresolvedItemCount: 3,
            conflictingProviderItemCount: 2, invalidProviderItemCount: 1 },
        upgradeEnrollmentRecorded: true,
    });
    expect(db.query).toHaveBeenCalledTimes(1);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('FROM libraries l');
    expect(sql).toContain("generation=c.generation");
    expect(sql).not.toMatch(/\b(title|external_id|metadata)\b/);
    expect(JSON.stringify(report)).not.toContain('Synthetic');
});

test('fails closed on invalid aggregate counts', async () => {
    await expect(readLibraryUpgradeReadiness({ query: async () => ({ rows: [{
        ...counts, library_count: '-1',
    }] }) })).rejects.toThrow('Invalid upgrade readiness count');
});

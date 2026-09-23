/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { buildPostUpgradeTaskPlan } from '../services/postUpgradeTaskPlan.mjs';
import { runPostUpgradeTaskPlan } from '../scripts/runPostUpgradeTaskPlan.mjs';

const tasks = [
    { id: 'old_logs', version: '0.41.2', action: 'clear_logs', description: 'not public' },
    { id: 'profiles', version: '0.48.4-beta', action: 'regenerate_library_profile_observations' }
];

describe('post-upgrade task manifest', () => {
    it('marks old automatic log clearing as skipped, without copying task descriptions', () => {
        expect(buildPostUpgradeTaskPlan(tasks, [])).toEqual({
            schemaVersion: 1,
            total: 2,
            pending: 1,
            legacyClearPending: 1,
            entries: [
                { id: 'old_logs', version: '0.41.2', action: 'clear_logs', status: 'skip_legacy_auto_clear' },
                { id: 'profiles', version: '0.48.4-beta', action: 'regenerate_library_profile_observations', status: 'pending' }
            ]
        });
        expect(buildPostUpgradeTaskPlan(tasks, ['profiles']).pending).toBe(0);
    });

    it('reads the ledger in a bounded read-only transaction and closes the pool', async () => {
        const query = jest.fn(async sql => sql.startsWith('SELECT task_id')
            ? { rows: [{ task_id: 'old_logs' }] } : { rows: [] });
        const close = jest.fn();
        const withTransaction = jest.fn(async fn => fn({ query }));
        const result = await runPostUpgradeTaskPlan({ load: async () => ({ tasks, close, withTransaction }) });

        expect(result.entries).toEqual([
            expect.objectContaining({ id: 'old_logs', status: 'recorded' }),
            expect.objectContaining({ id: 'profiles', status: 'pending' })
        ]);
        expect(query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        expect(query).toHaveBeenCalledWith('SELECT task_id FROM post_upgrade_tasks ORDER BY executed_at');
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('fails closed and closes the pool when the ledger is missing', async () => {
        const close = jest.fn();
        const withTransaction = jest.fn(async fn => fn({ query: jest.fn(async sql => {
            if (sql.startsWith('SELECT task_id')) throw new Error('ledger missing');
            return { rows: [] };
        }) }));
        await expect(runPostUpgradeTaskPlan({ load: async () => ({ tasks, close, withTransaction }) }))
            .rejects.toThrow('ledger missing');
        expect(close).toHaveBeenCalledTimes(1);
    });
});

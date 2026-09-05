/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
    query: jest.fn()
};

const mockFs = {
    access: jest.fn(),
    readdir: jest.fn(),
    writeFile: jest.fn()
};

const mockLibraryProfileService = {
    generateAllProfiles: jest.fn()
};

const legacyRatingProfileRows = [
    { library_id: 20, media_type: 'tv', rating_distribution: { '16': 11, 'TV-MA': 4 } }
];

const normalizedRatingProfileRows = [
    { library_id: 20, media_type: 'tv', rating_distribution: { 'TV-MA': 15 } }
];

await jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

await jest.unstable_mockModule('../services/libraryProfileService.mjs', () => ({
    libraryProfileService: mockLibraryProfileService
}));

await jest.unstable_mockModule('node:fs/promises', () => ({
    default: mockFs
}));

const { postUpgradeService } = await import('../services/postUpgradeService.mjs');

describe('PostUpgradeService', () => {
    beforeEach(() => {
        mockDb.query.mockReset();
        mockFs.access.mockReset();
        mockFs.readdir.mockReset();
        mockFs.writeFile.mockReset();
        mockLibraryProfileService.generateAllProfiles.mockReset();
        mockLibraryProfileService.generateAllProfiles.mockResolvedValue([
            { id: 1, success: true },
            { id: 2, success: false, error: 'sync unavailable' }
        ]);
    });

    describe('runPendingTasks', () => {
        it('should execute pending tasks that have not been run', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 5 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rows: legacyRatingProfileRows })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 10 })
                .mockResolvedValueOnce({ rowCount: 1 });

            mockFs.access.mockResolvedValue();
            mockFs.readdir.mockResolvedValue([]);

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(10);
            expect(result.skipped).toBe(0);
            expect(mockLibraryProfileService.generateAllProfiles).toHaveBeenCalledTimes(2);
        });

        it('should pre-seed all tasks as complete on a fresh install without executing them', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValue({ rowCount: 1 });

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(0);
            expect(result.skipped).toBeGreaterThan(0);
            expect(mockDb.query).not.toHaveBeenCalledWith('DELETE FROM error_log WHERE resolved = false');
            expect(mockDb.query).not.toHaveBeenCalledWith('DELETE FROM app_log');
        });

        it('should skip tasks that have already been executed', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [
                        { task_id: 'clear_logs_0393' },
                        { task_id: 'backfill_library_name_0393' },
                        { task_id: 'clear_logs_0412' },
                        { task_id: 'clear_logs_0413' },
                        { task_id: 'clear_logs_0427' },
                        { task_id: 'clear_logs_0431b' },
                        { task_id: 'clear_logs_0439' },
                        { task_id: 'regenerate_library_profiles_rating_normalization_0472' },
                        { task_id: 'reset_stale_rating_normalization_0475' },
                        { task_id: 'clear_logs_0475a' },
                        { task_id: 'regenerate_library_profile_observations_v1' }
                    ]
                });

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(0);
            expect(result.skipped).toBe(11);
            expect(mockLibraryProfileService.generateAllProfiles).not.toHaveBeenCalled();
        });

        it('should handle partial execution when some tasks fail', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockRejectedValueOnce(new Error('Failed to truncate'))
                .mockResolvedValueOnce({ rowCount: 5 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rows: legacyRatingProfileRows })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 15 })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(9);
        });

        it('should mark rating profile regeneration complete without running when profiles are already normalized', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [
                        { task_id: 'clear_logs_0393' },
                        { task_id: 'backfill_library_name_0393' },
                        { task_id: 'clear_logs_0412' },
                        { task_id: 'clear_logs_0413' },
                        { task_id: 'clear_logs_0427' },
                        { task_id: 'clear_logs_0431b' },
                        { task_id: 'clear_logs_0439' },
                        { task_id: 'regenerate_library_profile_observations_v1' }
                    ]
                })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: normalizedRatingProfileRows })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rowCount: 12 })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(2);
            expect(result.skipped).toBe(9);
            expect(mockLibraryProfileService.generateAllProfiles).not.toHaveBeenCalled();
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO post_upgrade_tasks'),
                [
                    'regenerate_library_profiles_rating_normalization_0472',
                    '0.47.2-beta',
                    'Regenerate library profiles with normalized rating distributions'
                ]
            );
        });
    });

    it('retries incomplete observation refreshes and records completion only after success', async () => {
        const taskId = 'regenerate_library_profile_observations_v1';
        const completed = postUpgradeService.getAllTasks().map(task => task.id).filter(id => id !== taskId);
        mockDb.query.mockImplementation(async (sql, values) => {
            if (sql.includes('SELECT task_id')) return { rows: completed.map(task_id => ({ task_id })) };
            if (sql.includes('FROM users')) return { rows: [{ count: '1' }] };
            if (sql.includes('INSERT INTO post_upgrade_tasks')) completed.push(values[0]);
            return { rows: [], rowCount: 1 };
        });
        expect((await postUpgradeService.runPendingTasks()).executed).toBe(0);
        expect(completed).not.toContain(taskId);
        mockLibraryProfileService.generateAllProfiles.mockResolvedValue([{ id: 1, success: true }]);
        expect((await postUpgradeService.runPendingTasks()).executed).toBe(1);
        expect(completed.filter(id => id === taskId)).toHaveLength(1);
        expect((await postUpgradeService.runPendingTasks()).executed).toBe(0);
        expect(mockLibraryProfileService.generateAllProfiles).toHaveBeenCalledTimes(2);
    });

    describe('executeTask', () => {
        it('should execute clear_logs task', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 10 })
                .mockResolvedValueOnce({ rowCount: 5 });

            mockFs.access.mockResolvedValue();
            mockFs.readdir.mockResolvedValue(['app.log', 'error.log']);
            mockFs.writeFile.mockResolvedValue();

            await postUpgradeService.executeTask({
                id: 'test_clear_logs',
                action: 'clear_logs',
                description: 'Test'
            });

            expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM error_log WHERE resolved = false');
            expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM app_log');
        });

        it('should execute rebuild_embeddings task', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 100 })
                .mockResolvedValueOnce({ rowCount: 1 });

            await postUpgradeService.executeTask({
                id: 'test_rebuild',
                action: 'rebuild_embeddings',
                description: 'Test'
            });

            expect(mockDb.query).toHaveBeenCalledWith('UPDATE classification_embeddings SET is_stale = true');
            expect(mockDb.query).toHaveBeenCalledWith(
                'INSERT INTO rag_logs (level, type, message) VALUES ($1, $2, $3)',
                [
                    'info',
                    'upgrade',
                    'Post-upgrade rebuild marked 100 classification_embeddings row(s) stale for regeneration.',
                ]
            );
        });

        it('should execute backfill_library_name task', async () => {
            mockDb.query.mockResolvedValueOnce({ rowCount: 25 });

            await postUpgradeService.executeTask({
                id: 'test_backfill',
                action: 'backfill_library_name',
                description: 'Test'
            });

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE classification_history ch')
            );
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('SET library_name = l.name')
            );
        });

        it('should execute regenerate_library_profiles task', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: legacyRatingProfileRows });

            await postUpgradeService.executeTask({
                id: 'test_regenerate_library_profiles',
                action: 'regenerate_library_profiles',
                description: 'Test'
            });

            expect(mockLibraryProfileService.generateAllProfiles).toHaveBeenCalledTimes(1);
        });

        it('should skip regenerate_library_profiles task when profiles are already normalized', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: normalizedRatingProfileRows });

            const result = await postUpgradeService.executeTask({
                id: 'test_regenerate_library_profiles',
                action: 'regenerate_library_profiles',
                description: 'Test'
            });

            expect(result).toEqual({
                skipped: true,
                reason: 'rating_profiles_already_normalized'
            });
            expect(mockLibraryProfileService.generateAllProfiles).not.toHaveBeenCalled();
        });

        it('should execute reset_stale_normalizations task', async () => {
            mockDb.query.mockResolvedValueOnce({ rowCount: 42 });

            const result = await postUpgradeService.executeTask({
                id: 'test_reset_stale_normalizations',
                action: 'reset_stale_normalizations',
                description: 'Test'
            });

            expect(result).toEqual({ resetCount: 42 });
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE media_server_items')
            );
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('SET original_rating = NULL')
            );

            // Check that query string contains normalized metadata comparison
            const queryCall = mockDb.query.mock.calls[0][0];
            expect(queryCall).toContain('original_rating IS NOT NULL');
            expect(queryCall).toContain("CASE WHEN media_type = 'tv' THEN");
            expect(queryCall).toContain('UPPER(TRIM');
            expect(queryCall).toContain('DISTINCT FROM');
        });

        it('should detect stringified legacy rating distributions', () => {
            const needsRegeneration = postUpgradeService.hasLegacyRatingDistributionBuckets(
                JSON.stringify({ '18': 12, 'TV-MA': 5 }),
                'tv'
            );

            expect(needsRegeneration).toBe(true);
        });

        it('should throw error for unknown task action', async () => {
            await expect(
                postUpgradeService.executeTask({
                    id: 'test_unknown',
                    action: 'unknown_action',
                    description: 'Test'
                })
            ).rejects.toThrow('Unknown task action: unknown_action');
        });
    });

    describe('markTaskComplete', () => {
        it('should insert task completion record', async () => {
            mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

            await postUpgradeService.markTaskComplete({
                id: 'test_task',
                version: '0.39.3',
                description: 'Test task'
            });

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO post_upgrade_tasks'),
                ['test_task', '0.39.3', 'Test task']
            );
        });
    });

    describe('getExecutedTaskIds', () => {
        it('should return list of executed task IDs', async () => {
            mockDb.query.mockResolvedValueOnce({
                rows: [
                    { task_id: 'task1' },
                    { task_id: 'task2' },
                    { task_id: 'task3' }
                ]
            });

            const taskIds = await postUpgradeService.getExecutedTaskIds();

            expect(taskIds).toEqual(['task1', 'task2', 'task3']);
        });

        it('should return empty array if table does not exist', async () => {
            const error = new Error('Table does not exist');
            error.code = '42P01';
            mockDb.query.mockRejectedValueOnce(error);

            const taskIds = await postUpgradeService.getExecutedTaskIds();

            expect(taskIds).toEqual([]);
        });
    });

    describe('getAllTasks', () => {
        it('should return all tasks across all versions', () => {
            const tasks = postUpgradeService.getAllTasks();

            expect(tasks.length).toBeGreaterThan(0);
            expect(tasks[0]).toHaveProperty('id');
            expect(tasks[0]).toHaveProperty('action');
            expect(tasks[0]).toHaveProperty('version');
            expect(tasks[0]).toHaveProperty('description');
            expect(tasks).toContainEqual(expect.objectContaining({
                id: 'regenerate_library_profiles_rating_normalization_0472',
                version: '0.47.2-beta'
            }));
            expect(tasks).toContainEqual(expect.objectContaining({
                id: 'reset_stale_rating_normalization_0475',
                version: '0.47.5-beta'
            }));
        });
    });
});

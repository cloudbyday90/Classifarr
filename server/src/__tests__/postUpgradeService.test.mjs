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

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

const mockFs = {
    access: jest.fn(),
    readdir: jest.fn(),
    writeFile: jest.fn()
};

await jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

await jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

await jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
    default: {
        createLogger: () => mockLogger
    }
}));

await jest.unstable_mockModule('node:fs/promises', () => ({
    default: mockFs
}));

const { postUpgradeService } = await import('../services/postUpgradeService.mjs');

describe('PostUpgradeService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
                .mockResolvedValueOnce({ rowCount: 1 });

            mockFs.access.mockResolvedValue();
            mockFs.readdir.mockResolvedValue([]);

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(7);
            expect(result.skipped).toBe(0);
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
                        { task_id: 'clear_logs_0439' }
                    ]
                });

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(0);
            expect(result.skipped).toBe(7);
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
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(6);
        });
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
            mockDb.query.mockResolvedValueOnce({ rowCount: 100 });

            await postUpgradeService.executeTask({
                id: 'test_rebuild',
                action: 'rebuild_embeddings',
                description: 'Test'
            });

            expect(mockDb.query).toHaveBeenCalledWith('UPDATE classification_embeddings SET is_stale = true');
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
        });
    });
});

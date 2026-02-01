/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const postUpgradeService = require('../services/postUpgradeService');
const db = require('../config/database');
const fs = require('fs').promises;

jest.mock('../config/database');
jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        writeFile: jest.fn()
    }
}));
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('PostUpgradeService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('runPendingTasks', () => {
        it('should execute pending tasks that have not been run', async () => {
            // Mock table exists check
            db.query
                .mockResolvedValueOnce({ rows: [] }) // ensureTableExists check
                .mockResolvedValueOnce({ rows: [] }) // getExecutedTaskIds - no tasks executed yet
                .mockResolvedValueOnce({ rowCount: 0 }) // clear_logs - TRUNCATE error_log
                .mockResolvedValueOnce({ rowCount: 0 }) // clear_logs - TRUNCATE app_log
                .mockResolvedValueOnce({ rowCount: 1 }) // markTaskComplete - clear_logs
                .mockResolvedValueOnce({ rowCount: 5 }) // backfill_library_name
                .mockResolvedValueOnce({ rowCount: 1 }); // markTaskComplete - backfill_library_name

            // Mock fs operations for clear_logs
            fs.readdir.mockResolvedValue([]);

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(2); // Both tasks should execute
            expect(result.skipped).toBe(0);
        });

        it('should skip tasks that have already been executed', async () => {
            // Mock that tasks are already executed
            db.query
                .mockResolvedValueOnce({ rows: [] }) // ensureTableExists check
                .mockResolvedValueOnce({
                    rows: [
                        { task_id: 'clear_logs_0393' },
                        { task_id: 'backfill_library_name_0393' }
                    ]
                }); // getExecutedTaskIds

            const result = await postUpgradeService.runPendingTasks();

            expect(result.executed).toBe(0);
            expect(result.skipped).toBe(2);
        });

        it('should handle partial execution when some tasks fail', async () => {
            // Mock table exists and executed tasks
            db.query
                .mockResolvedValueOnce({ rows: [] }) // ensureTableExists check
                .mockResolvedValueOnce({ rows: [] }) // getExecutedTaskIds
                .mockRejectedValueOnce(new Error('Failed to truncate')) // clear_logs fails
                .mockResolvedValueOnce({ rowCount: 5 }) // backfill_library_name succeeds
                .mockResolvedValueOnce({ rowCount: 1 }); // markTaskComplete for successful task

            const result = await postUpgradeService.runPendingTasks();

            // Only the successful task should be counted
            expect(result.executed).toBe(1);
        });
    });

    describe('executeTask', () => {
        it('should execute clear_logs task', async () => {
            db.query
                .mockResolvedValueOnce({ rowCount: 10 }) // TRUNCATE error_log
                .mockResolvedValueOnce({ rowCount: 5 }); // TRUNCATE app_log

            fs.readdir.mockResolvedValue(['app.log', 'error.log']);
            fs.writeFile.mockResolvedValue();

            await postUpgradeService.executeTask({
                id: 'test_clear_logs',
                action: 'clear_logs',
                description: 'Test'
            });

            expect(db.query).toHaveBeenCalledWith('TRUNCATE TABLE error_log');
            expect(db.query).toHaveBeenCalledWith('TRUNCATE TABLE app_log');
        });

        it('should execute clear_embedding_queue task', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 15 });

            await postUpgradeService.executeTask({
                id: 'test_clear_queue',
                action: 'clear_embedding_queue',
                description: 'Test'
            });

            expect(db.query).toHaveBeenCalledWith('DELETE FROM embedding_retry_queue');
        });

        it('should execute rebuild_embeddings task', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 100 });

            await postUpgradeService.executeTask({
                id: 'test_rebuild',
                action: 'rebuild_embeddings',
                description: 'Test'
            });

            expect(db.query).toHaveBeenCalledWith('UPDATE classification_embeddings SET is_stale = true');
        });

        it('should execute backfill_library_name task', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 25 });

            await postUpgradeService.executeTask({
                id: 'test_backfill',
                action: 'backfill_library_name',
                description: 'Test'
            });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE classification_history ch')
            );
            expect(db.query).toHaveBeenCalledWith(
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
            db.query.mockResolvedValueOnce({ rowCount: 1 });

            await postUpgradeService.markTaskComplete({
                id: 'test_task',
                version: '0.39.3',
                description: 'Test task'
            });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO post_upgrade_tasks'),
                ['test_task', '0.39.3', 'Test task']
            );
        });
    });

    describe('getExecutedTaskIds', () => {
        it('should return list of executed task IDs', async () => {
            db.query.mockResolvedValueOnce({
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
            db.query.mockRejectedValueOnce(error);

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

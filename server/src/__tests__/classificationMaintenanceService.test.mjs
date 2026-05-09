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
import { createMockDb, createMockLogger, restoreAllAndResetMocks } from './helpers/mockFactory.mjs';
import { STALE_AWAITING_DECISION_DAYS } from '../constants/classificationFlow.mjs';
import { ClassificationMaintenanceService } from '../services/classificationMaintenanceService.mjs';

const makeDb = () => createMockDb();
const makeLogger = () => createMockLogger();

describe('ClassificationMaintenanceService', () => {
    let db;
    let logger;
    let service;

    beforeEach(() => {
        restoreAllAndResetMocks();
        db = makeDb();
        logger = makeLogger();
        service = new ClassificationMaintenanceService({ db, logger });
    });

    describe('cleanupStaleAwaitingDecisions', () => {
        it('skips requeueing when no stale rows are reset', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            await service.cleanupStaleAwaitingDecisions();

            expect(db.query).toHaveBeenCalledTimes(1);
            const [, params] = db.query.mock.calls[0];
            expect(params).toEqual([STALE_AWAITING_DECISION_DAYS]);
            const insertCall = db.query.mock.calls.find(
                ([sql]) => sql && sql.includes('INSERT INTO task_queue')
            );
            expect(insertCall).toBeUndefined();
        });

        it('resets stale rows and requeues each item', async () => {
            const staleRows = [
                { id: 1, title: 'Old Movie', tmdb_id: 100, media_type: 'movie' },
                { id: 2, title: 'Old Show', tmdb_id: 200, media_type: 'tv' }
            ];

            db.query.mockImplementation((sql) => {
                if (sql && sql.includes('UPDATE classification_history')) {
                    return Promise.resolve({ rowCount: 2, rows: staleRows });
                }
                if (sql && sql.includes('INSERT INTO task_queue')) {
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            });

            await service.cleanupStaleAwaitingDecisions();

            const insertCalls = db.query.mock.calls.filter(
                ([sql]) => sql && sql.includes('INSERT INTO task_queue')
            );
            expect(insertCalls).toHaveLength(2);
            expect(JSON.parse(insertCalls[0][1][0])).toEqual({
                tmdb_id: 100,
                media_type: 'movie',
                title: 'Old Movie',
                source: 'stale_cleanup'
            });
            expect(logger.info).toHaveBeenCalledWith(
                'Stale awaiting_decision cleanup: reset rows',
                { count: 2 }
            );
        });

        it('logs individual requeue failures without stopping other rows', async () => {
            const staleRows = [
                { id: 1, title: 'Old Movie', tmdb_id: 100, media_type: 'movie' },
                { id: 2, title: 'Old Show', tmdb_id: 200, media_type: 'tv' }
            ];

            let insertCallCount = 0;
            db.query.mockImplementation((sql) => {
                if (sql && sql.includes('UPDATE classification_history')) {
                    return Promise.resolve({ rowCount: 2, rows: staleRows });
                }
                if (sql && sql.includes('INSERT INTO task_queue')) {
                    insertCallCount += 1;
                    if (insertCallCount === 1) {
                        return Promise.reject(new Error('Queue insert failed'));
                    }
                    return Promise.resolve({ rowCount: 1, rows: [] });
                }
                return Promise.resolve({ rowCount: 0, rows: [] });
            });

            await expect(service.cleanupStaleAwaitingDecisions()).resolves.toBeUndefined();

            expect(insertCallCount).toBe(2);
            expect(logger.warn).toHaveBeenCalledWith(
                'Stale cleanup: failed to re-queue item',
                { id: 1, error: 'Queue insert failed' }
            );
        });

        it('logs update failures without throwing', async () => {
            db.query.mockRejectedValueOnce(new Error('classification_history unavailable'));

            await expect(service.cleanupStaleAwaitingDecisions()).resolves.toBeUndefined();

            expect(logger.error).toHaveBeenCalledWith(
                'Stale awaiting_decision cleanup failed',
                { error: 'classification_history unavailable' }
            );
        });
    });
});

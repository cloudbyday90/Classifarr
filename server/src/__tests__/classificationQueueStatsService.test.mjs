/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import {
    SUCCESSFUL_CLASSIFICATION_STATUSES,
    getClassificationQueueHealth,
    getClassificationQueueSummary,
} from '../services/classificationQueueStatsService.mjs';

describe('classificationQueueStatsService', () => {
    let db;

    beforeEach(() => {
        db = { query: jest.fn() };
    });

    it('builds fast queue summary from active queue rows and durable totals', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{ pending: '4', processing: '1' }],
            })
            .mockResolvedValueOnce({
                rows: [{ successful_count: '22', failed_count: '3' }],
            });

        const summary = await getClassificationQueueSummary(db);

        expect(summary).toEqual({
            pending: 4,
            processing: 1,
            completed: 22,
            failed: 3,
            total: 30,
        });
    });

    it('builds queue health from durable totals and recent successful history', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{ pending: '2', processing: '0' }],
            })
            .mockResolvedValueOnce({
                rows: [{ successful_count: '90', failed_count: '10' }],
            })
            .mockResolvedValueOnce({
                rows: [{ completed_recent: '7' }],
            });

        const health = await getClassificationQueueHealth(db);

        expect(health).toEqual({
            pending: 2,
            processing: 0,
            completed_today: 7,
            failed: 10,
            total: 102,
            success_rate: 90,
        });
    });

    it('queries recent successful history using the shared terminal success statuses', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{ pending: '0', processing: '0' }],
            })
            .mockResolvedValueOnce({
                rows: [{ successful_count: '0', failed_count: '0' }],
            })
            .mockResolvedValueOnce({
                rows: [{ completed_recent: '0' }],
            });

        await getClassificationQueueHealth(db, { recentWindow: '12 hours' });

        expect(db.query).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('status = ANY($1::text[])'),
            [SUCCESSFUL_CLASSIFICATION_STATUSES, '12 hours']
        );
    });
});

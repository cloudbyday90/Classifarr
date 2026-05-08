/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const db = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

const { QueueMaintenanceService } = await import('../services/queueMaintenanceService.mjs');

describe('QueueMaintenanceService', () => {
    let service;
    let db;

    beforeEach(() => {
        jest.resetAllMocks();

        db = { query: jest.fn() };
        service = new QueueMaintenanceService({
            db,
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn()
            }
        });
    });

    describe('backgroundDrainIfBloated', () => {
        function mockCounts({ stale = 0, total = 0 } = {}) {
            db.query.mockResolvedValueOnce({ rows: [{ stale_count: String(stale), total_count: String(total) }] });
        }

        it('returns early when neither age nor count threshold is exceeded', async () => {
            mockCounts({ stale: 0, total: 500 });
            await service.backgroundDrainIfBloated();
            expect(db.query).toHaveBeenCalledTimes(1);
        });

        it('age-based drain: deletes rows older than retention window and runs VACUUM ANALYZE', async () => {
            mockCounts({ stale: 3000, total: 3000 });
            db.query
                .mockResolvedValueOnce({ rowCount: 3000 })
                .mockResolvedValueOnce({});

            await service.backgroundDrainIfBloated();

            const calls = db.query.mock.calls.map(([sql]) => (typeof sql === 'string' ? sql : ''));
            expect(calls.some(s => s.includes('DELETE') && s.includes('created_at <'))).toBe(true);
            expect(calls.some(s => s.includes('VACUUM ANALYZE task_queue'))).toBe(true);
            expect(service.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('bloat detected'),
                expect.objectContaining({ trigger: 'age' })
            );
        });

        it('count-based drain: deletes oldest rows when total exceeds MAX_TOTAL_ROWS', async () => {
            mockCounts({ stale: 0, total: 20000 });
            db.query
                .mockResolvedValueOnce({ rowCount: 5000 })
                .mockResolvedValueOnce({ rowCount: 5000 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({});

            await service.backgroundDrainIfBloated();

            const calls = db.query.mock.calls.map(([sql]) => (typeof sql === 'string' ? sql : ''));
            expect(calls.some(s => s.includes('DELETE') && s.includes('ORDER BY created_at ASC'))).toBe(true);
            expect(calls.some(s => s.includes('VACUUM ANALYZE task_queue'))).toBe(true);
            expect(service.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('count cap exceeded'),
                expect.objectContaining({ remaining: 20000, maxTotalRows: 10000 })
            );
        });

        it('logs trigger as "age+count" when both thresholds are exceeded', async () => {
            mockCounts({ stale: 5000, total: 20000 });
            db.query
                .mockResolvedValueOnce({ rowCount: 5000 })
                .mockResolvedValueOnce({ rowCount: 5000 })
                .mockResolvedValueOnce({ rowCount: 0 })
                .mockResolvedValueOnce({});

            await service.backgroundDrainIfBloated();

            expect(service.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('bloat detected'),
                expect.objectContaining({ trigger: 'age+count' })
            );
        });

        it('continues and logs warning when VACUUM ANALYZE fails', async () => {
            mockCounts({ stale: 2000, total: 2000 });
            db.query
                .mockResolvedValueOnce({ rowCount: 2000 })
                .mockRejectedValueOnce(new Error('vacuum failed'));

            await expect(service.backgroundDrainIfBloated()).resolves.toBeUndefined();
            expect(service.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('VACUUM ANALYZE failed'),
                expect.objectContaining({ error: 'vacuum failed' })
            );
        });

        it('respects TASK_QUEUE_MAX_TOTAL_ROWS env override', async () => {
            const originalEnv = process.env.TASK_QUEUE_MAX_TOTAL_ROWS;
            process.env.TASK_QUEUE_MAX_TOTAL_ROWS = '500';
            try {
                mockCounts({ stale: 0, total: 1000 });
                db.query
                    .mockResolvedValueOnce({ rowCount: 500 })
                    .mockResolvedValueOnce({ rowCount: 0 })
                    .mockResolvedValueOnce({});

                await service.backgroundDrainIfBloated();

                expect(service.logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('count cap exceeded'),
                    expect.objectContaining({ maxTotalRows: 500 })
                );
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.TASK_QUEUE_MAX_TOTAL_ROWS;
                } else {
                    process.env.TASK_QUEUE_MAX_TOTAL_ROWS = originalEnv;
                }
            }
        });
    });
});

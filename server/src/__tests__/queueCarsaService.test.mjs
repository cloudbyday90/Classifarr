/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

const mockMediaSync = { syncAllLibraries: jest.fn().mockResolvedValue(undefined) };
jest.mock('../services/mediaSync', () => mockMediaSync);
jest.unstable_mockModule('../services/mediaSync', () => ({ ...mockMediaSync, default: mockMediaSync }));
jest.unstable_mockModule('../services/mediaSync.mjs', () => ({ ...mockMediaSync, default: mockMediaSync }));

const mockScheduler = { runGapAnalysis: jest.fn().mockResolvedValue(undefined) };
jest.mock('../services/scheduler', () => mockScheduler);
jest.unstable_mockModule('../services/scheduler', () => ({ ...mockScheduler, default: mockScheduler }));
jest.unstable_mockModule('../services/scheduler.mjs', () => ({ ...mockScheduler, default: mockScheduler }));

const { QueueCarsaService } = await import('../services/queueCarsaService.mjs');

describe('QueueCarsaService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('resolves the scheduler lazily during clearAndResync instead of capturing it at module load time', async () => {
        const syncStatus = {
            isRunning: false,
            start: jest.fn(),
            stop: jest.fn(),
            updateProgress: jest.fn(),
            forceStop: jest.fn(),
        };

        const service = new QueueCarsaService({
            db: {
                query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
            },
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            syncStatus,
            mediaSyncService: mockMediaSync,
            captureLibrarySnapshot: jest.fn().mockResolvedValue({ libraries: {}, mappings: [] }),
            buildLibraryLookup: jest.fn().mockResolvedValue({ byExternalId: {}, byNameType: {} }),
            remapMappings: jest.fn().mockResolvedValue({ totalRemapped: 0, totalFailed: 0, radarr: [], sonarr: [] }),
            notifyRemapFailures: jest.fn().mockResolvedValue(undefined),
            performCleanup: jest.fn().mockResolvedValue({
                queueResult: { rowCount: 0 },
                embeddingsResult: { rowCount: 0 },
                historyResult: { rowCount: 0 },
                patternsResult: { rowCount: 0 },
                correctionsResult: { rowCount: 0 },
                rulesV2Result: { rowCount: 0 },
                syncStatusRowsResult: { rowCount: 0 },
                collectionsResult: { rowCount: 0 },
                itemsResult: { rowCount: 0 },
                librariesResult: { rowCount: 0 },
                feedbackLibraryRefsCleared: 0,
            }),
            resetVolatileState: jest.fn(),
        });

        const result = await service.clearAndResync();
        expect(result.success).toBe(true);

        await new Promise(resolve => setImmediate(resolve));

        expect(mockMediaSync.syncAllLibraries).toHaveBeenCalledTimes(1);
        expect(mockScheduler.runGapAnalysis).toHaveBeenCalledTimes(1);
        expect(syncStatus.stop).toHaveBeenCalledTimes(1);
    });

    it('uses the evidence service during cleanup instead of deleting learning patterns directly', async () => {
        const evidenceService = {
            purgeAllLegacyPatterns: jest.fn().mockResolvedValue({ deleted: 3, rows: [{ id: 1 }, { id: 2 }, { id: 3 }] })
        };
        const db = {
            query: jest.fn().mockResolvedValue({ rowCount: 2, rows: [{ id: 1 }, { id: 2 }] }),
            withTransaction: jest.fn((fn) => fn(db))
        };
        const syncStatus = {
            updateProgress: jest.fn()
        };

        const service = new QueueCarsaService({
            db,
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            syncStatus,
            evidenceService
        });

        const result = await service.performClearAndResyncCleanup();

        expect(evidenceService.purgeAllLegacyPatterns).toHaveBeenCalledWith({
            client: db,
            actor: 'carsa',
            reason: 'clear_and_resync'
        });
        expect(result.patternsResult.deleted).toBe(3);
        expect(db.query).not.toHaveBeenCalledWith('DELETE FROM learning_patterns RETURNING id');
    });
});

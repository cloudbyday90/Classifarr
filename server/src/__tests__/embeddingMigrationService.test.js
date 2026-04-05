/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingService = require('../services/embeddingService');
const embeddingMigrationService = require('../services/embeddingMigrationService');

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/embeddingService', () => ({
    generateAndStore: jest.fn(),
    isProviderBusyError: jest.fn().mockReturnValue(false),
    getProviderAvailabilityStatus: jest.fn().mockReturnValue({
        status: 'available',
        cooldownUntil: null
    }),
    checkEmbeddingVersionMismatch: jest.fn().mockResolvedValue(false),
    EMBEDDING_FORMAT_VERSION: 2
}));

jest.mock('../services/embeddingRouter', () => ({
    getConfig: jest.fn().mockResolvedValue({ rag_enabled: true, embedding_format_version: 2 })
}));

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

describe('EmbeddingMigrationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        embeddingMigrationService.isRunning = false;
        embeddingMigrationService.progress = {
            total: 0,
            completed: 0,
            failed: 0,
            startedAt: null,
            estimatedCompletion: null
        };
        embeddingService.isProviderBusyError.mockReturnValue(false);
        embeddingService.getProviderAvailabilityStatus.mockReturnValue({
            status: 'available',
            cooldownUntil: null
        });
    });

    it('does not count progress when an item returns no stored embedding', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                classification_id: 42,
                title: 'No Store',
                media_type: 'movie',
                library_name: 'Movies',
                metadata: {}
            }]
        });
        embeddingService.generateAndStore.mockResolvedValueOnce(null);

        const result = await embeddingMigrationService.processBatch(10);

        expect(result).toEqual({ deferredReason: null });
        expect(embeddingMigrationService.progress.completed).toBe(0);
        expect(embeddingMigrationService.progress.failed).toBe(0);
    });

    it('yields the migration when the embedding provider is busy', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                classification_id: 43,
                title: 'Busy',
                media_type: 'movie',
                library_name: 'Movies',
                metadata: {}
            }]
        });
        embeddingService.generateAndStore.mockRejectedValueOnce(Object.assign(new Error('PROVIDER_BUSY'), {
            code: 'EMBEDDING_PROVIDER_BUSY',
            lockHolder: 'classification',
            waitMs: 1200,
            activeModel: 'gemma3:12b'
        }));
        embeddingService.isProviderBusyError.mockReturnValue(true);
        embeddingMigrationService.isRunning = true;

        const result = await embeddingMigrationService.processBatch(10);

        expect(result).toEqual({ deferredReason: 'provider_busy' });
        expect(embeddingMigrationService.isRunning).toBe(false);
        expect(embeddingMigrationService.progress.completed).toBe(0);
        expect(embeddingMigrationService.progress.failed).toBe(0);
    });

    it('stops the background loop after a deferred batch', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ total: '3' }]
        });
        jest.spyOn(embeddingMigrationService, 'processBatch')
            .mockResolvedValueOnce({ deferredReason: 'provider_busy' });

        await embeddingMigrationService.startBackgroundMigration();

        expect(embeddingMigrationService.processBatch).toHaveBeenCalledTimes(1);
        expect(embeddingMigrationService.progress.total).toBe(3);
        expect(embeddingMigrationService.isRunning).toBe(false);
    });
});

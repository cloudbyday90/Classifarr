/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

const mockDb = {
  query: jest.fn(),
  withSessionAdvisoryLock: jest.fn(),
  DB_ADVISORY_LOCKS: {
    EMBEDDING_PROVIDER_PROBE: 1005
  }
};

jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({
  ...mockDb,
  default: mockDb,
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));
jest.unstable_mockModule('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const { default: embeddingAvailabilityService } = await import('../services/embeddingAvailabilityService.mjs');
const db = mockDb;

describe('EmbeddingAvailabilityService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        embeddingAvailabilityService.cachedStatus = embeddingAvailabilityService.buildDefaultStatus();
        db.withSessionAdvisoryLock.mockImplementation(async (_lockKey, fn) => {
            await fn();
            return true;
        });
    });

    it('loads cooldown state from the database row', async () => {
        db.query
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    availability_status: 'cooldown',
                    failure_count: 3,
                    last_error: 'connect ETIMEDOUT',
                    last_failure_source: 'generateAndStore',
                    last_failure_at: '2026-03-27T22:00:00.000Z',
                    cooldown_until: new Date(Date.now() + 60000).toISOString(),
                    probe_started_at: null,
                    last_probe_at: null,
                    last_recovered_at: null,
                    updated_at: '2026-03-27T22:01:00.000Z'
                }]
            });

        const status = await embeddingAvailabilityService.getStatusFresh();

        expect(status.status).toBe('cooldown');
        expect(status.isOffline).toBe(true);
        expect(status.failureCount).toBe(3);
    });

    it('persists unavailable state with increasing cooldown', async () => {
        db.query
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    availability_status: 'available',
                    failure_count: 0,
                    last_error: null,
                    last_failure_source: null,
                    last_failure_at: null,
                    cooldown_until: null,
                    probe_started_at: null,
                    last_probe_at: null,
                    last_recovered_at: null,
                    updated_at: '2026-03-27T22:01:00.000Z'
                }]
            })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    availability_status: 'cooldown',
                    failure_count: 1,
                    last_error: 'connect ETIMEDOUT',
                    last_failure_source: 'generateAndStore',
                    last_failure_at: '2026-03-27T22:02:00.000Z',
                    cooldown_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                    probe_started_at: null,
                    last_probe_at: null,
                    last_recovered_at: null,
                    updated_at: '2026-03-27T22:02:00.000Z'
                }]
            });

        const status = await embeddingAvailabilityService.markUnavailable(new Error('connect ETIMEDOUT'), {
            source: 'generateAndStore'
        });

        expect(status.status).toBe('cooldown');
        expect(status.failureCount).toBe(1);
        expect(status.lastError).toBe('connect ETIMEDOUT');
    });

    it('marks the provider available after a successful recovery probe', async () => {
        db.query
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    availability_status: 'probe_due',
                    failure_count: 2,
                    last_error: 'connect ETIMEDOUT',
                    last_failure_source: 'probe',
                    last_failure_at: '2026-03-27T22:00:00.000Z',
                    cooldown_until: new Date(Date.now() - 60000).toISOString(),
                    probe_started_at: null,
                    last_probe_at: null,
                    last_recovered_at: null,
                    updated_at: '2026-03-27T22:01:00.000Z'
                }]
            })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    availability_status: 'probe_due',
                    failure_count: 2,
                    last_error: 'connect ETIMEDOUT',
                    last_failure_source: 'probe',
                    last_failure_at: '2026-03-27T22:00:00.000Z',
                    cooldown_until: new Date(Date.now() - 60000).toISOString(),
                    probe_started_at: null,
                    last_probe_at: null,
                    last_recovered_at: null,
                    updated_at: '2026-03-27T22:01:00.000Z'
                }]
            })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    availability_status: 'probing',
                    failure_count: 2,
                    last_error: 'connect ETIMEDOUT',
                    last_failure_source: 'probe',
                    last_failure_at: '2026-03-27T22:00:00.000Z',
                    cooldown_until: new Date(Date.now() - 60000).toISOString(),
                    probe_started_at: new Date().toISOString(),
                    last_probe_at: new Date().toISOString(),
                    last_recovered_at: null,
                    updated_at: new Date().toISOString()
                }]
            })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    availability_status: 'available',
                    failure_count: 0,
                    last_error: null,
                    last_failure_source: null,
                    last_failure_at: '2026-03-27T22:00:00.000Z',
                    cooldown_until: null,
                    probe_started_at: null,
                    last_probe_at: new Date().toISOString(),
                    last_recovered_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]
            });

        const recovered = await embeddingAvailabilityService.runRecoveryProbe(async () => ({
            success: true,
            provider: 'ollama',
            model: 'nomic-embed-text-v2-moe'
        }));

        expect(recovered).toBe(true);
        expect(embeddingAvailabilityService.getStatus().status).toBe('available');
    });
});

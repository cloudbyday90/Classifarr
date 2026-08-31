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
import { SchedulerRetentionService } from '../services/schedulerRetentionService.mjs';


describe('SchedulerRetentionService', () => {
    let db;
    let logger;
    let service;

    beforeEach(() => {
        restoreAllAndResetMocks();
        db = createMockDb();
        logger = createMockLogger();
        service = new SchedulerRetentionService({
            db,
            logger,
            webSearchProviderRetentionService: {
                cleanup: jest.fn().mockResolvedValue({ usageDeleted: 0, cacheDeleted: 0 }),
            },
            webSearchProviderRouteDecisionRetentionService: {
                cleanup: jest.fn().mockResolvedValue({
                    routeDecisionsDeleted: 0,
                    routeDecisionRetentionDays: 30,
                }),
            },
            webSearchProviderHealthRetentionService: {
                cleanup: jest.fn().mockResolvedValue({
                    healthEventsDeleted: 0,
                    healthEventRetentionDays: 30,
                }),
            },
            policyRollbackSnapshotRetentionService: {
                cleanup: jest.fn().mockResolvedValue({
                    redactedSnapshotCount: 0,
                    statusId: 'completed',
                }),
            },
            policyObservedEvidenceProvenanceRetentionService: {
                cleanup: jest.fn().mockResolvedValue({
                    redactedSnapshotCount: 0,
                    statusId: 'completed',
                }),
            },
            nativeIntentReconciliationLedgerRetentionService: {
                cleanup: jest.fn().mockResolvedValue({
                    outcomeDeletedCount: 0,
                    runDeletedCount: 0,
                    statusId: 'completed',
                }),
            },
            policyNativeIntentChangeReceiptRetentionService: {
                cleanup: jest.fn().mockResolvedValue({
                    deletedReceiptCount: 0,
                    statusId: 'completed',
                }),
            },
            policyCandidateCorrectionPolicyChangeOutcomeObservationRetentionService: {
                cleanup: jest.fn().mockResolvedValue({
                    deletedReviewHistoryCount: 0,
                    deletedDecisionRecordCount: 0,
                    deletedObservationCount: 0,
                    statusId: 'completed',
                }),
            },
        });
    });

    describe('runRefreshTokenCleanup', () => {
        it('deletes expired tokens', async () => {
            db.query.mockResolvedValue({ rowCount: 5 });

            await service.runRefreshTokenCleanup();

            expect(db.query).toHaveBeenCalledTimes(1);
            const [sql] = db.query.mock.calls[0];
            expect(sql).toMatch(/DELETE FROM refresh_tokens/);
            expect(sql).toMatch(/expires_at < NOW\(\)/);
            expect(logger.info).toHaveBeenCalledWith('Refresh token cleanup complete', { deleted: 5 });
        });

        it('skips when REFRESH_TOKEN_CLEANUP_ENABLED=false', async () => {
            const originalEnv = process.env.REFRESH_TOKEN_CLEANUP_ENABLED;
            process.env.REFRESH_TOKEN_CLEANUP_ENABLED = 'false';
            try {
                await service.runRefreshTokenCleanup();

                expect(db.query).not.toHaveBeenCalled();
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.REFRESH_TOKEN_CLEANUP_ENABLED;
                } else {
                    process.env.REFRESH_TOKEN_CLEANUP_ENABLED = originalEnv;
                }
            }
        });

        it('logs error and does not throw on DB failure', async () => {
            db.query.mockRejectedValue(new Error('DB connection failed'));

            await expect(service.runRefreshTokenCleanup()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'Refresh token cleanup failed',
                expect.objectContaining({ error: 'DB connection failed' })
            );
        });
    });

    describe('runApiKeyAuditPrune', () => {
        it('deletes rows older than retention window', async () => {
            db.query.mockResolvedValue({ rowCount: 12 });

            await service.runApiKeyAuditPrune();

            expect(db.query).toHaveBeenCalledTimes(1);
            const [sql] = db.query.mock.calls[0];
            expect(sql).toMatch(/DELETE FROM api_key_audit/);
            expect(logger.info).toHaveBeenCalledWith(
                'API key audit prune complete',
                expect.objectContaining({ deleted: 12, retentionDays: 90 })
            );
        });

        it('uses API_AUDIT_RETENTION_DAYS env var', async () => {
            const originalEnv = process.env.API_AUDIT_RETENTION_DAYS;
            process.env.API_AUDIT_RETENTION_DAYS = '30';
            db.query.mockResolvedValue({ rowCount: 3 });
            try {
                await service.runApiKeyAuditPrune();

                const [, params] = db.query.mock.calls[0];
                expect(params[0]).toBe(30);
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.API_AUDIT_RETENTION_DAYS;
                } else {
                    process.env.API_AUDIT_RETENTION_DAYS = originalEnv;
                }
            }
        });

        it('logs error and does not throw on DB failure', async () => {
            db.query.mockRejectedValue(new Error('DB connection failed'));

            await expect(service.runApiKeyAuditPrune()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'API key audit prune failed',
                expect.objectContaining({ error: 'DB connection failed' })
            );
        });
    });

    describe('runErrorLogCleanup', () => {
        it('uses settings.error_log_retention_days and deletes in batches', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ value: '14' }] })
                .mockResolvedValueOnce({ rowCount: 1000 })
                .mockResolvedValueOnce({ rowCount: 12 });

            await service.runErrorLogCleanup();

            expect(db.query).toHaveBeenCalledTimes(3);
            const [, deleteCallOneParams] = db.query.mock.calls[1];
            expect(deleteCallOneParams).toEqual([14, 1000]);
            expect(logger.info).toHaveBeenCalledWith(
                'Error log cleanup complete',
                expect.objectContaining({ deleted: 1012, retentionDays: 14 })
            );
        });

        it('falls back to 30 days when setting is missing or invalid', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ value: 'not-a-number' }] })
                .mockResolvedValueOnce({ rowCount: 0 });

            await service.runErrorLogCleanup();

            const [, deleteParams] = db.query.mock.calls[1];
            expect(deleteParams).toEqual([30, 1000]);
            expect(logger.debug).toHaveBeenCalledWith(
                'Error log cleanup: no rows to delete',
                expect.objectContaining({ retentionDays: 30 })
            );
        });

        it('logs error and does not throw on DB failure', async () => {
            db.query.mockRejectedValue(new Error('DB connection failed'));

            await expect(service.runErrorLogCleanup()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                'Error log cleanup failed',
                expect.objectContaining({ error: 'DB connection failed' })
            );
        });
    });

    describe('runWebSearchProviderRetentionCleanup', () => {
        it('delegates web-search provider retention cleanup to provider and route-decision services', async () => {
            await expect(service.runWebSearchProviderRetentionCleanup()).resolves.toEqual({
                usageDeleted: 0,
                cacheDeleted: 0,
                routeDecisionsDeleted: 0,
                routeDecisionRetentionDays: 30,
                healthEventsDeleted: 0,
                healthEventRetentionDays: 30,
            });

            expect(service.webSearchProviderRetentionService.cleanup).toHaveBeenCalledTimes(1);
            expect(service.webSearchProviderRouteDecisionRetentionService.cleanup).toHaveBeenCalledTimes(1);
            expect(service.webSearchProviderHealthRetentionService.cleanup).toHaveBeenCalledTimes(1);
        });
    });

    describe('runPolicyRollbackSnapshotRetentionCleanup', () => {
        it('delegates expired rollback snapshot cleanup to the retention service', async () => {
            const result = await service.runPolicyRollbackSnapshotRetentionCleanup();

            expect(result).toEqual({
                redactedSnapshotCount: 0,
                statusId: 'completed',
            });
            expect(service.policyRollbackSnapshotRetentionService.cleanup).toHaveBeenCalledTimes(1);
        });
    });

    describe('runPolicyObservedEvidenceProvenanceRetentionCleanup', () => {
        it('delegates expired observed evidence provenance redaction to the retention service', async () => {
            const result = await service.runPolicyObservedEvidenceProvenanceRetentionCleanup();

            expect(result).toEqual({
                redactedSnapshotCount: 0,
                statusId: 'completed',
            });
            expect(service.policyObservedEvidenceProvenanceRetentionService.cleanup)
                .toHaveBeenCalledTimes(1);
        });
    });

    describe('runNativeIntentReconciliationLedgerRetentionCleanup', () => {
        it('delegates bounded reconciliation ledger cleanup to its retention service', async () => {
            const result = await service.runNativeIntentReconciliationLedgerRetentionCleanup();

            expect(result).toEqual({
                outcomeDeletedCount: 0,
                runDeletedCount: 0,
                statusId: 'completed',
            });
            expect(service.nativeIntentReconciliationLedgerRetentionService.cleanup)
                .toHaveBeenCalledTimes(1);
        });
    });

    describe('runPolicyNativeIntentChangeReceiptRetentionCleanup', () => {
        it('delegates bounded native-intent change receipt cleanup to its retention service', async () => {
            const result = await service.runPolicyNativeIntentChangeReceiptRetentionCleanup();

            expect(result).toEqual({
                deletedReceiptCount: 0,
                statusId: 'completed',
            });
            expect(service.policyNativeIntentChangeReceiptRetentionService.cleanup)
                .toHaveBeenCalledTimes(1);
        });
    });

    describe('runPolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionCleanup', () => {
        it('delegates expired aggregate observation deletion to the retention service', async () => {
            const result = await service.runPolicyCandidateCorrectionPolicyChangeOutcomeObservationRetentionCleanup();

            expect(result).toEqual({
                deletedReviewHistoryCount: 0,
                deletedDecisionRecordCount: 0,
                deletedObservationCount: 0,
                statusId: 'completed',
            });
            expect(service.policyCandidateCorrectionPolicyChangeOutcomeObservationRetentionService.cleanup)
                .toHaveBeenCalledTimes(1);
        });
    });
});

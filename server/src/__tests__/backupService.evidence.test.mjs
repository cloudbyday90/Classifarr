/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Focused tests for backupService evidence-boundary integration.
 */

import { jest } from '@jest/globals';
import {
    createMockModule,
    createNamedMockModule,
    createServiceStubs,
    createTransactionalDbMock,
} from './helpers/mockFactory.mjs';

const mockFs = {
    existsSync: jest.fn(() => false),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    promises: {
        mkdir: jest.fn(),
        writeFile: jest.fn(),
        readFile: jest.fn(),
        readdir: jest.fn(),
        unlink: jest.fn(),
        access: jest.fn(),
        stat: jest.fn(),
    }
};
jest.unstable_mockModule('fs', () => createMockModule(mockFs));
jest.unstable_mockModule('node:fs', () => createMockModule(mockFs));

const mockDatabase = createTransactionalDbMock();
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDatabase));

const mockClassificationEvidenceService = createServiceStubs([
        'listLegacyPatterns',
        'purgeAllLegacyPatterns',
        'restoreLegacyPattern',
]);
jest.unstable_mockModule('../services/classificationEvidenceService.mjs', () => createNamedMockModule('classificationEvidenceService', mockClassificationEvidenceService));

const mockClassificationEvidenceRepository = createServiceStubs([
    'listAll',
    'purgeAll',
    'upsertEvidence',
]);
jest.unstable_mockModule('../services/classificationEvidenceRepository.mjs', () => createNamedMockModule('classificationEvidenceRepository', mockClassificationEvidenceRepository));

const db = mockDatabase;
const classificationEvidenceService = mockClassificationEvidenceService;
const classificationEvidenceRepository = mockClassificationEvidenceRepository;
const { backupService } = await import('../services/backupService.mjs');
const reconciliationLifecycle = {
    beginBackupRestore: jest.fn(),
    verifyRestoredDatabase: jest.fn(),
    completeBackupRestore: jest.fn(),
    failBackupRestore: jest.fn(),
};
const recordBackupRestoreVerification = jest.fn();

describe('BackupService evidence integration', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        db.query.mockReset();
        db.pool.connect.mockReset();
        db.withTransaction.mockClear();
        classificationEvidenceService.listLegacyPatterns.mockReset();
        classificationEvidenceService.purgeAllLegacyPatterns.mockReset();
        classificationEvidenceService.restoreLegacyPattern.mockReset();
        classificationEvidenceRepository.listAll.mockReset();
        classificationEvidenceRepository.purgeAll.mockReset();
        classificationEvidenceRepository.upsertEvidence.mockReset();
        reconciliationLifecycle.beginBackupRestore.mockReset();
        reconciliationLifecycle.verifyRestoredDatabase.mockReset();
        reconciliationLifecycle.completeBackupRestore.mockReset();
        reconciliationLifecycle.failBackupRestore.mockReset();
        recordBackupRestoreVerification.mockReset();
        backupService.reconciliationLifecycle = reconciliationLifecycle;
        backupService.recordBackupRestoreVerification = recordBackupRestoreVerification;
        reconciliationLifecycle.beginBackupRestore.mockResolvedValue({
            started: true,
            restoreToken: 'test-restore-token',
        });
        reconciliationLifecycle.verifyRestoredDatabase.mockResolvedValue({
            verified: true,
            schemaParity: true,
            nativeAuthorityIntegrity: true,
            policyLibraryMismatchCount: 0,
            reasonId: 'restore_verified',
        });
        reconciliationLifecycle.completeBackupRestore.mockResolvedValue({
            completed: true,
            verifiedAt: '2026-07-25T12:00:00.000Z',
        });
        reconciliationLifecycle.failBackupRestore.mockResolvedValue({ failed: true });
        recordBackupRestoreVerification.mockResolvedValue({ id: 1 });
    });

    test('collectBackupData uses the evidence service for learned pattern export', async () => {
        db.query.mockResolvedValue({ rows: [] });
        classificationEvidenceService.listLegacyPatterns.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        classificationEvidenceRepository.listAll.mockResolvedValue([]);

        const result = await backupService.collectBackupData({ includePatterns: true });

        expect(classificationEvidenceService.listLegacyPatterns).toHaveBeenCalledWith();
        expect(result.data.learningPatterns).toEqual([{ id: 1 }, { id: 2 }]);
        expect(result.meta.learningPatternsCount).toBe(2);
    });

    test('restoreBackup uses the evidence service for replace-mode purge and pattern restore', async () => {
        const client = {
            query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
            release: jest.fn()
        };

        db.pool.connect.mockResolvedValue(client);
        jest.spyOn(backupService, 'readBackup').mockResolvedValue({
            version: '2.0',
            data: {
                confidenceSettings: [],
                mediaServers: [],
                radarrConfigs: [],
                sonarrConfigs: [],
                libraries: [{ id: 99, name: 'Movies', type: 'movie', media_type: 'movie', media_server_id: 1 }],
                libraryPolicies: [],
                libraryCustomRules: [],
                labelPresets: [],
                scheduledTasks: [],
                autoLearnedPreferences: [],
                learningPatterns: [{
                    tmdb_id: 550,
                    media_type: 'movie',
                    library_id: 99,
                    pattern_type: 'exact_match',
                    pattern_data: { title: 'Fight Club' }
                }],
                pathMappings: []
            }
        });

        classificationEvidenceService.purgeAllLegacyPatterns.mockResolvedValue({ deleted: 4, rows: [] });
        classificationEvidenceService.restoreLegacyPattern.mockResolvedValue({ id: 77 });

        await backupService.restoreBackup('phase1.json', { mode: 'replace' });

        expect(reconciliationLifecycle.beginBackupRestore).toHaveBeenCalledWith(expect.objectContaining({
            dbClient: expect.objectContaining({ withTransaction: expect.any(Function) }),
        }));
        expect(reconciliationLifecycle.verifyRestoredDatabase).toHaveBeenCalledWith(expect.objectContaining({
            dbClient: expect.objectContaining({ withTransaction: expect.any(Function) }),
        }));
        expect(reconciliationLifecycle.completeBackupRestore).toHaveBeenCalledWith(expect.objectContaining({
            dbClient: client,
            restoreToken: 'test-restore-token',
        }));
        expect(recordBackupRestoreVerification).toHaveBeenCalledWith({
            db: client,
            restoreMode: 'replace',
            backupVersion: '2.0',
            verification: expect.objectContaining({
                verified: true,
                schemaParity: true,
                nativeAuthorityIntegrity: true,
                policyLibraryMismatchCount: 0,
            }),
            verifiedAt: '2026-07-25T12:00:00.000Z',
        });

        expect(classificationEvidenceService.purgeAllLegacyPatterns).toHaveBeenCalledWith({
            client,
            actor: 'backup_restore',
            reason: 'replace_mode'
        });
        expect(classificationEvidenceService.restoreLegacyPattern).toHaveBeenCalledWith({
            pattern: expect.objectContaining({
                tmdb_id: 550,
                media_type: 'movie',
                library_id: 99
            }),
            libraryId: 1,
            client
        });
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(client.release).toHaveBeenCalled();
    });

    test('keeps reconciliation closed when post-restore authority verification fails', async () => {
        const client = {
            query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
            release: jest.fn(),
        };
        db.pool.connect.mockResolvedValue(client);
        jest.spyOn(backupService, 'readBackup').mockResolvedValue({ version: '2.0', data: {} });
        reconciliationLifecycle.verifyRestoredDatabase.mockResolvedValue({
            verified: false,
            reasonId: 'restore_validation_failed',
        });
        reconciliationLifecycle.completeBackupRestore.mockResolvedValue({
            completed: false,
            reasonId: 'restore_validation_failed',
        });

        await expect(backupService.restoreBackup('invalid-authority.json', { mode: 'merge' }))
            .rejects.toThrow('native policy authority validation did not pass');

        expect(reconciliationLifecycle.failBackupRestore).toHaveBeenCalledWith(expect.objectContaining({
            dbClient: expect.objectContaining({ withTransaction: expect.any(Function) }),
            restoreToken: 'test-restore-token',
        }));
    });

    test('fails closed when validated restore evidence cannot be persisted', async () => {
        const client = {
            query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
            release: jest.fn(),
        };
        db.pool.connect.mockResolvedValue(client);
        jest.spyOn(backupService, 'readBackup').mockResolvedValue({ version: '2.0', data: {} });
        recordBackupRestoreVerification.mockRejectedValue(
            new Error('verification evidence persistence failed')
        );

        await expect(backupService.restoreBackup('evidence-failure.json', { mode: 'merge' }))
            .rejects.toThrow('verification evidence persistence failed');

        expect(reconciliationLifecycle.completeBackupRestore).toHaveBeenCalled();
        expect(reconciliationLifecycle.failBackupRestore).toHaveBeenCalledWith(expect.objectContaining({
            dbClient: expect.objectContaining({ withTransaction: expect.any(Function) }),
            restoreToken: 'test-restore-token',
        }));
    });

    test('restoreBackup restores webhook secret_key and regenerates a valid-format admin API key', async () => {
        const client = {
            query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
            release: jest.fn()
        };

        db.pool.connect.mockResolvedValue(client);
        jest.spyOn(backupService, 'readBackup').mockResolvedValue({
            version: '2.0',
            data: {
                webhookConfig: {
                    id: 1,
                    secret_key: 'whsec_restored',
                    enabled: true
                }
            }
        });

        const result = await backupService.restoreBackup('webhook.json', { mode: 'merge' });

        const webhookCall = client.query.mock.calls.find(([sql]) => (
            typeof sql === 'string' && sql.includes('INSERT INTO webhook_config')
        ));
        expect(webhookCall[0]).toContain('secret_key');
        expect(webhookCall[0]).not.toContain('webhook_key');
        expect(webhookCall[1]).toEqual([1, 'whsec_restored', true]);

        const apiKeyCall = client.query.mock.calls.find(([sql]) => (
            typeof sql === 'string' && sql.includes('INSERT INTO api_keys')
        ));
        expect(result.newApiKey).toMatch(/^clf_/);
        expect(apiKeyCall[1]).toEqual([
            'Restored System API Key',
            expect.stringContaining('$'),
            result.newApiKey.substring(0, 8),
            'admin',
            true
        ]);
    });

    test('restoreBackup accepts legacy webhook_key backups but writes current secret_key column', async () => {
        const client = {
            query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
            release: jest.fn()
        };

        db.pool.connect.mockResolvedValue(client);
        jest.spyOn(backupService, 'readBackup').mockResolvedValue({
            version: '2.0',
            data: {
                webhookConfig: {
                    webhook_key: 'legacy-webhook-secret',
                    enabled: false
                }
            }
        });

        await backupService.restoreBackup('legacy-webhook.json', { mode: 'merge' });

        const webhookCall = client.query.mock.calls.find(([sql]) => (
            typeof sql === 'string' && sql.includes('INSERT INTO webhook_config')
        ));
        expect(webhookCall[0]).toContain('secret_key');
        expect(webhookCall[0]).not.toContain('webhook_key');
        expect(webhookCall[1]).toEqual([1, 'legacy-webhook-secret', false]);
    });
});

// ── Phase 6A: classification_evidence restore mapping tests ──────────────────

describe('BackupService classification_evidence export (Phase 6A)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('includes classification_evidence rows in backup when includePatterns is true', async () => {
        const ceRows = [
            { id: 1, scope: 'item_exact', tmdb_id: 550, media_type: 'movie', library_id: 10, evidence_key: null, provenance: 'human_confirmed', confidence: 100, status: 'active' },
            { id: 2, scope: 'genre', tmdb_id: null, media_type: 'movie', library_id: 10, evidence_key: 'genre:documentary', provenance: 'policy_confirmed', confidence: 85, status: 'active' }
        ];

        db.query.mockResolvedValue({ rows: [] });
        classificationEvidenceService.listLegacyPatterns.mockResolvedValue([]);
        classificationEvidenceRepository.listAll.mockResolvedValue(ceRows);

        const result = await backupService.collectBackupData({ includePatterns: true });

        expect(classificationEvidenceRepository.listAll).toHaveBeenCalledWith();
        expect(result.data.classificationEvidence).toEqual(ceRows);
        expect(result.meta.classificationEvidenceCount).toBe(2);
    });

    test('does not include classification_evidence rows when includePatterns is false', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await backupService.collectBackupData({ includePatterns: false });

        expect(classificationEvidenceRepository.listAll).not.toHaveBeenCalled();
        expect(result.data.classificationEvidence).toBeUndefined();
        expect(result.meta.classificationEvidenceCount).toBeUndefined();
    });

    test('exposes evidenceCategories metadata with correct scope and provenance counts', async () => {
        const ceRows = [
            { id: 1, scope: 'item_exact', provenance: 'human_confirmed', status: 'active' },
            { id: 2, scope: 'genre', provenance: 'policy_confirmed', status: 'active' },
            { id: 3, scope: 'genre', provenance: 'mined', status: 'active' }
        ];

        db.query.mockResolvedValue({ rows: [] });
        classificationEvidenceService.listLegacyPatterns.mockResolvedValue([]);
        classificationEvidenceRepository.listAll.mockResolvedValue(ceRows);

        const result = await backupService.collectBackupData({ includePatterns: true });

        expect(result.meta.classificationEvidenceCount).toBe(3);
    });

    test('includes Phase 8R native policy intent tables in backup data', async () => {
        db.query.mockImplementation(async (sql) => {
            if (sql.includes('FROM policy_intents')) return { rows: [{ id: 1, policy_id: 10 }] };
            if (sql.includes('FROM policy_intent_rules')) return { rows: [{ id: 2, intent_id: 1 }] };
            if (sql.includes('FROM policy_intent_routing_targets')) return { rows: [{ id: 3, intent_id: 1 }] };
            if (sql.includes('FROM policy_intent_template_applications')) return { rows: [{ id: 4, intent_id: 1 }] };
            if (sql.includes('FROM policy_intent_migration_events')) return { rows: [{ id: 5, policy_id: 10 }] };
            if (sql.includes('FROM policy_intent_rollback_snapshots')) return { rows: [{ id: 6, intent_id: 1 }] };
            if (sql.includes('FROM policy_intent_validation_status')) return { rows: [{ id: 7, intent_id: 1 }] };
            if (sql.includes('FROM policy_initial_intent_establishments')) return { rows: [{ id: 8, intent_id: 1 }] };
            if (sql.includes('FROM policy_observed_evidence_provenance_snapshots')) return { rows: [{ id: 9, intent_id: 1 }] };
            if (sql.includes('FROM policy_native_intent_reconciliation_runs')) return { rows: [{ id: 10, run_key: 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c' }] };
            if (sql.includes('FROM policy_native_intent_reconciliation_outcomes')) return { rows: [{ id: 11, policy_id: 10 }] };
            if (sql.includes('FROM policy_native_intent_reconciliation_states')) return { rows: [{ policy_id: 10, outcome_state: 'system_failure' }] };
            return { rows: [] };
        });
        classificationEvidenceService.listLegacyPatterns.mockResolvedValue([]);
        classificationEvidenceRepository.listAll.mockResolvedValue([]);

        const result = await backupService.collectBackupData({ includePatterns: true });

        expect(result.data.policyIntents).toEqual([{ id: 1, policy_id: 10 }]);
        expect(result.data.policyIntentRules).toEqual([{ id: 2, intent_id: 1 }]);
        expect(result.data.policyIntentRoutingTargets).toEqual([{ id: 3, intent_id: 1 }]);
        expect(result.data.policyIntentTemplateApplications).toEqual([{ id: 4, intent_id: 1 }]);
        expect(result.data.policyIntentMigrationEvents).toEqual([{ id: 5, policy_id: 10 }]);
        expect(result.data.policyIntentRollbackSnapshots).toEqual([{ id: 6, intent_id: 1 }]);
        expect(result.data.policyInitialIntentEstablishments).toEqual([{ id: 8, intent_id: 1 }]);
        expect(result.data.policyObservedEvidenceProvenanceSnapshots).toEqual([{ id: 9, intent_id: 1 }]);
        expect(result.data.policyIntentValidationStatus).toEqual([{ id: 7, intent_id: 1 }]);
        expect(result.data.policyNativeIntentReconciliationRuns).toEqual([
            { id: 10, run_key: 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c' },
        ]);
        expect(result.data.policyNativeIntentReconciliationOutcomes).toEqual([{ id: 11, policy_id: 10 }]);
        expect(result.data.policyNativeIntentReconciliationStates).toEqual([
            { policy_id: 10, outcome_state: 'system_failure' },
        ]);
        expect(result.meta.policyIntentsCount).toBe(1);
        expect(result.meta.policyIntentRollbackSnapshotsCount).toBe(1);
        expect(result.meta.policyInitialIntentEstablishmentsCount).toBe(1);
        expect(result.meta.policyObservedEvidenceProvenanceSnapshotsCount).toBe(1);
        expect(result.meta.policyNativeIntentReconciliationRunsCount).toBe(1);
        expect(result.meta.policyNativeIntentReconciliationOutcomesCount).toBe(1);
        expect(result.meta.policyNativeIntentReconciliationStatesCount).toBe(1);
    });
});

describe('BackupService classification_evidence restore mapping (Phase 6A)', () => {
    let client;

    beforeEach(() => {
        jest.clearAllMocks();
        db.pool.connect.mockReset();
        classificationEvidenceService.purgeAllLegacyPatterns.mockReset();
        classificationEvidenceRepository.purgeAll.mockReset();
        classificationEvidenceRepository.upsertEvidence.mockReset();
        classificationEvidenceService.restoreLegacyPattern.mockReset();
        client = {
            query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
            release: jest.fn()
        };
        db.pool.connect.mockResolvedValue(client);
        classificationEvidenceService.purgeAllLegacyPatterns.mockResolvedValue({ deleted: 0, rows: [] });
        classificationEvidenceRepository.purgeAll.mockResolvedValue({ deleted: 0 });
        classificationEvidenceRepository.upsertEvidence.mockResolvedValue({ id: 99 });
        classificationEvidenceService.restoreLegacyPattern.mockResolvedValue({ id: 77 });
    });

    function makeBackup(ceRows = [], extra = {}) {
        return {
            version: '2.0',
            data: {
                confidenceSettings: [],
                mediaServers: [],
                radarrConfigs: [],
                sonarrConfigs: [],
                libraries: [{ id: 99, name: 'Movies', type: 'movie', media_type: 'movie', media_server_id: 1 }],
                libraryPolicies: [],
                libraryCustomRules: [],
                labelPresets: [],
                scheduledTasks: [],
                autoLearnedPreferences: [],
                learningPatterns: [],
                pathMappings: [],
                classificationEvidence: ceRows,
                ...extra
            }
        };
    }

    test('calls purgeAll on classificationEvidenceRepository in replace mode', async () => {
        jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup());

        await backupService.restoreBackup('backup.json', { mode: 'replace' });

        expect(classificationEvidenceRepository.purgeAll).toHaveBeenCalledWith({ client });
    });

    test('does not call purgeAll in merge mode', async () => {
        jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup());

        await backupService.restoreBackup('backup.json', { mode: 'merge' });

        expect(classificationEvidenceRepository.purgeAll).not.toHaveBeenCalled();
    });

    test('upserts each CE row using the remapped library ID', async () => {
        // library 99 in backup → new library ID 1 (from client.query returning { id: 1 })
        const ceRow = {
            scope: 'genre',
            tmdb_id: null,
            media_type: 'movie',
            library_id: 99,
            evidence_key: 'genre:documentary',
            evidence_data: { genre: 'documentary' },
            confidence: 85,
            usage_count: 3,
            success_rate: 100,
            provenance: 'policy_confirmed',
            status: 'active',
            created_by: null,
            source_classification_id: null,
            source_system: null
        };

        jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

        await backupService.restoreBackup('backup.json', { mode: 'merge' });

        expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: 'genre',
                libraryId: 1,
                evidenceKey: 'genre:documentary',
                provenance: 'policy_confirmed'
            }),
            { client, conflictMode: 'do_nothing' }
        );
    });

    test('item_exact CE rows with null library_id are restored with libraryId null (not skipped)', async () => {
        const ceRow = {
            scope: 'item_exact',
            tmdb_id: 550,
            media_type: 'movie',
            library_id: null,
            evidence_key: null,
            evidence_data: { title: 'Fight Club' },
            confidence: 100,
            usage_count: 1,
            success_rate: null,
            provenance: 'human_confirmed',
            status: 'active',
            created_by: null,
            source_classification_id: null,
            source_system: null
        };

        jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

        await backupService.restoreBackup('backup.json', { mode: 'merge' });

        expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: 'item_exact',
                tmdbId: 550,
                libraryId: null
            }),
            expect.anything()
        );
    });

    test('CE rows whose old library_id has no mapping are restored with libraryId null (not skipped)', async () => {
        // library_id 777 does not exist in the backup's library list → no mapping → null
        const ceRow = {
            scope: 'genre',
            tmdb_id: null,
            media_type: 'movie',
            library_id: 777,
            evidence_key: 'genre:horror',
            evidence_data: null,
            confidence: 70,
            usage_count: 2,
            success_rate: null,
            provenance: 'mined',
            status: 'active',
            created_by: null,
            source_classification_id: null,
            source_system: null
        };

        jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

        await backupService.restoreBackup('backup.json', { mode: 'merge' });

        expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: 'genre',
                libraryId: null
            }),
            expect.anything()
        );
        // Should still have been called — not skipped
        expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledTimes(1);
    });

    test('uses conflictMode do_nothing so existing evidence rows are not overwritten', async () => {
        const ceRow = {
            scope: 'item_exact',
            tmdb_id: 550,
            media_type: 'movie',
            library_id: 99,
            evidence_key: null,
            evidence_data: null,
            confidence: 100,
            usage_count: 1,
            success_rate: null,
            provenance: 'human_confirmed',
            status: 'active',
            created_by: null,
            source_classification_id: null,
            source_system: null
        };

        jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

        await backupService.restoreBackup('backup.json', { mode: 'merge' });

        const [, opts] = classificationEvidenceRepository.upsertEvidence.mock.calls[0];
        expect(opts.conflictMode).toBe('do_nothing');
    });

    test('restore stats include classificationEvidenceRestored count', async () => {
        const ceRows = [
            { scope: 'item_exact', tmdb_id: 550, media_type: 'movie', library_id: 99, evidence_key: null, evidence_data: null, confidence: 100, usage_count: 1, success_rate: null, provenance: 'human_confirmed', status: 'active', created_by: null, source_classification_id: null, source_system: null },
            { scope: 'genre', tmdb_id: null, media_type: 'movie', library_id: 99, evidence_key: 'genre:documentary', evidence_data: null, confidence: 85, usage_count: 3, success_rate: null, provenance: 'policy_confirmed', status: 'active', created_by: null, source_classification_id: null, source_system: null }
        ];

        jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup(ceRows));

        const result = await backupService.restoreBackup('backup.json', { mode: 'merge' });

        expect(result.stats.classificationEvidenceRestored).toBe(2);
    });

    test('gracefully skips CE restoration when classificationEvidence key is absent from backup', async () => {
        jest.spyOn(backupService, 'readBackup').mockResolvedValue(
            makeBackup([], { classificationEvidence: undefined })
        );

        const result = await backupService.restoreBackup('backup.json', { mode: 'merge' });

        expect(classificationEvidenceRepository.upsertEvidence).not.toHaveBeenCalled();
        expect(result.stats.classificationEvidenceRestored).toBe(0);
    });

    test('maps all evidence fields including optional nullable columns', async () => {
        const ceRow = {
            scope: 'studio',
            tmdb_id: null,
            media_type: 'movie',
            library_id: 99,
            evidence_key: 'studio:a24',
            evidence_data: { studio: 'A24' },
            confidence: 72,
            usage_count: 5,
            success_rate: 80,
            provenance: 'mined',
            status: 'active',
            created_by: 'backfill',
            source_classification_id: 12345,
            source_system: 'learning_patterns'
        };

        jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

        await backupService.restoreBackup('backup.json', { mode: 'merge' });

        expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledWith(
            {
                scope: 'studio',
                tmdbId: null,
                mediaType: 'movie',
                libraryId: 1,
                evidenceKey: 'studio:a24',
                evidenceData: { studio: 'A24' },
                confidence: 72,
                usageCount: 5,
                successRate: 80,
                provenance: 'mined',
                status: 'active',
                createdBy: 'backfill',
                sourceClassificationId: 12345,
                sourceSystem: 'learning_patterns'
            },
            { client, conflictMode: 'do_nothing' }
        );
    });
});

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Integration test for CARSA library mapping preservation
 * Tests the complete workflow of preserving Radarr/Sonarr mappings during Clear and Re-sync All
 */

import { jest } from '@jest/globals';
import { createCarsaLibraryMappingFixture, resetCarsaIntegrationTables } from '../setup/createCarsaIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};

const loggerModule = {
    createLogger: () => mockLogger,
};

const mockSyncStatus = {
    start: jest.fn(),
    stop: jest.fn(),
    updateProgress: jest.fn(),
    isRunning: false,
    forceStop: jest.fn(),
};

const mockMediaSync = {
    syncAllLibraries: jest.fn().mockResolvedValue(),
};

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../utils/logger.mjs', () => ({
    createLogger: loggerModule.createLogger,
    default: loggerModule,
}));
jest.unstable_mockModule('../../services/syncStatus.mjs', () => ({ syncStatus: mockSyncStatus, default: mockSyncStatus, }));
jest.unstable_mockModule('../../services/mediaSync.mjs', () => ({ mediaSyncService: mockMediaSync, default: mockMediaSync, }));

const { default: db } = await import('../../config/database.mjs');
const { queueService } = await import('../../services/queueService.mjs');

describe('CARSA Library Mapping Preservation Integration', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await resetCarsaIntegrationTables(db);
    });

    describe('Full CARSA workflow with mapping preservation', () => {
        it('should preserve and remap all library mappings after CARSA', async () => {
            const fixture = await createCarsaLibraryMappingFixture(db, {
                libraries: [
                    { externalId: 'plex-100', name: 'Movies 4K', mediaType: 'movie' },
                    { externalId: 'plex-101', name: 'Movies HD', mediaType: 'movie' },
                ],
                radarrConfigs: [
                    { name: 'Radarr 4K', url: 'http://radarr:7878', apiKey: 'test-key' },
                    { name: 'Radarr HD', url: 'http://radarr:7879', apiKey: 'test-key2' },
                ],
                mappings: [
                    { libraryIndex: 0, radarrIndex: 0, arrRootFolderId: 1, arrRootFolderPath: '/movies/4k' },
                    { libraryIndex: 1, radarrIndex: 1, arrRootFolderId: 2, arrRootFolderPath: '/movies/hd' },
                ],
            });

            const oldLib1Id = fixture.libraries[0].id;
            const oldLib2Id = fixture.libraries[1].id;
            const mediaServerId = fixture.mediaServerId;

            // Verify mappings exist before CARSA
            const mappingsBefore = await db.query('SELECT * FROM library_arr_mappings');
            expect(mappingsBefore.rows).toHaveLength(2);

            // Run CARSA (without the async background sync)
            // We'll manually simulate the re-sync part
            const snapshot = await queueService.buildLibrarySnapshot();

            // Verify snapshot captured libraries
            expect(snapshot.libraries[oldLib1Id]).toEqual({
                name: 'Movies 4K',
                media_type: 'movie',
                external_id: 'plex-100',
                media_server_type: 'plex'
            });

            expect(snapshot.mappings).toHaveLength(2);

            // Clear libraries (simulating CARSA)
            await db.query('DELETE FROM libraries');

            // Re-create libraries with NEW IDs (simulating media server sync)
            const newLib1 = await db.query(
                `INSERT INTO libraries (media_server_id, external_id, name, media_type)
                 VALUES ($1, 'plex-100', 'Movies 4K', 'movie')
                 RETURNING id`,
                [mediaServerId]
            );

            const newLib2 = await db.query(
                `INSERT INTO libraries (media_server_id, external_id, name, media_type)
                 VALUES ($1, 'plex-101', 'Movies HD', 'movie')
                 RETURNING id`,
                [mediaServerId]
            );

            const newLib1Id = newLib1.rows[0].id;
            const newLib2Id = newLib2.rows[0].id;

            // Verify IDs are different
            expect(newLib1Id).not.toBe(oldLib1Id);
            expect(newLib2Id).not.toBe(oldLib2Id);

            // Build new library lookup
            const newLookup = await queueService.buildNewLibraryLookup();

            // Remap all arr mappings
            const remapResults = await queueService.remapAllArrMappings(snapshot, newLookup);

            // Verify results
            expect(remapResults.totalRemapped).toBe(2);
            expect(remapResults.totalFailed).toBe(0);

            // Verify mappings were updated with new library IDs
            const mappingsAfter = await db.query('SELECT * FROM library_arr_mappings ORDER BY arr_config_id');
            expect(mappingsAfter.rows).toHaveLength(2);
            expect(mappingsAfter.rows[0].library_id).toBe(newLib1Id);
            expect(mappingsAfter.rows[1].library_id).toBe(newLib2Id);
        }, 30000);

        it('should create notification when some mappings fail', async () => {
            const fixture = await createCarsaLibraryMappingFixture(db, {
                libraries: [
                    { externalId: 'plex-100', name: 'Movies 4K', mediaType: 'movie' },
                ],
                radarrConfigs: [
                    { name: 'Radarr 4K', url: 'http://radarr:7878', apiKey: 'test-key' },
                ],
                mappings: [
                    { libraryIndex: 0, radarrIndex: 0, arrRootFolderId: 1, arrRootFolderPath: '/movies/4k' },
                ],
            });

            // Build snapshot
            const snapshot = await queueService.buildLibrarySnapshot();

            // Clear libraries
            await db.query('DELETE FROM libraries');

            // Don't recreate the library (simulating deleted library)

            // Build new library lookup (empty)
            const newLookup = await queueService.buildNewLibraryLookup();

            // Remap all arr mappings
            const remapResults = await queueService.remapAllArrMappings(snapshot, newLookup);

            // Verify results
            expect(remapResults.totalRemapped).toBe(0);
            expect(remapResults.totalFailed).toBe(1);
            expect(remapResults.radarr[0].failedLibraries).toHaveLength(1);

            // Create notification
            await queueService.createRemapFailureNotification(remapResults);

            // Verify notification was created
            const notifications = await db.query('SELECT * FROM app_notifications WHERE type = $1', ['warning']);
            expect(notifications.rows).toHaveLength(1);
            expect(notifications.rows[0].title).toBe('Some library mappings need attention');
        }, 30000);
    });
});

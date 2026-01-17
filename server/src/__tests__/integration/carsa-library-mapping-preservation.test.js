/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Integration test for CARSA library mapping preservation
 * Tests the complete workflow of preserving Radarr/Sonarr mappings during Clear and Re-sync All
 */

const db = require('../../config/database');
const queueService = require('../../services/queueService');

jest.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('../../services/syncStatus', () => ({
    start: jest.fn(),
    stop: jest.fn(),
    updateProgress: jest.fn(),
    isRunning: false,
    forceStop: jest.fn()
}));

jest.mock('../../services/mediaSync', () => ({
    syncAllLibraries: jest.fn().mockResolvedValue()
}));

jest.mock('../../services/scheduler', () => ({
    runGapAnalysis: jest.fn().mockResolvedValue({})
}));

describe('CARSA Library Mapping Preservation Integration', () => {
    beforeEach(async () => {
        // Clear all tables
        await db.query('DELETE FROM library_arr_mappings');
        await db.query('DELETE FROM libraries');
        await db.query('DELETE FROM media_server');
        await db.query('DELETE FROM radarr_config');
        await db.query('DELETE FROM sonarr_config');
        await db.query('DELETE FROM app_notifications');
    });

    describe('Full CARSA workflow with mapping preservation', () => {
        it('should preserve and remap all library mappings after CARSA', async () => {
            // Setup: Create media server
            const mediaServerResult = await db.query(
                `INSERT INTO media_server (type, name, url, api_key, is_active)
                 VALUES ('plex', 'Test Plex', 'http://plex:32400', 'test-key', true)
                 RETURNING id`
            );
            const mediaServerId = mediaServerResult.rows[0].id;

            // Setup: Create libraries with external_ids
            const lib1 = await db.query(
                `INSERT INTO libraries (media_server_id, external_id, name, media_type)
                 VALUES ($1, 'plex-100', 'Movies 4K', 'movie')
                 RETURNING id`,
                [mediaServerId]
            );

            const lib2 = await db.query(
                `INSERT INTO libraries (media_server_id, external_id, name, media_type)
                 VALUES ($1, 'plex-101', 'Movies HD', 'movie')
                 RETURNING id`,
                [mediaServerId]
            );

            const oldLib1Id = lib1.rows[0].id;
            const oldLib2Id = lib2.rows[0].id;

            // Setup: Create Radarr configs
            const radarr1 = await db.query(
                `INSERT INTO radarr_config (name, url, api_key)
                 VALUES ('Radarr 4K', 'http://radarr:7878', 'test-key')
                 RETURNING id`
            );

            const radarr2 = await db.query(
                `INSERT INTO radarr_config (name, url, api_key)
                 VALUES ('Radarr HD', 'http://radarr:7879', 'test-key2')
                 RETURNING id`
            );

            const radarr1Id = radarr1.rows[0].id;
            const radarr2Id = radarr2.rows[0].id;

            // Setup: Create library mappings
            await db.query(
                `INSERT INTO library_arr_mappings (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path)
                 VALUES ($1, 'radarr', $2, 1, '/movies/4k')`,
                [oldLib1Id, radarr1Id]
            );

            await db.query(
                `INSERT INTO library_arr_mappings (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path)
                 VALUES ($1, 'radarr', $2, 2, '/movies/hd')`,
                [oldLib2Id, radarr2Id]
            );

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
            // Setup: Create media server
            const mediaServerResult = await db.query(
                `INSERT INTO media_server (type, name, url, api_key, is_active)
                 VALUES ('plex', 'Test Plex', 'http://plex:32400', 'test-key', true)
                 RETURNING id`
            );
            const mediaServerId = mediaServerResult.rows[0].id;

            // Setup: Create a library
            const lib1 = await db.query(
                `INSERT INTO libraries (media_server_id, external_id, name, media_type)
                 VALUES ($1, 'plex-100', 'Movies 4K', 'movie')
                 RETURNING id`,
                [mediaServerId]
            );
            const oldLib1Id = lib1.rows[0].id;

            // Setup: Create Radarr config
            const radarr1 = await db.query(
                `INSERT INTO radarr_config (name, url, api_key)
                 VALUES ('Radarr 4K', 'http://radarr:7878', 'test-key')
                 RETURNING id`
            );
            const radarr1Id = radarr1.rows[0].id;

            // Setup: Create mapping to library that will be "deleted" (not recreated)
            await db.query(
                `INSERT INTO library_arr_mappings (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path)
                 VALUES ($1, 'radarr', $2, 1, '/movies/4k')`,
                [oldLib1Id, radarr1Id]
            );

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

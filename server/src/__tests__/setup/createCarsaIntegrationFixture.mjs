export async function resetCarsaIntegrationTables(db) {
    await db.query('DELETE FROM library_arr_mappings');
    await db.query('DELETE FROM libraries');
    await db.query('DELETE FROM media_server');
    await db.query('DELETE FROM radarr_config');
    await db.query('DELETE FROM sonarr_config');
    await db.query('DELETE FROM app_notifications');
}

export async function createCarsaLibraryMappingFixture(db, options = {}) {
    const {
        mediaServer = {
            type: 'plex',
            name: 'Test Plex',
            url: 'http://plex:32400',
            apiKey: 'test-key',
            isActive: true,
        },
        libraries = [],
        radarrConfigs = [],
        mappings = [],
    } = options;

    const mediaServerResult = await db.query(
        `INSERT INTO media_server (type, name, url, api_key, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [mediaServer.type, mediaServer.name, mediaServer.url, mediaServer.apiKey, mediaServer.isActive]
    );
    const mediaServerId = mediaServerResult.rows[0].id;

    const createdLibraries = [];
    for (const library of libraries) {
        const result = await db.query(
            `INSERT INTO libraries (media_server_id, external_id, name, media_type)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [mediaServerId, library.externalId, library.name, library.mediaType]
        );

        createdLibraries.push({
            id: result.rows[0].id,
            externalId: library.externalId,
            name: library.name,
            mediaType: library.mediaType,
        });
    }

    const createdRadarrConfigs = [];
    for (const config of radarrConfigs) {
        const result = await db.query(
            `INSERT INTO radarr_config (name, url, api_key)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [config.name, config.url, config.apiKey]
        );

        createdRadarrConfigs.push({
            id: result.rows[0].id,
            name: config.name,
            url: config.url,
        });
    }

    for (const mapping of mappings) {
        const libraryId = mapping.libraryId ?? createdLibraries[mapping.libraryIndex]?.id;
        const arrConfigId = mapping.arrConfigId ?? createdRadarrConfigs[mapping.radarrIndex]?.id;

        await db.query(
            `INSERT INTO library_arr_mappings (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path)
             VALUES ($1, $2, $3, $4, $5)`,
            [libraryId, mapping.arrType ?? 'radarr', arrConfigId, mapping.arrRootFolderId, mapping.arrRootFolderPath]
        );
    }

    return {
        mediaServerId,
        libraries: createdLibraries,
        radarrConfigs: createdRadarrConfigs,
    };
}

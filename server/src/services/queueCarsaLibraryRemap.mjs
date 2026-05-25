/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { withServiceCatch } from '../utils/serviceCatch.mjs';

export async function buildLibrarySnapshot(db, logger) {
    return withServiceCatch(logger, 'Failed to build library snapshot', async () => {
        const librariesResult = await db.query(`
            SELECT
                l.id,
                l.name,
                l.media_type,
                l.external_id,
                ms.type as media_server_type
            FROM libraries l
            LEFT JOIN media_server ms ON l.media_server_id = ms.id
        `);

        const mappingsResult = await db.query(`
            SELECT * FROM library_arr_mappings
        `);

        const snapshot = {
            libraries: {},
            mappings: mappingsResult.rows
        };

        for (const lib of librariesResult.rows) {
            snapshot.libraries[lib.id] = {
                name: lib.name,
                media_type: lib.media_type,
                external_id: lib.external_id,
                media_server_type: lib.media_server_type
            };
        }

        logger.info('Built library snapshot', {
            libraryCount: Object.keys(snapshot.libraries).length,
            mappingCount: snapshot.mappings.length
        });
        return snapshot;
    });
}

export async function buildNewLibraryLookup(db, logger) {
    return withServiceCatch(logger, 'Failed to build library lookup', async () => {
        const result = await db.query(`
            SELECT
                l.id,
                l.name,
                l.media_type,
                l.external_id,
                ms.type as media_server_type
            FROM libraries l
            LEFT JOIN media_server ms ON l.media_server_id = ms.id
        `);

        const lookup = {
            byExternalId: {},
            byNameType: {}
        };

        for (const lib of result.rows) {
            if (lib.external_id && lib.media_server_type) {
                const key = `${lib.media_server_type}:${lib.external_id}`;
                lookup.byExternalId[key] = lib.id;
            }

            const nameKey = `${lib.name.toLowerCase()}|${lib.media_type}`;
            lookup.byNameType[nameKey] = lib.id;
        }

        logger.info('Built new library lookup', {
            byExternalId: Object.keys(lookup.byExternalId).length,
            byNameType: Object.keys(lookup.byNameType).length
        });

        return lookup;
    });
}

export function findNewLibraryId(oldLibInfo, newLookup) {
    if (oldLibInfo.external_id && oldLibInfo.media_server_type) {
        const key = `${oldLibInfo.media_server_type}:${oldLibInfo.external_id}`;
        if (newLookup.byExternalId[key]) {
            return newLookup.byExternalId[key];
        }
    }

    const nameKey = `${oldLibInfo.name.toLowerCase()}|${oldLibInfo.media_type}`;
    if (newLookup.byNameType[nameKey]) {
        return newLookup.byNameType[nameKey];
    }

    return null;
}

export async function remapInstanceMappings(db, logger, type, config, snapshot, newLookup) {
    const result = {
        remapped: 0,
        failed: 0,
        failedLibraries: []
    };

    return withServiceCatch(logger, 'Failed to remap instance mappings', { type, configId: config.id }, async () => {
        const instanceMappings = snapshot.mappings.filter(
            m => m.arr_type === type && m.arr_config_id === config.id
        );

        if (instanceMappings.length === 0) {
            logger.debug('No mappings found in snapshot for instance', {
                type,
                configId: config.id
            });
            return result;
        }

        for (const mapping of instanceMappings) {
            const oldLibInfo = snapshot.libraries[mapping.library_id];

            if (!oldLibInfo) {
                result.failed++;
                result.failedLibraries.push({
                    oldId: mapping.library_id,
                    reason: 'Library not found in snapshot'
                });
                continue;
            }

            const newLibraryId = findNewLibraryId(oldLibInfo, newLookup);

            if (newLibraryId) {
                await db.query(
                    `INSERT INTO library_arr_mappings
                     (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path,
                      quality_profile_id, plex_path_prefix, arr_path_prefix, classifarr_path_prefix)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (library_id) DO UPDATE SET
                        arr_type = EXCLUDED.arr_type,
                        arr_config_id = EXCLUDED.arr_config_id,
                        arr_root_folder_id = EXCLUDED.arr_root_folder_id,
                        arr_root_folder_path = EXCLUDED.arr_root_folder_path,
                        quality_profile_id = EXCLUDED.quality_profile_id,
                        plex_path_prefix = EXCLUDED.plex_path_prefix,
                        arr_path_prefix = EXCLUDED.arr_path_prefix,
                        classifarr_path_prefix = EXCLUDED.classifarr_path_prefix,
                        updated_at = NOW()`,
                    [
                        newLibraryId,
                        mapping.arr_type,
                        mapping.arr_config_id,
                        mapping.arr_root_folder_id,
                        mapping.arr_root_folder_path,
                        mapping.quality_profile_id,
                        mapping.plex_path_prefix,
                        mapping.arr_path_prefix,
                        mapping.classifarr_path_prefix
                    ]
                );

                result.remapped++;

                logger.info('Restored library mapping', {
                    instance: `${type} ${config.id}`,
                    oldId: mapping.library_id,
                    newId: newLibraryId,
                    name: oldLibInfo.name,
                    arr_root_folder: mapping.arr_root_folder_path
                });
            } else {
                result.failed++;
                result.failedLibraries.push({
                    oldId: mapping.library_id,
                    name: oldLibInfo.name,
                    reason: 'No matching library found after re-sync'
                });
            }
        }

        return result;
    });
}

export async function remapAllArrMappings(db, logger, oldLibrarySnapshot, newLibraryLookup) {
    const results = {
        radarr: [],
        sonarr: [],
        totalRemapped: 0,
        totalFailed: 0
    };

    return withServiceCatch(logger, 'Failed to remap all arr mappings', async () => {
        const radarrConfigs = await db.query('SELECT * FROM radarr_config');

        for (const config of radarrConfigs.rows) {
            const instanceResult = await remapInstanceMappings(
                db, logger, 'radarr', config, oldLibrarySnapshot, newLibraryLookup
            );

            results.radarr.push({
                id: config.id,
                name: config.name || `Radarr ${config.id}`,
                remapped: instanceResult.remapped,
                failed: instanceResult.failed,
                failedLibraries: instanceResult.failedLibraries
            });

            results.totalRemapped += instanceResult.remapped;
            results.totalFailed += instanceResult.failed;
        }

        const sonarrConfigs = await db.query('SELECT * FROM sonarr_config');

        for (const config of sonarrConfigs.rows) {
            const instanceResult = await remapInstanceMappings(
                db, logger, 'sonarr', config, oldLibrarySnapshot, newLibraryLookup
            );

            results.sonarr.push({
                id: config.id,
                name: config.name || `Sonarr ${config.id}`,
                remapped: instanceResult.remapped,
                failed: instanceResult.failed,
                failedLibraries: instanceResult.failedLibraries
            });

            results.totalRemapped += instanceResult.remapped;
            results.totalFailed += instanceResult.failed;
        }

        logger.info('Library mapping restoration complete', {
            totalRemapped: results.totalRemapped,
            totalFailed: results.totalFailed
        });

        return results;
    });
}

export async function createRemapFailureNotification(db, logger, results) {
    if (results.totalFailed === 0) return;

    try {
        const failedDetails = [];

        for (const instance of results.radarr) {
            if (instance.failed > 0) {
                failedDetails.push({
                    type: 'radarr',
                    instanceId: instance.id,
                    instanceName: instance.name,
                    failedLibraries: instance.failedLibraries
                });
            }
        }

        for (const instance of results.sonarr) {
            if (instance.failed > 0) {
                failedDetails.push({
                    type: 'sonarr',
                    instanceId: instance.id,
                    instanceName: instance.name,
                    failedLibraries: instance.failedLibraries
                });
            }
        }

        await db.query(`
            INSERT INTO app_notifications (type, title, message, data, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [
            'warning',
            'Some library mappings need attention',
            `${results.totalFailed} library mapping(s) could not be automatically restored after CARSA. Please review and reconfigure them manually.`,
            JSON.stringify(failedDetails)
        ]);

        logger.warn('Created notification for failed mappings', {
            totalFailed: results.totalFailed,
            details: failedDetails
        });
    } catch (error) {
        logger.error('Failed to create remap failure notification', { error: error.message });
    }
}

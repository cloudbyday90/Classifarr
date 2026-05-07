/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/* eslint-disable security/detect-non-literal-fs-filename */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('PathTestService');

class PathTestService {
    async testPathAccessibility(testPath) {
        const result = {
            path: testPath,
            accessible: false,
            isDirectory: false,
            isFile: false,
            readable: false,
            writable: false,
            contents: null,
            error: null,
            testedAt: new Date().toISOString()
        };

        try {
            const stats = await fs.stat(testPath);
            result.accessible = true;
            result.isDirectory = stats.isDirectory();
            result.isFile = stats.isFile();

            try {
                await fs.access(testPath, fs.constants.R_OK);
                result.readable = true;
            } catch {
                result.readable = false;
            }

            try {
                await fs.access(testPath, fs.constants.W_OK);
                result.writable = true;
            } catch {
                result.writable = false;
            }

            if (result.isDirectory && result.readable) {
                const entries = await fs.readdir(testPath, { withFileTypes: true });
                result.contents = entries.slice(0, 10).map(entry => ({
                    name: entry.name,
                    isDirectory: entry.isDirectory()
                }));
                result.totalItems = entries.length;
            }

            logger.info('Path accessibility test passed', { path: testPath, result });

        } catch (error) {
            result.accessible = false;
            result.error = {
                code: error.code,
                message: error.message
            };

            if (error.code === 'ENOENT') {
                result.error.suggestion = 'Path does not exist. Check if the volume is mounted correctly in Docker.';
            } else if (error.code === 'EACCES') {
                result.error.suggestion = 'Permission denied. Ensure Classifarr has read access to this path.';
            } else if (error.code === 'ENOTDIR') {
                result.error.suggestion = 'Parent path is not a directory.';
            }

            logger.warn('Path accessibility test failed', { path: testPath, error: error.message });
        }

        return result;
    }

    async testPathTranslation({ plexPath, arrPath, classiflarrPath, sampleFile = null }) {
        const results = {
            plexPath: null,
            arrPath: null,
            classiflarrPath: null,
            translationValid: false,
            errors: [],
            suggestions: []
        };

        if (plexPath) {
            results.plexPath = await this.testPathAccessibility(plexPath);
        }
        if (arrPath) {
            results.arrPath = await this.testPathAccessibility(arrPath);
        }
        if (classiflarrPath) {
            results.classiflarrPath = await this.testPathAccessibility(classiflarrPath);
        }

        if (results.classiflarrPath?.accessible && results.classiflarrPath?.contents) {
            results.translationValid = true;
            results.suggestions.push('Path is accessible from Classifarr container.');
        }

        if (sampleFile && classiflarrPath) {
            const fullPath = path.join(classiflarrPath, sampleFile);
            const fileTest = await this.testPathAccessibility(fullPath);
            results.sampleFileTest = fileTest;

            if (fileTest.accessible) {
                results.suggestions.push(`Sample file "${sampleFile}" found and accessible.`);
            } else {
                results.errors.push(`Sample file "${sampleFile}" not accessible: ${fileTest.error?.message}`);
            }
        }

        logger.info('Path translation test completed', { results });
        return results;
    }

    async testAllMappings(mediaServerId) {
        try {
            const mappingsResult = await db.query(`
                SELECT lam.*, l.name as library_name
                FROM library_arr_mappings lam
                JOIN libraries l ON lam.library_id = l.id
                WHERE l.media_server_id = $1
            `, [mediaServerId]);

            const results = {
                mediaServerId,
                mappingsCount: mappingsResult.rows.length,
                mappings: [],
                allValid: true,
                testedAt: new Date().toISOString()
            };

            for (const mapping of mappingsResult.rows) {
                const mappingTest = {
                    libraryId: mapping.library_id,
                    libraryName: mapping.library_name,
                    arrType: mapping.arr_type,
                    arrRootFolderPath: mapping.arr_root_folder_path,
                    classiflarrPathPrefix: mapping.classifarr_path_prefix,
                    tests: {}
                };

                if (mapping.classifarr_path_prefix) {
                    mappingTest.tests.classiflarrPath = await this.testPathAccessibility(
                        mapping.classifarr_path_prefix
                    );

                    if (!mappingTest.tests.classiflarrPath.accessible) {
                        results.allValid = false;
                    }
                } else {
                    mappingTest.tests.classiflarrPath = {
                        accessible: false,
                        error: { message: 'No Classifarr path prefix configured' }
                    };
                    results.allValid = false;
                }

                results.mappings.push(mappingTest);
            }

            logger.info('All mappings tested', { mediaServerId, allValid: results.allValid });
            return results;

        } catch (error) {
            logger.error('Failed to test all mappings', { mediaServerId, error: error.message });
            throw error;
        }
    }

    async getMediaPathConfig() {
        try {
            const result = await db.query(
                `SELECT setting_value FROM app_settings WHERE setting_key = 'classifarr_media_path'`
            );

            const mediaPath = result.rows[0]?.setting_value || null;

            if (mediaPath) {
                const accessTest = await this.testPathAccessibility(mediaPath);
                return {
                    configured: true,
                    path: mediaPath,
                    ...accessTest
                };
            }

            return {
                configured: false,
                path: null,
                accessible: false,
                suggestion: 'No media path configured. Set classifarr_media_path in Settings -> System.'
            };
        } catch (error) {
            logger.error('Failed to get media path config', { error: error.message });
            return {
                configured: false,
                error: error.message
            };
        }
    }

    async healthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            checks: {}
        };

        health.checks.mediaPath = await this.getMediaPathConfig();
        if (!health.checks.mediaPath.accessible) {
            health.status = 'degraded';
        }

        try {
            const mappingsCount = await db.query('SELECT COUNT(*) FROM library_arr_mappings');
            health.checks.mappings = {
                count: parseInt(mappingsCount.rows[0].count),
                configured: parseInt(mappingsCount.rows[0].count) > 0
            };
        } catch (error) {
            health.checks.mappings = { error: error.message };
            health.status = 'degraded';
        }

        try {
            const radarrLinked = await db.query(
                'SELECT COUNT(*) FROM radarr_config WHERE media_server_id IS NOT NULL'
            );
            const sonarrLinked = await db.query(
                'SELECT COUNT(*) FROM sonarr_config WHERE media_server_id IS NOT NULL'
            );
            health.checks.arrInstances = {
                radarrLinked: parseInt(radarrLinked.rows[0].count),
                sonarrLinked: parseInt(sonarrLinked.rows[0].count)
            };
        } catch (error) {
            health.checks.arrInstances = { error: error.message };
        }

        logger.info('Health check completed', { status: health.status });
        return health;
    }
}

const pathTestService = new PathTestService();

export { PathTestService };
export default pathTestService;

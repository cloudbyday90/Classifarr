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
import fs from 'node:fs';
import db from '../config/database.mjs';
import {
    createRuntimeWiringChecks,
    describeRuntimeExport,
    validateRuntimeWiringChecks,
} from './shared/runtimeWiringValidation.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('StartupService');

function defaultImportRuntimeModule(modulePath) {
    return import(modulePath);
}

class StartupService {
    constructor() {
        this.importRuntimeModule = defaultImportRuntimeModule;
        this.runtimeWiringChecks = createRuntimeWiringChecks((value) => this.describeRuntimeExport(value));
    }

    describeRuntimeExport(value) {
        return describeRuntimeExport(value);
    }

    async validateRuntimeWiring() {
        return validateRuntimeWiringChecks({
            checks: this.runtimeWiringChecks,
            importModule: this.importRuntimeModule,
            logger
        });
    }

    async checkMappingStatus() {
        try {
            const radarrConfigs = await db.query('SELECT id FROM radarr_config WHERE is_active = true');
            const sonarrConfigs = await db.query('SELECT id FROM sonarr_config WHERE is_active = true');

            if (radarrConfigs.rows.length === 0 && sonarrConfigs.rows.length === 0) {
                return {
                    status: 'not_applicable',
                    message: 'No Radarr or Sonarr instances configured'
                };
            }

            const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'library_arr_mappings'
        )
      `);

            if (!tableCheck.rows[0].exists) {
                return {
                    status: 'migrations_pending',
                    message: 'Database migrations need to run'
                };
            }

            const mappingsResult = await db.query('SELECT COUNT(*) as count FROM library_arr_mappings');
            const librariesResult = await db.query('SELECT COUNT(*) as count FROM libraries WHERE is_active = true');

            const mapped = parseInt(mappingsResult.rows[0].count);
            const total = parseInt(librariesResult.rows[0].count);

            if (mapped < total) {
                return {
                    status: 'incomplete',
                    message: `${mapped} of ${total} libraries mapped`,
                    mapped,
                    total,
                    unmapped: total - mapped
                };
            }

            return {
                status: 'complete',
                message: 'All libraries mapped',
                mapped,
                total
            };

        } catch (error) {
            logger.error('Failed to check mapping status', { error: error.message });
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    async checkMediaPathStatus() {
        try {
            const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'app_settings'
        )
      `);

            if (!tableCheck.rows[0].exists) {
                return {
                    status: 'not_configured',
                    message: 'Settings not initialized'
                };
            }

            const pathResult = await db.query(
                "SELECT value FROM app_settings WHERE key = 'classifarr_media_path'"
            );

            if (pathResult.rows.length === 0 || !pathResult.rows[0].value) {
                return {
                    status: 'not_configured',
                    message: 'Media path not configured',
                    path: null,
                    accessible: false
                };
            }

            const mediaPath = pathResult.rows[0].value;

            let accessible = false;
            try {
                accessible = fs.existsSync(mediaPath);
            } catch {
                accessible = false;
            }

            return {
                status: accessible ? 'configured' : 'path_not_accessible',
                message: accessible ? 'Media path accessible' : 'Media path not accessible',
                path: mediaPath,
                accessible
            };

        } catch (error) {
            logger.error('Failed to check media path status', { error: error.message });
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    async getSetupStatus() {
        const mappingStatus = await this.checkMappingStatus();
        const mediaPathStatus = await this.checkMediaPathStatus();

        let overallStatus = 'complete';
        const issues = [];

        if (mappingStatus.status === 'incomplete') {
            overallStatus = 'incomplete';
            issues.push({
                type: 'mapping',
                message: `${mappingStatus.unmapped} libraries need to be mapped to *arr root folders`,
                action: 'Configure in Settings → Radarr/Sonarr'
            });
        }

        if (mediaPathStatus.status === 'not_configured') {
            overallStatus = 'incomplete';
            issues.push({
                type: 'media_path',
                message: 'Media path not configured for re-classification',
                action: 'Configure in Settings → System or update Docker volume mounts'
            });
        } else if (mediaPathStatus.status === 'path_not_accessible') {
            overallStatus = 'incomplete';
            issues.push({
                type: 'media_path',
                message: 'Media path configured but not accessible',
                action: 'Check Docker volume mounts in docker-compose.yml'
            });
        }

        if (mappingStatus.status === 'not_applicable') {
            overallStatus = 'optional';
        }

        return {
            status: overallStatus,
            reclassificationEnabled: overallStatus === 'complete',
            mapping: mappingStatus,
            mediaPath: mediaPathStatus,
            issues
        };
    }

    async setMediaPath(path) {
        await db.query(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('classifarr_media_path', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [path]);

        logger.info('Media path configured', { path });
    }
}

const instance = new StartupService();
export default instance;

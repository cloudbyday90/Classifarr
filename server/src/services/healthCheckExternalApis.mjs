/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { metadataProviderConfigQuery } from './metadataProviderConfigStore.mjs';
import { readHealthConfiguration, buildUnknownHealthState } from './healthConfigurationRead.mjs';
import { tmdbService } from './tmdb.mjs';
import { omdbService } from './omdb.mjs';
import {
    buildConfiguredHealthState,
    buildNotConfiguredHealthState,
    buildTimedResultHealthState,
    measureTime,
} from './healthCheckServiceShared.mjs';

export async function checkTMDB(previous) {
    try {
        const result = await readHealthConfiguration(previous, 'tmdb', () => db.query(metadataProviderConfigQuery('tmdb', { activeOnly: true })));
        if (!result.ok) return result.health;
        const config = result.rows[0];

        if (!config?.api_key) {
            return buildNotConfiguredHealthState(previous);
        }

        const probe = await measureTime(async () => {
            await tmdbService.testConnection(config.api_key);
        });

        return buildTimedResultHealthState(previous, probe);
    } catch (_error) {
        return buildUnknownHealthState(previous, 'tmdb');
    }
}

export async function checkOMDb(previous) {
    try {
        const result = await readHealthConfiguration(previous, 'omdb', () => db.query(metadataProviderConfigQuery('omdb', { activeOnly: true })));
        if (!result.ok) return result.health;
        const config = result.rows[0];

        if (!config?.api_key) {
            return buildNotConfiguredHealthState(previous);
        }

        const probe = await measureTime(async () => {
            const connection = await omdbService.testConnection(config.api_key);
            if (connection?.success !== true) {
                throw new Error(connection?.error || 'OMDb connection test failed');
            }
        });

        return buildTimedResultHealthState(previous, probe);
    } catch (_error) {
        return buildUnknownHealthState(previous, 'omdb');
    }
}

export async function checkTavily(previous) {
    try {
        const result = await readHealthConfiguration(previous, 'tavily', () => db.query(metadataProviderConfigQuery('tavily', { activeOnly: true })));
        if (!result.ok) return result.health;
        const config = result.rows[0];

        if (!config?.api_key) {
            return buildNotConfiguredHealthState(previous);
        }

        return buildConfiguredHealthState(previous);
    } catch (_error) {
        return buildUnknownHealthState(previous, 'tavily');
    }
}

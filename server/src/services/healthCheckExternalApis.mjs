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
import { healthConfigurationQuery } from './healthConfigurationQueries.mjs';
import { readHealthConfiguration, buildUnknownHealthState } from './healthConfigurationRead.mjs';
import { probeTmdbConnection, probeOmdbConnection } from './healthMetadataProbe.mjs';
import { measureConnectionProbe, buildConnectionProbeHealthState } from './healthConnectionProbe.mjs';
import {
    buildConfiguredHealthState,
    buildNotConfiguredHealthState,
} from './healthCheckServiceShared.mjs';

export async function checkTMDB(previous, guard = undefined) {
    try {
        const result = await readHealthConfiguration(previous, 'tmdb', () => db.query(healthConfigurationQuery('tmdb')), guard);
        if (!result.ok) return result.health;
        const config = result.rows[0];

        if (!config?.api_key) {
            return buildNotConfiguredHealthState(previous);
        }

        const probe = await measureConnectionProbe(() => probeTmdbConnection(config.api_key));

        return buildConnectionProbeHealthState(previous, probe);
    } catch (_error) {
        return buildUnknownHealthState(previous, 'tmdb');
    }
}

export async function checkOMDb(previous, guard = undefined) {
    try {
        const result = await readHealthConfiguration(previous, 'omdb', () => db.query(healthConfigurationQuery('omdb')), guard);
        if (!result.ok) return result.health;
        const config = result.rows[0];

        if (!config?.api_key) {
            return buildNotConfiguredHealthState(previous);
        }

        const probe = await measureConnectionProbe(() => probeOmdbConnection(config.api_key));

        return buildConnectionProbeHealthState(previous, probe);
    } catch (_error) {
        return buildUnknownHealthState(previous, 'omdb');
    }
}

export async function checkTavily(previous, guard = undefined) {
    try {
        const result = await readHealthConfiguration(previous, 'tavily', () => db.query(healthConfigurationQuery('tavily')), guard);
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

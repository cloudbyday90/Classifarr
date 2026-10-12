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
import { radarrService } from './radarr.mjs';
import { sonarrService } from './sonarr.mjs';
import { readHealthConfiguration, buildUnknownHealthState } from './healthConfigurationRead.mjs';
import { healthConfigurationQuery } from './healthConfigurationQueries.mjs';
import {
    buildAggregateInstancesHealthState,
    buildNotConfiguredHealthState,
    buildTimedInstanceHealthState,
    measureTime,
} from './healthCheckServiceShared.mjs';

export async function checkRadarr(previous, guard = undefined) {
    try {
        const configs = await readHealthConfiguration(previous, 'radarr', () => db.query(healthConfigurationQuery('radarr')), guard);
        if (!configs.ok) return configs.health;

        if (configs.rows.length === 0) {
            return buildNotConfiguredHealthState(previous, { instances: [] });
        }

        const instances = [];

        for (const config of configs.rows) {
            const prevInstance = previous.instances?.find(i => i.id === config.id);
            const result = await measureTime(async () => {
                await radarrService.testConnection(config);
            });

            instances.push(buildTimedInstanceHealthState(prevInstance, result, {
                id: config.id,
                name: config.name,
            }));
        }

        return buildAggregateInstancesHealthState(previous, instances);
    } catch (_error) {
        return buildUnknownHealthState(previous, 'radarr');
    }
}

export async function checkSonarr(previous, guard = undefined) {
    try {
        const configs = await readHealthConfiguration(previous, 'sonarr', () => db.query(healthConfigurationQuery('sonarr')), guard);
        if (!configs.ok) return configs.health;

        if (configs.rows.length === 0) {
            return buildNotConfiguredHealthState(previous, { instances: [] });
        }

        const instances = [];

        for (const config of configs.rows) {
            const prevInstance = previous.instances?.find(i => i.id === config.id);
            const result = await measureTime(async () => {
                await sonarrService.testConnection(config);
            });

            instances.push(buildTimedInstanceHealthState(prevInstance, result, {
                id: config.id,
                name: config.name,
            }));
        }

        return buildAggregateInstancesHealthState(previous, instances);
    } catch (_error) {
        return buildUnknownHealthState(previous, 'sonarr');
    }
}

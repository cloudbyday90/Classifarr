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
import { tmdbService } from './tmdb.mjs';
import { omdbService } from './omdb.mjs';
import {
    buildConfiguredHealthState,
    buildErrorHealthState,
    buildNotConfiguredHealthState,
    buildTimedResultHealthState,
} from './healthCheckServiceShared.mjs';

async function measureTime(fn) {
    const start = Date.now();
    try {
        await fn();
        return { success: true, time: Date.now() - start };
    } catch (error) {
        return { success: false, time: Date.now() - start, error: error.message };
    }
}

export async function checkTMDB(previous) {
    try {
        const config = await db.query('SELECT api_key FROM tmdb_config LIMIT 1');

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            return buildNotConfiguredHealthState(previous);
        }

        const result = await measureTime(async () => {
            await tmdbService.testConnection();
        });

        return buildTimedResultHealthState(previous, result);
    } catch (error) {
        return buildErrorHealthState(previous, error);
    }
}

export async function checkOMDb(previous) {
    try {
        const config = await db.query('SELECT api_key FROM omdb_config WHERE is_active = true LIMIT 1');

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            return buildNotConfiguredHealthState(previous);
        }

        const result = await measureTime(async () => {
            await omdbService.testConnection(config.rows[0].api_key);
        });

        return buildTimedResultHealthState(previous, result);
    } catch (error) {
        return buildErrorHealthState(previous, error);
    }
}

export async function checkTavily(previous) {
    try {
        const config = await db.query('SELECT api_key FROM tavily_config LIMIT 1');

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            return buildNotConfiguredHealthState(previous);
        }

        return buildConfiguredHealthState(previous);
    } catch (error) {
        return buildErrorHealthState(previous, error);
    }
}
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
import { discordBotService } from './discordBot.mjs';
import { readHealthConfiguration, buildUnknownHealthState } from './healthConfigurationRead.mjs';
import {
    buildStatusHealthState,
    buildTimedResultHealthState,
    measureTime,
} from './healthCheckServiceShared.mjs';

export { checkOllama } from './healthCheckAiProvider.mjs';
export { checkMediaServer } from './healthCheckMediaServer.mjs';

export async function checkDatabase(previous) {
    const result = await measureTime(async () => {
        await db.query('SELECT 1');
    });

    return buildTimedResultHealthState(previous, result);
}

export async function checkDiscordBot(previous, guard = undefined) {
    try {
        const config = await readHealthConfiguration(previous, 'discordBot', () => db.query("SELECT bot_token FROM notification_config WHERE type = 'discord' LIMIT 1"), guard);
        if (!config.ok) return config.health;
        const isConfigured = config.rows.length > 0 && config.rows[0].bot_token;
        const isConnected = discordBotService.client && discordBotService.client.isReady();

        const status = isConnected ? 'connected' : (isConfigured ? 'disconnected' : 'not configured');

        return buildStatusHealthState(previous, status, {
            lastSuccessfulCheck: isConnected ? new Date().toISOString() : previous?.lastSuccessfulCheck,
            responseTime: null,
        });
    } catch (_error) {
        return buildUnknownHealthState(previous, 'discordBot');
    }
}

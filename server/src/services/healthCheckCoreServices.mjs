/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { httpGet } from '../utils/httpClient.mjs';
import * as db from '../config/database.mjs';
import { ollamaService } from './ollama.mjs';
import { discordBotService } from './discordBot.mjs';
import { readHealthConfiguration, buildUnknownHealthState } from './healthConfigurationRead.mjs';
import {
    buildNotConfiguredHealthState,
    buildStatusHealthState,
    buildTimedResultHealthState,
    measureTime,
} from './healthCheckServiceShared.mjs';

export async function checkDatabase(previous) {
    const result = await measureTime(async () => {
        await db.query('SELECT 1');
    });

    return buildTimedResultHealthState(previous, result);
}

export async function checkDiscordBot(previous) {
    try {
        const config = await readHealthConfiguration(previous, 'discordBot', () => db.query("SELECT bot_token FROM notification_config WHERE type = 'discord' LIMIT 1"));
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

export async function checkOllama(previous) {
    try {
        const aiConfig = await readHealthConfiguration(previous, 'ollama', () => db.query('SELECT * FROM ai_provider_config WHERE id = 1'));
        if (!aiConfig.ok) return aiConfig.health;

        if (aiConfig.rows.length === 0 || !aiConfig.rows[0].primary_provider || aiConfig.rows[0].primary_provider === 'none') {
            return buildNotConfiguredHealthState(previous, { provider: 'none' });
        }

        const provider = aiConfig.rows[0].primary_provider;
        const config = aiConfig.rows[0];
        let result = { success: true, time: 0 };

        if (provider === 'ollama' && config.ollama_url) {
            result = await measureTime(async () => {
                await ollamaService.testConnection(config.ollama_url);
            });
        } else if (provider === 'openai') {
            if (!config.openai_api_key) {
                result = { success: false, time: 0, error: 'No API key configured' };
            }
        } else if (provider === 'anthropic') {
            if (!config.anthropic_api_key) {
                result = { success: false, time: 0, error: 'No API key configured' };
            }
        }

        return buildTimedResultHealthState(previous, result, {
            provider,
        });
    } catch (_error) {
        return buildUnknownHealthState(previous, 'ollama');
    }
}

export async function checkMediaServer(previous) {
    try {
        const config = await readHealthConfiguration(previous, 'mediaServer', () => db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1'));
        if (!config.ok) return config.health;

        if (config.rows.length === 0) {
            return buildNotConfiguredHealthState(previous, { type: null });
        }

        const server = config.rows[0];
        const serverType = server.type || 'plex';

        const result = await measureTime(async () => {
            const url = server.selected_connection || server.url;

            if (serverType === 'plex') {
                await httpGet(`${url}/identity`, {
                    headers: { 'X-Plex-Token': server.token },
                    timeout: 10000,
                });
            } else if (serverType === 'jellyfin' || serverType === 'emby') {
                await httpGet(`${url}/System/Info`, {
                    headers: { 'X-MediaBrowser-Token': server.token },
                    timeout: 10000,
                });
            }
        });

        return buildTimedResultHealthState(previous, result, {
            type: serverType,
            name: server.name,
        });
    } catch (_error) {
        return buildUnknownHealthState(previous, 'mediaServer');
    }
}

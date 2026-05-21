/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import os from 'node:os';
import v8 from 'node:v8';
import { httpGet } from '../utils/httpClient.mjs';
import * as db from '../config/database.mjs';
import { ollamaService } from './ollama.mjs';
import { discordBotService } from './discordBot.mjs';
import {
    buildErrorHealthState,
    buildNotConfiguredHealthState,
    buildStatusHealthState,
    buildTimedResultHealthState,
    createDefaultHealthCache,
    getAlertPreviousStatus,
    shouldSendHealthAlert,
} from './healthCheckServiceShared.mjs';
import { checkImageEmbeddings as computeImageEmbeddingsHealth } from './healthCheckImageEmbeddings.mjs';
import { checkRAG as computeRAGHealth } from './healthCheckRAG.mjs';
import { checkRadarr as computeRadarrHealth, checkSonarr as computeSonarrHealth } from './healthCheckArrServices.mjs';
import { checkTMDB as computeTMDBHealth, checkOMDb as computeOMDbHealth, checkTavily as computeTavilyHealth } from './healthCheckExternalApis.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('healthCheck');


// Cache for health status
let healthCache = createDefaultHealthCache();

// Heartbeat interval (default: 15 minutes)
let heartbeatInterval = null;
const DEFAULT_HEARTBEAT_MS = 15 * 60 * 1000;

// Track start time for uptime calculation
const startTime = Date.now();

// Worker stall threshold (10 minutes)
const WORKER_STALL_THRESHOLD_MS = 10 * 60 * 1000;

async function measureTime(fn) {
    const start = Date.now();
    try {
        await fn();
        return { success: true, time: Date.now() - start };
    } catch (error) {
        return { success: false, time: Date.now() - start, error: error.message };
    }
}

const UNHEALTHY_STATUSES = new Set(['disconnected', 'degraded', 'error', 'partial']);

function maybeSendHealthAlert(serviceKey, previousStatus, newStatus) {
    if (!shouldSendHealthAlert(previousStatus, newStatus, UNHEALTHY_STATUSES)) return;
    const prevForAlert = getAlertPreviousStatus(previousStatus);
    discordBotService.sendSystemAlert(serviceKey, newStatus, prevForAlert).catch(() => {}); // swallow-error: fire-and-forget notification — must not block health check logic
}

export async function checkDatabase() {
    const previous = { ...healthCache.database };
    const result = await measureTime(async () => {
        await db.query('SELECT 1');
    });

    healthCache.database = buildTimedResultHealthState(previous, result);

    return healthCache.database;
}

export async function checkDiscordBot() {
    const previous = { ...healthCache.discordBot };

    try {
        const isConnected = discordBotService.client && discordBotService.client.isReady();

        let isConfigured = false;
        try {
            const config = await db.query("SELECT bot_token FROM notification_config WHERE type = 'discord' LIMIT 1");
            isConfigured = config.rows.length > 0 && config.rows[0].bot_token;
        } catch (_dbError) {
            isConfigured = false;
        }

        const status = isConnected ? 'connected' : (isConfigured ? 'disconnected' : 'not configured');

        healthCache.discordBot = buildStatusHealthState(previous, status, {
            lastSuccessfulCheck: isConnected ? new Date().toISOString() : previous.lastSuccessfulCheck,
            responseTime: null,
        });
    } catch (_error) {
        healthCache.discordBot = buildNotConfiguredHealthState(previous, { responseTime: null });
    }

    return healthCache.discordBot;
}

export async function checkOllama() {
    const previous = { ...healthCache.ollama };

    try {
        let aiConfig;
        try {
            aiConfig = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');
        } catch (_dbError) {
            healthCache.ollama = buildNotConfiguredHealthState(previous, { provider: 'none' });
            return healthCache.ollama;
        }

        if (aiConfig.rows.length === 0 || !aiConfig.rows[0].primary_provider || aiConfig.rows[0].primary_provider === 'none') {
            healthCache.ollama = buildNotConfiguredHealthState(previous, { provider: 'none' });
            return healthCache.ollama;
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

        healthCache.ollama = buildTimedResultHealthState(previous, result, {
            provider,
        });
    } catch (_error) {
        healthCache.ollama = buildNotConfiguredHealthState(previous, { provider: 'none' });
    }

    return healthCache.ollama;
}

export async function checkRadarr() {
    const previous = { ...healthCache.radarr };
    healthCache.radarr = await computeRadarrHealth(previous);
    return healthCache.radarr;
}

export async function checkSonarr() {
    const previous = { ...healthCache.sonarr };
    healthCache.sonarr = await computeSonarrHealth(previous);
    return healthCache.sonarr;
}

export async function checkMediaServer() {
    const previous = { ...healthCache.mediaServer };

    try {
        const config = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');

        if (config.rows.length === 0) {
            healthCache.mediaServer = buildNotConfiguredHealthState(previous, { type: null });
            return healthCache.mediaServer;
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

        healthCache.mediaServer = buildTimedResultHealthState(previous, result, {
            type: serverType,
            name: server.name,
        });
    } catch (error) {
        healthCache.mediaServer = buildErrorHealthState(previous, error, { type: null });
    }

    return healthCache.mediaServer;
}

export async function checkTMDB() {
    const previous = { ...healthCache.tmdb };
    healthCache.tmdb = await computeTMDBHealth(previous);
    return healthCache.tmdb;
}

export async function checkOMDb() {
    const previous = { ...healthCache.omdb };
    healthCache.omdb = await computeOMDbHealth(previous);
    return healthCache.omdb;
}

export async function checkTavily() {
    const previous = { ...healthCache.tavily };
    healthCache.tavily = await computeTavilyHealth(previous);
    return healthCache.tavily;
}

export async function checkRAG() {
    const previous = { ...healthCache.rag };

    healthCache.rag = await computeRAGHealth(previous);

    return healthCache.rag;
}

export async function checkImageEmbeddings() {
    const previous = { ...healthCache.imageEmbeddings };

    healthCache.imageEmbeddings = await computeImageEmbeddingsHealth(previous);

    maybeSendHealthAlert('imageEmbeddings', previous.status, healthCache.imageEmbeddings.status);

    return healthCache.imageEmbeddings;
}

export async function runAllHealthChecks() {
    logger.info('[HealthCheck] Running all health checks...');
    const startTime = Date.now();

    await Promise.allSettled([
        checkDatabase(),
        checkDiscordBot(),
        checkOllama(),
        checkRAG(),
        checkImageEmbeddings(),
        checkRadarr(),
        checkSonarr(),
        checkMediaServer(),
        checkTMDB(),
        checkOMDb(),
        checkTavily()
    ]);

    logger.info(`[HealthCheck] All checks completed in ${Date.now() - startTime}ms`);
    return getHealthCache();
}

export function getHealthCache() {
    return { ...healthCache };
}

export function resetHealthState() {
    stopHeartbeat();
    healthCache = createDefaultHealthCache();
    servicesHealthCache = null;
    servicesHealthCacheTime = null;
}

export function startHeartbeat(intervalMs = DEFAULT_HEARTBEAT_MS) {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    logger.info(`[HealthCheck] Starting heartbeat scheduler (interval: ${intervalMs / 1000}s)`);
    runAllHealthChecks();
    heartbeatInterval = setInterval(() => {
        runAllHealthChecks();
    }, intervalMs);
}

export function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        logger.info('[HealthCheck] Heartbeat scheduler stopped');
    }
}

export function isHeartbeatRunning() {
    return heartbeatInterval !== null;
}

export function checkProcessMemory() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    let heapCapMb = null;
    try {
        heapCapMb = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
    } catch (_) {
        // v8 module unavailable in some environments
    }

    const heapUsedMb  = Math.round(mem.heapUsed  / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMb       = Math.round(mem.rss       / 1024 / 1024);
    const totalMemMb  = Math.round(totalMem / 1024 / 1024);
    const freeMemMb   = Math.round(freeMem  / 1024 / 1024);
    const usedMemMb   = Math.round(usedMem  / 1024 / 1024);

    const heapUsedPct = heapCapMb ? Math.round((heapUsedMb / heapCapMb) * 100) : null;
    const osUsedPct   = totalMemMb ? Math.round((usedMemMb  / totalMemMb) * 100) : null;

    let status = 'ok';
    if (heapCapMb && heapUsedPct >= 90) status = 'critical';
    else if (osUsedPct !== null && osUsedPct >= 95) status = 'critical';
    else if (heapCapMb && heapUsedPct >= 75) status = 'warning';
    else if (osUsedPct !== null && osUsedPct >= 85) status = 'warning';

    return {
        status,
        process: {
            heapUsedMb,
            heapTotalMb,
            heapCapMb,
            heapUsedPct,
            rssMb
        },
        os: {
            totalMemMb,
            freeMemMb,
            usedMemMb,
            usedPct: osUsedPct
        },
        timestamp: new Date().toISOString()
    };
}

export async function checkQueueWorker() {
    try {
        const result = await db.query(
            `SELECT
                 SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                 SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                 MAX(started_at) AS last_activity
             FROM task_queue
             WHERE status IN ('pending', 'processing')
                OR (status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour')`
        );

        const processingCount = parseInt(result.rows[0].processing) || 0;
        const pendingCount = parseInt(result.rows[0].pending) || 0;
        const lastActivity = result.rows[0].last_activity;

        let status = 'connected';
        if (lastActivity) {
            const lastActivityTime = new Date(lastActivity);
            const stallThreshold = new Date(Date.now() - WORKER_STALL_THRESHOLD_MS);
            if (lastActivityTime < stallThreshold && pendingCount > 0) {
                status = 'degraded';
            }
        }

        return {
            name: 'Queue Worker',
            status,
            latency: 0,
            timestamp: new Date().toISOString(),
            metadata: {
                processing: processingCount,
                pending: pendingCount,
                lastActivity: lastActivity
            }
        };
    } catch (error) {
        return {
            name: 'Queue Worker',
            status: 'disconnected',
            latency: 0,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

export function getUptime() {
    const uptimeMs = Date.now() - startTime;
    return Math.floor(uptimeMs / 1000);
}

let servicesHealthCache = null;
let servicesHealthCacheTime = null;
const SERVICES_CACHE_TTL = 30000;

export async function getAllServicesHealth() {
    const now = Date.now();

    if (servicesHealthCache && servicesHealthCacheTime && (now - servicesHealthCacheTime) < SERVICES_CACHE_TTL) {
        return servicesHealthCache;
    }

    const [database, mediaServer, radarr, sonarr, aiProvider, rag, queueWorker, imageEmbeddings] = await Promise.all([
        checkDatabase(),
        checkMediaServer(),
        checkRadarr(),
        checkSonarr(),
        checkOllama(),
        checkRAG(),
        checkQueueWorker(),
        checkImageEmbeddings()
    ]);

    const result = {
        database,
        mediaServer,
        radarr,
        sonarr,
        aiProvider,
        rag,
        imageEmbeddings,
        queueWorker,
        memory: checkProcessMemory(),
        timestamp: new Date().toISOString()
    };

    servicesHealthCache = result;
    servicesHealthCacheTime = now;

    return result;
}

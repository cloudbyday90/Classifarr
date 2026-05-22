/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { discordBotService } from './discordBot.mjs';
import {
    createDefaultHealthCache,
    getAlertPreviousStatus,
    shouldSendHealthAlert,
} from './healthCheckServiceShared.mjs';
import { checkImageEmbeddings as computeImageEmbeddingsHealth } from './healthCheckImageEmbeddings.mjs';
import { checkRAG as computeRAGHealth } from './healthCheckRAG.mjs';
import { checkRadarr as computeRadarrHealth, checkSonarr as computeSonarrHealth } from './healthCheckArrServices.mjs';
import { checkTMDB as computeTMDBHealth, checkOMDb as computeOMDbHealth, checkTavily as computeTavilyHealth } from './healthCheckExternalApis.mjs';
import { checkDatabase as computeDatabaseHealth, checkDiscordBot as computeDiscordBotHealth, checkOllama as computeOllamaHealth, checkMediaServer as computeMediaServerHealth } from './healthCheckCoreServices.mjs';
import { checkProcessMemory as computeProcessMemory, checkQueueWorker as computeQueueWorker } from './healthCheckInfrastructure.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('healthCheck');


// Cache for health status
let healthCache = createDefaultHealthCache();

// Heartbeat interval (default: 15 minutes)
let heartbeatInterval = null;
const DEFAULT_HEARTBEAT_MS = 15 * 60 * 1000;

// Track start time for uptime calculation
const startTime = Date.now();

const UNHEALTHY_STATUSES = new Set(['disconnected', 'degraded', 'error', 'partial']);

// Cache for health status

function maybeSendHealthAlert(serviceKey, previousStatus, newStatus) {
    if (!shouldSendHealthAlert(previousStatus, newStatus, UNHEALTHY_STATUSES)) return;
    const prevForAlert = getAlertPreviousStatus(previousStatus);
    discordBotService.sendSystemAlert(serviceKey, newStatus, prevForAlert).catch(() => {}); // swallow-error: fire-and-forget notification — must not block health check logic
}

export async function checkDatabase() {
    const previous = { ...healthCache.database };
    healthCache.database = await computeDatabaseHealth(previous);
    return healthCache.database;
}

export async function checkDiscordBot() {
    const previous = { ...healthCache.discordBot };
    healthCache.discordBot = await computeDiscordBotHealth(previous);
    return healthCache.discordBot;
}

export async function checkOllama() {
    const previous = { ...healthCache.ollama };
    healthCache.ollama = await computeOllamaHealth(previous);
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
    healthCache.mediaServer = await computeMediaServerHealth(previous);
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
    return computeProcessMemory();
}

export async function checkQueueWorker() {
    return computeQueueWorker();
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

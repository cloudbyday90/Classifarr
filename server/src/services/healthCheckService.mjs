/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { discordBotService } from './discordBot.mjs';
import {
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
import { DEFAULT_HEARTBEAT_MS, createHealthFreshnessPolicy, isValidHeartbeatInterval } from './healthObservationFreshness.mjs';
import { createHealthObservationCoordinator } from './healthObservationCoordinator.mjs';

const logger = createLogger('healthCheck');


// Cache for health status
const observations = createHealthObservationCoordinator();

// Heartbeat interval (default: 15 minutes)
let heartbeatInterval = null;
let heartbeatIntervalMs = DEFAULT_HEARTBEAT_MS;

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
    return observations.run('database', computeDatabaseHealth);
}

export async function checkDiscordBot() {
    return observations.run('discordBot', computeDiscordBotHealth);
}

export async function checkOllama() {
    return observations.run('ollama', computeOllamaHealth);
}

export async function checkRadarr() {
    return observations.run('radarr', computeRadarrHealth);
}

export async function checkSonarr() {
    return observations.run('sonarr', computeSonarrHealth);
}

export async function checkMediaServer() {
    return observations.run('mediaServer', computeMediaServerHealth);
}

export async function checkTMDB() {
    return observations.run('tmdb', computeTMDBHealth);
}

export async function checkOMDb() {
    return observations.run('omdb', computeOMDbHealth);
}

export async function checkTavily() {
    return observations.run('tavily', computeTavilyHealth);
}

export async function checkRAG() {
    return observations.run('rag', computeRAGHealth);
}

export async function checkImageEmbeddings() {
    return observations.run('imageEmbeddings', computeImageEmbeddingsHealth, (previous, result) => {
        if (!result.failure) maybeSendHealthAlert('imageEmbeddings', previous.status, result.status);
    });
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
    return observations.snapshot();
}

export function getHealthFreshnessPolicy() {
    return createHealthFreshnessPolicy({ intervalMs: heartbeatIntervalMs, heartbeatActive: isHeartbeatRunning() });
}

/** @internal */
export function resetHealthState() {
    stopHeartbeat();
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_MS;
    observations.reset();
    servicesHealthCache = null;
    servicesHealthCacheTime = null;
    servicesHealthFlight = null;
}

export function startHeartbeat(intervalMs = DEFAULT_HEARTBEAT_MS) {
    if (!isValidHeartbeatInterval(intervalMs)) throw new RangeError('Invalid heartbeat interval');
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    heartbeatIntervalMs = intervalMs;

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
let servicesHealthCacheVersion = null;
let servicesHealthFlight = null;
const SERVICES_CACHE_TTL = 30000;

export async function getAllServicesHealth() {
    const now = Date.now();

    if (servicesHealthCache && servicesHealthCacheVersion === observations.version()
        && servicesHealthCacheTime !== null && (now - servicesHealthCacheTime) < SERVICES_CACHE_TTL) {
        return servicesHealthCache;
    }
    if (servicesHealthFlight) return servicesHealthFlight;

    const pending = refreshServicesHealth().then(queueWorker => {
        const result = projectServicesHealth(queueWorker);
        if (servicesHealthFlight === pending) {
            servicesHealthCache = result;
            servicesHealthCacheTime = Date.now();
            servicesHealthCacheVersion = observations.version();
        }
        return result;
    }).finally(() => {
        if (servicesHealthFlight === pending) servicesHealthFlight = null;
    });
    servicesHealthFlight = pending;
    return pending;
}

async function refreshServicesHealth() {
    const results = await Promise.all([
        checkDatabase(),
        checkMediaServer(),
        checkRadarr(),
        checkSonarr(),
        checkOllama(),
        checkRAG(),
        checkQueueWorker(),
        checkImageEmbeddings()
    ]);

    return results[6];
}

function projectServicesHealth(queueWorker) {
    // Do not retain early service results while waiting for slower peers.
    const { database, mediaServer, radarr, sonarr, ollama: aiProvider, rag, imageEmbeddings } = observations.snapshot();
    return {
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

}

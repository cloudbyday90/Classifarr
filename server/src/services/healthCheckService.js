/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');
const ollamaService = require('./ollama');
const tmdbService = require('./tmdb');
const tavilyService = require('./tavily');
const discordBotService = require('./discordBot');

// Cache for health status
let healthCache = {
    database: { status: 'unknown', lastCheck: null, responseTime: null },
    discordBot: { status: 'unknown', lastCheck: null, responseTime: null },
    ollama: { status: 'unknown', lastCheck: null, responseTime: null },
    radarr: { status: 'unknown', lastCheck: null, responseTime: null, instances: [] },
    sonarr: { status: 'unknown', lastCheck: null, responseTime: null, instances: [] },
    mediaServer: { status: 'unknown', lastCheck: null, responseTime: null, type: null },
    tmdb: { status: 'unknown', lastCheck: null, responseTime: null },
    tavily: { status: 'unknown', lastCheck: null, responseTime: null }
};

// Heartbeat interval (default: 15 minutes)
let heartbeatInterval = null;
const DEFAULT_HEARTBEAT_MS = 15 * 60 * 1000;

/**
 * Measure response time for an async operation
 */
async function measureTime(fn) {
    const start = Date.now();
    try {
        await fn();
        return { success: true, time: Date.now() - start };
    } catch (error) {
        return { success: false, time: Date.now() - start, error: error.message };
    }
}

/**
 * Check database connectivity
 */
async function checkDatabase() {
    const result = await measureTime(async () => {
        await db.query('SELECT 1');
    });

    healthCache.database = {
        status: result.success ? 'connected' : 'disconnected',
        lastCheck: new Date().toISOString(),
        responseTime: result.time,
        error: result.error
    };

    return healthCache.database;
}

/**
 * Check Discord bot status
 */
async function checkDiscordBot() {
    try {
        const isConnected = discordBotService.client && discordBotService.client.isReady();

        // Check if Discord is configured
        const config = await db.query('SELECT bot_token FROM discord_config LIMIT 1');
        const isConfigured = config.rows.length > 0 && config.rows[0].bot_token;

        healthCache.discordBot = {
            status: isConnected ? 'connected' : (isConfigured ? 'disconnected' : 'not configured'),
            lastCheck: new Date().toISOString(),
            responseTime: null
        };
    } catch (error) {
        healthCache.discordBot = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            error: error.message
        };
    }

    return healthCache.discordBot;
}

/**
 * Check Ollama/AI provider status
 */
async function checkOllama() {
    try {
        // Check AI config - table might not exist yet
        let aiConfig;
        try {
            aiConfig = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');
        } catch (dbError) {
            // Table doesn't exist or query failed - treat as not configured
            healthCache.ollama = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                provider: 'none'
            };
            return healthCache.ollama;
        }

        if (aiConfig.rows.length === 0 || !aiConfig.rows[0].primary_provider || aiConfig.rows[0].primary_provider === 'none') {
            healthCache.ollama = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                provider: 'none'
            };
            return healthCache.ollama;
        }

        const provider = aiConfig.rows[0].primary_provider;
        const config = aiConfig.rows[0];

        // Only test connection if properly configured
        let result = { success: true, time: 0 };

        if (provider === 'ollama' && config.ollama_url) {
            result = await measureTime(async () => {
                await ollamaService.testConnection(config.ollama_url);
            });
        } else if (provider === 'openai') {
            // For OpenAI, just verify key exists (actual test would cost money)
            if (!config.openai_api_key) {
                result = { success: false, time: 0, error: 'No API key configured' };
            }
        } else if (provider === 'anthropic') {
            if (!config.anthropic_api_key) {
                result = { success: false, time: 0, error: 'No API key configured' };
            }
        }

        healthCache.ollama = {
            status: result.success ? 'connected' : 'disconnected',
            lastCheck: new Date().toISOString(),
            responseTime: result.time,
            provider: provider,
            error: result.error
        };
    } catch (error) {
        // Unexpected error - treat as not configured rather than error
        healthCache.ollama = {
            status: 'not configured',
            lastCheck: new Date().toISOString(),
            provider: 'none'
        };
    }

    return healthCache.ollama;
}

/**
 * Check all Radarr instances
 */
async function checkRadarr() {
    try {
        let configs;
        try {
            configs = await db.query('SELECT * FROM radarr_config WHERE is_active = true');
        } catch (dbError) {
            // Table doesn't exist - not configured
            healthCache.radarr = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                instances: []
            };
            return healthCache.radarr;
        }

        if (configs.rows.length === 0) {
            healthCache.radarr = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                instances: []
            };
            return healthCache.radarr;
        }

        const instances = [];
        let allConnected = true;
        let anyConnected = false;

        for (const config of configs.rows) {
            const result = await measureTime(async () => {
                await radarrService.testConnection(config);
            });

            instances.push({
                id: config.id,
                name: config.name,
                status: result.success ? 'connected' : 'disconnected',
                responseTime: result.time,
                error: result.error
            });

            if (result.success) anyConnected = true;
            else allConnected = false;
        }

        healthCache.radarr = {
            status: allConnected ? 'connected' : (anyConnected ? 'partial' : 'disconnected'),
            lastCheck: new Date().toISOString(),
            instances: instances,
            responseTime: instances.length > 0 ? Math.round(instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length) : null
        };
    } catch (error) {
        // Treat unexpected errors as not configured
        healthCache.radarr = {
            status: 'not configured',
            lastCheck: new Date().toISOString(),
            instances: []
        };
    }

    return healthCache.radarr;
}

/**
 * Check all Sonarr instances
 */
async function checkSonarr() {
    try {
        let configs;
        try {
            configs = await db.query('SELECT * FROM sonarr_config WHERE is_active = true');
        } catch (dbError) {
            // Table doesn't exist - not configured
            healthCache.sonarr = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                instances: []
            };
            return healthCache.sonarr;
        }

        if (configs.rows.length === 0) {
            healthCache.sonarr = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                instances: []
            };
            return healthCache.sonarr;
        }

        const instances = [];
        let allConnected = true;
        let anyConnected = false;

        for (const config of configs.rows) {
            const result = await measureTime(async () => {
                await sonarrService.testConnection(config);
            });

            instances.push({
                id: config.id,
                name: config.name,
                status: result.success ? 'connected' : 'disconnected',
                responseTime: result.time,
                error: result.error
            });

            if (result.success) anyConnected = true;
            else allConnected = false;
        }

        healthCache.sonarr = {
            status: allConnected ? 'connected' : (anyConnected ? 'partial' : 'disconnected'),
            lastCheck: new Date().toISOString(),
            instances: instances,
            responseTime: instances.length > 0 ? Math.round(instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length) : null
        };
    } catch (error) {
        // Treat unexpected errors as not configured
        healthCache.sonarr = {
            status: 'not configured',
            lastCheck: new Date().toISOString(),
            instances: []
        };
    }

    return healthCache.sonarr;
}

/**
 * Check Media Server (Plex/Jellyfin/Emby)
 */
async function checkMediaServer() {
    try {
        const config = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');

        if (config.rows.length === 0) {
            healthCache.mediaServer = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                type: null
            };
            return healthCache.mediaServer;
        }

        const server = config.rows[0];
        const serverType = server.type || 'plex';

        // Test connection by making a simple API call
        const result = await measureTime(async () => {
            const axios = require('axios');
            const url = server.selected_connection || server.url;

            if (serverType === 'plex') {
                await axios.get(`${url}/identity`, {
                    headers: { 'X-Plex-Token': server.token },
                    timeout: 10000
                });
            } else if (serverType === 'jellyfin' || serverType === 'emby') {
                await axios.get(`${url}/System/Info`, {
                    headers: { 'X-MediaBrowser-Token': server.token },
                    timeout: 10000
                });
            }
        });

        healthCache.mediaServer = {
            status: result.success ? 'connected' : 'disconnected',
            lastCheck: new Date().toISOString(),
            responseTime: result.time,
            type: serverType,
            name: server.name,
            error: result.error
        };
    } catch (error) {
        healthCache.mediaServer = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            error: error.message,
            type: null
        };
    }

    return healthCache.mediaServer;
}

/**
 * Check TMDB API
 */
async function checkTMDB() {
    try {
        const config = await db.query('SELECT api_key FROM tmdb_config LIMIT 1');

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            healthCache.tmdb = {
                status: 'not configured',
                lastCheck: new Date().toISOString()
            };
            return healthCache.tmdb;
        }

        const result = await measureTime(async () => {
            await tmdbService.testConnection();
        });

        healthCache.tmdb = {
            status: result.success ? 'connected' : 'disconnected',
            lastCheck: new Date().toISOString(),
            responseTime: result.time,
            error: result.error
        };
    } catch (error) {
        healthCache.tmdb = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            error: error.message
        };
    }

    return healthCache.tmdb;
}

/**
 * Check Tavily API (optional)
 */
async function checkTavily() {
    try {
        const config = await db.query('SELECT api_key FROM tavily_config LIMIT 1');

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            healthCache.tavily = {
                status: 'not configured',
                lastCheck: new Date().toISOString()
            };
            return healthCache.tavily;
        }

        // For Tavily, just check if key exists (actual test would cost credits)
        healthCache.tavily = {
            status: 'configured',
            lastCheck: new Date().toISOString(),
            responseTime: null
        };
    } catch (error) {
        healthCache.tavily = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            error: error.message
        };
    }

    return healthCache.tavily;
}

/**
 * Run all health checks
 */
async function runAllHealthChecks() {
    console.log('[HealthCheck] Running all health checks...');
    const startTime = Date.now();

    // Run checks in parallel for speed
    await Promise.allSettled([
        checkDatabase(),
        checkDiscordBot(),
        checkOllama(),
        checkRadarr(),
        checkSonarr(),
        checkMediaServer(),
        checkTMDB(),
        checkTavily()
    ]);

    console.log(`[HealthCheck] All checks completed in ${Date.now() - startTime}ms`);
    return getHealthCache();
}

/**
 * Get cached health status
 */
function getHealthCache() {
    return { ...healthCache };
}

/**
 * Start heartbeat scheduler
 */
function startHeartbeat(intervalMs = DEFAULT_HEARTBEAT_MS) {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    console.log(`[HealthCheck] Starting heartbeat scheduler (interval: ${intervalMs / 1000}s)`);

    // Run initial check
    runAllHealthChecks();

    // Schedule periodic checks
    heartbeatInterval = setInterval(() => {
        runAllHealthChecks();
    }, intervalMs);
}

/**
 * Stop heartbeat scheduler
 */
function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        console.log('[HealthCheck] Heartbeat scheduler stopped');
    }
}

/**
 * Check if heartbeat is running
 */
function isHeartbeatRunning() {
    return heartbeatInterval !== null;
}

module.exports = {
    checkDatabase,
    checkDiscordBot,
    checkOllama,
    checkRadarr,
    checkSonarr,
    checkMediaServer,
    checkTMDB,
    checkTavily,
    runAllHealthChecks,
    getHealthCache,
    startHeartbeat,
    stopHeartbeat,
    isHeartbeatRunning
};

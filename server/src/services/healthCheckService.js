/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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
const omdbService = require('./omdb');
const discordBotService = require('./discordBot');
const omdbCircuitBreaker = require('../utils/omdbCircuitBreaker');

// Cache for health status
let healthCache = {
    database: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        previousStatus: null,
        previousResponseTime: null
    },
    discordBot: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        previousStatus: null,
        previousResponseTime: null
    },
    ollama: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        previousStatus: null,
        previousResponseTime: null
    },
    rag: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        pgvector: false, 
        provider: null,
        previousStatus: null
    },
    radarr: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        instances: [],
        previousStatus: null,
        previousResponseTime: null
    },
    sonarr: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        instances: [],
        previousStatus: null,
        previousResponseTime: null
    },
    mediaServer: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        type: null,
        name: null,
        previousStatus: null,
        previousResponseTime: null
    },
    tmdb: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        previousStatus: null,
        previousResponseTime: null
    },
    omdb: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        previousStatus: null,
        previousResponseTime: null
    },
    tavily: { 
        status: 'unknown', 
        lastCheck: null, 
        lastSuccessfulCheck: null,
        responseTime: null,
        previousStatus: null,
        previousResponseTime: null
    }
};

// Heartbeat interval (default: 15 minutes)
let heartbeatInterval = null;
const DEFAULT_HEARTBEAT_MS = 15 * 60 * 1000;

// Track start time for uptime calculation
const startTime = Date.now();

// Worker stall threshold (10 minutes)
const WORKER_STALL_THRESHOLD_MS = 10 * 60 * 1000;

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
    const previous = { ...healthCache.database };
    const result = await measureTime(async () => {
        await db.query('SELECT 1');
    });

    healthCache.database = {
        status: result.success ? 'connected' : 'disconnected',
        lastCheck: new Date().toISOString(),
        lastSuccessfulCheck: result.success ? new Date().toISOString() : previous.lastSuccessfulCheck,
        responseTime: result.time,
        previousStatus: previous.status,
        previousResponseTime: previous.responseTime,
        error: result.error
    };

    return healthCache.database;
}

/**
 * Check Discord bot status
 */
async function checkDiscordBot() {
    const previous = { ...healthCache.discordBot };
    
    try {
        const isConnected = discordBotService.client && discordBotService.client.isReady();

        // Check if Discord is configured
        let isConfigured = false;
        try {
            const config = await db.query('SELECT bot_token FROM discord_config LIMIT 1');
            isConfigured = config.rows.length > 0 && config.rows[0].bot_token;
        } catch (dbError) {
            // Table doesn't exist or query failed - treat as not configured
            isConfigured = false;
        }

        const status = isConnected ? 'connected' : (isConfigured ? 'disconnected' : 'not configured');
        
        healthCache.discordBot = {
            status: status,
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: isConnected ? new Date().toISOString() : previous.lastSuccessfulCheck,
            responseTime: null,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    } catch (error) {
        // Unexpected error - treat as not configured rather than error
        healthCache.discordBot = {
            status: 'not configured',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            responseTime: null,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    }

    return healthCache.discordBot;
}

/**
 * Check Ollama/AI provider status
 */
async function checkOllama() {
    const previous = { ...healthCache.ollama };
    
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
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                provider: 'none',
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.ollama;
        }

        if (aiConfig.rows.length === 0 || !aiConfig.rows[0].primary_provider || aiConfig.rows[0].primary_provider === 'none') {
            healthCache.ollama = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                provider: 'none',
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
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
            lastSuccessfulCheck: result.success ? new Date().toISOString() : previous.lastSuccessfulCheck,
            responseTime: result.time,
            provider: provider,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime,
            error: result.error
        };
    } catch (error) {
        // Unexpected error - treat as not configured rather than error
        healthCache.ollama = {
            status: 'not configured',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            provider: 'none',
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    }

    return healthCache.ollama;
}

/**
 * Check all Radarr instances
 */
async function checkRadarr() {
    const previous = { ...healthCache.radarr };
    
    try {
        let configs;
        try {
            configs = await db.query('SELECT * FROM radarr_config WHERE is_active = true');
        } catch (dbError) {
            // Table doesn't exist - not configured
            healthCache.radarr = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                instances: [],
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.radarr;
        }

        if (configs.rows.length === 0) {
            healthCache.radarr = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                instances: [],
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.radarr;
        }

        const instances = [];
        let allConnected = true;
        let anyConnected = false;

        for (const config of configs.rows) {
            const prevInstance = previous.instances?.find(i => i.id === config.id);
            const result = await measureTime(async () => {
                await radarrService.testConnection(config);
            });

            instances.push({
                id: config.id,
                name: config.name,
                status: result.success ? 'connected' : 'disconnected',
                responseTime: result.time,
                lastSuccessfulCheck: result.success ? new Date().toISOString() : prevInstance?.lastSuccessfulCheck,
                previousStatus: prevInstance?.status,
                previousResponseTime: prevInstance?.responseTime,
                error: result.error
            });

            if (result.success) anyConnected = true;
            else allConnected = false;
        }

        const overallStatus = allConnected ? 'connected' : (anyConnected ? 'partial' : 'disconnected');
        const avgResponseTime = instances.length > 0 ? Math.round(instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length) : null;

        healthCache.radarr = {
            status: overallStatus,
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: allConnected ? new Date().toISOString() : previous.lastSuccessfulCheck,
            instances: instances,
            responseTime: avgResponseTime,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    } catch (error) {
        // Treat unexpected errors as not configured
        healthCache.radarr = {
            status: 'not configured',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            instances: [],
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    }

    return healthCache.radarr;
}

/**
 * Check all Sonarr instances
 */
async function checkSonarr() {
    const previous = { ...healthCache.sonarr };
    
    try {
        let configs;
        try {
            configs = await db.query('SELECT * FROM sonarr_config WHERE is_active = true');
        } catch (dbError) {
            // Table doesn't exist - not configured
            healthCache.sonarr = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                instances: [],
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.sonarr;
        }

        if (configs.rows.length === 0) {
            healthCache.sonarr = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                instances: [],
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.sonarr;
        }

        const instances = [];
        let allConnected = true;
        let anyConnected = false;

        for (const config of configs.rows) {
            const prevInstance = previous.instances?.find(i => i.id === config.id);
            const result = await measureTime(async () => {
                await sonarrService.testConnection(config);
            });

            instances.push({
                id: config.id,
                name: config.name,
                status: result.success ? 'connected' : 'disconnected',
                responseTime: result.time,
                lastSuccessfulCheck: result.success ? new Date().toISOString() : prevInstance?.lastSuccessfulCheck,
                previousStatus: prevInstance?.status,
                previousResponseTime: prevInstance?.responseTime,
                error: result.error
            });

            if (result.success) anyConnected = true;
            else allConnected = false;
        }

        const overallStatus = allConnected ? 'connected' : (anyConnected ? 'partial' : 'disconnected');
        const avgResponseTime = instances.length > 0 ? Math.round(instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length) : null;

        healthCache.sonarr = {
            status: overallStatus,
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: allConnected ? new Date().toISOString() : previous.lastSuccessfulCheck,
            instances: instances,
            responseTime: avgResponseTime,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    } catch (error) {
        // Treat unexpected errors as not configured
        healthCache.sonarr = {
            status: 'not configured',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            instances: [],
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    }

    return healthCache.sonarr;
}

/**
 * Check Media Server (Plex/Jellyfin/Emby)
 */
async function checkMediaServer() {
    const previous = { ...healthCache.mediaServer };
    
    try {
        const config = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');

        if (config.rows.length === 0) {
            healthCache.mediaServer = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                type: null,
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
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
            lastSuccessfulCheck: result.success ? new Date().toISOString() : previous.lastSuccessfulCheck,
            responseTime: result.time,
            type: serverType,
            name: server.name,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime,
            error: result.error
        };
    } catch (error) {
        healthCache.mediaServer = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            error: error.message,
            type: null,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    }

    return healthCache.mediaServer;
}

/**
 * Check TMDB API
 */
async function checkTMDB() {
    const previous = { ...healthCache.tmdb };
    
    try {
        const config = await db.query('SELECT api_key FROM tmdb_config LIMIT 1');

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            healthCache.tmdb = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.tmdb;
        }

        const result = await measureTime(async () => {
            await tmdbService.testConnection();
        });

        healthCache.tmdb = {
            status: result.success ? 'connected' : 'disconnected',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: result.success ? new Date().toISOString() : previous.lastSuccessfulCheck,
            responseTime: result.time,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime,
            error: result.error
        };
    } catch (error) {
        healthCache.tmdb = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            error: error.message,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    }

    return healthCache.tmdb;
}

/**
 * Check OMDb API
 */
async function checkOMDb() {
    const previous = { ...healthCache.omdb };
    
    try {
        const config = await db.query('SELECT api_key FROM omdb_config WHERE is_active = true LIMIT 1');

        // Get circuit breaker status
        const circuitStatus = omdbCircuitBreaker.getStatus();

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            healthCache.omdb = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime,
                circuitBreaker: circuitStatus
            };
            return healthCache.omdb;
        }

        // Check if circuit is OPEN
        if (circuitStatus.state === 'OPEN') {
            healthCache.omdb = {
                status: 'circuit_open',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime,
                circuitBreaker: circuitStatus,
                error: `Circuit breaker is OPEN. Next retry: ${circuitStatus.nextAttempt ? new Date(circuitStatus.nextAttempt).toISOString() : 'unknown'}`
            };
            return healthCache.omdb;
        }

        const result = await measureTime(async () => {
            await omdbService.testConnection(config.rows[0].api_key);
        });

        healthCache.omdb = {
            status: result.success ? 'connected' : 'disconnected',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: result.success ? new Date().toISOString() : previous.lastSuccessfulCheck,
            responseTime: result.time,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime,
            error: result.error,
            circuitBreaker: circuitStatus
        };
    } catch (error) {
        const circuitStatus = omdbCircuitBreaker.getStatus();
        healthCache.omdb = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            error: error.message,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime,
            circuitBreaker: circuitStatus
        };
    }

    return healthCache.omdb;
}

/**
 * Check Tavily API (optional)
 */
async function checkTavily() {
    const previous = { ...healthCache.tavily };
    
    try {
        const config = await db.query('SELECT api_key FROM tavily_config LIMIT 1');

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            healthCache.tavily = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.tavily;
        }

        // For Tavily, just check if key exists (actual test would cost credits)
        healthCache.tavily = {
            status: 'configured',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: new Date().toISOString(),
            responseTime: null,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    } catch (error) {
        healthCache.tavily = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            error: error.message,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    }

    return healthCache.tavily;
}

/**
 * Check RAG (Semantic Search) status
 */
async function checkRAG() {
    const previous = { ...healthCache.rag };
    
    try {
        // Check if RAG is enabled
        const config = await db.query(
            'SELECT rag_enabled, embedding_provider, embedding_model FROM ai_provider_config WHERE id = 1'
        );

        if (config.rows.length === 0 || !config.rows[0].rag_enabled) {
            healthCache.rag = {
                status: 'disabled',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                pgvector: false,
                provider: null,
                previousStatus: previous.status
            };
            return healthCache.rag;
        }

        // Check pgvector extension
        let pgvectorAvailable = false;
        try {
            await db.query("SELECT 'test'::vector(3)");
            pgvectorAvailable = true;
        } catch (pgError) {
            // pgvector not installed
        }

        // Check embedding count
        let embeddingCount = 0;
        let staleCount = 0;
        try {
            const countResult = await db.query('SELECT COUNT(*) FROM classification_embeddings');
            const staleResult = await db.query('SELECT COUNT(*) FROM classification_embeddings WHERE is_stale = true');
            embeddingCount = parseInt(countResult.rows[0].count) || 0;
            staleCount = parseInt(staleResult.rows[0].count) || 0;
        } catch (e) {
            // Table may not exist yet
        }

        const currentStatus = pgvectorAvailable ? 'available' : 'unavailable';
        
        healthCache.rag = {
            status: currentStatus,
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: pgvectorAvailable ? new Date().toISOString() : previous.lastSuccessfulCheck,
            pgvector: pgvectorAvailable,
            provider: config.rows[0].embedding_provider,
            model: config.rows[0].embedding_model,
            embeddingCount: embeddingCount,
            staleCount: staleCount,
            previousStatus: previous.status
        };
    } catch (error) {
        healthCache.rag = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            error: error.message,
            pgvector: false,
            previousStatus: previous.status
        };
    }

    return healthCache.rag;
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
        checkRAG(),
        checkRadarr(),
        checkSonarr(),
        checkMediaServer(),
        checkTMDB(),
        checkOMDb(),
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

/**
 * Check Queue Worker status
 */
async function checkQueueWorker() {
    try {
        const result = await db.query(
            `SELECT
                 SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                 SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                 MAX(started_at) AS last_activity
             FROM task_queue`
        );

        const processingCount = parseInt(result.rows[0].processing) || 0;
        const pendingCount = parseInt(result.rows[0].pending) || 0;
        const lastActivity = result.rows[0].last_activity;

        // Check if worker is stalled (no activity in last 10 minutes with pending tasks)
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

/**
 * Get uptime in seconds
 */
function getUptime() {
    const uptimeMs = Date.now() - startTime;
    return Math.floor(uptimeMs / 1000);
}

/**
 * Get all services health with caching (30 seconds TTL)
 */
let servicesHealthCache = null;
let servicesHealthCacheTime = null;
const SERVICES_CACHE_TTL = 30000; // 30 seconds

async function getAllServicesHealth() {
    const now = Date.now();
    
    // Return cached result if still valid
    if (servicesHealthCache && servicesHealthCacheTime && (now - servicesHealthCacheTime) < SERVICES_CACHE_TTL) {
        return servicesHealthCache;
    }

    // Run all checks in parallel
    const [database, mediaServer, radarr, sonarr, aiProvider, queueWorker] = await Promise.all([
        checkDatabase(),
        checkMediaServer(),
        checkRadarr(),
        checkSonarr(),
        checkOllama(),
        checkQueueWorker()
    ]);

    const result = {
        database,
        mediaServer,
        radarr,
        sonarr,
        aiProvider,
        queueWorker,
        timestamp: new Date().toISOString()
    };

    // Update cache
    servicesHealthCache = result;
    servicesHealthCacheTime = now;

    return result;
}

module.exports = {
    checkDatabase,
    checkDiscordBot,
    checkOllama,
    checkRAG,
    checkRadarr,
    checkSonarr,
    checkMediaServer,
    checkTMDB,
    checkOMDb,
    checkTavily,
    checkQueueWorker,
    runAllHealthChecks,
    getAllServicesHealth,
    getHealthCache,
    getUptime,
    startHeartbeat,
    stopHeartbeat,
    isHeartbeatRunning
};

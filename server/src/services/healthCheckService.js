/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const os = require('os');
const db = require('../config/database');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');
const ollamaService = require('./ollama');
const tmdbService = require('./tmdb');
const omdbService = require('./omdb');
const discordBotService = require('./discordBot');
const { createLogger } = require('../utils/logger');

const logger = createLogger('healthCheck');


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
    },
    imageEmbeddings: {
        status: 'unknown',
        lastCheck: null,
        lastSuccessfulCheck: null,
        responseTime: null,
        provider: 'unknown',
        mode: 'disabled',
        readiness: 'unknown',
        ready: null,
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
        } catch (_dbError) {
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
    } catch (_error) {
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
        } catch (_dbError) {
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
    } catch (_error) {
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
        } catch (_dbError) {
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
    } catch (_error) {
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
        } catch (_dbError) {
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
    } catch (_error) {
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

        if (config.rows.length === 0 || !config.rows[0].api_key) {
            healthCache.omdb = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
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
            error: result.error
        };
    } catch (error) {
        healthCache.omdb = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            error: error.message,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
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
        } catch (_pgError) {
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
        } catch (_e) {
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
 * Check image embedding provider status
 */
async function checkImageEmbeddings() {
    const previous = { ...healthCache.imageEmbeddings };

    try {
        const result = await db.query(`
            SELECT
                rag_image_weight,
                image_embedding_provider_mode,
                image_embedding_local_host,
                image_embedding_local_port,
                image_embedding_cloud_provider,
                image_embedding_cloud_api_key,
                image_embedding_models_cache_updated_at
            FROM ai_provider_config
            WHERE id = 1
        `);

        if (result.rows.length === 0) {
            healthCache.imageEmbeddings = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                provider: 'unknown',
                mode: 'disabled',
                readiness: 'unknown',
                ready: null,
                previousStatus: previous.status
            };
            return healthCache.imageEmbeddings;
        }

        const config = result.rows[0];
        const rawMode = (config.image_embedding_provider_mode || 'disabled').toLowerCase();
        const mode = rawMode === 'local'
            ? 'separate_local'
            : (['disabled', 'separate_local', 'cloud'].includes(rawMode) ? rawMode : 'disabled');
        const imageWeight = Number(config.rag_image_weight ?? 0);
        const imageEnabled = Number.isFinite(imageWeight) && imageWeight > 0;
        let provider = 'unknown';

        if (mode === 'disabled' || !imageEnabled) {
            healthCache.imageEmbeddings = {
                status: 'disabled',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                provider: 'disabled',
                mode,
                readiness: 'disabled',
                ready: false,
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.imageEmbeddings;
        }

        if (mode === 'cloud') {
            provider = config.image_embedding_cloud_provider || 'cloud';
        } else if (mode === 'separate_local') {
            provider = 'local';
        }

        const hasLocalConfig = !!String(config.image_embedding_local_host || '').trim();
        const hasCloudConfig = !!String(config.image_embedding_cloud_provider || '').trim()
            && !!String(config.image_embedding_cloud_api_key || '').trim();

        if ((provider === 'local' && !hasLocalConfig) || (provider === 'cloud' && !hasCloudConfig)) {
            healthCache.imageEmbeddings = {
                status: 'not configured',
                lastCheck: new Date().toISOString(),
                lastSuccessfulCheck: previous.lastSuccessfulCheck,
                responseTime: null,
                provider,
                mode,
                readiness: 'not_configured',
                ready: false,
                previousStatus: previous.status,
                previousResponseTime: previous.responseTime
            };
            return healthCache.imageEmbeddings;
        }

        let success = false;
        let responseTime = 0;
        let error = null;
        let readiness = provider === 'cloud' ? 'ready' : 'unknown';
        let ready = provider === 'cloud' ? true : null;

        if (provider === 'local' && config.image_embedding_local_host) {
            const host = config.image_embedding_local_host;
            const port = config.image_embedding_local_port || 8000;
            const baseUrl = `http://${host}:${port}`;
            const healthUrl = `${baseUrl}/health`;
            const start = Date.now();

            try {
                const axios = require('axios');
                const response = await axios.get(healthUrl, { timeout: 5000 });
                responseTime = Date.now() - start;
                success = response.status >= 200 && response.status < 300;

                if (success) {
                    try {
                        const readyResponse = await axios.get(`${baseUrl}/ready`, { timeout: 5000 });
                        const readyPayload = readyResponse?.data || {};
                        const isReady = readyPayload.ready === true && readyPayload.default_model_loaded !== false;

                        ready = isReady;
                        readiness = isReady ? 'ready' : 'warming_up';
                    } catch (readyError) {
                        const readyStatus = readyError?.response?.status;

                        if (readyStatus === 404 || readyStatus === 405) {
                            // Older sidecar builds may not expose /ready yet.
                            ready = null;
                            readiness = 'unknown';
                        } else {
                            ready = null;
                            readiness = 'unknown';
                            logger.warn('Image embedding readiness check failed after successful health check', {
                                error: readyError.message,
                                status: readyStatus
                            });
                        }
                    }
                }
            } catch (err) {
                responseTime = Date.now() - start;
                error = err.message;
            }
        } else if (provider === 'cloud') {
            // Cloud: treat as configured if provider set, but don't ping paid APIs
            success = !!config.image_embedding_cloud_provider;
        }

        let hasStoredImageEmbeddings = false;
        if (!success) {
            try {
                const imageResult = await db.query(`
                    SELECT EXISTS (
                        SELECT 1
                        FROM classification_embeddings
                        WHERE image_embedding IS NOT NULL
                    ) AS has_image_embeddings
                `);
                hasStoredImageEmbeddings = imageResult.rows[0]?.has_image_embeddings === true;
            } catch (_imageError) {
                hasStoredImageEmbeddings = false;
            }
        }

        const status = success
            ? (provider === 'local' && readiness === 'warming_up' ? 'degraded' : 'connected')
            : ((provider === 'unknown'
                || (!hasStoredImageEmbeddings
                    && !previous.lastSuccessfulCheck
                    && !config.image_embedding_models_cache_updated_at))
                ? 'not configured'
                : 'disconnected');

        healthCache.imageEmbeddings = {
            status,
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: success ? new Date().toISOString() : previous.lastSuccessfulCheck,
            responseTime: responseTime || null,
            provider,
            mode,
            readiness,
            ready,
            error,
            previousStatus: previous.status,
            previousResponseTime: previous.responseTime
        };
    } catch (error) {
        healthCache.imageEmbeddings = {
            status: 'error',
            lastCheck: new Date().toISOString(),
            lastSuccessfulCheck: previous.lastSuccessfulCheck,
            error: error.message,
            provider: 'unknown',
            readiness: 'unknown',
            ready: null,
            previousStatus: previous.status
        };
    }

    return healthCache.imageEmbeddings;
}

/**
 * Run all health checks
 */
async function runAllHealthChecks() {
    logger.info('[HealthCheck] Running all health checks...');
    const startTime = Date.now();

    // Run checks in parallel for speed
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

    logger.info(`[HealthCheck] Starting heartbeat scheduler (interval: ${intervalMs / 1000}s)`);

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
        logger.info('[HealthCheck] Heartbeat scheduler stopped');
    }
}

/**
 * Check if heartbeat is running
 */
function isHeartbeatRunning() {
    return heartbeatInterval !== null;
}

/**
 * Check process and OS memory.
 * Reports Node.js heap (used/total) and host free/total RAM so operators can
 * spot memory pressure before it triggers an OOM kill.
 */
function checkProcessMemory() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Derive the effective Node.js heap cap:
    //   1. Respect NODE_OPTIONS --max-old-space-size if set.
    //   2. Fall back to v8.getHeapStatistics().heap_size_limit (runtime cap).
    let heapCapMb = null;
    try {
        const v8 = require('v8');
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

    // Derive a simple status:
    //   warning  → heap > 75% of cap OR OS used > 85%
    //   critical → heap > 90% of cap OR OS used > 95%
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
             FROM task_queue
             WHERE status IN ('pending', 'processing')
                OR (status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour')`
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
    const [database, mediaServer, radarr, sonarr, aiProvider, queueWorker, imageEmbeddings] = await Promise.all([
        checkDatabase(),
        checkMediaServer(),
        checkRadarr(),
        checkSonarr(),
        checkOllama(),
        checkQueueWorker(),
        checkImageEmbeddings()
    ]);

    const result = {
        database,
        mediaServer,
        radarr,
        sonarr,
        aiProvider,
        imageEmbeddings,
        queueWorker,
        memory: checkProcessMemory(),
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
    checkImageEmbeddings,
    checkProcessMemory,
    runAllHealthChecks,
    getAllServicesHealth,
    getHealthCache,
    getUptime,
    startHeartbeat,
    stopHeartbeat,
    isHeartbeatRunning
};

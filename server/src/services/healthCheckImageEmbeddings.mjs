/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { httpGet } from '../utils/httpClient.mjs';
import * as db from '../config/database.mjs';
import {
    AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
    buildEmbeddingRuntimeDedupeKey,
} from './aiEmbeddingProviderIntegrityService.mjs';
import {
    buildImageEmbeddingsHealthState,
} from './healthCheckServiceShared.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('healthCheckImageEmbeddings');

export async function checkImageEmbeddings(previous) {
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
            return buildImageEmbeddingsHealthState(previous, 'not configured', {
                provider: 'unknown',
                mode: 'disabled',
                readiness: 'unknown',
                ready: null,
            });
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
            return buildImageEmbeddingsHealthState(previous, 'disabled', {
                provider: 'disabled',
                mode,
                readiness: 'disabled',
                ready: false,
            });
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
            return buildImageEmbeddingsHealthState(previous, 'not configured', {
                responseTime: null,
                provider,
                mode,
                readiness: 'not_configured',
                ready: false,
            });
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
                const response = await httpGet(healthUrl, { timeout: 5000 });
                responseTime = Date.now() - start;
                success = response.status >= 200 && response.status < 300;

                if (success) {
                    try {
                        const readyResponse = await httpGet(`${baseUrl}/ready`, { timeout: 5000 });
                        const readyPayload = readyResponse?.data || {};
                        const isReady = readyPayload.ready === true && readyPayload.default_model_loaded !== false;

                        ready = isReady;
                        readiness = isReady ? 'ready' : 'warming_up';
                    } catch (readyError) {
                        const readyStatus = readyError?.response?.status;

                        if (readyStatus === 404 || readyStatus === 405) {
                            ready = null;
                            readiness = 'unknown';
                        } else {
                            ready = null;
                            readiness = 'unknown';
                            logger.warn('Image embedding readiness check failed after successful health check', {
                                error: readyError.message,
                                status: readyStatus
                            }, {
                                dedupeKey: buildEmbeddingRuntimeDedupeKey(
                                    'image',
                                    'readiness_probe_failed',
                                    `${provider}:${readyStatus || readyError.code || readyError.message || 'unknown'}`
                                ),
                                dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
                            });
                        }
                    }
                }
            } catch (err) {
                responseTime = Date.now() - start;
                error = err.message;
            }
        } else if (provider === 'cloud') {
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
                || (!hasStoredImageEmbeddings && !previous.lastSuccessfulCheck))
                ? 'not configured'
                : 'disconnected');

        return buildImageEmbeddingsHealthState(previous, status, {
            lastSuccessfulCheck: success ? new Date().toISOString() : previous.lastSuccessfulCheck,
            responseTime: responseTime || null,
            provider,
            mode,
            readiness,
            ready,
            error,
        });
    } catch (error) {
        logger.error('[HEALTH] Unexpected error in checkImageEmbeddings', { error: error.message });
        return buildImageEmbeddingsHealthState(previous, 'error', {
            error: error.message,
            provider: 'unknown',
            readiness: 'unknown',
            ready: null,
        });
    }
}
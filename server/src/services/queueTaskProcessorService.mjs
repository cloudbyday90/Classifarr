/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { QueueOmdbEnrichmentService } from './queueOmdbEnrichmentService.mjs';
import { QueueTavilyEnrichmentService } from './queueTavilyEnrichmentService.mjs';
import { QueueTmdbResolutionService } from './queueTmdbResolutionService.mjs';
import { QueueClassificationHistoryService } from './queueClassificationHistoryService.mjs';
import metadataEnrichment from '../utils/metadataEnrichment.mjs';
import ratingNormalizer from '../utils/ratingNormalizer.mjs';
import { parsePayload } from '../utils/queueHelpers.mjs';

function parseEnvMs(envValue, defaultValue) {
    const parsed = Number.parseInt(envValue || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

class QueueTaskProcessorService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.classificationService = deps.classificationService;
        this.omdbService = deps.omdbService;
        this.tmdbService = deps.tmdbService;
        this.completeTask = deps.completeTask || (async () => {});
        this.failTask = deps.failTask || (async () => {});
        this.ratingNormalizer = deps.ratingNormalizer || ratingNormalizer;
        this.metadataEnrichment = deps.metadataEnrichment || metadataEnrichment;
        this.queryWithTimeout = deps.queryWithTimeout || ((...args) => this._queryWithTimeout(...args));
        this.omdbLimitHit = false;
        this.lastOmdbCircuitWarnAt = 0;
        this.lastOmdbSslWarnAt = 0;
        this.omdbSslBlockedUntil = 0;
        this.lastOmdbSslProbeAt = 0;
        this.omdbCircuitWarnThrottleMs = deps.omdbCircuitWarnThrottleMs || 60_000;
        this.omdbSslWarnThrottleMs = deps.omdbSslWarnThrottleMs || parseEnvMs(process.env.OMDB_SSL_WARN_THROTTLE_MS, 15 * 60 * 1000);
        this.omdbSslBlockMs = deps.omdbSslBlockMs || parseEnvMs(process.env.OMDB_SSL_BLOCK_MS, 15 * 60 * 1000);
        this.omdbSslRecoveryProbeMs = deps.omdbSslRecoveryProbeMs || parseEnvMs(process.env.OMDB_SSL_RECOVERY_PROBE_MS, 60 * 1000);
        this.queueOmdbEnrichmentService = deps.queueOmdbEnrichmentService || new QueueOmdbEnrichmentService({
            db: this.db,
            logger: this.logger,
            omdbService: this.omdbService,
            queryWithTimeout: (...args) => this.queryWithTimeout(...args),
            isOmdbSslBlocked: (...args) => this.isOmdbSslBlocked(...args),
            getRuntimeState: () => ({
                omdbLimitHit: this.omdbLimitHit,
                lastOmdbCircuitWarnAt: this.lastOmdbCircuitWarnAt,
                lastOmdbSslWarnAt: this.lastOmdbSslWarnAt,
                omdbSslBlockedUntil: this.omdbSslBlockedUntil,
            }),
            setRuntimeState: (patch) => {
                if (Object.prototype.hasOwnProperty.call(patch, 'omdbLimitHit')) {
                    this.omdbLimitHit = patch.omdbLimitHit;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'lastOmdbCircuitWarnAt')) {
                    this.lastOmdbCircuitWarnAt = patch.lastOmdbCircuitWarnAt;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'lastOmdbSslWarnAt')) {
                    this.lastOmdbSslWarnAt = patch.lastOmdbSslWarnAt;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'omdbSslBlockedUntil')) {
                    this.omdbSslBlockedUntil = patch.omdbSslBlockedUntil;
                }
            },
            omdbCircuitWarnThrottleMs: this.omdbCircuitWarnThrottleMs,
            omdbSslWarnThrottleMs: this.omdbSslWarnThrottleMs,
            omdbSslBlockMs: this.omdbSslBlockMs,
        });
        this.queueTavilyEnrichmentService = deps.queueTavilyEnrichmentService || new QueueTavilyEnrichmentService({
            db: this.db,
            logger: this.logger,
        });
        this.queueTmdbResolutionService = deps.queueTmdbResolutionService || new QueueTmdbResolutionService({
            logger: this.logger,
            tmdbService: this.tmdbService,
            queryWithTimeout: (...args) => this.queryWithTimeout(...args),
        });
        this.queueClassificationHistoryService = deps.queueClassificationHistoryService || new QueueClassificationHistoryService({
            db: this.db,
            logger: this.logger,
        });
    }

    async resolveSourceLibraryName(sourceLibraryId, sourceLibraryName, taskContext = {}) {
        if (sourceLibraryName || !sourceLibraryId) {
            return sourceLibraryName;
        }

        try {
            const result = await this.db.query(
                'SELECT name FROM libraries WHERE id = $1',
                [sourceLibraryId]
            );

            const resolvedName = result.rows[0]?.name || null;
            if (resolvedName) {
                this.logger.info('Self-heal: Retrieved missing source library name from libraries table', {
                    libraryId: sourceLibraryId,
                    libraryName: resolvedName,
                    ...taskContext
                });
            }

            return resolvedName;
        } catch (lookupError) {
            this.logger.debug('Source library name lookup failed', {
                libraryId: sourceLibraryId,
                error: lookupError.message,
                ...taskContext
            });
            return sourceLibraryName;
        }
    }

    async processRatingNormalization(task) {
        const ratingNormalizer = this.ratingNormalizer;
        const payload = parsePayload(task.payload);
        const { media_item_id } = payload;

        let skipped = false;
        let originalRating, normalizedRating;

        const client = await this.db.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query("SET LOCAL statement_timeout = '30000'");

            const result = await client.query(`
                SELECT id, content_rating, metadata, media_type
                FROM media_server_items WHERE id = $1
            `, [media_item_id]);

            if (result.rows.length === 0) {
                skipped = true;
            } else {
                const item = result.rows[0];
                originalRating = item.content_rating;
                normalizedRating = ratingNormalizer.getPriorityRating(item);

                await client.query(`
                    UPDATE media_server_items
                    SET original_rating = COALESCE(original_rating, $2), 
                        content_rating = $3, 
                        last_synced = NOW()
                    WHERE id = $1
                `, [media_item_id, originalRating, normalizedRating]);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {}); // swallow-error: best-effort ROLLBACK in error handler — already in error state, cannot re-throw
            this.logger.error('Rating normalization failed', {
                itemId: media_item_id,
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }

        if (skipped) {
            await this.completeTask(task.id, { skipped: true, reason: 'Item not found' });
            return;
        }

        if (normalizedRating !== originalRating) {
            this.logger.info('Rating normalized', {
                itemId: media_item_id,
                original: originalRating,
                normalized: normalizedRating
            });

            await this.completeTask(task.id, {
                normalized: true,
                original: originalRating,
                new: normalizedRating
            });
            return;
        }

        this.logger.debug('Rating already standard', {
            itemId: media_item_id,
            rating: originalRating
        });

        await this.completeTask(task.id, {
            normalized: false,
            reason: 'Rating already standard',
            rating: originalRating
        });
    }

    async processClassificationTask(task) {
        const payload = parsePayload(task.payload);
        const result = await this.classificationService.classify({ ...payload, taskId: task.id });
        await this.completeTask(task.id, result);

        if (payload.itemId && result.bestMatch) {
            const newMetadata = {
                content_analysis: {
                    type: result.bestMatch.type,
                    confidence: result.bestMatch.confidence,
                    detected_at: new Date().toISOString()
                }
            };

            await this.queryWithTimeout(
                `UPDATE media_server_items 
                 SET metadata = metadata || $1::jsonb
                 WHERE id = $2`,
                [JSON.stringify(newMetadata), payload.itemId]
            );
        }

        if (task.webhook_log_id) {
            await this.db.query(
                `UPDATE webhook_log SET processing_status = 'completed', 
   routed_to_library = $2, processing_time_ms = EXTRACT(EPOCH FROM (NOW() - $3)) * 1000
   WHERE id = $1`,
                [task.webhook_log_id, result.library?.name, task.started_at]
            );
        }
    }

    async processMetadataEnrichmentTask(task) {
        const { hasTavilyEnrichmentMetadata } = this.metadataEnrichment;
        const enrichPayload = parsePayload(task.payload);
        let enrichTmdbId = enrichPayload.tmdbId || enrichPayload.tmdb_id;
        let enrichSourceLibraryId = enrichPayload.source_library_id;
        let enrichSourceLibraryName = enrichPayload.source_library_name;

        if (enrichPayload.itemId && (!enrichTmdbId || !enrichSourceLibraryId)) {
            try {
                const itemResult = await this.db.query(
                    `SELECT msi.tmdb_id, msi.library_id, msi.metadata, l.name as library_name 
                     FROM media_server_items msi 
                     LEFT JOIN libraries l ON msi.library_id = l.id 
                     WHERE msi.id = $1`,
                    [enrichPayload.itemId]
                );
                if (itemResult.rows.length > 0) {
                    const row = itemResult.rows[0];
                    if (!enrichTmdbId && row.tmdb_id) {
                        enrichTmdbId = row.tmdb_id;
                    }
                    if (!enrichSourceLibraryId && row.library_id) {
                        enrichSourceLibraryId = row.library_id;
                    }
                    if (!enrichSourceLibraryName && row.library_name) {
                        enrichSourceLibraryName = row.library_name;
                    }
                    if (!enrichPayload.posterPath && row.metadata) {
                        const itemMetadata = parsePayload(row.metadata);
                        if (itemMetadata?.posterPath) {
                            enrichPayload.posterPath = itemMetadata.posterPath;
                        }
                        if (!enrichPayload.poster_path && itemMetadata?.poster_path) {
                            enrichPayload.poster_path = itemMetadata.poster_path;
                        }
                    }
                    this.logger.info('Self-heal: Retrieved missing metadata from database', {
                        itemId: enrichPayload.itemId,
                        tmdbId: enrichTmdbId,
                        libraryId: enrichSourceLibraryId,
                        libraryName: enrichSourceLibraryName
                    });
                }
            } catch (lookupError) {
                this.logger.debug('Self-heal lookup failed', { error: lookupError.message });
            }
        }

        enrichSourceLibraryName = await this.resolveSourceLibraryName(
            enrichSourceLibraryId,
            enrichSourceLibraryName,
            {
                itemId: enrichPayload.itemId,
                title: enrichPayload.title
            }
        );

        const enrichmentData = {
            source_library_id: enrichSourceLibraryId,
            source_library_name: enrichSourceLibraryName,
            content_analysis: {
                type: 'source_library',
                confidence: 100,
                detected_at: new Date().toISOString(),
                source: 'metadata_enrichment',
                source_library_id: enrichSourceLibraryId,
                source_library_name: enrichSourceLibraryName
            }
        };

        await this.queueOmdbEnrichmentService.enrich(enrichPayload, enrichmentData);

        await this.queueTavilyEnrichmentService.enrich(enrichPayload, enrichmentData);

        if (enrichPayload.itemId) {
            const historyPayload = {
                ...enrichPayload,
                source_library_id: enrichSourceLibraryId,
                source_library_name: enrichSourceLibraryName
            };

            enrichmentData.content_analysis = {
                ...enrichmentData.content_analysis,
                type: enrichPayload.media?.media_type || 'unknown',
                confidence: 100,
                method: 'source_library',
                source: 'metadata_enrichment',
                detected_at: new Date().toISOString()
            };

            enrichTmdbId = await this.queueTmdbResolutionService.resolveAndBackfill(
                enrichPayload,
                enrichmentData,
                enrichTmdbId
            );

            await this.queryWithTimeout(
                `UPDATE media_server_items 
                 SET metadata = metadata || $1::jsonb
                 WHERE id = $2`,
                [JSON.stringify(enrichmentData), enrichPayload.itemId]
            );

            await this.queueClassificationHistoryService.persist(
                historyPayload,
                enrichTmdbId,
                enrichSourceLibraryId,
                enrichSourceLibraryName,
                task.id
            );

            const hasTavily = hasTavilyEnrichmentMetadata(enrichmentData);
            this.logger.info('Metadata enrichment complete (no AI, from source library)', {
                itemId: enrichPayload.itemId,
                title: enrichPayload.title,
                sourceLibrary: enrichSourceLibraryName,
                tavilyEnriched: hasTavily
            });
        }

        await this.completeTask(task.id, {
            enriched: true,
            sourceLibrary: enrichSourceLibraryName,
            tavilyEnriched: hasTavilyEnrichmentMetadata(enrichmentData)
        });
    }

    async rebuildImageIndexes(task) {
        this.logger.info('Rebuilding deferred HNSW and B-tree image indexes...');
        await this.db.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_hnsw
            ON classification_embeddings USING hnsw (image_embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        `);
        await this.db.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_present
            ON classification_embeddings (image_provider, image_model)
            WHERE image_embedding IS NOT NULL
        `);
        await this.db.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_hash
            ON classification_embeddings (image_embedding_hash, image_model, image_embedding_size)
            WHERE image_embedding_hash IS NOT NULL
        `);
        this.logger.info('HNSW and supporting image indexes rebuilt successfully.');
        await this.completeTask(task.id, {
            rebuilt: true,
            indexes: [
                'idx_embeddings_image_hnsw',
                'idx_embeddings_image_present',
                'idx_embeddings_image_hash'
            ]
        });
    }

    async processTask(task) {
        this.logger.info('Processing task', { taskId: task.id, taskType: task.task_type });

        try {
            switch (task.task_type) {
                case 'classification':
                    await this.processClassificationTask(task);
                    break;

                case 'metadata_enrichment':
                    await this.processMetadataEnrichmentTask(task);
                    break;

                case 'rating_normalization':
                    await this.processRatingNormalization(task);
                    break;

                case 'rebuild_hnsw_index':
                    await this.rebuildImageIndexes(task);
                    break;

                default:
                    this.logger.warn('Unknown task type', { taskType: task.task_type });
                    await this.failTask(task.id, `Unknown task type: ${task.task_type}`, task.attempts, task.max_attempts);
            }
        } catch (error) {
            this.logger.error('Task processing failed', { taskId: task.id, error: error.message });
            await this.failTask(task.id, error.message, task.attempts, task.max_attempts);

            if (task.webhook_log_id) {
                await this.db.query(
                    `UPDATE webhook_log SET processing_status = 'failed', error_message = $2 WHERE id = $1`,
                    [task.webhook_log_id, error.message]
                );
            }
        }
    }

    async _queryWithTimeout(sql, params, timeoutMs = 30_000) {
        let client;
        try {
            if (this.db.pool && typeof this.db.pool.connect === 'function') {
                client = await this.db.pool.connect();
            }
        } catch (_) {
            // Pool unavailable — fall through to regular query
        }

        if (!client || typeof client.query !== 'function') {
            return this.db.query(sql, params);
        }

        try {
            await client.query('BEGIN');
            await client.query(`SET LOCAL statement_timeout = '${timeoutMs}'`); // sql-interpolation: SET LOCAL timeout — numeric param, not user-controlled; $N not supported by PostgreSQL SET
            const result = await client.query(sql, params);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {}); // swallow-error: best-effort ROLLBACK in error handler — already in error state
            throw err;
        } finally {
            client.release();
        }
    }

    async isOmdbSslBlocked(omdbApiKey, title) {
        const now = Date.now();

        if (this.omdbSslBlockedUntil === 0 || now >= this.omdbSslBlockedUntil) {
            return false;
        }

        if ((now - this.lastOmdbSslProbeAt) < this.omdbSslRecoveryProbeMs) {
            return true;
        }

        this.lastOmdbSslProbeAt = now;

        try {
            const health = await this.omdbService.checkHealth(omdbApiKey);
            if (health?.healthy) {
                this.omdbSslBlockedUntil = 0;
                this.lastOmdbSslWarnAt = 0;
                this.logger.info('OMDb SSL recovery detected; resuming OMDb enrichment', { title });
                return false;
            }

            if (health?.ssl_error) {
                this.omdbSslBlockedUntil = now + this.omdbSslBlockMs;
                if ((now - this.lastOmdbSslWarnAt) >= this.omdbSslWarnThrottleMs) {
                    this.lastOmdbSslWarnAt = now;
                    this.logger.warn('OMDb SSL certificate issue persists; OMDb enrichment remains temporarily paused', {
                        title,
                        message: health.message
                    });
                } else {
                    this.logger.debug('OMDb SSL persistent warning suppressed', { title });
                }
                return true;
            }
        } catch (healthError) {
            this.logger.debug('OMDb SSL recovery probe failed', {
                title,
                error: healthError.message
            });
        }

        return true;
    }

    resetOmdbState() {
        this.omdbLimitHit = false;
        this.lastOmdbCircuitWarnAt = 0;
        this.lastOmdbSslWarnAt = 0;
        this.omdbSslBlockedUntil = 0;
        this.lastOmdbSslProbeAt = 0;
    }
}

export { QueueTaskProcessorService };

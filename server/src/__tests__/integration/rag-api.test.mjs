/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/*
 * Integration tests for canonical RAG API endpoints.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const mockLoggerModule = {
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
};

jest.unstable_mockModule('../../utils/logger.mjs', () => ({
    ...mockLoggerModule,
    default: mockLoggerModule
}));

const { ragLoopMetricsCollector } = await import('../../services/ragLoopMetricsCollector.mjs');
const { manualBackfillService } = await import('../../services/manualBackfillService.mjs');
const { embeddingProvider } = await import('../../services/embeddingProvider.mjs');
const { router: ragRouter } = await import('../../routes/rag.mjs');
const app = express();
app.use(bodyParser.json());
app.use('/api/rag', ragRouter);

describe('RAG API Integration Tests', () => {
    let pool;

    beforeAll(async () => {
        pool = getPool();

        await pool.query('TRUNCATE TABLE ai_provider_config RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE classification_embeddings RESTART IDENTITY CASCADE');

        await pool.query(`
            INSERT INTO ai_provider_config (id, primary_provider, embedding_provider_mode) 
            VALUES (1, 'ollama', 'same')
        `);
    });

    describe('GET /api/rag/status', () => {
        it('should return providerOnline field', async () => {
            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body).toHaveProperty('providerOnline');
            expect(response.body).toHaveProperty('embeddingAvailability');
            expect(typeof response.body.providerOnline).toBe('boolean');
            expect(response.body.embeddingAvailability).toHaveProperty('status');
            expect(response.body.embeddingAvailability).toHaveProperty('presentation');
            expect(response.body.embeddingAvailability).toHaveProperty('controls');
        });

        it('should return providerOnline=true when same mode is properly configured', async () => {
            await pool.query(`
                UPDATE ai_provider_config 
                SET primary_provider = 'ollama', embedding_provider_mode = 'same'
                WHERE id = 1
            `);

            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body.providerOnline).toBe(true);
        });

        it('should return providerOnline=false when same mode has no provider', async () => {
            await pool.query(`
                UPDATE ai_provider_config 
                SET primary_provider = 'none', embedding_provider_mode = 'same'
                WHERE id = 1
            `);

            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body.providerOnline).toBe(false);
        });

        it('should return providerOnline=false when cloud mode has no API key', async () => {
            await pool.query(`
                UPDATE ai_provider_config 
                SET embedding_provider_mode = 'cloud', 
                    embedding_cloud_provider = 'openai',
                    embedding_cloud_api_key = NULL
                WHERE id = 1
            `);

            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body.providerOnline).toBe(false);
        });

        it('should return providerOnline=false when separate_ollama has no host', async () => {
            await pool.query(`
                UPDATE ai_provider_config 
                SET embedding_provider_mode = 'separate_ollama',
                    embedding_ollama_host = NULL
                WHERE id = 1
            `);

            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body.providerOnline).toBe(false);
        });

        it('should include stats object', async () => {
            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body).toHaveProperty('stats');
            expect(response.body.stats).toHaveProperty('total');
        });

        it('returns image.status=not_configured for setup-pending image embeddings', async () => {
            await pool.query(`
                UPDATE ai_provider_config
                SET rag_enabled = true,
                    rag_image_weight = 0.5,
                    image_embedding_provider_mode = 'separate_local',
                    image_embedding_local_host = 'image-embedder',
                    image_embedding_local_port = 11434,
                    image_embedding_models_cache_updated_at = NULL
                WHERE id = 1
            `);

            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body.image.status).toBe('not_configured');
        });

        it('returns image.status=not_configured when provider is set up but no image embeddings exist yet', async () => {
            await pool.query(`
                UPDATE ai_provider_config
                SET rag_enabled = true,
                    rag_image_weight = 0.5,
                    image_embedding_provider_mode = 'separate_local',
                    image_embedding_local_host = 'image-embedder',
                    image_embedding_local_port = 11434,
                    image_embedding_models_cache_updated_at = NOW()
                WHERE id = 1
            `);

            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body.image.status).toBe('not_configured');
        });

        it('should surface pgvector settings when available', async () => {
            const settings = [
                ['avx_guard_pgvector_selected', 'avx2'],
                ['avx_guard_pgvector_build', 'multi'],
                ['avx_guard_cpu_avx', 'true'],
                ['avx_guard_cpu_avx2', 'true']
            ];

            for (const [key, value] of settings) {
                await pool.query(
                    `INSERT INTO settings (key, value)
                     VALUES ($1, $2)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                    [key, value]
                );
            }

            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body.pgvectorVariant).toBe('avx2');
            expect(response.body.pgvectorBuild).toBe('multi');
            expect(response.body.cpuAvx).toBe('true');
            expect(response.body.cpuAvx2).toBe('true');
        });
    });

    describe('POST /api/rag/backfill/manual/start', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('accepts legacy limit payloads on the manual route', async () => {
            jest.spyOn(manualBackfillService, 'start').mockResolvedValue({
                status: 'running',
                batchSize: 18
            });
            jest.spyOn(manualBackfillService, 'getStatus').mockResolvedValue({
                status: 'running',
                processed: 0,
                total: 10,
                batchSize: 18
            });

            const response = await request(app)
                .post('/api/rag/backfill/manual/start')
                .send({ limit: 18 })
                .expect(200);

            expect(manualBackfillService.start).toHaveBeenCalledWith({ batchSize: 18 });
            expect(response.body.success).toBe(true);
        });

        it('allows service-side default batch size resolution when no payload size is supplied', async () => {
            jest.spyOn(manualBackfillService, 'start').mockResolvedValue({
                status: 'running',
                batchSize: 50
            });
            jest.spyOn(manualBackfillService, 'getStatus').mockResolvedValue({
                status: 'running',
                processed: 0,
                total: 10,
                batchSize: 50
            });

            await request(app)
                .post('/api/rag/backfill/manual/start')
                .send({})
                .expect(200);

            expect(manualBackfillService.start).toHaveBeenCalledWith({});
        });

        it('rejects invalid manual backfill sizes on the manual route', async () => {
            const response = await request(app)
                .post('/api/rag/backfill/manual/start')
                .send({ batchSize: -5 })
                .expect(400);

            expect(response.body.error).toContain('batchSize must be a positive integer');
        });
    });

    describe('GET /api/rag/overview', () => {
        it('should return providerOnline at top level', async () => {
            const response = await request(app)
                .get('/api/rag/overview')
                .expect(200);

            expect(response.body).toHaveProperty('providerOnline');
            expect(response.body).toHaveProperty('providerConfigured');
            expect(response.body).toHaveProperty('embeddingAvailability');
            expect(typeof response.body.providerOnline).toBe('boolean');
            expect(response.body.embeddingAvailability).toHaveProperty('presentation');
            expect(response.body.embeddingAvailability).toHaveProperty('controls');
        });

        it('should return stats object with counts', async () => {
            const response = await request(app)
                .get('/api/rag/overview')
                .expect(200);

            expect(response.body).toHaveProperty('stats');
            expect(response.body.stats).toHaveProperty('totalEmbeddings');
            expect(response.body.stats).toHaveProperty('pendingCount');
            expect(response.body.stats).toHaveProperty('failedCount');
        });

        it('should return recentActivity array', async () => {
            const response = await request(app)
                .get('/api/rag/overview')
                .expect(200);

            expect(response.body).toHaveProperty('recentActivity');
            expect(Array.isArray(response.body.recentActivity)).toBe(true);
        });
    });

    describe('operational RAG routes', () => {
        it('returns advanced config defaults when the singleton config row is missing', async () => {
            await pool.query('TRUNCATE TABLE ai_provider_config RESTART IDENTITY CASCADE');

            const response = await request(app)
                .get('/api/rag/advanced')
                .expect(200);

            expect(response.body).toEqual(expect.objectContaining({
                max_retries: 3,
                retry_delay: 1000,
                request_timeout: 30000,
                cache_enabled: false,
                cache_ttl: 24,
                verbose_logging: false,
                log_embedding_content: false
            }));

            await pool.query(`
                INSERT INTO ai_provider_config (id, primary_provider, embedding_provider_mode)
                VALUES (1, 'ollama', 'same')
            `);
        });

        it('preserves retry validation errors through the extracted helper path', async () => {
            const response = await request(app)
                .put('/api/rag/settings/embedding/retry')
                .send({ request_timeout: 1000, jitter_factor: 2 })
                .expect(400);

            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                'request_timeout must be between 5000 and 300000 (5s-300s)',
                'jitter_factor must be between 0 and 1'
            ]));
        });
    });

    describe('POST /api/rag/text-models', () => {
        it('returns provider-aware recommendations for same-mode Ollama', async () => {
            await pool.query(`
                UPDATE ai_provider_config
                SET primary_provider = 'ollama',
                    embedding_provider_mode = 'same'
                WHERE id = 1
            `);

            const response = await request(app)
                .post('/api/rag/text-models')
                .send({ mode: 'same' })
                .expect(200);

            expect(response.body.provider).toBe('ollama');
            expect(Array.isArray(response.body.recommended)).toBe(true);
            expect(response.body.recommended[0]).toEqual(expect.objectContaining({
                id: expect.any(String),
                dims: expect.any(Number)
            }));
            expect(response.body.models).toEqual([]);
        });

    });

    describe('POST /api/rag/test-connection', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should return dimensions field on success', async () => {
            jest.spyOn(embeddingProvider, 'testConnection').mockResolvedValue({
                success: true,
                provider: 'ollama',
                model: 'nomic-embed-text',
                dimensions: 768,
                cost: 0
            });

            const response = await request(app)
                .post('/api/rag/test-connection')
                .send({
                    mode: 'same',
                    model: 'nomic-embed-text'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('dims');
            expect(response.body.dims).toBe(768);
            expect(response.body).toHaveProperty('provider');
            expect(response.body).toHaveProperty('model');
        });

        it('should return error message on failure', async () => {
            jest.spyOn(embeddingProvider, 'testConnection').mockResolvedValue({
                success: false,
                error: 'Connection failed'
            });

            const response = await request(app)
                .post('/api/rag/test-connection')
                .send({
                    mode: 'cloud',
                    model: 'text-embedding-3-small'
                })
                .expect(200);

            expect(response.body.success).toBe(false);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('Connection failed');
        });

        it('should include latency in response', async () => {
            jest.spyOn(embeddingProvider, 'testConnection').mockResolvedValue({
                success: true,
                provider: 'ollama',
                model: 'nomic-embed-text',
                dimensions: 768,
                cost: 0
            });

            const response = await request(app)
                .post('/api/rag/test-connection')
                .send({ mode: 'same' })
                .expect(200);

            expect(response.body).toHaveProperty('latency');
            expect(typeof response.body.latency).toBe('number');
        });
    });

    describe('GET /api/rag/detailed', () => {
        it('should return consolidated statistics in a single response', async () => {
            const response = await request(app)
                .get('/api/rag/detailed')
                .expect(200);

            expect(response.body).toHaveProperty('stats');
            expect(response.body).toHaveProperty('providerOnline');
            expect(response.body).toHaveProperty('embeddingAvailability');
            expect(response.body).toHaveProperty('operationMetrics');
            expect(response.body).toHaveProperty('providerMetrics');
            expect(response.body).toHaveProperty('circuitBreaker');
            expect(response.body).toHaveProperty('backfillHistory');
            expect(response.body).toHaveProperty('config');
            expect(response.body).toHaveProperty('timestamp');
        });

        it('should return stats object with all required fields', async () => {
            const response = await request(app)
                .get('/api/rag/detailed')
                .expect(200);

            expect(response.body.stats).toHaveProperty('totalEmbeddings');
            expect(response.body.stats).toHaveProperty('pendingCount');
            expect(response.body.stats).toHaveProperty('failedCount');
            expect(response.body.stats).toHaveProperty('avgGenerationTime');
            expect(response.body.stats).toHaveProperty('lastEmbeddingTime');
            
            expect(typeof response.body.stats.totalEmbeddings).toBe('number');
            expect(typeof response.body.stats.pendingCount).toBe('number');
            expect(typeof response.body.stats.failedCount).toBe('number');
            expect(typeof response.body.stats.avgGenerationTime).toBe('number');
            expect(response.body.stats.lastEmbeddingTime === null || typeof response.body.stats.lastEmbeddingTime === 'string').toBe(true);
        });

        it('should return pendingCount that matches actual unembedded items', async () => {
            const response = await request(app)
                .get('/api/rag/detailed')
                .expect(200);

            expect(typeof response.body.stats.pendingCount).toBe('number');
            expect(response.body.stats.pendingCount).toBeGreaterThanOrEqual(0);
        });

        it('should return providerOnline as boolean', async () => {
            const response = await request(app)
                .get('/api/rag/detailed')
                .expect(200);

            expect(typeof response.body.providerOnline).toBe('boolean');
        });

        it('should return circuit breaker information', async () => {
            const response = await request(app)
                .get('/api/rag/detailed')
                .expect(200);

            expect(response.body.embeddingAvailability).toHaveProperty('status');
            expect(response.body.embeddingAvailability).toHaveProperty('presentation');
            expect(response.body.embeddingAvailability).toHaveProperty('controls');
            expect(response.body.circuitBreaker).toHaveProperty('state');
            expect(response.body.circuitBreaker).toHaveProperty('failureCount');
            expect(response.body.circuitBreaker).toHaveProperty('lastFailureTime');
            expect(response.body.circuitBreaker).toHaveProperty('stateHistory');
            expect(response.body.circuitBreaker).toHaveProperty('config');
        });

        it('should return backfill history array', async () => {
            const response = await request(app)
                .get('/api/rag/detailed')
                .expect(200);

            expect(Array.isArray(response.body.backfillHistory)).toBe(true);
        });

        it('should accept hours query parameter', async () => {
            const response = await request(app)
                .get('/api/rag/detailed?hours=48')
                .expect(200);

            expect(response.body).toHaveProperty('stats');
        });

        it('should reject invalid hours parameter', async () => {
            const response = await request(app)
                .get('/api/rag/detailed?hours=invalid')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Invalid hours parameter');
        });

        it('should reject hours parameter that is too large', async () => {
            const response = await request(app)
                .get('/api/rag/detailed?hours=1000')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Invalid hours parameter');
        });
    });

    describe('GET /api/rag/loop/promotion-readiness', () => {
        beforeEach(() => {
            ragLoopMetricsCollector.reset();
        });

        it('returns promotion metrics payload with safe defaults', async () => {
            const response = await request(app)
                .get('/api/rag/loop/promotion-readiness')
                .expect(200);

            expect(response.body).toHaveProperty('ready');
            expect(response.body).toHaveProperty('metrics');
            expect(response.body).toHaveProperty('gates');
            expect(response.body.metrics).toHaveProperty('shadow_sample_count');
            expect(response.body.metrics).toHaveProperty('correction_delta');
            expect(response.body.metrics).toHaveProperty('error_rate_delta');
            expect(response.body.metrics).toHaveProperty('p95_latency_delta_ms');
            expect(response.body.gates).toHaveProperty('min_samples');
            expect(response.body.gates).toHaveProperty('max_error_rate_delta');
            expect(response.body.gates).toHaveProperty('max_p95_latency_delta_ms');
            expect(response.body).toHaveProperty('checked_at');
        });

        it('marks readiness true when shadow gates are satisfied', async () => {
            await pool.query(`
                UPDATE ai_provider_config
                SET rag_loop_shadow_min_samples = 2,
                    rag_loop_shadow_max_error_rate_delta = 0.5,
                    rag_loop_shadow_max_p95_latency_delta_ms = 500
                WHERE id = 1
            `);

            ragLoopMetricsCollector.recordEvaluation({
                rolloutMode: 'shadow',
                wouldUpgrade: true,
                hadError: false,
                latencyDeltaMs: 120
            });
            ragLoopMetricsCollector.recordEvaluation({
                rolloutMode: 'shadow',
                wouldUpgrade: false,
                hadError: false,
                latencyDeltaMs: 180
            });

            const response = await request(app)
                .get('/api/rag/loop/promotion-readiness')
                .expect(200);

            expect(response.body.ready).toBe(true);
            expect(response.body.metrics.shadow_sample_count).toBe(2);
            expect(response.body.gates.min_samples).toBe(2);
        });
    });

    describe('GET /api/rag/loop/latest-fallback-incident', () => {
        it('returns empty incident payload when no fallback has been recorded', async () => {
            await pool.query(`
                UPDATE ai_provider_config
                SET rag_loop_auto_fallback_last_incident_payload = NULL,
                    rag_loop_auto_fallback_last_incident_id = NULL,
                    rag_loop_auto_fallback_last_triggered_at = NULL
                WHERE id = 1
            `);

            const response = await request(app)
                .get('/api/rag/loop/latest-fallback-incident')
                .expect(200);

            expect(response.body.incident).toBeNull();
            expect(response.body.fallback_state).toHaveProperty('auto_fallback_enabled');
            expect(response.body).toHaveProperty('checked_at');
        });

        it('returns sanitized copy-ready incident payload when present', async () => {
            await pool.query(`
                UPDATE ai_provider_config
                SET rag_loop_auto_fallback_last_incident_id = 'incident-abc',
                    rag_loop_auto_fallback_last_triggered_at = '2026-02-11T10:00:00.000Z',
                    rag_loop_auto_fallback_last_version = '0.41.2-alpha',
                    rag_loop_auto_fallback_last_incident_payload = $1::jsonb
                WHERE id = 1
            `, [JSON.stringify({
                incident_id: 'incident-abc',
                triggered_at: '2026-02-11T10:00:00.000Z',
                from_mode: 'apply',
                to_mode: 'shadow',
                app_version: '0.41.2-alpha',
                thresholds: { max_error_rate_delta: 0.01 },
                observed_metrics: { apply_sample_count: 25 }
            })]);

            const response = await request(app)
                .get('/api/rag/loop/latest-fallback-incident')
                .expect(200);

            expect(response.body.incident).toBeTruthy();
            expect(response.body.incident.incident_id).toBe('incident-abc');
            expect(response.body.incident.from_mode).toBe('apply');
            expect(response.body.incident.to_mode).toBe('shadow');
            expect(response.body.fallback_state.last_fallback_version).toBe('0.41.2-alpha');
        });
    });

    describe('GET /api/rag/backfill/status', () => {
        beforeEach(async () => {
            await pool.query('TRUNCATE TABLE classification_embeddings RESTART IDENTITY CASCADE');
            await pool.query('TRUNCATE TABLE classification_history RESTART IDENTITY CASCADE');
            await pool.query('TRUNCATE TABLE media_server_items RESTART IDENTITY CASCADE');
            await pool.query('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE');
            await pool.query('TRUNCATE TABLE media_server RESTART IDENTITY CASCADE');

            await pool.query(`
                UPDATE ai_provider_config
                SET rag_enabled = true,
                    rag_image_weight = 0.5,
                    image_embedding_provider_mode = 'separate_local',
                    image_embedding_local_host = 'localhost',
                    image_embedding_local_port = 8000
                WHERE id = 1
            `);
        });

        it('returns pendingBreakdown with text and image counts', async () => {
            const mediaServer = await pool.query(`
                INSERT INTO media_server (type, name, url, api_key)
                VALUES ('plex', 'Test Plex', 'http://localhost:32400', 'abc')
                RETURNING id
            `);
            const library = await pool.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type)
                VALUES ($1, 'lib1', 'Movies', 'movie')
                RETURNING id
            `, [mediaServer.rows[0].id]);

            const _classificationOne = await pool.query(`
                INSERT INTO classification_history (tmdb_id, media_type, title, library_id)
                VALUES (100, 'movie', 'Pending Text', $1)
                RETURNING id
            `, [library.rows[0].id]);
            const classificationTwo = await pool.query(`
                INSERT INTO classification_history (tmdb_id, media_type, title, library_id)
                VALUES (200, 'movie', 'Pending Image', $1)
                RETURNING id
            `, [library.rows[0].id]);

            const dimsResult = await pool.query(`
                SELECT format_type(att.atttypid, att.atttypmod) AS type
                FROM pg_attribute att
                WHERE att.attrelid = 'classification_embeddings'::regclass
                  AND att.attname = 'embedding'
                  AND NOT att.attisdropped
                LIMIT 1
            `);
            const typeString = dimsResult.rows[0]?.type || '';
            const match = typeString.match(/\((\d+)\)/);
            const dims = match ? Number(match[1]) : 768;

            await pool.query(`
                INSERT INTO classification_embeddings (classification_id, embedding, embedding_dims, provider, model)
                VALUES ($1, ARRAY(SELECT 0.0 FROM generate_series(1, $2))::vector, $2, 'test', 'model')
            `, [classificationTwo.rows[0].id, dims]);

            await pool.query(`
                INSERT INTO media_server_items (media_server_id, library_id, external_id, tmdb_id, title, media_type, metadata)
                VALUES ($1, $2, 'ext1', 200, 'Pending Image', 'movie', $3::jsonb)
            `, [
                mediaServer.rows[0].id,
                library.rows[0].id,
                JSON.stringify({ posterPath: 'https://example.com/poster.jpg' })
            ]);

            const response = await request(app)
                .get('/api/rag/backfill/status')
                .expect(200);

            expect(response.body).toHaveProperty('pendingBreakdown');
            expect(response.body.pendingBreakdown).toEqual({ text: 1, image: 1, total: 2 });
            expect(response.body.pending).toBe(2);
            expect(response.body.embeddingAvailability).toHaveProperty('status');
            expect(response.body.embeddingAvailability).toHaveProperty('presentation');
            expect(response.body.embeddingAvailability).toHaveProperty('controls');
            expect(response.body.manual).toHaveProperty('presentation');
            expect(response.body.manual).toHaveProperty('controls');
            expect(response.body.idle).toHaveProperty('presentation');
            expect(response.body.idle).toHaveProperty('controls');
            expect(response.body.scheduled).toHaveProperty('presentation');
            expect(response.body.scheduled).toHaveProperty('controls');
            expect(response.body.idle).toHaveProperty('status');
            expect(response.body.idle).toHaveProperty('enabled');
            expect(response.body.idle).toHaveProperty('cooldownUntil');
            expect(response.body.scheduled).toHaveProperty('status');
            expect(response.body.scheduled).toHaveProperty('isRunning');
            expect(response.body.scheduled).toHaveProperty('stopRequested');
            expect(response.body).toHaveProperty('idleDetector');
            expect(response.body.idleDetector).toHaveProperty('isIdle');
            expect(response.body.idleDetector).toHaveProperty('timeSinceActivity');
            expect(response.body.idleDetector).toHaveProperty('threshold');
            expect(response.body).toHaveProperty('latestRun');
            expect(response.body).toHaveProperty('startupRecoveryEligible');
        });
    });

    describe('GET /api/rag/backfill/config', () => {
        it('returns consolidated backfill configuration', async () => {
            const response = await request(app)
                .get('/api/rag/backfill/config')
                .expect(200);

            expect(response.body).toHaveProperty('realtime_embedding_enabled');
            expect(response.body).toHaveProperty('idle_backfill_enabled');
            expect(response.body).toHaveProperty('idle_threshold');
            expect(response.body).toHaveProperty('idle_batch_size');
            expect(response.body).toHaveProperty('scheduled_backfill_enabled');
            expect(response.body).toHaveProperty('scheduled_backfill_time');
            expect(response.body).toHaveProperty('scheduled_backfill_days');
            expect(response.body).toHaveProperty('scheduled_backfill_batch_size');
            expect(response.body).toHaveProperty('scheduled_backfill_max_duration');
        });
    });

    describe('PUT /api/rag/backfill/config', () => {
        it('updates consolidated backfill configuration', async () => {
            const response = await request(app)
                .put('/api/rag/backfill/config')
                .send({
                    realtime_embedding_enabled: false,
                    idle_backfill_enabled: false,
                    idle_threshold: 45000,
                    idle_batch_size: 12,
                    scheduled_backfill_enabled: true,
                    scheduled_backfill_time: '03:30',
                    scheduled_backfill_days: '1,3,5',
                    scheduled_backfill_batch_size: 250,
                    scheduled_backfill_max_duration: 1800000
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.config.realtime_embedding_enabled).toBe(false);
            expect(response.body.config.idle_backfill_enabled).toBe(false);
            expect(Number(response.body.config.idle_threshold)).toBe(45000);
            expect(Number(response.body.config.idle_batch_size)).toBe(12);
            expect(response.body.config.scheduled_backfill_enabled).toBe(true);
            expect(response.body.config.scheduled_backfill_time).toBe('03:30');
            expect(response.body.config.scheduled_backfill_days).toBe('1,3,5');
            expect(Number(response.body.config.scheduled_backfill_batch_size)).toBe(250);
            expect(Number(response.body.config.scheduled_backfill_max_duration)).toBe(1800000);
        });
    });

    describe('POST /api/rag/image-models-metadata', () => {
        it('returns cached models for matching local config through the canonical metadata route', async () => {
            await pool.query(`
                UPDATE ai_provider_config
                SET image_embedding_provider_mode = 'separate_local',
                    image_embedding_local_host = 'localhost',
                    image_embedding_local_port = 8000,
                    image_embedding_models_cache = $1::jsonb
                WHERE id = 1
            `, [JSON.stringify({
                local: {
                    host: 'localhost',
                    port: 8000,
                    models: [{ id: 'vit-l-14', name: 'ViT-L-14' }],
                    fetched_at: '2026-02-05T00:00:00Z'
                }
            })]);

            const response = await request(app)
                .post('/api/rag/image-models-metadata')
                .send({ mode: 'separate_local', refresh: false })
                .expect(200);

            expect(response.body.cacheHit).toBe(true);
            expect(response.body.scope).toBe('local');
            expect(response.body.models).toEqual([{ id: 'vit-l-14', name: 'ViT-L-14' }]);
        });
    });

});

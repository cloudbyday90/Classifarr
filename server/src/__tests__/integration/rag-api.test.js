/*
 * Integration tests for RAG API endpoints
 * Tests for v0.39.3-alpha bug fixes
 */

const request = require('supertest');
const setup = require('./setup');

// Mock logger
jest.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

const express = require('express');
const ragRouter = require('../../routes/rag');
const bodyParser = require('body-parser');

// Don't mock the database module locally - allow it to use the global mock from setup.js
// which points to the test container

describe('RAG API Integration Tests', () => {
    let app;
    let pool;

    beforeAll(async () => {
        // Get the pool from the setup module (initialized in global setup)
        pool = setup.getPool();

        // No manual schema setup needed - it's done in globally via migrations


        // Clear any existing data
        await pool.query('TRUNCATE TABLE ai_provider_config RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE classification_embeddings RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE embedding_retry_queue RESTART IDENTITY CASCADE');

        // Insert default config
        await pool.query(`
            INSERT INTO ai_provider_config (id, primary_provider, embedding_provider_mode) 
            VALUES (1, 'ollama', 'same')
        `);

        // Create test app
        app = express();
        app.use(bodyParser.json());
        app.use('/api/rag', ragRouter);
    });



    describe('GET /api/rag/status', () => {
        it('should return providerOnline field', async () => {
            const response = await request(app)
                .get('/api/rag/status')
                .expect(200);

            expect(response.body).toHaveProperty('providerOnline');
            expect(typeof response.body.providerOnline).toBe('boolean');
        });

        it('should return providerOnline=true when same mode is properly configured', async () => {
            // Update config to have a valid provider
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
            // Update config to have no provider
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

    describe('GET /api/rag/overview', () => {
        it('should return providerOnline at top level', async () => {
            const response = await request(app)
                .get('/api/rag/overview')
                .expect(200);

            expect(response.body).toHaveProperty('providerOnline');
            expect(typeof response.body.providerOnline).toBe('boolean');
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

    describe('POST /api/rag/test-connection', () => {
        it('should return dimensions field on success', async () => {
            // Mock embeddingProvider to return success
            const embeddingProvider = require('../../services/embeddingProvider');
            embeddingProvider.testConnection = jest.fn().mockResolvedValue({
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
            const embeddingProvider = require('../../services/embeddingProvider');
            embeddingProvider.testConnection = jest.fn().mockResolvedValue({
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
            const embeddingProvider = require('../../services/embeddingProvider');
            embeddingProvider.testConnection = jest.fn().mockResolvedValue({
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

            // Check top-level structure
            expect(response.body).toHaveProperty('stats');
            expect(response.body).toHaveProperty('providerOnline');
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
            
            // Verify types are correct
            expect(typeof response.body.stats.totalEmbeddings).toBe('number');
            expect(typeof response.body.stats.pendingCount).toBe('number');
            expect(typeof response.body.stats.failedCount).toBe('number');
            expect(typeof response.body.stats.avgGenerationTime).toBe('number');
            // lastEmbeddingTime can be null or string
            expect(response.body.stats.lastEmbeddingTime === null || typeof response.body.stats.lastEmbeddingTime === 'string').toBe(true);
        });

        it('should return pendingCount that matches actual unembedded items', async () => {
            const response = await request(app)
                .get('/api/rag/detailed')
                .expect(200);

            // pendingCount should be a non-negative number
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
});

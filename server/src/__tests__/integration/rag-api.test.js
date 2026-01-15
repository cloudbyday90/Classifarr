/*
 * Integration tests for RAG API endpoints
 * Tests for v0.39.3-alpha bug fixes
 */

const request = require('supertest');
const { newDb } = require('pg-mem');

// Mock logger
jest.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('RAG API Integration Tests', () => {
    let app;
    let db;
    let pgMem;

    beforeAll(async () => {
        // Create in-memory database
        pgMem = newDb();
        db = pgMem.adapters.createPg();

        // Mock the database module
        jest.mock('../../config/database', () => ({
            query: jest.fn((...args) => db.query(...args)),
            pool: db
        }));

        // Setup schema
        await db.query(`
            CREATE EXTENSION IF NOT EXISTS vector;
            
            CREATE TABLE IF NOT EXISTS ai_provider_config (
                id SERIAL PRIMARY KEY,
                primary_provider VARCHAR(50),
                embedding_provider_mode VARCHAR(50) DEFAULT 'same',
                embedding_model VARCHAR(100),
                embedding_ollama_host VARCHAR(255),
                embedding_ollama_port INTEGER DEFAULT 11434,
                embedding_ollama_model VARCHAR(100),
                embedding_cloud_provider VARCHAR(50),
                embedding_cloud_api_key TEXT,
                embedding_cloud_model VARCHAR(100),
                rag_enabled BOOLEAN DEFAULT false,
                rag_min_history_count INTEGER DEFAULT 50
            );

            CREATE TABLE IF NOT EXISTS classification_embeddings (
                id SERIAL PRIMARY KEY,
                embedding vector(768),
                embedding_dims INTEGER,
                provider VARCHAR(50),
                model VARCHAR(100),
                is_stale BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS embedding_retry_queue (
                id SERIAL PRIMARY KEY,
                classification_id INTEGER,
                attempt_count INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            );

            -- Insert default config
            INSERT INTO ai_provider_config (id, primary_provider, embedding_provider_mode) 
            VALUES (1, 'ollama', 'same');
        `);

        // Import app after mocks are set up
        app = require('../../index');
    });

    afterAll(async () => {
        if (db) {
            await db.end();
        }
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
            await db.query(`
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
            await db.query(`
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
            await db.query(`
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
            await db.query(`
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
});

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

const setup = await import('./setup.js');
const { createSettingsTestRouter } = await import('../setup/createSettingsTestRouter.js');

describe('Settings AI RAG loop configuration integration', () => {
    let app;
    let pool;
    let settingsRouter;

    beforeAll(async () => {
        pool = setup.getPool();
        settingsRouter = await createSettingsTestRouter(express);
        app = express();
        app.use(express.json());
        app.use('/api/settings', settingsRouter);
    });

    beforeEach(async () => {
        await pool.query('TRUNCATE TABLE classification_embeddings RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE classification_history RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE ai_provider_config RESTART IDENTITY CASCADE');
        await pool.query(`
            INSERT INTO ai_provider_config (id, primary_provider, api_key, embedding_provider_mode)
            VALUES (1, 'openai', 'secret-live-key', 'same')
        `);
    });

    test('GET /api/settings/ai returns stable RAG loop config keys when config row is missing', async () => {
        await pool.query('TRUNCATE TABLE ai_provider_config RESTART IDENTITY CASCADE');

        const response = await request(app)
            .get('/api/settings/ai')
            .expect(200);

        expect(response.body).toHaveProperty('rag_retrieval_loop_enabled', true);
        expect(response.body).toHaveProperty('rag_loop_rollout_mode', 'apply');
        expect(response.body).toHaveProperty('policy_recheck_below_prompt_threshold_enabled', true);
        expect(response.body).toHaveProperty('rag_loop_low_confidence_threshold', 70);
        expect(response.body).toHaveProperty('policy_recheck_identifier_caps');
        expect(response.body.policy_recheck_identifier_caps).toEqual({
            keywords: 8,
            genres: 5,
            studios: 3,
            cast: 3
        });
        expect(response.body).toHaveProperty('rag_loop_shadow_min_samples', 200);
        expect(response.body).toHaveProperty('rag_loop_auto_fallback_enabled', true);
        expect(response.body).toHaveProperty('rag_loop_auto_fallback_min_apply_samples', 25);
        expect(response.body).toHaveProperty('rag_loop_auto_fallback_consecutive_breaches', 3);
        expect(response.body).toHaveProperty('rag_loop_auto_fallback_cooldown_ms', 900000);
        expect(response.body).toHaveProperty('rag_loop_auto_recover_enabled', false);
        expect(response.body).toHaveProperty('rag_loop_trace_max_bytes', 16384);
    });

    test('PUT /api/settings/ai normalizes and persists RAG loop config values', async () => {
        const response = await request(app)
            .put('/api/settings/ai')
            .send({
                rag_retrieval_loop_enabled: true,
                rag_loop_rollout_mode: 'invalid',
                rag_loop_low_confidence_threshold: 1000,
                rag_loop_trace_max_bytes: 999999,
                rag_loop_auto_fallback_min_apply_samples: 0,
                rag_loop_auto_fallback_consecutive_breaches: 101,
                rag_loop_auto_fallback_cooldown_ms: 999999999,
                rag_loop_auto_fallback_enabled: false,
                rag_loop_auto_recover_enabled: true,
                policy_recheck_identifier_caps: {
                    keywords: 999,
                    genres: 2,
                    studios: -5,
                    cast: 'abc'
                },
                rag_retry_strategy: 'invalid'
            })
            .expect(200);

        expect(response.body.rag_retrieval_loop_enabled).toBe(true);
        expect(response.body.rag_loop_rollout_mode).toBe('apply');
        expect(response.body.rag_loop_low_confidence_threshold).toBe(100);
        expect(response.body.rag_loop_trace_max_bytes).toBe(131072);
        expect(response.body.rag_loop_auto_fallback_enabled).toBe(false);
        expect(response.body.rag_loop_auto_recover_enabled).toBe(true);
        expect(response.body.rag_loop_auto_fallback_min_apply_samples).toBe(1);
        expect(response.body.rag_loop_auto_fallback_consecutive_breaches).toBe(100);
        expect(response.body.rag_loop_auto_fallback_cooldown_ms).toBe(86400000);
        expect(response.body.rag_retry_strategy).toBe('auto');
        expect(response.body.policy_recheck_identifier_caps).toEqual({
            keywords: 25,
            genres: 2,
            studios: 0,
            cast: 3
        });

        const result = await pool.query(`
            SELECT
                rag_retrieval_loop_enabled,
                rag_loop_rollout_mode,
                rag_loop_low_confidence_threshold,
                rag_loop_trace_max_bytes,
                rag_loop_auto_fallback_enabled,
                rag_loop_auto_recover_enabled,
                rag_loop_auto_fallback_min_apply_samples,
                rag_loop_auto_fallback_consecutive_breaches,
                rag_loop_auto_fallback_cooldown_ms,
                rag_retry_strategy,
                policy_recheck_identifier_caps
            FROM ai_provider_config
            WHERE id = 1
        `);

        const row = result.rows[0];
        expect(row.rag_retrieval_loop_enabled).toBe(true);
        expect(row.rag_loop_rollout_mode).toBe('apply');
        expect(row.rag_loop_low_confidence_threshold).toBe(100);
        expect(row.rag_loop_trace_max_bytes).toBe(131072);
        expect(row.rag_loop_auto_fallback_enabled).toBe(false);
        expect(row.rag_loop_auto_recover_enabled).toBe(true);
        expect(row.rag_loop_auto_fallback_min_apply_samples).toBe(1);
        expect(row.rag_loop_auto_fallback_consecutive_breaches).toBe(100);
        expect(row.rag_loop_auto_fallback_cooldown_ms).toBe(86400000);
        expect(row.rag_retry_strategy).toBe('auto');
        expect(row.policy_recheck_identifier_caps).toEqual({
            keywords: 25,
            genres: 2,
            studios: 0,
            cast: 3
        });
    });

    test('PUT /api/settings/ai rejects unknown RAG loop config keys', async () => {
        const response = await request(app)
            .put('/api/settings/ai')
            .send({
                rag_loop_nonexistent_toggle: true
            })
            .expect(400);

        expect(response.body.error).toContain('Unsupported RAG loop configuration keys in payload');
        expect(response.body.unknown_rag_loop_config_keys).toContain('rag_loop_nonexistent_toggle');
    });

    test('PUT /api/settings/ai rejects V1.1-only keys in V1 scope', async () => {
        const response = await request(app)
            .put('/api/settings/ai')
            .send({
                rag_loop_override: {
                    second_pass_enabled: true
                }
            })
            .expect(400);

        expect(response.body.error).toContain('Unsupported RAG loop configuration keys in payload');
        expect(response.body.disallowed_rag_loop_override_keys).toContain('rag_loop_override');
    });

    test('partial RAG loop config update preserves unrelated provider and secret fields', async () => {
        const response = await request(app)
            .put('/api/settings/ai')
            .send({
                rag_retrieval_loop_enabled: true
            })
            .expect(200);

        expect(response.body.primary_provider).toBe('openai');
        expect(response.body.api_key).not.toBe('secret-live-key');
        expect(response.body.api_key).toMatch(/^•+/);

        const result = await pool.query(`
            SELECT primary_provider, api_key, rag_retrieval_loop_enabled
            FROM ai_provider_config
            WHERE id = 1
        `);

        expect(result.rows[0].primary_provider).toBe('openai');
        expect(result.rows[0].api_key).toBe('secret-live-key');
        expect(result.rows[0].rag_retrieval_loop_enabled).toBe(true);
    });

    test('PUT /api/settings/ai clears classification embeddings when same-mode auto provider identity changes', async () => {
        await pool.query(`
            UPDATE ai_provider_config
            SET embedding_provider = 'auto',
                embedding_model = NULL
            WHERE id = 1
        `);

        const mediaServer = await pool.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'AI Settings Test Plex', 'http://localhost:32400', 'abc')
            RETURNING id
        `);
        const library = await pool.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type)
            VALUES ($1, 'ai-settings-lib', 'AI Settings Movies', 'movie')
            RETURNING id
        `, [mediaServer.rows[0].id]);

        const classification = await pool.query(`
            INSERT INTO classification_history (tmdb_id, media_type, title, library_id)
            VALUES (440001, 'movie', 'Identity Drift', $1)
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
            VALUES ($1, ARRAY(SELECT 0.0 FROM generate_series(1, $2))::vector, $2, 'openai', 'text-embedding-3-small')
        `, [classification.rows[0].id, dims]);

        const before = await pool.query('SELECT COUNT(*)::int AS count FROM classification_embeddings');
        expect(before.rows[0].count).toBe(1);

        await request(app)
            .put('/api/settings/ai')
            .send({
                primary_provider: 'gemini'
            })
            .expect(200);

        const after = await pool.query('SELECT COUNT(*)::int AS count FROM classification_embeddings');
        expect(after.rows[0].count).toBe(0);
    });
});

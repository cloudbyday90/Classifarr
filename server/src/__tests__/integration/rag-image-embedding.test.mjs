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

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};

const loggerModule = {
    createLogger: () => mockLogger,
};

const embeddingRouter = {
    isEnabled: jest.fn(),
    getConfig: jest.fn(),
    embed: jest.fn(),
};

const imageEmbeddingProvider = {
    getConfig: jest.fn(),
    isConfigured: jest.fn(),
    embedImageFromUrl: jest.fn(),
};

const embeddingService = {
    formatForEmbedding: jest.fn().mockReturnValue('Query'),
    resolvePosterUrl: jest.fn((metadata) => {
        if (!metadata?.poster_path) {
            return null;
        }

        return /^https?:\/\//i.test(metadata.poster_path)
            ? metadata.poster_path
            : `https://image.tmdb.org/t/p/w500${metadata.poster_path}`;
    }),
    hasMinimumEmbeddings: jest.fn().mockResolvedValue(true),
};

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../services/embeddingService.mjs', () => ({
    default: embeddingService,
}));
jest.unstable_mockModule('../../services/embeddingRouter.mjs', () => ({
    default: embeddingRouter,
}));
jest.unstable_mockModule('../../services/imageEmbeddingProvider.mjs', () => ({
    default: imageEmbeddingProvider,
}));
jest.unstable_mockModule('../../utils/logger.mjs', () => ({
    createLogger: loggerModule.createLogger,
    default: loggerModule,
}));

const { default: ragRetriever } = await import('../../services/ragRetriever.mjs');

const fetchVectorDims = async (pool, column) => {
    const result = await pool.query(`
        SELECT format_type(att.atttypid, att.atttypmod) AS type
        FROM pg_attribute att
        WHERE att.attrelid = 'classification_embeddings'::regclass
          AND att.attname = $1
          AND NOT att.attisdropped
        LIMIT 1
    `, [column]);
    const typeString = result.rows[0]?.type || '';
    const match = typeString.match(/\((\d+)\)/);
    return match ? Number(match[1]) : null;
};

describe('RAG Image Embedding Integration', () => {
    let pool;

    beforeAll(async () => {
        pool = getPool();
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        // Reset ragRetriever's singleton TTL cache so it re-queries the fresh test DB.
        // Without this, a stale false cached from an earlier integration test suite
        // (when classification_embeddings was empty) causes semanticSearch to return [].
        ragRetriever._hasMinimumCache = null;
        ragRetriever._hasMinimumCachedAt = 0;
        await pool.query('TRUNCATE TABLE classification_embeddings RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE classification_history RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE media_server_items RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE media_server RESTART IDENTITY CASCADE');
    });

    it('combines text and image similarity when image embeddings exist', async () => {
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

        const classification = await pool.query(`
            INSERT INTO classification_history (tmdb_id, media_type, title, library_id, library_name)
            VALUES (100, 'movie', 'RAG Image Test', $1, 'Movies')
            RETURNING id
        `, [library.rows[0].id]);

        const textDims = await fetchVectorDims(pool, 'embedding') || 768;
        const imageDims = await fetchVectorDims(pool, 'image_embedding') || textDims;

        await pool.query(`
            INSERT INTO classification_embeddings (
                classification_id,
                embedding,
                embedding_dims,
                provider,
                model,
                image_embedding,
                image_embedding_dims,
                image_model,
                image_embedding_hash,
                image_embedding_size,
                image_embedding_source_url,
                is_stale
            )
            VALUES (
                $1,
                ARRAY(SELECT 1.0 FROM generate_series(1, $2))::vector,
                $2,
                'test',
                'text-model',
                ARRAY(SELECT 1.0 FROM generate_series(1, $3))::vector,
                $3,
                'ViT-L-14',
                'hash',
                512,
                'https://example.com/poster.jpg',
                false
            )
        `, [classification.rows[0].id, textDims, imageDims]);

        embeddingRouter.isEnabled.mockResolvedValue(true);
        embeddingRouter.getConfig.mockResolvedValue({
            rag_similarity_threshold: 0.5,
            rag_text_weight: 0.6,
            rag_image_weight: 0.4,
            rag_min_history_count: 1
        });
        embeddingRouter.embed.mockResolvedValue({
            embedding: Array(textDims).fill(1.0),
            dims: textDims
        });

        imageEmbeddingProvider.getConfig.mockResolvedValue({ image_embedding_provider_mode: 'separate_local' });
        imageEmbeddingProvider.isConfigured.mockReturnValue(true);
        imageEmbeddingProvider.embedImageFromUrl.mockResolvedValue({
            embedding: Array(imageDims).fill(1.0),
            dims: imageDims
        });

        const results = await ragRetriever.semanticSearch({
            title: 'Query',
            poster_path: '/poster.jpg',
        });

        expect(results).toHaveLength(1);
        expect(results[0].textSimilarity).toBe(1);
        expect(results[0].imageSimilarity).toBe(1);
        expect(results[0].similarity).toBe(1);
    });
});

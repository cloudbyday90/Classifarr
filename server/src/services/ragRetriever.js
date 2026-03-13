/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingRouter = require('./embeddingRouter');
const embeddingService = require('./embeddingService');
const imageEmbeddingProvider = require('./imageEmbeddingProvider');
const { createLogger } = require('../utils/logger');
const ragLogger = require('../utils/ragLogger');
const { expandRetrievalMetadata } = require('../utils/ragLoopHelpers');

const logger = createLogger('RAGRetriever');

const EF_SEARCH = parseInt(process.env.PGVECTOR_EF_SEARCH) || 80;
const EF_SEARCH_CANDIDATES = parseInt(process.env.PGVECTOR_EF_SEARCH_CANDIDATES) || 40;
const CANDIDATE_LIMIT_MAX = parseInt(process.env.PGVECTOR_CANDIDATE_LIMIT) || 200;

// Short-lived in-process TTL for embedding count/minimum checks.
// Eliminates redundant SELECT COUNT(*) round-trips when multiple concurrent
// classification tasks call semanticSearch() within the same burst window.
// (e.g. MAX_CONCURRENT = 5 tasks → 10 extra DB queries/s without caching)
const EMBEDDING_STATS_TTL_MS = 30_000; // 30 seconds

function checkAbort(signal, operation = 'operation') {
    if (signal?.aborted) {
        const error = new Error(`${operation} aborted`);
        error.name = 'AbortError';
        error.code = 'ABORT_ERR';
        throw error;
    }
}

/**
 * RAG Retriever Service
 * Performs semantic similarity search to find similar past classifications
 */
class RAGRetriever {
    constructor() {
        // In-process TTL cache for lightweight pre-check queries.
        // Both fields reset to their zero values so the first call always fetches.
        this._embeddingCountCache = null;
        this._embeddingCountCachedAt = 0;
        this._hasMinimumCache = null;
        this._hasMinimumCachedAt = 0;
    }

    buildRetrievalText(metadata, options = {}) {
        const pass = options.pass || 'pass1';
        const useExpandedQuery = options.useExpandedQuery === true || pass !== 'pass1';

        if (!useExpandedQuery) {
            return embeddingService.formatForEmbedding(metadata);
        }

        const expandedMetadata = expandRetrievalMetadata(metadata, {
            pass,
            identifierCaps: options.identifierCaps,
            aliasEnabled: options.aliasEnabled,
            aliasMaxTerms: options.aliasMaxTerms,
            minTokenLength: options.aliasMinTokenLength
        });

        const baseText = embeddingService.formatForEmbedding(expandedMetadata);
        const overrides = expandedMetadata.rag_query_overrides || {};
        const extraTerms = [];

        if (Array.isArray(overrides.alias_terms) && overrides.alias_terms.length > 0) {
            extraTerms.push(`Aliases: ${overrides.alias_terms.join(', ')}`);
        }

        const evidence = overrides.evidence_tokens || {};
        if (Array.isArray(evidence.keywords) && evidence.keywords.length > 0) {
            extraTerms.push(`Evidence Keywords: ${evidence.keywords.join(', ')}`);
        }
        if (Array.isArray(evidence.genres) && evidence.genres.length > 0) {
            extraTerms.push(`Evidence Genres: ${evidence.genres.join(', ')}`);
        }
        if (Array.isArray(evidence.studios) && evidence.studios.length > 0) {
            extraTerms.push(`Evidence Studios: ${evidence.studios.join(', ')}`);
        }
        if (Array.isArray(evidence.cast) && evidence.cast.length > 0) {
            extraTerms.push(`Evidence Cast: ${evidence.cast.join(', ')}`);
        }
        if (evidence.collection) {
            extraTerms.push(`Evidence Collection: ${evidence.collection}`);
        }

        if (extraTerms.length === 0) {
            return baseText;
        }

        return `${baseText} | ${extraTerms.join(' | ')}`;
    }

    /**
     * Search for similar classifications using vector similarity
     * @param {object} metadata - Metadata of item to search for
     * @param {number} limit - Max results to return
     * @returns {Promise<Array>} Similar classifications with scores
     */
    async semanticSearch(metadata, limit = 5, options = {}) {
        const signal = options.signal || null;
        
        try {
            checkAbort(signal, 'semantic search');
            
            const pass = options.pass || 'pass1';
            const applyThreshold = options.applyThreshold !== false;
            const expansionOptions = options.expansionOptions || {};
            const efSearch = options.efSearch ?? EF_SEARCH;

            // Check if RAG is enabled
            const enabled = await embeddingRouter.isEnabled();
            if (!enabled) {
                logger.info('RAG search skipped - RAG is disabled', { title: metadata.title });
                return [];
            }
            
            checkAbort(signal, 'semantic search');

            // Get config and embedding count once for efficiency
            const config = await embeddingRouter.getConfig();
            const embeddingCount = await this.getEmbeddingCount();
            const threshold = config?.rag_similarity_threshold || 0.70;
            let textWeight = Number(config?.rag_text_weight ?? 0.70);
            let imageWeight = Number(config?.rag_image_weight ?? 0.30);
            if (!Number.isFinite(textWeight)) textWeight = 0.70;
            if (!Number.isFinite(imageWeight)) imageWeight = 0.30;
            textWeight = Math.max(0, textWeight);
            imageWeight = Math.max(0, imageWeight);
            const imageConfig = await imageEmbeddingProvider.getConfig();
            const imageMode = imageConfig?.image_embedding_provider_mode || 'disabled';
            const imageConfigured = imageEmbeddingProvider.isConfigured(imageConfig);
            if (imageMode === 'disabled' || !imageConfigured) {
                imageWeight = 0;
            }
            const weightSum = textWeight + imageWeight;
            if (weightSum > 0) {
                textWeight /= weightSum;
                imageWeight /= weightSum;
            } else {
                textWeight = 1;
                imageWeight = 0;
            }
            const minRequired = config?.rag_min_history_count || 50;

            // Check minimum embeddings threshold
            const hasMinimum = await this._getHasMinimumCached();
            if (!hasMinimum) {
                logger.info('RAG search skipped - not enough embeddings', { 
                    title: metadata.title,
                    embeddingCount,
                    minimumRequired: minRequired
                });
                return [];
            }
            
            checkAbort(signal, 'semantic search');

            logger.info('RAG search initiated', { 
                title: metadata.title, 
                threshold,
                limit,
                embeddingCount,
                pass,
                applyThreshold
            });

            // Generate embedding for query
            const text = this.buildRetrievalText(metadata, {
                pass,
                useExpandedQuery: options.useExpandedQuery === true || pass !== 'pass1',
                identifierCaps: expansionOptions.identifierCaps,
                aliasEnabled: expansionOptions.aliasEnabled,
                aliasMaxTerms: expansionOptions.aliasMaxTerms,
                aliasMinTokenLength: expansionOptions.aliasMinTokenLength
            });
            const queryResult = await embeddingRouter.embed(text, { signal });
            
            checkAbort(signal, 'semantic search');

            // Convert to pgvector format
            const vectorString = `[${queryResult.embedding.join(',')}]`;

            // Attempt image embedding (best-effort)
            let imageVectorString = null;
            const posterUrl = embeddingService.resolvePosterUrl(metadata);
            if (posterUrl && imageWeight > 0) {
                try {
                    const imageResult = await imageEmbeddingProvider.embedImageFromUrl(posterUrl);
                    if (imageResult?.embedding?.length) {
                        imageVectorString = `[${imageResult.embedding.join(',')}]`;
                    }
                } catch (imageError) {
                    logger.debug('Image embedding skipped', { error: imageError.message });
                }
            }
            
            checkAbort(signal, 'semantic search');

            // Two-phase retrieval:
            // 1) Pull top-K by text similarity
            // 2) Re-rank by combined (text + image) similarity
            const candidateLimit = Math.min(Math.max(limit * 5, 25), CANDIDATE_LIMIT_MAX);

            const client = await db.pool.connect();
            let result;
            try {
                await client.query('BEGIN');
                await client.query(`SET LOCAL hnsw.ef_search = ${efSearch}`); // sql-interpolation: SET LOCAL param cannot use $N placeholders; efSearch is a validated positive integer from config
                result = await client.query(`
                WITH candidates AS (
                    SELECT
                        ce.id,
                        ce.classification_id,
                        ch.title,
                        ch.media_type,
                        ch.library_id,
                        ch.library_name,
                        ch.method,
                        ch.confidence,
                        ch.created_at,
                        1 - (ce.embedding <=> $1::vector) as text_similarity,
                        ce.image_embedding
                    FROM classification_embeddings ce
                    JOIN classification_history ch ON ce.classification_id = ch.id
                    WHERE ce.is_stale = false
                    AND ch.library_id IS NOT NULL
                    ORDER BY text_similarity DESC
                    LIMIT $5
                )
                SELECT
                    c.id,
                    c.classification_id,
                    c.title,
                    c.media_type,
                    c.library_id,
                    c.library_name,
                    c.method,
                    c.confidence,
                    c.created_at,
                    c.text_similarity,
                    CASE
                        WHEN $2::vector IS NULL OR c.image_embedding IS NULL THEN NULL
                        ELSE 1 - (c.image_embedding <=> $2::vector)
                    END as image_similarity,
                    CASE
                        WHEN $2::vector IS NULL OR c.image_embedding IS NULL
                            THEN c.text_similarity
                        ELSE
                            ($3 * c.text_similarity) +
                            ($4 * (1 - (c.image_embedding <=> $2::vector)))
                    END as combined_similarity
                FROM candidates c
                ORDER BY combined_similarity DESC
                LIMIT $6
            `, [vectorString, imageVectorString, textWeight, imageWeight, candidateLimit, limit]);
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK').catch(() => {});
                throw err;
            } finally {
                client.release();
            }

            if (result.rows.length === 0) {
                logger.info('RAG search returned no results', { 
                    title: metadata.title,
                    embeddingCount
                });
                return [];
            }

            // Filter by threshold and format results
            const normalizedTextWeight = Math.round(textWeight * 100) / 100;
            const normalizedImageWeight = Math.round(imageWeight * 100) / 100;
            const rows = applyThreshold
                ? result.rows.filter(row => row.combined_similarity >= threshold)
                : result.rows;
            const matches = rows
                .map(row => ({
                    classificationId: row.classification_id,
                    title: row.title,
                    mediaType: row.media_type,
                    libraryId: row.library_id,
                    libraryName: row.library_name,
                    method: row.method,
                    confidence: row.confidence,
                    similarity: Math.round(row.combined_similarity * 100) / 100,
                    textSimilarity: Math.round((row.text_similarity ?? 0) * 100) / 100,
                    imageSimilarity: row.image_similarity === null || row.image_similarity === undefined
                        ? null
                        : Math.round(row.image_similarity * 100) / 100,
                    textWeight: normalizedTextWeight,
                    imageWeight: normalizedImageWeight,
                    date: row.created_at
                }));

            if (applyThreshold && matches.length === 0 && result.rows.length > 0) {
                logger.info('RAG results below threshold', { 
                    title: metadata.title,
                    topSimilarity: result.rows[0]?.combined_similarity || 0,
                    threshold,
                    totalResults: result.rows.length
                });
                return [];
            }

            logger.info('RAG search completed successfully', {
                title: metadata.title,
                matches: matches.length,
                topSimilarity: matches[0]?.similarity || 0,
                threshold,
                pass,
                applyThreshold
            });

            return matches;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            logger.error('Semantic search failed', { 
                title: metadata.title,
                error: error.message 
            });
            if (options.throwOnError === true) {
                throw error;
            }
            return [];
        }
    }

    /**
     * Return top-K semantic candidates without similarity-threshold filtering.
     * Used for deterministic conflict/weakness diagnostics.
     * @param {object} metadata - Metadata of item to search for
     * @param {number} candidateLimit - Max candidates to return
     * @param {object} options - Optional retrieval controls
     * @returns {Promise<Array>} Unfiltered semantic candidates
     */
    async semanticSearchCandidates(metadata, candidateLimit = 25, options = {}) {
        return this.semanticSearch(metadata, candidateLimit, {
            ...options,
            applyThreshold: false,
            efSearch: options.efSearch ?? EF_SEARCH_CANDIDATES
        });
    }

    /**
     * Get count of available embeddings
     * @returns {Promise<number>} Count of non-stale embeddings
     */
    async getEmbeddingCount() {
        const now = Date.now();
        if (this._embeddingCountCache !== null && now - this._embeddingCountCachedAt < EMBEDDING_STATS_TTL_MS) {
            return this._embeddingCountCache;
        }
        try {
            const result = await db.query(`
                SELECT COUNT(*) as count 
                FROM classification_embeddings 
                WHERE is_stale = false
            `);
            this._embeddingCountCache = parseInt(result.rows[0]?.count || 0);
            this._embeddingCountCachedAt = now;
            return this._embeddingCountCache;
        } catch (error) {
            logger.debug('Failed to get embedding count', { error: error.message });
            return 0;
        }
    }

    /**
     * Cached wrapper for embeddingService.hasMinimumEmbeddings().
     * Avoids a SELECT COUNT(*) on every semanticSearch/findSimilarItems call during
     * burst classification by reusing the result for EMBEDDING_STATS_TTL_MS ms.
     * The cache is instance-level; call sites that need a fresh check (e.g. health
     * endpoints) should call embeddingService.hasMinimumEmbeddings() directly.
     * @returns {Promise<boolean>}
     */
    async _getHasMinimumCached() {
        const now = Date.now();
        if (this._hasMinimumCache !== null && now - this._hasMinimumCachedAt < EMBEDDING_STATS_TTL_MS) {
            return this._hasMinimumCache;
        }
        const result = await embeddingService.hasMinimumEmbeddings();
        this._hasMinimumCache = result;
        this._hasMinimumCachedAt = now;
        return result;
    }

    /**
     * Calculate RRF (Reciprocal Rank Fusion) score
     * @param {Array} semanticMatches - Results from semantic search
     * @param {Array} textMatches - Results from full-text search
     * @param {number} k - RRF smoothing constant (default 60)
     * @returns {Array} Fused results with RRF scores
     */
    calculateRRF(semanticMatches, textMatches, k = 60) {
        // Handle edge cases
        if (!semanticMatches && !textMatches) {
            return [];
        }
        
        // Ensure we have arrays
        const semantic = semanticMatches || [];
        const text = textMatches || [];
        
        // If both are empty, return empty
        if (semantic.length === 0 && text.length === 0) {
            return [];
        }

        // Validate k parameter
        if (typeof k !== 'number' || k < 0) {
            k = 60;
        }

        const combined = new Map();

        // Process semantic matches (rank starting from 0)
        semantic.forEach((match, index) => {
            if (!match.classificationId) {
                logger.debug('Skipping match without classificationId', { match });
                return;
            }

            const rrfScore = 1 / (k + index + 1);
            combined.set(match.classificationId, {
                ...match,
                rrfScore,
                semanticRank: index + 1,
                textRank: null,
                vectorScore: match.similarity || 0,
                textScore: 0
            });
        });

        // Process text matches
        text.forEach((match, index) => {
            if (!match.classificationId) {
                logger.debug('Skipping match without classificationId', { match });
                return;
            }

            const rrfScore = 1 / (k + index + 1);
            
            if (combined.has(match.classificationId)) {
                // Item appears in both sources - boost with combined RRF
                const existing = combined.get(match.classificationId);
                existing.rrfScore += rrfScore;
                existing.textRank = index + 1;
                existing.textScore = match.textScore || 0;
            } else {
                // Item only in text search
                combined.set(match.classificationId, {
                    ...match,
                    rrfScore,
                    semanticRank: null,
                    textRank: index + 1,
                    vectorScore: 0,
                    textScore: match.textScore || 0
                });
            }
        });

        // Sort by RRF score (descending), then by semantic rank for tie-breaking
        const results = Array.from(combined.values())
            .sort((a, b) => {
                if (b.rrfScore !== a.rrfScore) {
                    return b.rrfScore - a.rrfScore;
                }
                // Tie-breaking: prefer items with better semantic rank
                if (a.semanticRank !== null && b.semanticRank !== null) {
                    return a.semanticRank - b.semanticRank;
                } /* c8 ignore next */
                if (a.semanticRank !== null) return -1;
                if (b.semanticRank !== null) return 1;
                /* c8 ignore next */
                return 0;
            });

        return results;
    }

    /**
     * Weighted Reciprocal Rank Fusion (Issue 286 — 3-way fusion with per-source weights).
     *
     * Formula: final_score(doc) = Σ weight_i × (1 / (k + rank_i(doc)))
     * Source: Azure AI Search weighted hybrid ranking (confirmed from Azure hybrid search docs).
     *
     * The weight multiplies the per-rank contribution before accumulation. With equal weights
     * (weight=1.0 for all sources) the result is identical to the unweighted calculateRRF.
     * At rag_graph_weight=0.20, a top-1 graph hit contributes ~20% of what a top-1 vector hit
     * contributes — graph is supplementary, not a veto.
     *
     * @param {Array<{matches: Array, weight: number}>} sources - Each source's matches + weight.
     * @param {number} k - RRF smoothing constant (default 60, Cormack et al. 2009).
     * @returns {Array} Fused and ranked results sorted by descending rrfScore.
     */
    calculateWeightedRRF(sources, k = 60) {
        if (!sources || sources.length === 0) return [];
        if (typeof k !== 'number' || k < 0) k = 60;

        const combined = new Map();

        sources.forEach(({ matches, weight = 1.0 }) => {
            if (!matches || matches.length === 0) return;
            matches.forEach((match, index) => {
                if (!match.classificationId) {
                    logger.debug('Skipping match without classificationId in weighted RRF', { match });
                    return;
                }
                const contribution = weight * (1 / (k + index + 1));
                if (combined.has(match.classificationId)) {
                    combined.get(match.classificationId).rrfScore += contribution;
                } else {
                    combined.set(match.classificationId, { ...match, rrfScore: contribution });
                }
            });
        });

        return Array.from(combined.values())
            .sort((a, b) => b.rrfScore - a.rrfScore);
    }

    /**
     * Legacy hybrid combine (weighted average)
     * Kept for rollback capability
     */
    legacyHybridCombine(semanticMatches, textMatches, limit = 5) {
        const combined = new Map();

        // Add semantic matches with vector score
        for (const match of semanticMatches) {
            combined.set(match.classificationId, {
                ...match,
                vectorScore: match.similarity,
                textScore: 0
            });
        }

        // Add/update text matches
        for (const match of textMatches) {
            if (combined.has(match.classificationId)) {
                combined.get(match.classificationId).textScore = match.textScore;
            } else {
                combined.set(match.classificationId, {
                    ...match,
                    vectorScore: 0,
                    textScore: match.textScore
                });
            }
        }

        // Calculate combined score and sort
        const results = Array.from(combined.values())
            .map(item => ({
                ...item,
                combinedScore: (item.vectorScore * 0.7) + (item.textScore * 0.3)
            }))
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, limit);

        return results;
    }

    /**
     * Hybrid search combining vector similarity and full-text search
     * @param {object} metadata - Metadata to search for
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Combined search results
     */
    async hybridSearch(metadata, limit = 5, options = {}) {
        const startTime = Date.now();
        const signal = options.signal || null;
        
        try {
            checkAbort(signal, 'hybrid search');
            
            // Get config for fusion method
            const config = await embeddingRouter.getConfig();
            const fusionMethod = config?.rag_fusion_method || 'rrf';
            const rrfK = config?.rag_rrf_k || 60;
            const graphEnabled = config?.rag_graph_enabled === true;

            // Get semantic matches
            const semanticMatches = await this.semanticSearch(metadata, limit, options);

            // Get full-text matches
            const { matches: textMatches, expansionTermCount } = await this.fullTextSearch(metadata, limit, options);

            // Get graph matches (only when rag_graph_enabled = true)
            let graphMatches = [];
            if (graphEnabled) {
                graphMatches = await this.graphSearch(metadata, config, options);
            }

            let results;
            if (fusionMethod === 'rrf') {
                if (graphEnabled && graphMatches.length >= (config?.rag_graph_min_matches_to_apply ?? 1)) {
                    // 3-way weighted RRF
                    results = this.calculateWeightedRRF([
                        { matches: semanticMatches, weight: 1.0 },
                        { matches: textMatches,     weight: 1.0 },
                        { matches: graphMatches,    weight: Number(config?.rag_graph_weight ?? 0.20) }
                    ], rrfK);
                } else {
                    // 2-way unweighted RRF (same as before Issue 286)
                    results = this.calculateRRF(semanticMatches, textMatches, rrfK);
                }
            } else {
                // Use legacy weighted average (graph not supported in legacy mode)
                results = this.legacyHybridCombine(semanticMatches, textMatches, limit);
            }

            // Limit results
            results = results.slice(0, limit);

            // Log operation metrics
            const duration = Date.now() - startTime;
            const useExpandedQuery = options.useExpandedQuery === true;
            await ragLogger.logOperation('hybrid_search', duration, true, {
                itemsProcessed: results.length,
                metadata: {
                    fusionMethod,
                    semanticMatches: semanticMatches.length,
                    textMatches: textMatches.length,
                    graphMatches: graphMatches.length,
                    graphEnabled,
                    fusedResults: results.length,
                    expandedQuery: useExpandedQuery,
                    expansionTermCount: useExpandedQuery ? expansionTermCount : 0
                }
            });

            return results;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            const duration = Date.now() - startTime;
            await ragLogger.logError(error, 'hybrid_search', { duration_ms: duration });
            logger.error('Hybrid search failed', { error: error.message });
            if (options.throwOnError === true) {
                throw error;
            }
            return [];
        }
    }

    /**
     * Graph retrieval: finds classification_history rows that are relationally connected
     * to the query item via franchise/collection, director, studio, cast, or genre overlap.
     *
     * Query strategy: builds a dynamic WHERE clause from only the relationship dimensions
     * that are (a) enabled in config and (b) have a non-null input value. This is required
     * because parameterized boolean predicates (AND $n) are not valid SQL, and null-check
     * branches in prepared statements may produce sub-optimal plans (Postgres 17 planner).
     *
     * @param {object} metadata - Classification metadata (same shape as semanticSearch).
     * @param {object} config - RAG config from embeddingRouter.getConfig() — already loaded.
     * @param {object} options - Supports options.signal (AbortSignal).
     * @returns {Promise<Array>} Graph candidates, sorted by match_score DESC then created_at DESC.
     */
    async graphSearch(metadata, config, options = {}) {
        const signal = options.signal || null;
        const startTime = Date.now();

        try {
            checkAbort(signal, 'graph search');

            const graphEnabled = config?.rag_graph_enabled === true;
            if (!graphEnabled) return [];

            const ragGraphExtractor = require('./ragGraphExtractor');
            const relationships = ragGraphExtractor.extract(metadata);

            // collection_id lives on the metadata object directly (set by signalCollector)
            const collectionId = metadata.collectionId || metadata.collection_id || null;

            const collectionEnabled = config?.rag_graph_collection_enabled !== false; // default true
            const directorEnabled   = config?.rag_graph_director_enabled   !== false; // default true
            const studioEnabled     = config?.rag_graph_studio_enabled     === true;  // default false
            const castEnabled       = config?.rag_graph_cast_enabled       === true;  // default false
            const genreEnabled      = config?.rag_graph_genre_enabled      === true;  // default false
            const limit             = Number(config?.rag_graph_candidates_limit ?? 20);

            // Build active conditions dynamically — only push dimensions that are enabled and
            // have non-null input. classificationId-to-exclude is always $1.
            const excludeId = metadata.classificationId || metadata.classification_id || 0;
            const params = [excludeId];
            const conditions = [];
            const scoreTerms = [];

            if (collectionEnabled && collectionId != null) {
                params.push(collectionId);
                conditions.push(`collection_id = $${params.length}`);
                scoreTerms.push(`CASE WHEN collection_id = $${params.length} THEN 8 ELSE 0 END`);
            }
            if (directorEnabled && relationships.director_name != null) {
                params.push(relationships.director_name);
                conditions.push(`director_name = $${params.length}`);
                scoreTerms.push(`CASE WHEN director_name = $${params.length} THEN 4 ELSE 0 END`);
            }
            if (studioEnabled && relationships.primary_studio_name != null) {
                params.push(relationships.primary_studio_name);
                conditions.push(`primary_studio_name = $${params.length}`);
                scoreTerms.push(`CASE WHEN primary_studio_name = $${params.length} THEN 2 ELSE 0 END`);
            }
            if (castEnabled && relationships.cast_ids.length > 0) {
                params.push(relationships.cast_ids);
                conditions.push(`cast_ids && $${params.length}`);
                scoreTerms.push(`CASE WHEN cast_ids && $${params.length} THEN 1 ELSE 0 END`);
            }
            if (genreEnabled && relationships.genre_names.length > 0) {
                params.push(relationships.genre_names);
                conditions.push(`genre_names && $${params.length}`);
                scoreTerms.push(`CASE WHEN genre_names && $${params.length} THEN 1 ELSE 0 END`);
            }

            // Nothing to query on — return early without hitting the DB.
            if (conditions.length === 0) return [];

            const matchScoreExpr = scoreTerms.length > 0
                ? `(${scoreTerms.join(' + ')})`
                : '0';

            params.push(limit);
            const sql = `
                SELECT id AS classification_id, title, media_type, library_id, library_name,
                       method, confidence, created_at,
                       ${matchScoreExpr} AS match_score
                FROM classification_history
                WHERE library_id IS NOT NULL
                  AND id != $1
                  AND (${conditions.join(' OR ')})
                ORDER BY match_score DESC, created_at DESC
                LIMIT $${params.length}
            `;

            checkAbort(signal, 'graph search');
            const { rows } = await db.query(sql, params);

            return rows.map(row => ({
                classificationId: row.classification_id,
                title:            row.title,
                mediaType:        row.media_type,
                libraryId:        row.library_id,
                libraryName:      row.library_name,
                method:           row.method,
                confidence:       row.confidence,
                similarity:       null,      // graph hits have no cosine similarity
                graphMatchScore:  row.match_score
            }));

        } catch (error) {
            if (error.name === 'AbortError') throw error;
            const duration = Date.now() - startTime;
            await ragLogger.logError(error, 'graph_search', { duration_ms: duration });
            logger.error('Graph search failed', { title: metadata?.title, error: error.message });
            return [];
        }
    }

    async fullTextSearch(metadata, limit = 5, options = {}) {
        const signal = options.signal || null;
        const useExpandedQuery = options.useExpandedQuery === true;
        
        try {
            checkAbort(signal, 'full-text search');
            
            const baseTerms = [
                metadata.title,
                metadata.library_name
            ].filter(Boolean);

            let expansionTermCount = 0;
            let searchTerms;

            if (useExpandedQuery && metadata.rag_query_overrides) {
                const overrides = metadata.rag_query_overrides;
                const aliasTerms = Array.isArray(overrides.alias_terms) ? overrides.alias_terms : [];
                const evidenceTokens = overrides.evidence_tokens || {};
                const genres = Array.isArray(evidenceTokens.genres) ? evidenceTokens.genres : [];
                const keywords = Array.isArray(evidenceTokens.keywords) ? evidenceTokens.keywords : [];
                // Cast and aliases not indexed in search_text tsvector; omit from FTS to avoid zero-match expansion
                const ftsExpansionTerms = [...aliasTerms, ...genres, ...keywords].filter(Boolean);
                expansionTermCount = ftsExpansionTerms.length;
                // Use OR semantics so each expansion term broadens rather than restricts results
                const baseQuery = baseTerms.join(' ');
                searchTerms = ftsExpansionTerms.length > 0
                    ? `${baseQuery} OR ${ftsExpansionTerms.join(' OR ')}`
                    : baseQuery;
            } else {
                searchTerms = baseTerms.join(' ');
            }

            if (!searchTerms) return { matches: [], expansionTermCount: 0 };
            
            checkAbort(signal, 'full-text search');

            // Explicitly whitelist to prevent any possibility of SQL injection
            const tsQueryFn = (useExpandedQuery && expansionTermCount > 0)
                ? 'websearch_to_tsquery'
                : 'plainto_tsquery';
            /* c8 ignore next 3 */
            if (tsQueryFn !== 'websearch_to_tsquery' && tsQueryFn !== 'plainto_tsquery') {
                throw new Error(`Invalid tsQueryFn: ${tsQueryFn}`);
            }

            const result = await db.query(`
                SELECT 
                    id as classification_id,
                    title,
                    media_type,
                    library_id,
                    library_name,
                    ts_rank(search_text, ${tsQueryFn}('english', $1)) as text_score
                FROM classification_history
                WHERE search_text @@ ${tsQueryFn}('english', $1)
                AND library_id IS NOT NULL
                ORDER BY text_score DESC
                LIMIT $2
            `, [searchTerms, limit]);

            const matches = result.rows.map(row => ({
                classificationId: row.classification_id,
                title: row.title,
                mediaType: row.media_type,
                libraryId: row.library_id,
                libraryName: row.library_name,
                textScore: Math.round(row.text_score * 100) / 100
            }));
            return { matches, expansionTermCount };

        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            logger.debug('Full-text search failed', { error: error.message });
            return { matches: [], expansionTermCount: 0 };
        }
    }

    /**
     * Calculate dynamic weight for semantic similarity signal
     * Based on match quality and unanimity
     * @param {Array} matches - Similar matches from search
     * @returns {number} Weight between 50-90
     */
    calculateDynamicWeight(matches) {
        if (!matches || matches.length === 0) {
            return 0;
        }

        const topMatch = matches[0]?.similarity || 0;

        // Check if all matches point to same library
        const libraryIds = matches.map(m => m.libraryId);
        const uniqueLibraries = new Set(libraryIds);
        const unanimous = uniqueLibraries.size === 1;

        // Dynamic weight based on quality and unanimity
        if (matches.length >= 3 && unanimous && topMatch > 0.90) {
            return 90;
        }
        if (matches.length >= 2 && unanimous && topMatch > 0.80) {
            return 80;
        }
        if (matches.length >= 1 && topMatch > 0.70) {
            return 70;
        }
        if (topMatch > 0.60) {
            return 60;
        }
        return 50;
    }

    /**
     * Get the suggested library from similar matches
     * @param {Array} matches - Similar matches
     * @returns {object|null} Suggested library with confidence
     */
    getSuggestedLibrary(matches) {
        if (!matches || matches.length === 0) {
            return null;
        }

        // Count votes by library
        const votes = {};
        for (const match of matches) {
            if (!votes[match.libraryId]) {
                votes[match.libraryId] = {
                    libraryId: match.libraryId,
                    libraryName: match.libraryName,
                    count: 0,
                    totalSimilarity: 0
                };
            }
            votes[match.libraryId].count++;
            votes[match.libraryId].totalSimilarity += match.similarity;
        }

        // Find winner
        const winner = Object.values(votes)
            .sort((a, b) => b.totalSimilarity - a.totalSimilarity)[0];

        return {
            libraryId: winner.libraryId,
            libraryName: winner.libraryName,
            voteCount: winner.count,
            avgSimilarity: Math.round((winner.totalSimilarity / winner.count) * 100) / 100
        };
    }

    /**
     * Format matches for AI context
     * @param {Array} matches - Similar matches
     * @returns {string} Formatted string for AI prompt
     */
    formatForAIContext(matches) {
        if (!matches || matches.length === 0) {
            return '';
        }

        const lines = ['Similar past classifications:'];
        for (const match of matches.slice(0, 3)) {
            const similarity = match.similarity || 0;
            if (match.imageSimilarity !== null && match.imageSimilarity !== undefined) {
                const textPct = Math.round((match.textSimilarity || 0) * 100);
                const imagePct = Math.round(match.imageSimilarity * 100);
                lines.push(`- "${match.title}" → ${match.libraryName} (${Math.round(similarity * 100)}% combined; text ${textPct}%, image ${imagePct}%)`);
            } else {
                lines.push(`- "${match.title}" → ${match.libraryName} (${Math.round(similarity * 100)}% similar)`);
            }
        }

        const suggested = this.getSuggestedLibrary(matches);
        if (suggested) {
            lines.push(`\nRAG suggests: ${suggested.libraryName} (${suggested.voteCount} similar items)`);
        }

        return lines.join('\n');
    }

    /**
     * Find similar items in a specific library for Discord notifications
     * @param {string} title - Title to search for
     * @param {number} libraryId - Library ID to filter by
     * @param {number} limit - Max results to return
     * @returns {Promise<Array>} Similar items in the library
     */
    async findSimilarItems(title, libraryId, limit = 3) {
        try {
            // Check if RAG is enabled
            const enabled = await embeddingRouter.isEnabled();
            if (!enabled) {
                return [];
            }

            // Check minimum embeddings
            const hasMinimum = await this._getHasMinimumCached();
            if (!hasMinimum) {
                return [];
            }

            // Create simple metadata object for embedding
            const metadata = { title };
            const text = embeddingService.formatForEmbedding(metadata);
            const queryResult = await embeddingRouter.embed(text);

            // Convert to pgvector format
            const vectorString = `[${queryResult.embedding.join(',')}]`;

            // Search only in the specified library
            const result = await db.query(`
                SELECT 
                    ch.title,
                    ch.media_type,
                    1 - (ce.embedding <=> $1::vector) as similarity
                FROM classification_embeddings ce
                JOIN classification_history ch ON ce.classification_id = ch.id
                WHERE ce.is_stale = false
                AND ch.library_id = $2
                AND ch.title != $3
                ORDER BY ce.embedding <=> $1::vector
                LIMIT $4
            `, [vectorString, libraryId, title, limit]);

            return result.rows.map(row => ({
                title: row.title,
                mediaType: row.media_type,
                similarity: Math.round(row.similarity * 100) / 100
            }));
        } catch (error) {
            logger.debug('Failed to find similar items', { 
                error: error.message,
                libraryId,
                title
            });
            return [];
        }
    }
}

module.exports = new RAGRetriever();

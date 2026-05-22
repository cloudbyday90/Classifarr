/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { embeddingService } from './embeddingService.mjs';
import { imageEmbeddingProvider } from './imageEmbeddingProvider.mjs';
import * as ragGraphExtractor from './ragGraphExtractor.mjs';
import { createLogger } from '../utils/logger.mjs';
import { ragLogger } from '../utils/ragLogger.mjs';
import { expandRetrievalMetadata } from '../utils/ragLoopHelpers.mjs';
import { calculateRRF as calculateRRFFn, calculateWeightedRRF as calculateWeightedRRFFn, legacyHybridCombine as legacyHybridCombineFn } from './ragFusion.mjs';
import { formatForAIContext as formatForAIContextFn, getSuggestedLibrary as getSuggestedLibraryFn, calculateDynamicWeight as calculateDynamicWeightFn } from './ragRetrieverFormatters.mjs';

const logger = createLogger('RAGRetriever');

const EF_SEARCH = parseInt(process.env.PGVECTOR_EF_SEARCH) || 80;
const EF_SEARCH_CANDIDATES = parseInt(process.env.PGVECTOR_EF_SEARCH_CANDIDATES) || 40;
const CANDIDATE_LIMIT_MAX = parseInt(process.env.PGVECTOR_CANDIDATE_LIMIT) || 200;
const EMBEDDING_STATS_TTL_MS = 30_000;

function checkAbort(signal, operation = 'operation') {
  if (signal?.aborted) {
    const error = new Error(`${operation} aborted`);
    error.name = 'AbortError';
    error.code = 'ABORT_ERR';
    throw error;
  }
}

class RAGRetriever {
  constructor() {
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
      minTokenLength: options.aliasMinTokenLength,
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

  async semanticSearch(metadata, limit = 5, options = {}) {
    const signal = options.signal || null;

    try {
      checkAbort(signal, 'semantic search');

      const pass = options.pass || 'pass1';
      const applyThreshold = options.applyThreshold !== false;
      const expansionOptions = options.expansionOptions || {};
      const efSearch = options.efSearch ?? EF_SEARCH;

      const enabled = await embeddingRouter.isEnabled();
      if (!enabled) {
        logger.info('RAG search skipped - RAG is disabled', { title: metadata.title });
        return [];
      }

      checkAbort(signal, 'semantic search');

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

      const hasMinimum = await this._getHasMinimumCached();
      if (!hasMinimum) {
        logger.info('RAG search skipped - not enough embeddings', {
          title: metadata.title,
          embeddingCount,
          minimumRequired: minRequired,
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
        applyThreshold,
      });

      const text = this.buildRetrievalText(metadata, {
        pass,
        useExpandedQuery: options.useExpandedQuery === true || pass !== 'pass1',
        identifierCaps: expansionOptions.identifierCaps,
        aliasEnabled: expansionOptions.aliasEnabled,
        aliasMaxTerms: expansionOptions.aliasMaxTerms,
        aliasMinTokenLength: expansionOptions.aliasMinTokenLength,
      });
      const queryResult = await embeddingRouter.embed(text, { signal });

      checkAbort(signal, 'semantic search');

      const vectorString = `[${queryResult.embedding.join(',')}]`;

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

      const candidateLimit = Math.min(Math.max(limit * 5, 25), CANDIDATE_LIMIT_MAX);

      const result = await db.withTransaction(async (client) => {
        await client.query("SELECT set_config('hnsw.ef_search', $1, true)", [String(efSearch)]);
        return client.query(`
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
      });

      if (result.rows.length === 0) {
        logger.info('RAG search returned no results', {
          title: metadata.title,
          embeddingCount,
        });
        return [];
      }

      const normalizedTextWeight = Math.round(textWeight * 100) / 100;
      const normalizedImageWeight = Math.round(imageWeight * 100) / 100;
      const rows = applyThreshold
        ? result.rows.filter((row) => row.combined_similarity >= threshold)
        : result.rows;
      const matches = rows
        .map((row) => ({
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
          date: row.created_at,
        }));

      if (applyThreshold && matches.length === 0 && result.rows.length > 0) {
        logger.info('RAG results below threshold', {
          title: metadata.title,
          topSimilarity: result.rows[0]?.combined_similarity || 0,
          threshold,
          totalResults: result.rows.length,
        });
        return [];
      }

      logger.info('RAG search completed successfully', {
        title: metadata.title,
        matches: matches.length,
        topSimilarity: matches[0]?.similarity || 0,
        threshold,
        pass,
        applyThreshold,
      });

      return matches;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      logger.error('Semantic search failed', {
        title: metadata.title,
        error: error.message,
      });
      if (options.throwOnError === true) {
        throw error;
      }
      return [];
    }
  }

  async semanticSearchCandidates(metadata, candidateLimit = 25, options = {}) {
    return this.semanticSearch(metadata, candidateLimit, {
      ...options,
      applyThreshold: false,
      efSearch: options.efSearch ?? EF_SEARCH_CANDIDATES,
    });
  }

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

  calculateRRF(semanticMatches, textMatches, k) {
    return calculateRRFFn(semanticMatches, textMatches, k);
  }

  calculateWeightedRRF(sources, k) {
    return calculateWeightedRRFFn(sources, k);
  }

  legacyHybridCombine(semanticMatches, textMatches, limit) {
    return legacyHybridCombineFn(semanticMatches, textMatches, limit);
  }

  async hybridSearch(metadata, limit = 5, options = {}) {
    const startTime = Date.now();
    const signal = options.signal || null;

    try {
      checkAbort(signal, 'hybrid search');

      const config = await embeddingRouter.getConfig();
      const fusionMethod = config?.rag_fusion_method || 'rrf';
      const rrfK = config?.rag_rrf_k || 60;
      const graphEnabled = config?.rag_graph_enabled === true;

      const semanticMatches = await this.semanticSearch(metadata, limit, options);
      const { matches: textMatches, expansionTermCount } = await this.fullTextSearch(metadata, limit, options);

      let graphMatches = [];
      if (graphEnabled) {
        graphMatches = await this.graphSearch(metadata, config, options);
      }

      let results;
      if (fusionMethod === 'rrf') {
        if (graphEnabled && graphMatches.length >= (config?.rag_graph_min_matches_to_apply ?? 1)) {
          results = this.calculateWeightedRRF([
            { matches: semanticMatches, weight: 1.0 },
            { matches: textMatches, weight: 1.0 },
            { matches: graphMatches, weight: Number(config?.rag_graph_weight ?? 0.20) },
          ], rrfK);
        } else {
          results = this.calculateRRF(semanticMatches, textMatches, rrfK);
        }
      } else {
        results = this.legacyHybridCombine(semanticMatches, textMatches, limit);
      }

      results = results.slice(0, limit);

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
          expansionTermCount: useExpandedQuery ? expansionTermCount : 0,
        },
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

  async graphSearch(metadata, config, options = {}) {
    const signal = options.signal || null;
    const startTime = Date.now();

    try {
      checkAbort(signal, 'graph search');

      const graphEnabled = config?.rag_graph_enabled === true;
      if (!graphEnabled) return [];

      const relationships = ragGraphExtractor.extract(metadata);

      const collectionId = metadata.collectionId || metadata.collection_id || null;

      const collectionEnabled = config?.rag_graph_collection_enabled !== false;
      const directorEnabled = config?.rag_graph_director_enabled !== false;
      const studioEnabled = config?.rag_graph_studio_enabled === true;
      const castEnabled = config?.rag_graph_cast_enabled === true;
      const genreEnabled = config?.rag_graph_genre_enabled === true;
      const limit = Number(config?.rag_graph_candidates_limit ?? 20);

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

      return rows.map((row) => ({
        classificationId: row.classification_id,
        title: row.title,
        mediaType: row.media_type,
        libraryId: row.library_id,
        libraryName: row.library_name,
        method: row.method,
        confidence: row.confidence,
        similarity: null,
        graphMatchScore: row.match_score,
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
        metadata.library_name,
      ].filter(Boolean);

      let expansionTermCount = 0;
      let searchTerms;

      if (useExpandedQuery && metadata.rag_query_overrides) {
        const overrides = metadata.rag_query_overrides;
        const aliasTerms = Array.isArray(overrides.alias_terms) ? overrides.alias_terms : [];
        const evidenceTokens = overrides.evidence_tokens || {};
        const genres = Array.isArray(evidenceTokens.genres) ? evidenceTokens.genres : [];
        const keywords = Array.isArray(evidenceTokens.keywords) ? evidenceTokens.keywords : [];
        const ftsExpansionTerms = [...aliasTerms, ...genres, ...keywords].filter(Boolean);
        expansionTermCount = ftsExpansionTerms.length;
        const baseQuery = baseTerms.join(' ');
        searchTerms = ftsExpansionTerms.length > 0
          ? `${baseQuery} OR ${ftsExpansionTerms.join(' OR ')}`
          : baseQuery;
      } else {
        searchTerms = baseTerms.join(' ');
      }

      if (!searchTerms) return { matches: [], expansionTermCount: 0 };

      checkAbort(signal, 'full-text search');

      const tsQueryFn = (useExpandedQuery && expansionTermCount > 0)
        ? 'websearch_to_tsquery'
        : 'plainto_tsquery';
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

      const matches = result.rows.map((row) => ({
        classificationId: row.classification_id,
        title: row.title,
        mediaType: row.media_type,
        libraryId: row.library_id,
        libraryName: row.library_name,
        textScore: Math.round(row.text_score * 100) / 100,
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

  calculateDynamicWeight(matches) {
    return calculateDynamicWeightFn(matches);
  }

  getSuggestedLibrary(matches) {
    return getSuggestedLibraryFn(matches);
  }

  formatForAIContext(matches) {
    return formatForAIContextFn(matches);
  }

  async findSimilarItems(title, libraryId, limit = 3) {
    try {
      const enabled = await embeddingRouter.isEnabled();
      if (!enabled) {
        return [];
      }

      const hasMinimum = await this._getHasMinimumCached();
      if (!hasMinimum) {
        return [];
      }

      const metadata = { title };
      const text = embeddingService.formatForEmbedding(metadata);
      const queryResult = await embeddingRouter.embed(text);

      const vectorString = `[${queryResult.embedding.join(',')}]`;

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

      return result.rows.map((row) => ({
        title: row.title,
        mediaType: row.media_type,
        similarity: Math.round(row.similarity * 100) / 100,
      }));
    } catch (error) {
      logger.debug('Failed to find similar items', {
        error: error.message,
        libraryId,
        title,
      });
      return [];
    }
  }
}

export const ragRetriever = new RAGRetriever();

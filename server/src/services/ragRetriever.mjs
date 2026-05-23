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
import { createLogger } from '../utils/logger.mjs';
import { ragLogger } from '../utils/ragLogger.mjs';
import { calculateRRF as calculateRRFFn, calculateWeightedRRF as calculateWeightedRRFFn, legacyHybridCombine as legacyHybridCombineFn } from './ragFusion.mjs';
import { formatForAIContext as formatForAIContextFn, getSuggestedLibrary as getSuggestedLibraryFn, calculateDynamicWeight as calculateDynamicWeightFn } from './ragRetrieverFormatters.mjs';
import { graphSearch as graphSearchFn, fullTextSearch as fullTextSearchFn, findSimilarItems as findSimilarItemsFn } from './ragRetrieverSearch.mjs';
import { executeSemanticVectorSearch, mapSearchResults } from './ragRetrieverQuery.mjs';
import { buildRetrievalText as _buildRetrievalText } from './ragRetrieverText.mjs';

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
    return _buildRetrievalText(metadata, options, embeddingService.formatForEmbedding);
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

      const result = await executeSemanticVectorSearch(db, {
        vectorString,
        imageVectorString,
        textWeight,
        imageWeight,
        candidateLimit,
        limit,
        efSearch,
      });

      const { matches, allBelowThreshold } = mapSearchResults(result.rows, {
        textWeight,
        imageWeight,
        threshold,
        applyThreshold,
      });

      if (allBelowThreshold) {
        logger.info('RAG results below threshold', {
          title: metadata.title,
          topSimilarity: result.rows[0]?.combined_similarity || 0,
          threshold,
          totalResults: result.rows.length,
        });
        return [];
      }

      if (matches.length === 0) {
        logger.info('RAG search returned no results', {
          title: metadata.title,
          embeddingCount,
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
    return graphSearchFn(metadata, config, options);
  }

  async fullTextSearch(metadata, limit = 5, options = {}) {
    return fullTextSearchFn(metadata, limit, options);
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
    return findSimilarItemsFn(title, libraryId, limit, () => this._getHasMinimumCached(), embeddingService.formatForEmbedding, (text) => embeddingRouter.embed(text));
  }
}

export const ragRetriever = new RAGRetriever();

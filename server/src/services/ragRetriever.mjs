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
import { createLogger } from '../utils/logger.mjs';
import { ragLogger } from '../utils/ragLogger.mjs';
import { calculateRRF as calculateRRFFn, calculateWeightedRRF as calculateWeightedRRFFn, legacyHybridCombine as legacyHybridCombineFn } from './ragFusion.mjs';
import { formatForAIContext as formatForAIContextFn, getSuggestedLibrary as getSuggestedLibraryFn, calculateDynamicWeight as calculateDynamicWeightFn } from './ragRetrieverFormatters.mjs';
import { graphSearch as graphSearchFn, fullTextSearch as fullTextSearchFn, findSimilarItems as findSimilarItemsFn } from './ragRetrieverSearch.mjs';
import { buildRetrievalText as _buildRetrievalText } from './ragRetrieverText.mjs';
import { semanticSearch as _semanticSearch } from './ragRetrieverSemanticSearch.mjs';

const logger = createLogger('RAGRetriever');

const EF_SEARCH_CANDIDATES = parseInt(process.env.PGVECTOR_EF_SEARCH_CANDIDATES) || 40;
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
    return _semanticSearch(metadata, limit, options, {
      buildRetrievalText: (m, o) => this.buildRetrievalText(m, o),
      getEmbeddingCount: () => this.getEmbeddingCount(),
      hasMinimumCached: () => this._getHasMinimumCached(),
    });
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

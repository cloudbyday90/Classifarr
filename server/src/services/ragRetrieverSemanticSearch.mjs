import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { embeddingService } from './embeddingService.mjs';
import { imageEmbeddingProvider } from './imageEmbeddingProvider.mjs';
import { createLogger } from '../utils/logger.mjs';
import { executeSemanticVectorSearch, mapSearchResults } from './ragRetrieverQuery.mjs';
import { isProviderPreemptedError } from './embeddingServiceErrors.mjs';

const logger = createLogger('RAGRetriever');

const EF_SEARCH = parseInt(process.env.PGVECTOR_EF_SEARCH) || 80;
const CANDIDATE_LIMIT_MAX = parseInt(process.env.PGVECTOR_CANDIDATE_LIMIT) || 200;

function checkAbort(signal, operation = 'operation') {
  if (signal?.aborted) {
    const error = new Error(`${operation} aborted`);
    error.name = 'AbortError';
    error.code = 'ABORT_ERR';
    throw error;
  }
}

export async function semanticSearch(metadata, limit, options, { buildRetrievalText, getEmbeddingCount, hasMinimumCached }) {
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
    const embeddingCount = await getEmbeddingCount();
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

    const hasMinimum = await hasMinimumCached();
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

    const text = buildRetrievalText(metadata, {
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
    if (isProviderPreemptedError(error)) {
      logger.info('Semantic search skipped - embedding preempted by high-priority classification request', {
        title: metadata.title,
        pass: options.pass || 'pass1',
      });
      if (options.throwOnError === true) {
        throw error;
      }
      return [];
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

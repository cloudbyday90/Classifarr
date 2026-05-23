import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { embeddingService } from './embeddingService.mjs';
import * as ragGraphExtractor from './ragGraphExtractor.mjs';
import { createLogger } from '../utils/logger.mjs';
import { ragLogger } from '../utils/ragLogger.mjs';

const logger = createLogger('RAGRetrieverSearch');

export async function graphSearch(metadata, config, options = {}) {
  const signal = options.signal || null;
  const startTime = Date.now();

  try {
    if (signal?.aborted) {
      const error = new Error('graph search aborted');
      error.name = 'AbortError';
      error.code = 'ABORT_ERR';
      throw error;
    }

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

    if (signal?.aborted) {
      const error = new Error('graph search aborted');
      error.name = 'AbortError';
      error.code = 'ABORT_ERR';
      throw error;
    }
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

export async function fullTextSearch(metadata, limit = 5, options = {}) {
  const signal = options.signal || null;
  const useExpandedQuery = options.useExpandedQuery === true;

  try {
    if (signal?.aborted) {
      const error = new Error('full-text search aborted');
      error.name = 'AbortError';
      error.code = 'ABORT_ERR';
      throw error;
    }

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

    if (signal?.aborted) {
      const error = new Error('full-text search aborted');
      error.name = 'AbortError';
      error.code = 'ABORT_ERR';
      throw error;
    }

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

export async function findSimilarItems(title, libraryId, limit, getHasMinimumCached, formatForEmbedding, embed) {
  try {
    const enabled = await embeddingRouter.isEnabled();
    if (!enabled) {
      return [];
    }

    const hasMinimum = await getHasMinimumCached();
    if (!hasMinimum) {
      return [];
    }

    const metadata = { title };
    const text = formatForEmbedding(metadata);
    const queryResult = await embed(text);

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

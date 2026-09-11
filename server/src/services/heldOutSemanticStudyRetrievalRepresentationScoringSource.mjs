/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import { formatVectorString } from '../utils/embeddingUtils.mjs';
import { createLogger } from '../utils/logger.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { embeddingService } from './embeddingService.mjs';
import {
  applyHeldOutSemanticStudyQuerySettings,
  assertHeldOutSemanticStudyMember,
  heldOutSemanticStudyParameters,
} from './heldOutSemanticStudyScope.mjs';
import {
  applyPgvectorRecallSettings,
  resolvePgvectorRecallTuning,
} from './pgvectorRecallTuning.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_scoring_source.v1';
export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
});

const MAXIMUM_ITEMS_PER_CANDIDATE = 3;
const MAXIMUM_SCAN = 192;
const MAX_HISTORY_METADATA_BYTES = 12 * 1024;

const SCORING_SOURCE_SQL = `
  WITH nearest_embeddings AS MATERIALIZED (
    SELECT
      history.library_id,
      history.id AS classification_id,
      history.title,
      history.year,
      history.media_type,
      history.metadata AS history_metadata,
      COALESCE(NULLIF(history.library_name, ''), library.name) AS classification_label,
      embedding.embedding <=> $3::vector AS distance
    FROM classification_embeddings AS embedding
    JOIN classification_history AS history
      ON history.id = embedding.classification_id
    JOIN media_server_items AS item
      ON item.library_id = history.library_id
      AND item.media_type = history.media_type
      AND item.tmdb_id = history.tmdb_id
    LEFT JOIN libraries AS library ON library.id = history.library_id
    WHERE embedding.is_stale = false
      AND embedding.embedding IS NOT NULL
      AND history.library_id = ANY($1::integer[])
      AND history.media_type = $2::text
      AND ($4::integer IS NULL OR history.tmdb_id IS DISTINCT FROM $4::integer)
      AND history.tmdb_id > 0
      AND NOT EXISTS (
        SELECT 1
        FROM unnest($7::text[], $8::integer[]) AS held(media_type, tmdb_id)
        WHERE held.media_type = history.media_type
          AND held.tmdb_id = history.tmdb_id
      )
    ORDER BY embedding.embedding <=> $3::vector ASC, embedding.id ASC
    LIMIT $5::integer
  ), distinct_items AS (
    SELECT DISTINCT ON (library_id, classification_id)
      library_id,
      classification_id,
      title,
      year,
      media_type,
      history_metadata,
      classification_label,
      distance
    FROM nearest_embeddings
    ORDER BY library_id ASC, classification_id ASC, distance ASC
  ), ranked_items AS (
    SELECT
      library_id,
      title,
      year,
      media_type,
      history_metadata,
      classification_label,
      row_number() OVER (
        PARTITION BY library_id
        ORDER BY distance ASC, classification_id ASC
      ) AS item_rank
    FROM distinct_items
  )
  SELECT
    library_id,
    title,
    year,
    media_type,
    history_metadata,
    classification_label
  FROM ranked_items
  WHERE item_rank <= $6::integer
  ORDER BY library_id ASC, item_rank ASC
`;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function boundedText(value, maximumLength) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function boundedYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1800 && year <= 9_999 ? year : null;
}

function privateHistoryMetadata(row) {
  const source = isPlainRecord(row?.history_metadata) ? row.history_metadata : {};
  let encoded;
  try {
    encoded = JSON.stringify(source);
  } catch {
    return null;
  }
  if (!encoded || Buffer.byteLength(encoded) > MAX_HISTORY_METADATA_BYTES) return null;
  const title = boundedText(row?.title, 220);
  const mediaType = row?.media_type === 'movie' || row?.media_type === 'tv' ? row.media_type : null;
  if (!title || !mediaType) return null;
  return Object.freeze({
    ...source,
    media_type: mediaType,
    title,
    year: boundedYear(row?.year),
  });
}

function evidenceFor(candidates, statusId, rows = []) {
  const rowsByLibraryId = new Map(candidates.map((candidate) => [candidate.libraryId, []]));
  for (const row of Array.isArray(rows) ? rows : []) {
    const libraryId = Number(row?.library_id);
    const items = rowsByLibraryId.get(libraryId);
    if (!items || items.length >= MAXIMUM_ITEMS_PER_CANDIDATE) continue;
    const metadata = privateHistoryMetadata(row);
    const classificationLabel = boundedText(row?.classification_label, 160);
    if (!metadata || !classificationLabel) continue;
    items.push(Object.freeze({ classificationLabel, metadata }));
  }
  return Object.freeze({
    candidates: Object.freeze(candidates.map((candidate) => Object.freeze({
      candidateId: candidate.candidateId,
      items: Object.freeze(rowsByLibraryId.get(candidate.libraryId)),
    }))),
    statusId,
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_VERSION,
  });
}

async function defaultEmbed(text) {
  if (typeof embeddingRouter.embed !== 'function') throw new Error('semantic_embedding_provider_unavailable');
  return embeddingRouter.embed(text);
}

function defaultFormatForEmbedding(metadata) {
  if (typeof embeddingService.formatForEmbedding !== 'function') {
    throw new Error('semantic_embedding_formatter_unavailable');
  }
  return embeddingService.formatForEmbedding(metadata);
}

async function defaultWithTransaction(work) {
  if (typeof db.withTransaction !== 'function') throw new Error('semantic_retrieval_database_unavailable');
  return db.withTransaction(work);
}

function queryValues(metadata, candidates, vector, heldOutScope) {
  const [heldOutMediaTypes, heldOutTmdbIds] = heldOutSemanticStudyParameters(heldOutScope);
  return [
    candidates.map((candidate) => candidate.libraryId),
    metadata.media_type,
    vector,
    Number.isInteger(metadata.tmdb_id) ? metadata.tmdb_id : null,
    Math.min(MAXIMUM_SCAN, candidates.length * 64),
    MAXIMUM_ITEMS_PER_CANDIDATE,
    heldOutMediaTypes,
    heldOutTmdbIds,
  ];
}

/**
 * Reads bounded current-library history only during a held-out scorer run. No
 * route imports this service, and the returned material is intended to remain
 * in memory until the scorer reduces it to categorical decisions.
 */
export function createHeldOutSemanticStudyRetrievalRepresentationScoringSource({
  embed = defaultEmbed,
  formatForEmbedding = defaultFormatForEmbedding,
  logger = createLogger('heldOutSemanticStudyRetrievalRepresentationScoringSource'),
  withTransaction = defaultWithTransaction,
} = {}) {
  return Object.freeze({
    async retrieve({ candidates, heldOutScope, metadata } = {}) {
      if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 3) {
        return evidenceFor([], HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS.UNAVAILABLE);
      }
      try {
        assertHeldOutSemanticStudyMember(heldOutScope, metadata);
        const text = formatForEmbedding(metadata);
        if (typeof text !== 'string' || !text.trim()) throw new Error('semantic_embedding_text_unavailable');
        const embedding = await embed(text);
        if (!Array.isArray(embedding?.embedding) || embedding.embedding.length === 0 || embedding.fallback === true) {
          throw new Error('semantic_embedding_unavailable');
        }
        const result = await withTransaction(async (client) => {
          await applyHeldOutSemanticStudyQuerySettings(client, heldOutScope);
          await applyPgvectorRecallSettings(client, resolvePgvectorRecallTuning({ candidateSearch: true }));
          return client.query(SCORING_SOURCE_SQL, queryValues(
            metadata,
            candidates,
            formatVectorString(embedding.embedding),
            heldOutScope,
          ));
        });
        return evidenceFor(
          candidates,
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS.AVAILABLE,
          result?.rows,
        );
      } catch {
        // A provider or database error may contain source-derived text. Keep
        // the private scorer failure receipt deliberately data-free.
        logger.warn('Held-out retrieval-representation history unavailable');
        return evidenceFor(
          candidates,
          HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS.UNAVAILABLE,
        );
      }
    },
  });
}

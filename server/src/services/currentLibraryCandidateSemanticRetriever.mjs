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
  buildCurrentLibraryCandidateSemanticRetrievalRequest,
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS,
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
} from './currentLibraryCandidateSemanticRetrievalContract.mjs';
import {
  buildCurrentLibraryCandidateSemanticRetrieverQuery,
} from './currentLibraryCandidateSemanticRetrieverQuery.mjs';
import {
  calibrateCurrentLibraryCandidateSemanticOutcome,
} from './currentLibraryCandidateSemanticOutcomeCalibration.mjs';
import {
  applyPgvectorRecallSettings,
  resolvePgvectorRecallTuning,
} from './pgvectorRecallTuning.mjs';

function boundedTitle(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 160) : null;
}

async function defaultEmbed(text) {
  if (typeof embeddingRouter.embed !== 'function') {
    throw new Error('semantic_embedding_provider_unavailable');
  }
  return embeddingRouter.embed(text);
}

function defaultFormatForEmbedding(metadata) {
  if (typeof embeddingService.formatForEmbedding !== 'function') {
    throw new Error('semantic_embedding_formatter_unavailable');
  }
  return embeddingService.formatForEmbedding(metadata);
}

async function defaultIsEnabled() {
  if (typeof embeddingRouter.isEnabled !== 'function') return false;
  return embeddingRouter.isEnabled();
}

async function defaultWithTransaction(work) {
  if (typeof db.withTransaction !== 'function') {
    throw new Error('semantic_retrieval_database_unavailable');
  }
  return db.withTransaction(work);
}

function boundedYear(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 1800 && numericValue < 10_000
    ? numericValue
    : null;
}

function semanticItem(row) {
  const calibration = calibrateCurrentLibraryCandidateSemanticOutcome({
    relevance: row?.relevance,
    hasAuthorizedOutcome: row?.has_authorized_outcome,
  });
  return Object.freeze({
    title: boundedTitle(row?.title),
    year: boundedYear(row?.year),
    relevance: calibration.relevance,
    outcomeCalibrated: calibration.outcomeCalibrated,
  });
}

function evidenceForRequest(request, statusId, rows = []) {
  const requestedIds = new Set(request.candidates.map((candidate) => candidate.libraryId));
  const itemsByLibraryId = new Map(request.candidates.map((candidate) => [candidate.libraryId, []]));

  for (const row of Array.isArray(rows) ? rows : []) {
    const libraryId = Number(row?.library_id);
    if (!requestedIds.has(libraryId)) continue;

    const items = itemsByLibraryId.get(libraryId);
    if (items.length < request.maximumItemsPerCandidate) {
      const item = semanticItem(row);
      if (item.title) items.push(item);
    }
  }

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
    statusId,
    candidates: Object.freeze(request.candidates.map((candidate) => {
      const items = Object.freeze([...itemsByLibraryId.get(candidate.libraryId)]
        .sort((left, right) => (
          right.relevance - left.relevance ||
          Number(right.outcomeCalibrated) - Number(left.outcomeCalibrated) ||
          String(left.title).localeCompare(String(right.title))
        )));
      return Object.freeze({
        libraryId: candidate.libraryId,
        matchCount: items.length,
        topRelevance: items[0]?.relevance ?? null,
        outcomeCalibratedMatchCount: items.filter((item) => item.outcomeCalibrated).length,
        items,
      });
    })),
  });
}

/**
 * Retrieves only the closest current-library items inside the policy-owned
 * candidate set. It is a read-only advisory fact: errors, disabled RAG, and
 * partial coverage fail closed to `unavailable` and never affect routing.
 */
export function createCurrentLibraryCandidateSemanticRetriever({
  embed = defaultEmbed,
  formatForEmbedding = defaultFormatForEmbedding,
  isEnabled = defaultIsEnabled,
  logger = createLogger('currentLibraryCandidateSemanticRetriever'),
  withTransaction = defaultWithTransaction,
} = {}) {
  return Object.freeze({
    async retrieve({ contract = null, metadata = null } = {}) {
      const request = buildCurrentLibraryCandidateSemanticRetrievalRequest({
        contract,
        metadata,
        formatForEmbedding,
      });
      if (request.statusId !== CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.READY) {
        return evidenceForRequest(request, request.statusId);
      }

      try {
        if (await isEnabled() !== true) {
          return evidenceForRequest(
            request,
            CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.UNAVAILABLE,
          );
        }

        const embeddingResult = await embed(request.embeddingText);
        if (!Array.isArray(embeddingResult?.embedding) || embeddingResult.embedding.length === 0) {
          throw new Error('semantic_embedding_unavailable');
        }

        const statement = buildCurrentLibraryCandidateSemanticRetrieverQuery(
          request,
          formatVectorString(embeddingResult.embedding),
        );
        const result = await withTransaction(async (client) => {
          await applyPgvectorRecallSettings(
            client,
            resolvePgvectorRecallTuning({ candidateSearch: true }),
          );
          return client.query(statement.text, statement.values);
        });
        return evidenceForRequest(
          request,
          CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.AVAILABLE,
          result?.rows,
        );
      } catch (error) {
        logger.warn('Current-library candidate semantic retrieval unavailable', {
          error: error instanceof Error ? error.message : 'unknown_error',
        });
        return evidenceForRequest(
          request,
          CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.UNAVAILABLE,
        );
      }
    },
  });
}

export const currentLibraryCandidateSemanticRetriever =
  createCurrentLibraryCandidateSemanticRetriever();

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  buildCurrentLibraryCandidateRetrievalRequest,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS,
  CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_VERSION,
} from './currentLibraryCandidateRetrievalContract.mjs';
import { buildCurrentLibraryCandidateRetrieverQuery } from './currentLibraryCandidateRetrieverQuery.mjs';

function boundedTitle(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 160) : null;
}

function boundedYear(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 1800 && numericValue < 10000
    ? numericValue
    : null;
}

function retrievalItem(row) {
  const matchKind = ['identifier', 'title_year', 'text'].includes(row?.match_kind)
    ? row.match_kind
    : 'text';
  const relevance = Number(row?.relevance);
  return Object.freeze({
    title: boundedTitle(row?.title),
    year: boundedYear(row?.year),
    matchKind,
    relevance: Number.isFinite(relevance) ? Math.max(0, Math.min(100, Math.round(relevance))) : 0,
  });
}

function unavailableEvidence(request) {
  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_VERSION,
    statusId: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.UNAVAILABLE,
    candidates: Object.freeze(request.candidates.map((candidate) => Object.freeze({
      libraryId: candidate.libraryId,
      matchCount: 0,
      directMatch: false,
      topMatchKind: null,
      topRelevance: null,
      items: Object.freeze([]),
    }))),
  });
}

function availableEvidence(request, rows) {
  const requestedIds = new Set(request.candidates.map((candidate) => candidate.libraryId));
  const itemsByLibraryId = new Map(request.candidates.map((candidate) => [candidate.libraryId, []]));

  for (const row of Array.isArray(rows) ? rows : []) {
    const libraryId = Number(row?.library_id);
    if (!requestedIds.has(libraryId)) continue;

    const items = itemsByLibraryId.get(libraryId);
    if (items.length < request.maximumItemsPerCandidate) items.push(retrievalItem(row));
  }

  return Object.freeze({
    version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_VERSION,
    statusId: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.AVAILABLE,
    candidates: Object.freeze(request.candidates.map((candidate) => {
      const items = Object.freeze(itemsByLibraryId.get(candidate.libraryId));
      const topItem = items[0] || null;
      return Object.freeze({
        libraryId: candidate.libraryId,
        matchCount: items.length,
        directMatch: items.some((item) => item.matchKind === 'identifier' || item.matchKind === 'title_year'),
        topMatchKind: topItem?.matchKind || null,
        topRelevance: topItem?.relevance ?? null,
        items,
      });
    })),
  });
}

/**
 * Read-only lookup over the synchronized library cache. It is intentionally
 * separate from classification-history RAG: no embeddings, backfill, learning,
 * persistence, provider call, or routing decision can occur in this service.
 */
export function createCurrentLibraryCandidateRetriever({
  query = db.query,
  logger = createLogger('currentLibraryCandidateRetriever'),
} = {}) {
  return Object.freeze({
    async retrieve({ contract = null, metadata = null } = {}) {
      const request = buildCurrentLibraryCandidateRetrievalRequest({ contract, metadata });
      if (request.statusId !== CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_STATUS_IDS.READY) {
        return Object.freeze({
          version: CURRENT_LIBRARY_CANDIDATE_RETRIEVAL_VERSION,
          statusId: request.statusId,
          candidates: Object.freeze([]),
        });
      }

      try {
        const statement = buildCurrentLibraryCandidateRetrieverQuery(request);
        const result = await query(statement.text, statement.values);
        return availableEvidence(request, result?.rows);
      } catch (error) {
        logger.warn('Current-library candidate retrieval unavailable', {
          error: error instanceof Error ? error.message : 'unknown_error',
        });
        return unavailableEvidence(request);
      }
    },
  });
}

export const currentLibraryCandidateRetriever = createCurrentLibraryCandidateRetriever();

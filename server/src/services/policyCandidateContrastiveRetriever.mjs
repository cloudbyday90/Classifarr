/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS,
} from './policyCandidateContrastiveRetrievalContract.mjs';
import {
  buildPolicyCandidateContrastiveRetrieverQuery,
} from './policyCandidateContrastiveRetrieverQuery.mjs';

export const POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_VERSION =
  'policy.candidate_contrastive_retrieval.v1';

export const POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_STATUS_IDS = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
});

function positiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function notApplicableRetrieval(contract) {
  return Object.freeze({
    version: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_VERSION,
    statusId: contract?.statusId ||
      POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.NOT_PENDING_POLICY_DECISION,
    matchedLibraryIds: Object.freeze([]),
  });
}

function matchedLibraryIds(contract, rows) {
  const candidateIds = new Set(contract.candidates.map((candidate) => candidate.libraryId));
  const seen = new Set();

  return Object.freeze((Array.isArray(rows) ? rows : [])
    .map((row) => positiveInteger(row?.library_id))
    .filter((libraryId) => libraryId && candidateIds.has(libraryId))
    .filter((libraryId) => {
      if (seen.has(libraryId)) return false;
      seen.add(libraryId);
      return true;
    })
    .sort((left, right) => left - right));
}

/**
 * Performs one bounded, read-only exact-identity check. Failed inventory reads
 * never fall back to title matching, AI, another library, or routing logic.
 */
export function createPolicyCandidateContrastiveRetriever({
  query = db.query,
  logger = createLogger('policyCandidateContrastiveRetriever'),
} = {}) {
  return Object.freeze({
    async retrieve({ contract = null } = {}) {
      if (contract?.valid !== true) return notApplicableRetrieval(contract);

      try {
        const statement = buildPolicyCandidateContrastiveRetrieverQuery(contract);
        const result = await query(statement.text, statement.values);
        return Object.freeze({
          version: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_VERSION,
          statusId: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_STATUS_IDS.AVAILABLE,
          matchedLibraryIds: matchedLibraryIds(contract, result?.rows),
        });
      } catch (error) {
        logger.warn('Policy candidate contrastive retrieval unavailable', {
          error: error instanceof Error ? error.message : 'unknown_error',
        });
        return Object.freeze({
          version: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_VERSION,
          statusId: POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_STATUS_IDS.UNAVAILABLE,
          matchedLibraryIds: Object.freeze([]),
        });
      }
    },
  });
}

export const policyCandidateContrastiveRetriever = createPolicyCandidateContrastiveRetriever();

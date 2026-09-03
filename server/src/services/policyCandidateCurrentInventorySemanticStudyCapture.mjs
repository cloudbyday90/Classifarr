/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS,
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
} from './currentLibraryCandidateSemanticRetrievalContract.mjs';
import {
  currentLibraryCandidateSemanticRetriever,
} from './currentLibraryCandidateSemanticRetriever.mjs';
import {
  buildPolicyCandidateCurrentInventorySemanticStudySnapshot,
} from './policyCandidateCurrentInventorySemanticStudySnapshot.mjs';
import {
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_DOCUMENT_VERSION,
  validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument,
} from './policyCandidateCurrentInventorySemanticStudySnapshotContract.mjs';
import {
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_STATUS_IDS,
  POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_VERSION,
  validatePolicyCandidateCurrentInventorySemanticStudyCaptureRequest,
} from './policyCandidateCurrentInventorySemanticStudyCaptureContract.mjs';

function unavailableRetrieval() {
  return Object.freeze({
    candidates: Object.freeze([]),
    statusId: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_STATUS_IDS.UNAVAILABLE,
    version: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
  });
}

function invalidCapture(validation) {
  return Object.freeze({
    document: null,
    status: Object.freeze({
      id: POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_STATUS_IDS.INVALID_REQUEST,
    }),
    summary: Object.freeze({
      caseCount: validation.caseCount,
      issueCount: validation.issues.length,
    }),
    version: POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_VERSION,
  });
}

function completeCapture(document, snapshots) {
  const availableCount = snapshots.filter((snapshot) => snapshot.retrievalStatusId === 'available').length;
  return Object.freeze({
    document,
    status: Object.freeze({
      id: POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_STATUS_IDS.COMPLETE,
    }),
    summary: Object.freeze({
      availableCount,
      caseCount: snapshots.length,
      unavailableCount: snapshots.length - availableCount,
    }),
    version: POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_CAPTURE_VERSION,
  });
}

async function retrieveOrAbstain(retriever, request) {
  try {
    const result = await retriever?.retrieve?.(request);
    return result || unavailableRetrieval();
  } catch {
    return unavailableRetrieval();
  }
}

/**
 * Captures one bounded, real current-library semantic-study cohort. Requests
 * are intentionally sequential to preserve the existing candidate-scoped
 * provider/database budget. Only the redacted snapshot document leaves the
 * loop; retrieval output and media metadata are held in memory briefly and
 * never logged, persisted, sent to the browser, or given routing authority.
 */
export function createPolicyCandidateCurrentInventorySemanticStudyCapture({
  retriever = currentLibraryCandidateSemanticRetriever,
} = {}) {
  return Object.freeze({
    async capture(request = {}) {
      const validation = validatePolicyCandidateCurrentInventorySemanticStudyCaptureRequest(request);
      if (!validation.ok) return invalidCapture(validation);

      const snapshots = [];
      for (const studyCase of request.cases) {
        const retrieval = await retrieveOrAbstain(retriever, {
          contract: studyCase.contract,
          metadata: studyCase.metadata,
        });
        const snapshot = buildPolicyCandidateCurrentInventorySemanticStudySnapshot({
          contract: studyCase.contract,
          fixtureId: studyCase.fixtureId,
          retrieval,
          snapshotId: studyCase.snapshotId,
        });

        // Input validation proves this branch is unreachable for a compliant
        // retriever. If an implementation ever violates that invariant, emit
        // no partial study document and disclose no retrieval detail.
        if (!snapshot) return invalidCapture({ caseCount: validation.caseCount, issues: [null] });
        snapshots.push(snapshot);
      }

      const document = Object.freeze({
        retrievalProtocolVersion: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
        snapshotSetId: request.snapshotSetId,
        snapshots: Object.freeze(snapshots),
        version: POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_SNAPSHOT_DOCUMENT_VERSION,
      });
      const documentValidation = validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument(document);
      if (!documentValidation.ok) {
        return invalidCapture({ caseCount: validation.caseCount, issues: documentValidation.issues });
      }

      return completeCapture(document, snapshots);
    },
  });
}

export const policyCandidateCurrentInventorySemanticStudyCapture =
  createPolicyCandidateCurrentInventorySemanticStudyCapture();

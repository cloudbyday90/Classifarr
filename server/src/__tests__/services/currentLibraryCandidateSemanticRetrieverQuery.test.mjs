/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL,
} from '../../services/currentLibraryCandidateSemanticRetrieverQuery.mjs';

describe('currentLibraryCandidateSemanticRetrieverQuery', () => {
  test('admits calibration only from an authenticated learning-ready final outcome', () => {
    expect(CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL).toContain(
      'FROM policy_authorized_outcome_source_event_receipts AS receipt',
    );
    expect(CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL).toContain(
      'receipt.classification_id = history.id',
    );
    expect(CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL).toContain(
      'receipt.destination_library_id = item.library_id',
    );
    expect(CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL).toContain(
      "receipt.final_outcome_status_id IN ('resolved', 'routed')",
    );
    expect(CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL).toContain(
      "receipt.persistence_status_id = 'ready'",
    );
    expect(CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL).not.toContain(
      'route_failed_missing_mapping',
    );
  });
});

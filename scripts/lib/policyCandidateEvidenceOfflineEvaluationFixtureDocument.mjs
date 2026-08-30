/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument,
} from '../../server/src/services/policyCandidateEvidenceOfflineEvaluationContract.mjs';

/**
 * Kept in scripts/lib so command-line preflight and Jest can use the same
 * strict fixture-document boundary without importing a mutable live sweep.
 */
export function validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocumentForScript(document) {
  return validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(document);
}

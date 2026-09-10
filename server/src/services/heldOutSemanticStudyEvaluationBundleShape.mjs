/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  HELD_OUT_SEMANTIC_STUDY_EVALUATION_BUNDLE_VERSION,
} from './heldOutSemanticStudyEvaluationBundle.mjs';

const EVALUATION_BUNDLE_KEYS = Object.freeze([
  'fixtureDocument',
  'manifest',
  'snapshotDocument',
  'version',
]);

/**
 * Admits only the redacted evaluation-bundle envelope. Callers must still run
 * the fixed snapshot evaluator to validate the fingerprint-bound contents.
 */
export function isHeldOutSemanticStudyEvaluationBundleShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.version !== HELD_OUT_SEMANTIC_STUDY_EVALUATION_BUNDLE_VERSION) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length === EVALUATION_BUNDLE_KEYS.length &&
    keys.every((key) => EVALUATION_BUNDLE_KEYS.includes(key));
}

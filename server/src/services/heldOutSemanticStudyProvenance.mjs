/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { HELD_OUT_SEMANTIC_STUDY_PROTOCOL } from './heldOutSemanticStudyScope.mjs';
import { createPolicyCandidateSemanticSnapshotFingerprint as fingerprint } from './policyCandidateSemanticSnapshotFingerprint.mjs';
import { resolvePgvectorRecallTuning } from './pgvectorRecallTuning.mjs';

export const HELD_OUT_SEMANTIC_STUDY_DOCUMENT_VERSION =
  'policy.candidate_current_inventory_semantic_study_snapshot_document.v2';

// Commit to configuration without exporting hosts, models, or credential material.
const CONFIG_KEYS = [
  'rag_enabled', 'embedding_provider_mode', 'embedding_provider', 'embedding_model',
  'primary_provider', 'ollama_host', 'ollama_port', 'api_endpoint', 'ollama_fallback_enabled',
  'embedding_ollama_host', 'embedding_ollama_port', 'embedding_ollama_model',
  'embedding_cloud_provider', 'embedding_cloud_model',
  'rag_similarity_threshold', 'rag_min_history_count',
];

export function heldOutSemanticStudyConfigurationFingerprint(config, policies) {
  if (!config || !Array.isArray(policies) || policies.length === 0) {
    throw new Error('held_out_configuration_unavailable');
  }
  return fingerprint({
    config: Object.fromEntries(CONFIG_KEYS.map((key) => [key, config[key] ?? null])),
    policies: JSON.parse(JSON.stringify(policies)),
    protocol: HELD_OUT_SEMANTIC_STUDY_PROTOCOL,
    retrieval: {
      mode: 'exact_text_only',
      candidatePreparationLimit: 5,
      candidateComparisonLimit: 3,
      tuning: resolvePgvectorRecallTuning(),
      candidateTuning: resolvePgvectorRecallTuning({ candidateSearch: true }),
    },
  });
}

export function isHeldOutSemanticStudyProvenance(value, caseCount) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'configurationFingerprint,excludedIdentityCount,exclusionSetFingerprint,protocolVersion' &&
    value.protocolVersion === HELD_OUT_SEMANTIC_STUDY_PROTOCOL &&
    Number.isInteger(caseCount) && caseCount >= 24 && caseCount <= 32 &&
    value.excludedIdentityCount === caseCount &&
    typeof value.exclusionSetFingerprint === 'string' &&
    typeof value.configurationFingerprint === 'string' &&
    /^sha256:[a-f0-9]{64}$/u.test(value.exclusionSetFingerprint) &&
    /^sha256:[a-f0-9]{64}$/u.test(value.configurationFingerprint);
}

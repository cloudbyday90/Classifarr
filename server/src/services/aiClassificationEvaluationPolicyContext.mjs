/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import { stableStringify } from './policyEvidenceFingerprint.mjs';

const AI_CLASSIFICATION_EVALUATION_POLICY_CONTEXT_VERSION =
  'classifarr.ai_classification_evaluation_policy_context.v1';
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const NON_SEMANTIC_FIELDS = new Set([
  'created_at',
  'updated_at',
  'validated_at',
  'established_at',
  'reconciled_at',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toStableValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(item => toStableValue(item));
  }

  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => !NON_SEMANTIC_FIELDS.has(key) && entry !== undefined)
      .map(([key, entry]) => [key, toStableValue(entry)])
  );
}

function sortStableRecords(records) {
  return asArray(records)
    .map(record => toStableValue(record))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function buildPolicyContextProjection({
  policies = [],
  presetAttachments = [],
  activeNativeIntents = [],
  activeNativeRules = [],
  activeNativeTemplates = [],
} = {}) {
  return {
    version: AI_CLASSIFICATION_EVALUATION_POLICY_CONTEXT_VERSION,
    policies: sortStableRecords(policies),
    presetAttachments: sortStableRecords(presetAttachments),
    activeNativeIntents: sortStableRecords(activeNativeIntents),
    activeNativeRules: sortStableRecords(activeNativeRules),
    activeNativeTemplates: sortStableRecords(activeNativeTemplates),
  };
}

function buildAiClassificationEvaluationPolicyContext(input = {}) {
  const projection = buildPolicyContextProjection(input);
  const fingerprint = createHash('sha256')
    .update(stableStringify(projection), 'utf8')
    .digest('hex');

  return {
    version: AI_CLASSIFICATION_EVALUATION_POLICY_CONTEXT_VERSION,
    algorithm: 'sha256',
    fingerprint,
    provenance: {
      policyCount: projection.policies.length,
      presetAttachmentCount: projection.presetAttachments.length,
      activeNativeIntentCount: projection.activeNativeIntents.length,
      activeNativeRuleCount: projection.activeNativeRules.length,
      activeNativeTemplateCount: projection.activeNativeTemplates.length,
    },
  };
}

function isAiClassificationEvaluationPolicyContext(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.version === AI_CLASSIFICATION_EVALUATION_POLICY_CONTEXT_VERSION &&
    value.algorithm === 'sha256' &&
    typeof value.fingerprint === 'string' &&
    SHA256_FINGERPRINT_PATTERN.test(value.fingerprint) &&
    value.provenance &&
    typeof value.provenance === 'object' &&
    !Array.isArray(value.provenance)
  );
}

export {
  AI_CLASSIFICATION_EVALUATION_POLICY_CONTEXT_VERSION,
  buildAiClassificationEvaluationPolicyContext,
  buildPolicyContextProjection,
  isAiClassificationEvaluationPolicyContext,
};

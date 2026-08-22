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
import {
  isAiClassificationEvaluationPolicyContext,
} from './aiClassificationEvaluationPolicyContext.mjs';

const AI_CLASSIFICATION_EVALUATION_FINGERPRINT_VERSION =
  'classifarr.ai_classification_evaluation_fingerprint.v1';

function hashProjection(scope, projection) {
  return {
    version: AI_CLASSIFICATION_EVALUATION_FINGERPRINT_VERSION,
    scope,
    algorithm: 'sha256',
    fingerprint: createHash('sha256')
      .update(stableStringify({
        version: AI_CLASSIFICATION_EVALUATION_FINGERPRINT_VERSION,
        scope,
        projection,
      }), 'utf8')
      .digest('hex'),
  };
}

function sortIdentifiers(values) {
  return Array.isArray(values) ? [...values].sort() : [];
}

function buildLibraryProjection(library) {
  if (!library || typeof library !== 'object' || Array.isArray(library)) {
    return null;
  }

  return {
    ...(Object.hasOwn(library, 'id') ? { id: library.id } : {}),
    ...(Object.hasOwn(library, 'name') ? { name: library.name } : {}),
  };
}

function buildConfidenceProjection(confidence) {
  if (!confidence || typeof confidence !== 'object' || Array.isArray(confidence)) {
    return null;
  }

  return {
    ...(Object.hasOwn(confidence, 'minimum') ? { minimum: confidence.minimum } : {}),
    ...(Object.hasOwn(confidence, 'maximum') ? { maximum: confidence.maximum } : {}),
  };
}

function buildPolicyFingerprintArtifact(policyContext) {
  if (!isAiClassificationEvaluationPolicyContext(policyContext)) {
    return null;
  }

  const provenance = policyContext.provenance;
  return {
    version: policyContext.version,
    scope: 'policy',
    algorithm: policyContext.algorithm,
    fingerprint: policyContext.fingerprint,
    provenance: {
      policyCount: Number.isInteger(provenance.policyCount) ? provenance.policyCount : null,
      presetAttachmentCount: Number.isInteger(provenance.presetAttachmentCount)
        ? provenance.presetAttachmentCount
        : null,
      activeNativeIntentCount: Number.isInteger(provenance.activeNativeIntentCount)
        ? provenance.activeNativeIntentCount
        : null,
      activeNativeRuleCount: Number.isInteger(provenance.activeNativeRuleCount)
        ? provenance.activeNativeRuleCount
        : null,
      activeNativeTemplateCount: Number.isInteger(provenance.activeNativeTemplateCount)
        ? provenance.activeNativeTemplateCount
        : null,
    },
  };
}

function buildFixtureProjection(fixture = {}) {
  const outcomes = Array.isArray(fixture?.expected?.outcomes)
    ? fixture.expected.outcomes.map(outcome => ({
      decisionKind: outcome?.decisionKind ?? null,
      methods: sortIdentifiers(outcome?.methods),
      historyStatuses: sortIdentifiers(outcome?.historyStatuses),
      library: buildLibraryProjection(outcome?.library),
      confidence: buildConfidenceProjection(outcome?.confidence),
    })).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
    : [];

  return {
    fixtureVersion: fixture?.version ?? null,
    id: fixture?.id ?? null,
    tags: sortIdentifiers(fixture?.tags),
    request: {
      tmdbId: fixture?.request?.tmdbId ?? null,
      mediaType: fixture?.request?.mediaType ?? null,
      title: fixture?.request?.title ?? null,
    },
    expected: {
      fallbackAllowed: fixture?.expected?.fallbackAllowed === true,
      outcomes,
    },
  };
}

function buildRuntimeProjection({
  model = null,
  ingestMode = null,
  requireAllConfirmations = null,
  aiConfig = {},
  policyContext = null,
  queueDecisionWitness = null,
} = {}) {
  return {
    model: typeof model === 'string' ? model : null,
    ingestMode: typeof ingestMode === 'string' ? ingestMode : null,
    requireAllConfirmations: requireAllConfirmations === true,
    ai: {
      primaryProvider: aiConfig?.primary_provider ?? null,
      ollamaFallbackEnabled: aiConfig?.ollama_fallback_enabled === true,
    },
    policyContext: isAiClassificationEvaluationPolicyContext(policyContext)
      ? {
        version: policyContext.version,
        fingerprint: policyContext.fingerprint,
      }
      : null,
    queueDecisionWitness: queueDecisionWitness && typeof queueDecisionWitness === 'object' &&
      typeof queueDecisionWitness.version === 'string' &&
      typeof queueDecisionWitness.algorithm === 'string' &&
      typeof queueDecisionWitness.fingerprint === 'string'
      ? {
        version: queueDecisionWitness.version,
        algorithm: queueDecisionWitness.algorithm,
        fingerprint: queueDecisionWitness.fingerprint,
      }
      : null,
  };
}

function buildOutcomeProjection(evaluation = {}) {
  return {
    version: evaluation?.version ?? null,
    fixtureId: evaluation?.fixtureId ?? null,
    passed: evaluation?.passed === true,
    matchedOutcomeIndex: Number.isInteger(evaluation?.matchedOutcomeIndex)
      ? evaluation.matchedOutcomeIndex
      : null,
    observedDecisionKind: evaluation?.observedDecisionKind ?? null,
    score: {
      passedCheckCount: Number.isInteger(evaluation?.score?.passedCheckCount)
        ? evaluation.score.passedCheckCount
        : null,
      totalCheckCount: Number.isInteger(evaluation?.score?.totalCheckCount)
        ? evaluation.score.totalCheckCount
        : null,
      percentage: Number.isFinite(evaluation?.score?.percentage)
        ? evaluation.score.percentage
        : null,
    },
    checks: Array.isArray(evaluation?.checks)
      ? evaluation.checks.map(check => ({
        id: check?.id ?? null,
        passed: check?.passed === true,
      })).sort((left, right) => String(left.id).localeCompare(String(right.id)))
      : [],
  };
}

function buildAiClassificationEvaluationFingerprintSet({
  fixture,
  policyContext,
  runtime,
  evaluation,
} = {}) {
  const fixtureFingerprint = hashProjection('fixture', buildFixtureProjection(fixture));
  const runtimeFingerprint = hashProjection('runtime', buildRuntimeProjection({
    ...runtime,
    policyContext,
  }));
  const outcomeFingerprint = hashProjection('outcome', buildOutcomeProjection(evaluation));

  return {
    fixture: fixtureFingerprint,
    policy: buildPolicyFingerprintArtifact(policyContext),
    runtime: runtimeFingerprint,
    outcome: outcomeFingerprint,
  };
}

export {
  AI_CLASSIFICATION_EVALUATION_FINGERPRINT_VERSION,
  buildAiClassificationEvaluationFingerprintSet,
  buildPolicyFingerprintArtifact,
  buildFixtureProjection,
  buildOutcomeProjection,
  buildRuntimeProjection,
};

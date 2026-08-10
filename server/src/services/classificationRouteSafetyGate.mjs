/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  getPolicyDecisionCandidate,
  getPolicyDecisionCandidateScore,
  policyDecisionAction,
} from '../utils/policyDecisionAuthority.mjs';
import { normalizePolicyDecisionThresholds } from '../utils/policyThresholds.mjs';
import { requiresProviderRecoveryReview } from './classificationProviderRecovery.mjs';

export const CLASSIFICATION_ROUTE_SAFETY_VERSION = 'classification.route_safety.v1';

export const CLASSIFICATION_ROUTE_SAFETY_GATE_IDS = Object.freeze({
  PROVIDER_RECOVERY_REVIEW_REQUIRED: 'provider_recovery_review_required',
  MANUAL_POLICY_EVIDENCE_REVIEW_REQUIRED: 'manual_policy_evidence_review_required',
  POLICY_CONFIRMATION_REQUIRED: 'policy_confirmation_required',
  POLICY_DESTINATION_SELECTION_REQUIRED: 'policy_destination_selection_required',
  POLICY_AUTO_PROVENANCE_REQUIRED: 'policy_auto_provenance_required',
  AI_ADVISORY_CANNOT_ROUTE: 'ai_advisory_cannot_route',
  POLICY_THRESHOLD_UNAVAILABLE: 'policy_threshold_unavailable',
  POLICY_SCORE_BELOW_AUTOMATIC_THRESHOLD: 'policy_score_below_automatic_threshold',
  ADMINISTRATIVE_CONFIRMATION_REQUIRED: 'administrative_confirmation_required',
  FALLBACK_RESULT_REVIEW_REQUIRED: 'fallback_result_review_required',
  LOW_CONFIDENCE_REVIEW_REQUIRED: 'low_confidence_review_required',
  CLARIFICATION_REQUESTED: 'clarification_requested',
});

const MAX_BLOCKING_GATES = 4;
const VALID_GATE_IDS = new Set(Object.values(CLASSIFICATION_ROUTE_SAFETY_GATE_IDS));

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function boundedString(value, maximumLength = 220) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function normalizeIdentifier(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function getResultLibraryIdentifier(result = {}) {
  return normalizeIdentifier(result?.library?.id ?? result?.library?.library_id ?? result?.library_id);
}

function getPolicyLibraryIdentifier(policyResult = {}) {
  const directLibraryIdentifier = normalizeIdentifier(
    policyResult?.library?.library_id ?? policyResult?.library?.id,
  );
  if (directLibraryIdentifier) return directLibraryIdentifier;

  return normalizeIdentifier(
    policyResult?.ranked?.[0]?.library_id ?? policyResult?.ranked?.[0]?.id,
  );
}

function finiteScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? Math.round(score) : null;
}

function buildGate(id, label, message, pendingReason) {
  return { id, label, message, pendingReason };
}

function manualEvidenceGate(policyResult) {
  const reasonCode = boundedString(policyResult?.decisionDiagnostics?.reason_code, 80)?.toLowerCase();
  if (reasonCode === 'weak_evidence_overlap') {
    return buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.MANUAL_POLICY_EVIDENCE_REVIEW_REQUIRED,
      'Policy evidence review required',
      'The leading candidates overlap and rely on weak evidence, so an operator must select the destination.',
      'Policy evidence review required',
    );
  }
  if (reasonCode === 'weak_evidence_primary') {
    return buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.MANUAL_POLICY_EVIDENCE_REVIEW_REQUIRED,
      'Policy evidence review required',
      'The leading candidate does not have enough independent evidence to authorize automatic routing.',
      'Policy evidence review required',
    );
  }

  return buildGate(
    CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.MANUAL_POLICY_EVIDENCE_REVIEW_REQUIRED,
    'Policy evidence review required',
    'The policy evaluation requires operator review before this item can route.',
    'Policy evidence review required',
  );
}

/**
 * A policy-auto route must originate from the current deterministic policy
 * evaluation, not from a method label carried by an upstream candidate.
 */
export function isCurrentDeterministicPolicyAuto(result = {}) {
  if (result?.method !== 'policy_auto' || result?.policyResult?.action !== 'auto_classify') {
    return false;
  }

  const resultLibraryIdentifier = getResultLibraryIdentifier(result);
  const policyLibraryIdentifier = getPolicyLibraryIdentifier(result.policyResult);

  return Boolean(
    resultLibraryIdentifier &&
    policyLibraryIdentifier &&
    resultLibraryIdentifier === policyLibraryIdentifier,
  );
}

/**
 * Model output may inform a candidate, but cannot independently authorize an
 * Arr route. Native policy evaluation remains a separately deterministic path.
 */
export function isAiAuthorityRoutingBlocked(result = {}) {
  const method = typeof result?.method === 'string' ? result.method : '';
  const isAiDerivedMethod = /^ai(?:_|$)/.test(method);

  return Boolean(
    isAiDerivedMethod ||
    result?.ai_authority?.sideEffects?.canRoute === false,
  );
}

/**
 * Resolves the bounded, server-owned conditions that prevent an automatic Arr
 * route. Gate order is intentional: the primary gate is the most actionable
 * deterministic explanation, while remaining gates are retained as context.
 */
export function evaluateClassificationRouteSafety({
  result = {},
  policyResult = null,
  requireAllConfirmations = false,
} = {}) {
  const normalizedResult = asObject(result);
  const effectivePolicyResult = asObject(normalizedResult.policyResult || policyResult);
  const action = policyDecisionAction(effectivePolicyResult);
  const policyCandidate = getPolicyDecisionCandidate(effectivePolicyResult, normalizedResult.library);
  const routeScore = policyCandidate
    ? getPolicyDecisionCandidateScore(effectivePolicyResult, normalizedResult.library)
    : finiteScore(normalizedResult.confidence);
  const autoThreshold = policyCandidate
    ? normalizePolicyDecisionThresholds(policyCandidate).autoClassifyThreshold
    : null;
  const needsThresholdReview = Boolean(
    normalizedResult.library &&
    normalizedResult.method !== 'policy_auto' &&
    (typeof autoThreshold !== 'number' || routeScore === null || routeScore < autoThreshold),
  );
  const gates = [];

  if (requiresProviderRecoveryReview(normalizedResult)) {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.PROVIDER_RECOVERY_REVIEW_REQUIRED,
      'Provider recovery review required',
      'The provider outcome requires recovery review before this item can route automatically.',
      'Provider recovery review required',
    ));
  }

  if (effectivePolicyResult?.decisionDiagnostics?.requires_manual_review === true) {
    gates.push(manualEvidenceGate(effectivePolicyResult));
  }

  if (action === 'prompt_confirm') {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_CONFIRMATION_REQUIRED,
      'Policy confirmation required',
      'The current policy outcome requires an operator confirmation before this item can route.',
      'Policy confirmation required',
    ));
  }

  if (action === 'prompt_select') {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_DESTINATION_SELECTION_REQUIRED,
      'Policy destination selection required',
      'The policy evaluation did not establish a unique destination, so an operator must select one.',
      'Policy destination selection required',
    ));
  }

  if (normalizedResult.method === 'policy_auto' && !isCurrentDeterministicPolicyAuto(normalizedResult)) {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_AUTO_PROVENANCE_REQUIRED,
      'Policy-route provenance review required',
      'The proposed policy route is not bound to the current deterministic auto-classify outcome.',
      'Policy-route provenance review required',
    ));
  }

  if (isAiAuthorityRoutingBlocked(normalizedResult)) {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.AI_ADVISORY_CANNOT_ROUTE,
      'AI advisory review required',
      'AI-derived output is advisory and cannot authorize automatic routing. A current deterministic policy evaluation must return auto-classify.',
      'AI advisory review required',
    ));
  }

  if (needsThresholdReview) {
    if (typeof autoThreshold !== 'number') {
      gates.push(buildGate(
        CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_THRESHOLD_UNAVAILABLE,
        'Policy threshold review required',
        'The proposed destination does not have a valid automatic-route threshold in the current policy result.',
        'Policy threshold review required',
      ));
    } else if (routeScore === null) {
      gates.push(buildGate(
        CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_THRESHOLD_UNAVAILABLE,
        'Policy score review required',
        'The proposed destination does not have a valid current policy score for automatic routing.',
        'Policy score review required',
      ));
    } else {
      gates.push(buildGate(
        CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_SCORE_BELOW_AUTOMATIC_THRESHOLD,
        'Policy confirmation required',
        `The current policy score of ${routeScore} is below the automatic-route threshold of ${autoThreshold}.`,
        'Policy confirmation required',
      ));
    }
  }

  if (normalizedResult.library && requireAllConfirmations) {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.ADMINISTRATIVE_CONFIRMATION_REQUIRED,
      'Administrative confirmation required',
      'This installation is configured to require confirmation before any destination can route automatically.',
      'Administrative confirmation required',
    ));
  }

  if (normalizedResult.method === 'fallback') {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.FALLBACK_RESULT_REVIEW_REQUIRED,
      'Fallback result review required',
      'The classification used a fallback path and must be confirmed before routing.',
      'Fallback result review required',
    ));
  }

  const confidence = Number(normalizedResult.confidence);
  if (Number.isFinite(confidence) && confidence > 0 && confidence < 70) {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.LOW_CONFIDENCE_REVIEW_REQUIRED,
      'Low-confidence review required',
      'The classification confidence is below the minimum automatic-review threshold.',
      'Low-confidence review required',
    ));
  }

  if (normalizedResult.needs_clarification === true) {
    gates.push(buildGate(
      CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.CLARIFICATION_REQUESTED,
      'Clarification required',
      'The current classification result requires an operator decision before it can route.',
      null,
    ));
  }

  const blockingGates = gates.slice(0, MAX_BLOCKING_GATES);
  return {
    version: CLASSIFICATION_ROUTE_SAFETY_VERSION,
    automatic_route_allowed: blockingGates.length === 0,
    primary_gate: blockingGates[0] || null,
    blocking_gates: blockingGates,
  };
}

function normalizeGate(value) {
  const gate = asObject(value);
  const id = boundedString(gate.id, 80);
  const label = boundedString(gate.label, 120);
  const message = boundedString(gate.message, 280);

  return id && VALID_GATE_IDS.has(id) && label && message
    ? { id, label, message }
    : null;
}

/**
 * Restricts persisted or historic input to the small, presentation-safe route
 * safety contract. Internal pending reasons never cross this boundary.
 */
export function buildClassificationRouteSafetyProjection(value) {
  const safety = asObject(value);
  if (safety.version !== CLASSIFICATION_ROUTE_SAFETY_VERSION) return null;

  const gates = (Array.isArray(safety.blocking_gates) ? safety.blocking_gates : [])
    .map(normalizeGate)
    .filter(Boolean)
    .slice(0, MAX_BLOCKING_GATES);
  const primaryGate = normalizeGate(safety.primary_gate) || gates[0] || null;

  if (!primaryGate || gates.length === 0) return null;

  const orderedGates = [
    primaryGate,
    ...gates.filter((gate) => gate.id !== primaryGate.id),
  ].slice(0, MAX_BLOCKING_GATES);

  return {
    version: CLASSIFICATION_ROUTE_SAFETY_VERSION,
    primary_gate: primaryGate,
    blocking_gates: orderedGates,
  };
}

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { evaluatePresetSignals } from './policyEngineSignalScoring.mjs';
import {
  evaluatePolicyConstraints,
  evaluateSignalConstraint,
  POLICY_CONSTRAINT_OUTCOMES,
} from './policyConstraintSemantics.mjs';
import { FORMULA_CONFIDENCE_CAP, normalizeCombinationMode } from './policyEngineUtils.mjs';
import { isNativePolicyRuntimeAuthority } from './policyEngineRuntimeAuthority.mjs';

export const POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS = Object.freeze({
  ACTIVE: 'native_intent_runtime_active',
  NO_PURPOSE: 'native_intent_runtime_no_purpose',
  PURPOSE_NOT_MATCHED: 'native_intent_runtime_purpose_not_matched',
  HARD_LIMIT_FAILED: 'native_intent_runtime_hard_limit_failed',
  HARD_LIMIT_UNKNOWN: 'native_intent_runtime_hard_limit_unknown',
  AUTHORITY_BLOCKED: 'native_intent_runtime_authority_blocked',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function numericWeight(rule = {}) {
  const value = Number(rule?.values?.weight);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function evaluateRule(rule = {}, item = {}) {
  if (!rule?.signal_type) return 0;

  return evaluatePresetSignals({
    [rule.signal_type]: {
      ...asObject(rule.values),
      ...(rule.constraint_mode ? { constraint_mode: rule.constraint_mode } : {}),
      ...(rule.semantics ? { semantics: rule.semantics } : {}),
    },
  }, item);
}

function combineRuleScores(rules, item, combinationMode) {
  const scores = asArray(rules).map((rule) => ({
    score: evaluateRule(rule, item),
    weight: numericWeight(rule),
  }));
  if (scores.length === 0) return 0;

  const mode = normalizeCombinationMode(combinationMode);
  if (mode === 'best_match') {
    return Math.max(...scores.map((entry) => entry.score));
  }
  if (mode === 'average') {
    return scores.reduce((total, entry) => total + entry.score, 0) / scores.length;
  }
  if (mode === 'require_all' && scores.some((entry) => entry.score <= 50)) {
    return 0;
  }

  const weightedScore = scores.reduce((total, entry) => total + (entry.score * entry.weight), 0);
  const totalWeight = scores.reduce((total, entry) => total + entry.weight, 0);
  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

function isExplicitAvoidExclusion(rule = {}) {
  const values = asObject(rule.values);
  return rule.operator === 'exclude' ||
    values.mode === 'exclude' ||
    (Array.isArray(values.exclude) && values.exclude.length > 0);
}

function evaluateAvoidRules(rules, item) {
  return asArray(rules).reduce((summary, rule) => {
    if (!rule?.signal_type || !isExplicitAvoidExclusion(rule)) {
      return summary;
    }

    const result = evaluateSignalConstraint(rule.signal_type, {
      ...asObject(rule.values),
      constraint_mode: 'strict',
    }, item);

    if (result.outcome === POLICY_CONSTRAINT_OUTCOMES.FAIL) {
      summary.matchedCount += 1;
    } else if (result.outcome === POLICY_CONSTRAINT_OUTCOMES.UNKNOWN) {
      summary.unknownCount += 1;
    }

    return summary;
  }, { matchedCount: 0, unknownCount: 0 });
}

function buildResult({
  statusId,
  score = 0,
  purposeScore = 0,
  helpfulBoost = 0,
  avoidPenalty = 0,
  contract = {},
  constraintDiagnostics = null,
  eligible = false,
} = {}) {
  return {
    statusId,
    eligible,
    score: Math.max(0, Math.min(score, FORMULA_CONFIDENCE_CAP)),
    purposeScore: Math.max(0, Math.min(purposeScore, FORMULA_CONFIDENCE_CAP)),
    helpfulBoost,
    avoidPenalty,
    ruleCounts: {
      purpose: asArray(contract.purpose).length,
      hard_limits: asArray(contract.hard_limits).length,
      helpful_hints: asArray(contract.helpful_hints).length,
      avoid: asArray(contract.avoid).length,
    },
    constraintDiagnostics,
  };
}

export function evaluateNativePolicyIntent(policy = {}, item = {}) {
  const runtimeAuthority = asObject(policy.policy_runtime_authority);
  const contract = asObject(policy.policy_intent_contract);

  if (
    !isNativePolicyRuntimeAuthority(policy) ||
    runtimeAuthority.validationOk !== true ||
    contract.validation?.valid !== true
  ) {
    return buildResult({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.AUTHORITY_BLOCKED,
      contract,
    });
  }

  if (asArray(contract.purpose).length === 0) {
    return buildResult({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.NO_PURPOSE,
      contract,
    });
  }

  const constraintDiagnostics = evaluatePolicyConstraints(policy, item);
  if (constraintDiagnostics.failed) {
    return buildResult({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_FAILED,
      contract,
      constraintDiagnostics,
    });
  }
  if (constraintDiagnostics.unknown_count > 0) {
    return buildResult({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_UNKNOWN,
      contract,
      constraintDiagnostics,
    });
  }

  const combinationMode = contract.review_behavior?.combination_mode || policy.combination_mode;
  const purposeScore = combineRuleScores(contract.purpose, item, combinationMode);
  if (purposeScore <= 50) {
    return buildResult({
      statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.PURPOSE_NOT_MATCHED,
      purposeScore,
      contract,
      constraintDiagnostics,
    });
  }

  const helpfulScore = combineRuleScores(contract.helpful_hints, item, combinationMode);
  const helpfulBoost = helpfulScore > 50
    ? Math.min(10, (helpfulScore - 50) * 0.2)
    : 0;
  const avoid = evaluateAvoidRules(contract.avoid, item);
  const avoidPenalty = avoid.matchedCount > 0 ? 15 : 0;

  return buildResult({
    statusId: POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.ACTIVE,
    score: purposeScore + helpfulBoost - avoidPenalty,
    purposeScore,
    helpfulBoost,
    avoidPenalty,
    contract,
    constraintDiagnostics,
    eligible: true,
  });
}

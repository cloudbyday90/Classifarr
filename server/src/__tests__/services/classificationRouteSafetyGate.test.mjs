/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  CLASSIFICATION_ROUTE_SAFETY_GATE_IDS,
  CLASSIFICATION_ROUTE_SAFETY_VERSION,
  buildClassificationRouteSafetyProjection,
  evaluateClassificationRouteSafety,
} from '../../services/classificationRouteSafetyGate.mjs';

function policyResult({ action = 'auto_classify', score = 90, diagnostics = null } = {}) {
  return {
    action,
    ranked: [{
      library_id: 5,
      score,
      prompt_threshold: 60,
      auto_classify_threshold: 85,
    }],
    ...(diagnostics ? { decisionDiagnostics: diagnostics } : {}),
  };
}

function result(overrides = {}) {
  const policies = policyResult();
  return {
    library: { id: 5, name: 'Movies' },
    confidence: 90,
    method: 'policy_auto',
    policyResult: policies,
    ...overrides,
  };
}

describe('classificationRouteSafetyGate', () => {
  test('allows only a current deterministic policy auto-classification to route', () => {
    const safety = evaluateClassificationRouteSafety({ result: result() });

    expect(safety).toEqual({
      version: CLASSIFICATION_ROUTE_SAFETY_VERSION,
      automatic_route_allowed: true,
      primary_gate: null,
      blocking_gates: [],
    });
  });

  test('names the AI authority gate for a 90/85 advisory result', () => {
    const safety = evaluateClassificationRouteSafety({
      result: result({ method: 'ai_verified' }),
    });

    expect(safety.automatic_route_allowed).toBe(false);
    expect(safety.primary_gate).toMatchObject({
      id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.AI_ADVISORY_CANNOT_ROUTE,
      label: 'AI advisory review required',
    });
    expect(safety.primary_gate.message).toContain('cannot authorize automatic routing');
  });

  test('prioritizes a manual weak-evidence decision over a high candidate score', () => {
    const safety = evaluateClassificationRouteSafety({
      result: result({
        method: 'policy_recheck',
        policyResult: policyResult({
          action: 'prompt_select',
          diagnostics: {
            requires_manual_review: true,
            reason_code: 'weak_evidence_overlap',
          },
        }),
      }),
    });

    expect(safety.primary_gate).toMatchObject({
      id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.MANUAL_POLICY_EVIDENCE_REVIEW_REQUIRED,
      label: 'Policy evidence review required',
    });
    expect(safety.blocking_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.POLICY_DESTINATION_SELECTION_REQUIRED,
      }),
    ]));
  });

  test('retains a provider recovery gate even when the deterministic score is high', () => {
    const safety = evaluateClassificationRouteSafety({
      result: result({
        method: 'signal_calculation',
        provider_recovery: { version: 'provider_recovery.v1', mode: 'review_required' },
      }),
    });

    expect(safety.primary_gate).toMatchObject({
      id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.PROVIDER_RECOVERY_REVIEW_REQUIRED,
    });
  });

  test('persists only allow-listed gate fields', () => {
    const projection = buildClassificationRouteSafetyProjection({
      version: CLASSIFICATION_ROUTE_SAFETY_VERSION,
      primary_gate: {
        id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.AI_ADVISORY_CANNOT_ROUTE,
        label: 'AI advisory review required',
        message: 'AI-derived output is advisory and cannot authorize automatic routing.',
        pendingReason: 'internal-only',
      },
      blocking_gates: [{
        id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.AI_ADVISORY_CANNOT_ROUTE,
        label: 'AI advisory review required',
        message: 'AI-derived output is advisory and cannot authorize automatic routing.',
        pendingReason: 'internal-only',
      }, {
        id: 'untrusted_gate',
        label: 'Untrusted',
        message: 'Must not persist.',
      }],
    });

    expect(projection).toEqual({
      version: CLASSIFICATION_ROUTE_SAFETY_VERSION,
      primary_gate: {
        id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.AI_ADVISORY_CANNOT_ROUTE,
        label: 'AI advisory review required',
        message: 'AI-derived output is advisory and cannot authorize automatic routing.',
      },
      blocking_gates: [{
        id: CLASSIFICATION_ROUTE_SAFETY_GATE_IDS.AI_ADVISORY_CANNOT_ROUTE,
        label: 'AI advisory review required',
        message: 'AI-derived output is advisory and cannot authorize automatic routing.',
      }],
    });
  });
});

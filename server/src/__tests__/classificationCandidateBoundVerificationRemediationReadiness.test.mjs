/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCandidateBoundVerificationPolicyReadiness,
  buildCandidateBoundVerificationRemediationReadiness,
  resolveConfiguredCandidateBoundVerificationAdmission,
} from '../services/classificationCandidateBoundVerificationRemediationReadiness.mjs';
import {
  resolveOllamaVerificationCapabilityIdentity,
} from '../services/ollamaVerificationCapabilityIdentity.mjs';

describe('classificationCandidateBoundVerificationRemediationReadiness', () => {
  test('admits only the current configured strict provider path without exposing provider identity', () => {
    const admission = resolveConfiguredCandidateBoundVerificationAdmission({
      primary_provider: 'openai',
      model: 'gpt-4o',
    });

    expect(admission).toEqual(expect.objectContaining({
      statusId: 'admitted',
      admitted: true,
      configurationOnly: true,
      providerCalled: false,
      providerAvailabilityChecked: false,
    }));
    expect(JSON.stringify(admission)).not.toContain('openai');
    expect(JSON.stringify(admission)).not.toContain('gpt-4o');
  });

  test('reports paused budgets and advisory fallbacks without treating them as verification authority', () => {
    expect(resolveConfiguredCandidateBoundVerificationAdmission({
      primary_provider: 'openai',
      model: 'gpt-4o',
      monthly_budget_usd: 10,
      current_month_usage_usd: 10,
      pause_on_budget_exhausted: true,
      ollama_fallback_enabled: false,
    })).toMatchObject({ statusId: 'budget_paused', admitted: false });

    expect(resolveConfiguredCandidateBoundVerificationAdmission({
      primary_provider: 'none',
      ollama_fallback_enabled: true,
    })).toMatchObject({ statusId: 'fallback_advisory_only', admitted: false });
  });

  test('recognizes a current tested primary Ollama path without exposing its configuration', () => {
    const configuration = {
      primary_provider: 'ollama',
      ollama_host: 'private-ollama.internal',
      ollama_port: 11434,
      ollama_model: 'gemma4:e4b',
      configuration_revision: 4,
    };
    const { fingerprint } = resolveOllamaVerificationCapabilityIdentity(configuration);
    const admission = resolveConfiguredCandidateBoundVerificationAdmission({
      ...configuration,
      ollama_verification_capability_status: 'verification_ready',
      ollama_verification_capability_fingerprint: fingerprint,
      ollama_verification_capability_configuration_revision: 4,
      ollama_verification_capability_model_digest: 'a'.repeat(64),
      ollama_verification_capability_checked_at: new Date().toISOString(),
    });

    expect(admission).toMatchObject({ statusId: 'admitted', admitted: true });
    expect(JSON.stringify(admission)).not.toContain('private-ollama.internal');
    expect(JSON.stringify(admission)).not.toContain('gemma4:e4b');
  });

  test('reduces anonymous policy readiness counts and rejects malformed status rows', () => {
    expect(buildCandidateBoundVerificationPolicyReadiness([
      { status_id: 'ready', policy_count: 2 },
      { status_id: 'routing_unavailable', policy_count: 1 },
      { status_id: 'unknown', policy_count: 100 },
      { status_id: 'ready', policy_count: -1 },
    ])).toEqual(expect.objectContaining({
      evaluatedPolicyCount: 3,
      readyPolicyCount: 2,
      notReadyPolicyCount: 1,
      allActivePoliciesReady: false,
    }));
  });

  test('correlates elevated aggregate health with current readiness without accepting it as routing authority', () => {
    const report = buildCandidateBoundVerificationRemediationReadiness({
      metrics: {
        current: { totalOutcomes: 9 },
        driftGuard: { statusId: 'elevated' },
      },
      providerConfiguration: {
        primary_provider: 'gemini',
        model: 'gemini-2.5-pro',
      },
      policyReadinessRows: [{ status_id: 'ready', policy_count: 3 }],
    });

    expect(report).toMatchObject({
      version: 'classification.candidate_bound_verification_remediation_readiness.v1',
      aggregateHealth: { driftStatusId: 'elevated', currentOutcomeCount: 9 },
      providerAdmission: { statusId: 'admitted', admitted: true },
      policyReadiness: { allActivePoliciesReady: true },
      readiness: { statusId: 'aggregate_review_required' },
      sideEffects: {
        providerCalled: false,
        classificationRead: false,
        policyMutation: false,
        routingMutation: false,
        retryQueued: false,
      },
    });
    expect(JSON.stringify(report)).not.toContain('gemini');
    expect(JSON.stringify(report)).not.toContain('gpt-4o');
  });

  test('fails closed when no active policy configuration is ready', () => {
    const report = buildCandidateBoundVerificationRemediationReadiness({
      metrics: { driftGuard: { statusId: 'stable' } },
      providerConfiguration: { primary_provider: 'openai', model: 'gpt-4o' },
      policyReadinessRows: [],
    });

    expect(report.readiness).toMatchObject({ statusId: 'policy_readiness_required' });
  });
});

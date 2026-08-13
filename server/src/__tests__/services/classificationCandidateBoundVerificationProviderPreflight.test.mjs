import { describe, expect, test } from '@jest/globals';
import {
  CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS,
  CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS,
  buildCandidateBoundVerificationProviderPreflight,
} from '../../services/classificationCandidateBoundVerificationProviderPreflight.mjs';

describe('candidate-bound verification provider preflight', () => {
  test('admits a verification-capable proposed primary path without exposing its identity', () => {
    const report = buildCandidateBoundVerificationProviderPreflight({
      proposedConfiguration: {
        primary_provider: 'gemini',
        model: 'gemini-3-pro-preview',
        ollama_fallback_enabled: false,
      },
    });

    expect(report).toMatchObject({
      statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.VERIFICATION_READY,
      requiresConfirmation: false,
      primaryPath: {
        statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.VERIFICATION_CAPABLE,
        verificationCapable: true,
      },
      budgetFallbackPath: {
        statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.NOT_APPLICABLE,
        verificationCapable: false,
      },
      sideEffects: {
        providerCalled: false,
        providerAvailabilityChecked: false,
        configurationPersisted: false,
        providerSelectionChanged: false,
        routingChanged: false,
      },
    });
    expect(JSON.stringify(report)).not.toContain('gemini');
    expect(JSON.stringify(report)).not.toContain('gemini-3-pro-preview');
  });

  test('uses the proposed partial values over persisted configuration without reading secrets', () => {
    const report = buildCandidateBoundVerificationProviderPreflight({
      existingConfiguration: {
        primary_provider: 'custom',
        model: 'legacy-model',
        api_key: 'persisted-secret',
        api_endpoint: 'https://private.example.test',
      },
      proposedConfiguration: {
        primary_provider: 'gemini',
        model: 'gemini-3-pro-preview',
      },
    });

    expect(report.statusId).toBe(
      CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.VERIFICATION_READY,
    );
    expect(JSON.stringify(report)).not.toContain('persisted-secret');
    expect(JSON.stringify(report)).not.toContain('private.example.test');
  });

  test('requires explicit acknowledgement for a generally usable but strict-ineligible primary path', () => {
    const report = buildCandidateBoundVerificationProviderPreflight({
      proposedConfiguration: {
        primary_provider: 'openrouter',
        model: 'general-purpose-model',
      },
    });

    expect(report).toMatchObject({
      statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.PRIMARY_PATH_INELIGIBLE,
      requiresConfirmation: true,
      primaryPath: {
        statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.CAPABILITY_UNAVAILABLE,
        verificationCapable: false,
      },
    });
  });

  test('recognizes OpenAI reasoning models as strict-ineligible through the runtime authority contract', () => {
    const report = buildCandidateBoundVerificationProviderPreflight({
      proposedConfiguration: {
        primary_provider: 'openai',
        model: 'gpt-5',
      },
    });

    expect(report.statusId).toBe(
      CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.PRIMARY_PATH_INELIGIBLE,
    );
  });

  test('warns when a budget-exhaustion fallback can be selected but remains advisory', () => {
    const report = buildCandidateBoundVerificationProviderPreflight({
      proposedConfiguration: {
        primary_provider: 'gemini',
        model: 'gemini-3-pro-preview',
        ollama_fallback_enabled: true,
        ollama_for_budget_exhausted: true,
        ollama_model: 'local-model',
      },
    });

    expect(report).toMatchObject({
      statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.BUDGET_FALLBACK_ADVISORY,
      requiresConfirmation: true,
      primaryPath: {
        verificationCapable: true,
      },
      budgetFallbackPath: {
        statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.ADVISORY_ONLY,
        verificationCapable: false,
      },
    });
    expect(JSON.stringify(report)).not.toContain('local-model');
  });

  test('does not treat an Ollama basic-task preference as a strict verification fallback', () => {
    const report = buildCandidateBoundVerificationProviderPreflight({
      proposedConfiguration: {
        primary_provider: 'gemini',
        model: 'gemini-3-pro-preview',
        ollama_fallback_enabled: true,
        ollama_for_budget_exhausted: false,
      },
    });

    expect(report.statusId).toBe(
      CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.VERIFICATION_READY,
    );
    expect(report.budgetFallbackPath.statusId).toBe(
      CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.NOT_APPLICABLE,
    );
  });
});

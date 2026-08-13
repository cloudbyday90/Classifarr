/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  AI_PROVIDER_AUTHORITY_MODE_IDS,
  buildAiProviderAuthorityProfile,
} from './aiProviderAuthority.mjs';
import {
  resolveCandidateBoundVerificationAdmission,
} from './classificationCandidateBoundVerificationContract.mjs';

export const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_VERSION =
  'classification.candidate_bound_verification_provider_preflight.v1';

export const CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS = Object.freeze({
  VERIFICATION_READY: 'verification_ready',
  PRIMARY_PATH_INELIGIBLE: 'primary_path_ineligible',
  BUDGET_FALLBACK_ADVISORY: 'budget_fallback_advisory',
  PRIMARY_AND_FALLBACK_INELIGIBLE: 'primary_and_fallback_ineligible',
});

export const CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS = Object.freeze({
  VERIFICATION_CAPABLE: 'verification_capable',
  NOT_CONFIGURED: 'not_configured',
  CAPABILITY_UNAVAILABLE: 'capability_unavailable',
  ADVISORY_ONLY: 'advisory_only',
  NOT_APPLICABLE: 'not_applicable',
});

export const CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS = Object.freeze({
  PROPOSED_CONFIGURATION: 'proposed_configuration',
  SAVED_CONFIGURATION: 'saved_configuration',
});

const PREFLIGHT_PRESENTATIONS = Object.freeze({
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.VERIFICATION_READY]: Object.freeze({
    label: 'Strict verification is available',
    message: 'The proposed primary AI path can admit strict candidate-bound verification.',
    savedMessage: 'The saved primary AI path can admit strict candidate-bound verification.',
    guidance: Object.freeze([]),
  }),
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.PRIMARY_PATH_INELIGIBLE]: Object.freeze({
    label: 'Strict verification needs attention',
    message: 'The proposed primary AI path remains available for general AI use but cannot admit strict candidate-bound verification.',
    savedMessage: 'The saved primary AI path remains available for general AI use but cannot admit strict candidate-bound verification.',
    guidance: Object.freeze([
      'Select a provider and model with server-enforced structured output before relying on strict verification.',
    ]),
  }),
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.BUDGET_FALLBACK_ADVISORY]: Object.freeze({
    label: 'Budget fallback remains advisory',
    message: 'The proposed primary AI path can admit strict verification, but its budget-exhaustion fallback remains advisory for that task.',
    savedMessage: 'The saved primary AI path can admit strict verification, but its budget-exhaustion fallback remains advisory for that task.',
    guidance: Object.freeze([
      'General AI settings can still be saved. Strict verification will abstain rather than use the advisory fallback when that fallback is selected.',
    ]),
  }),
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.PRIMARY_AND_FALLBACK_INELIGIBLE]: Object.freeze({
    label: 'Strict verification needs attention',
    message: 'The proposed primary AI path cannot admit strict candidate-bound verification and the configured fallback remains advisory.',
    savedMessage: 'The saved primary AI path cannot admit strict candidate-bound verification and the configured fallback remains advisory.',
    guidance: Object.freeze([
      'General AI settings can still be saved. Select a provider and model with server-enforced structured output before relying on strict verification.',
    ]),
  }),
});

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeProviderId(value) {
  return String(value || '').trim().toLowerCase() || 'none';
}

function isDisabledProvider(value) {
  return ['none', 'disabled'].includes(normalizeProviderId(value));
}

function resolveProposedConfiguration({ proposedConfiguration, existingConfiguration }) {
  const proposed = asRecord(proposedConfiguration);
  const existing = asRecord(existingConfiguration);

  return Object.freeze({
    primary_provider: proposed.primary_provider ?? existing.primary_provider ?? 'none',
    model: proposed.model ?? existing.model ?? '',
    ollama_fallback_enabled: proposed.ollama_fallback_enabled
      ?? existing.ollama_fallback_enabled
      ?? false,
    ollama_for_budget_exhausted: proposed.ollama_for_budget_exhausted
      ?? existing.ollama_for_budget_exhausted
      ?? true,
    ollama_model: proposed.ollama_model ?? existing.ollama_model ?? 'llama3.2',
  });
}

function buildPrimaryPath(configuration) {
  if (isDisabledProvider(configuration.primary_provider)) {
    return Object.freeze({
      statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.NOT_CONFIGURED,
      verificationCapable: false,
    });
  }

  const authority = buildAiProviderAuthorityProfile({
    providerId: configuration.primary_provider,
    model: configuration.model,
    requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
  });
  const admission = resolveCandidateBoundVerificationAdmission({
    contract: { valid: true },
    authority,
  });

  return Object.freeze({
    statusId: admission.admitted
      ? CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.VERIFICATION_CAPABLE
      : CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.CAPABILITY_UNAVAILABLE,
    verificationCapable: admission.admitted,
  });
}

function buildBudgetFallbackPath(configuration) {
  const primaryDisabled = isDisabledProvider(configuration.primary_provider);
  const fallbackCanBeSelected = configuration.ollama_fallback_enabled === true
    && (primaryDisabled || configuration.ollama_for_budget_exhausted === true);

  if (!fallbackCanBeSelected) {
    return Object.freeze({
      statusId: CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.NOT_APPLICABLE,
      verificationCapable: false,
    });
  }

  const authority = buildAiProviderAuthorityProfile({
    providerId: 'ollama',
    model: configuration.ollama_model,
    requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
    isFallback: true,
  });
  const admission = resolveCandidateBoundVerificationAdmission({
    contract: { valid: true },
    authority,
  });

  return Object.freeze({
    statusId: admission.admitted
      ? CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.VERIFICATION_CAPABLE
      : CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.ADVISORY_ONLY,
    verificationCapable: admission.admitted,
  });
}

function resolvePreflightStatus({ primaryPath, budgetFallbackPath }) {
  if (primaryPath.verificationCapable) {
    return budgetFallbackPath.statusId
      === CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.ADVISORY_ONLY
      ? CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.BUDGET_FALLBACK_ADVISORY
      : CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.VERIFICATION_READY;
  }

  return budgetFallbackPath.statusId
    === CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PATH_STATUS_IDS.ADVISORY_ONLY
    ? CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.PRIMARY_AND_FALLBACK_INELIGIBLE
    : CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.PRIMARY_PATH_INELIGIBLE;
}

/**
 * @param {string} statusId
 * @param {string} presentationContext
 */
export function getCandidateBoundVerificationProviderPreflightStatusPresentation(
  statusId,
  presentationContext = CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS.PROPOSED_CONFIGURATION,
) {
  const presentation = PREFLIGHT_PRESENTATIONS[statusId];
  if (!presentation) {
    throw new TypeError('Candidate-bound verification provider preflight status ID is invalid.');
  }
  const savedConfiguration = String(presentationContext)
    === CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS.SAVED_CONFIGURATION;

  return Object.freeze({
    label: presentation.label,
    message: savedConfiguration ? presentation.savedMessage : presentation.message,
    guidance: presentation.guidance,
  });
}

/**
 * Evaluates a proposed provider configuration using the same authority and
 * candidate-bound admission contracts used at runtime. The report is a fixed,
 * safe capability projection: it deliberately excludes provider identities,
 * models, endpoints, credentials, provider calls, and routing mutations.
 */
export function buildCandidateBoundVerificationProviderPreflight({
  proposedConfiguration = null,
  existingConfiguration = null,
  presentationContext = CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS.PROPOSED_CONFIGURATION,
} = {}) {
  const configuration = resolveProposedConfiguration({
    proposedConfiguration,
    existingConfiguration,
  });
  const primaryPath = buildPrimaryPath(configuration);
  const budgetFallbackPath = buildBudgetFallbackPath(configuration);
  const statusId = resolvePreflightStatus({ primaryPath, budgetFallbackPath });
  const presentation = getCandidateBoundVerificationProviderPreflightStatusPresentation(
    statusId,
    presentationContext,
  );

  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_VERSION,
    statusId,
    requiresConfirmation: statusId
      !== CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_STATUS_IDS.VERIFICATION_READY,
    label: presentation.label,
    message: presentation.message,
    guidance: presentation.guidance,
    primaryPath,
    budgetFallbackPath,
    sideEffects: Object.freeze({
      providerCalled: false,
      providerAvailabilityChecked: false,
      configurationPersisted: false,
      providerSelectionChanged: false,
      routingChanged: false,
    }),
  });
}

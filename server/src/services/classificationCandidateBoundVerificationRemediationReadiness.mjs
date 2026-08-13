/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  AI_PROVIDER_AUTHORITY_MODE_IDS,
  buildAiProviderAuthorityProfile,
} from './aiProviderAuthority.mjs';
import {
  CANDIDATE_BOUND_VERIFICATION_STATUS_IDS,
  resolveCandidateBoundVerificationAdmission,
} from './classificationCandidateBoundVerificationContract.mjs';

export const CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_REMEDIATION_READINESS_VERSION =
  'classification.candidate_bound_verification_remediation_readiness.v1';

export const CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS = Object.freeze({
  ADMITTED: CANDIDATE_BOUND_VERIFICATION_STATUS_IDS.ADMITTED,
  NOT_CONFIGURED: 'not_configured',
  BUDGET_PAUSED: 'budget_paused',
  FALLBACK_ADVISORY_ONLY: 'fallback_advisory_only',
  CAPABILITY_UNAVAILABLE: 'capability_unavailable',
});

export const CANDIDATE_BOUND_VERIFICATION_POLICY_READINESS_STATUS_IDS = Object.freeze({
  READY: 'ready',
  NATIVE_INTENT_UNAVAILABLE: 'native_intent_unavailable',
  ROUTING_UNAVAILABLE: 'routing_unavailable',
});

export const CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  AGGREGATE_REVIEW_REQUIRED: 'aggregate_review_required',
  PROVIDER_ADMISSION_REQUIRED: 'provider_admission_required',
  POLICY_READINESS_REQUIRED: 'policy_readiness_required',
  PROVIDER_AND_POLICY_READINESS_REQUIRED: 'provider_and_policy_readiness_required',
});

const POLICY_READINESS_STATUS_IDS = new Set(
  Object.values(CANDIDATE_BOUND_VERIFICATION_POLICY_READINESS_STATUS_IDS),
);

const PROVIDER_ADMISSION_PRESENTATIONS = Object.freeze({
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.ADMITTED]: Object.freeze({
    label: 'Verification authority admitted',
    message: 'The current configured execution path can receive strict candidate-bound verification requests.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.NOT_CONFIGURED]: Object.freeze({
    label: 'No verification provider configured',
    message: 'No configured provider path is available for candidate-bound verification.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.BUDGET_PAUSED]: Object.freeze({
    label: 'Verification paused by the configured budget gate',
    message: 'The configured cloud provider is paused by its stored budget settings, so no strict verification request can be admitted.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.FALLBACK_ADVISORY_ONLY]: Object.freeze({
    label: 'Only an advisory fallback path is configured',
    message: 'The current configured fallback path is advisory and cannot receive strict candidate-bound verification requests.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.CAPABILITY_UNAVAILABLE]: Object.freeze({
    label: 'Configured provider lacks verification authority',
    message: 'The configured provider path does not provide server-enforced structured output for candidate-bound verification.',
  }),
});

const POLICY_READINESS_PRESENTATIONS = Object.freeze({
  [CANDIDATE_BOUND_VERIFICATION_POLICY_READINESS_STATUS_IDS.READY]: 'Ready',
  [CANDIDATE_BOUND_VERIFICATION_POLICY_READINESS_STATUS_IDS.NATIVE_INTENT_UNAVAILABLE]: 'Native intent needs attention',
  [CANDIDATE_BOUND_VERIFICATION_POLICY_READINESS_STATUS_IDS.ROUTING_UNAVAILABLE]: 'Routing needs attention',
});

const REMEDIATION_PRESENTATIONS = Object.freeze({
  [CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.READY]: Object.freeze({
    label: 'Remediation prerequisites are ready',
    message: 'Current provider admission and active-policy configuration are ready. Continue to monitor aggregate verification outcomes.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.AGGREGATE_REVIEW_REQUIRED]: Object.freeze({
    label: 'Aggregate verification outcomes need review',
    message: 'Current configuration prerequisites are ready, but the aggregate drift guard detected an elevated verification outcome trend.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.PROVIDER_ADMISSION_REQUIRED]: Object.freeze({
    label: 'Provider admission needs attention',
    message: 'Current provider configuration cannot admit strict candidate-bound verification. Policy routing and classification authority remain unchanged.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.POLICY_READINESS_REQUIRED]: Object.freeze({
    label: 'Policy configuration needs attention',
    message: 'One or more active policies are not currently ready for native deterministic evaluation or routing. Provider authority remains advisory to routing.',
  }),
  [CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.PROVIDER_AND_POLICY_READINESS_REQUIRED]: Object.freeze({
    label: 'Provider and policy configuration need attention',
    message: 'Current provider admission and active-policy configuration both require remediation before strict verification can be relied on operationally.',
  }),
});

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeProviderId(value) {
  return String(value || '').trim().toLowerCase() || 'none';
}

function isPositiveBudget(value) {
  const budget = Number(value);
  return Number.isFinite(budget) && budget > 0;
}

function isBudgetPaused(configuration = {}) {
  if (configuration.pause_on_budget_exhausted !== true) return false;
  if (!isPositiveBudget(configuration.monthly_budget_usd)) return false;

  const usage = Number(configuration.current_month_usage_usd);
  const budget = Number(configuration.monthly_budget_usd);
  return Number.isFinite(usage) && usage >= budget;
}

function buildProviderAdmission(statusId) {
  const presentation = PROVIDER_ADMISSION_PRESENTATIONS[statusId]
    || PROVIDER_ADMISSION_PRESENTATIONS[
      CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.CAPABILITY_UNAVAILABLE
    ];

  return Object.freeze({
    statusId,
    admitted: statusId === CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.ADMITTED,
    label: presentation.label,
    message: presentation.message,
    configurationOnly: true,
    providerAvailabilityChecked: false,
    providerCalled: false,
  });
}

/**
 * Derives the authority of the path the router would select from the current
 * stored configuration. It deliberately does not invoke the router because a
 * readiness read must not call a provider, emit operational warnings, or
 * create provider-side effects.
 */
export function resolveConfiguredCandidateBoundVerificationAdmission(configuration) {
  const config = asRecord(configuration);
  const primaryProvider = normalizeProviderId(config.primary_provider);
  const fallbackEnabled = config.ollama_fallback_enabled === true;

  if (primaryProvider === 'none' || primaryProvider === 'disabled') {
    return buildProviderAdmission(
      fallbackEnabled
        ? CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.FALLBACK_ADVISORY_ONLY
        : CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.NOT_CONFIGURED,
    );
  }

  if (primaryProvider === 'ollama') {
    return buildProviderAdmission(
      CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.CAPABILITY_UNAVAILABLE,
    );
  }

  if (isBudgetPaused(config)) {
    if (fallbackEnabled && config.ollama_for_budget_exhausted === true) {
      return buildProviderAdmission(
        CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.FALLBACK_ADVISORY_ONLY,
      );
    }

    return buildProviderAdmission(
      CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.BUDGET_PAUSED,
    );
  }

  const authority = buildAiProviderAuthorityProfile({
    providerId: primaryProvider,
    model: config.model,
    requestedMode: AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
  });
  const admission = resolveCandidateBoundVerificationAdmission({
    // Candidate identity is not required to determine whether this configured
    // provider can receive the strict verification contract.
    contract: { valid: true },
    authority,
  });

  return buildProviderAdmission(
    admission.admitted
      ? CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.ADMITTED
      : CANDIDATE_BOUND_VERIFICATION_PROVIDER_ADMISSION_STATUS_IDS.CAPABILITY_UNAVAILABLE,
  );
}

function normalizePolicyReadinessRows(rows = []) {
  const normalized = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const statusId = row?.status_id ?? row?.statusId;
    const count = Number(row?.policy_count ?? row?.policyCount);
    if (!POLICY_READINESS_STATUS_IDS.has(statusId) || !Number.isSafeInteger(count) || count < 0) {
      continue;
    }

    normalized.set(statusId, (normalized.get(statusId) || 0) + count);
  }

  return Object.freeze([...POLICY_READINESS_STATUS_IDS].map(statusId => Object.freeze({
    statusId,
    label: POLICY_READINESS_PRESENTATIONS[statusId],
    count: normalized.get(statusId) || 0,
  })));
}

export function buildCandidateBoundVerificationPolicyReadiness(rows = []) {
  const statusCounts = normalizePolicyReadinessRows(rows);
  const evaluatedPolicyCount = statusCounts.reduce((total, entry) => total + entry.count, 0);
  const readyPolicyCount = statusCounts.find(
    entry => entry.statusId === CANDIDATE_BOUND_VERIFICATION_POLICY_READINESS_STATUS_IDS.READY,
  )?.count || 0;

  return Object.freeze({
    evaluatedPolicyCount,
    readyPolicyCount,
    notReadyPolicyCount: evaluatedPolicyCount - readyPolicyCount,
    allActivePoliciesReady: evaluatedPolicyCount > 0 && readyPolicyCount === evaluatedPolicyCount,
    statusCounts,
  });
}

function resolveAggregateDriftStatus(metrics = {}) {
  const statusId = metrics?.driftGuard?.statusId;
  return ['stable', 'elevated', 'insufficient_data'].includes(statusId)
    ? statusId
    : 'unavailable';
}

function resolveRemediationStatus({ providerAdmission, policyReadiness, aggregateDriftStatus }) {
  if (!providerAdmission?.admitted && !policyReadiness?.allActivePoliciesReady) {
    return CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.PROVIDER_AND_POLICY_READINESS_REQUIRED;
  }

  if (!providerAdmission?.admitted) {
    return CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.PROVIDER_ADMISSION_REQUIRED;
  }

  if (!policyReadiness?.allActivePoliciesReady) {
    return CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.POLICY_READINESS_REQUIRED;
  }

  return aggregateDriftStatus === 'elevated'
    ? CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.AGGREGATE_REVIEW_REQUIRED
    : CANDIDATE_BOUND_VERIFICATION_REMEDIATION_STATUS_IDS.READY;
}

function buildRecommendedSteps({ providerAdmission, policyReadiness, aggregateDriftStatus }) {
  const steps = [];

  if (!providerAdmission.admitted) {
    steps.push('Review AI provider settings and select a configured path with server-enforced structured output for verification.');
  }
  if (!policyReadiness.allActivePoliciesReady) {
    steps.push('Review active native policies for one authoritative intent with purpose rules and a configured routing mapping.');
  }
  if (aggregateDriftStatus === 'elevated') {
    steps.push('Review the aggregate verification trend before making configuration changes; aggregate metrics do not identify a root cause.');
  }
  steps.push('Re-read this readiness report after an authorized configuration change and observe a new completed UTC-day metrics window.');

  return Object.freeze(steps);
}

/**
 * Produces an operator-facing correlation between aggregate verification
 * health and current configuration prerequisites. Inputs intentionally omit
 * item identity, policy identity, provider identity, credentials, prompts,
 * and historic model output.
 */
export function buildCandidateBoundVerificationRemediationReadiness({
  metrics = {},
  providerConfiguration = null,
  policyReadinessRows = [],
} = {}) {
  const providerAdmission = resolveConfiguredCandidateBoundVerificationAdmission(providerConfiguration);
  const policyReadiness = buildCandidateBoundVerificationPolicyReadiness(policyReadinessRows);
  const aggregateDriftStatus = resolveAggregateDriftStatus(metrics);
  const statusId = resolveRemediationStatus({
    providerAdmission,
    policyReadiness,
    aggregateDriftStatus,
  });
  const presentation = REMEDIATION_PRESENTATIONS[statusId];

  return Object.freeze({
    version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_REMEDIATION_READINESS_VERSION,
    aggregateHealth: Object.freeze({
      driftStatusId: aggregateDriftStatus,
      currentOutcomeCount: Number(metrics?.current?.totalOutcomes) || 0,
    }),
    providerAdmission,
    policyReadiness,
    readiness: Object.freeze({
      statusId,
      label: presentation.label,
      message: presentation.message,
      recommendedSteps: buildRecommendedSteps({
        providerAdmission,
        policyReadiness,
        aggregateDriftStatus,
      }),
    }),
    sideEffects: Object.freeze({
      providerCalled: false,
      providerAvailabilityChecked: false,
      classificationRead: false,
      policyMutation: false,
      routingMutation: false,
      retryQueued: false,
    }),
  });
}

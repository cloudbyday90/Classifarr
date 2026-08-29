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
  POLICY_INTENT_DRAFT_BUCKETS,
  validatePolicyIntentDraftRequest,
} from './policyIntentRequestValidator.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_ROLES,
  POLICY_INTENT_SOURCES,
  validatePolicyIntentContract,
} from './policyIntentSchema.mjs';
import { buildPolicyIntentContract } from './policyIntentContract.mjs';
import {
  POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS,
} from './policyNativeIntentRuntimeEvaluator.mjs';

export const POLICY_COHORT_SIMULATION_VERSION = 1;

export const POLICY_COHORT_SIMULATION_STATUS_IDS = Object.freeze({
  READY: 'cohort_simulation_ready',
  NO_ELIGIBLE_HISTORIC_ITEMS: 'cohort_simulation_no_eligible_historic_items',
});

export const POLICY_COHORT_SIMULATION_OUTCOME_IDS = Object.freeze({
  ELIGIBLE: 'eligible',
  PURPOSE_NOT_MATCHED: 'purpose_not_matched',
  HARD_LIMIT_FAILED: 'hard_limit_failed',
  HARD_LIMIT_UNKNOWN: 'hard_limit_unknown',
  NO_PURPOSE: 'no_purpose',
  AUTHORITY_BLOCKED: 'authority_blocked',
  OTHER: 'other',
});

const DRAFT_BUCKET_MAPPING = Object.freeze({
  [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: {
    collection: 'purpose',
    intentRole: POLICY_INTENT_ROLES.PURPOSE,
    semantics: 'identity',
    constraintMode: null,
  },
  [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: {
    collection: 'hard_limits',
    intentRole: POLICY_INTENT_ROLES.HARD_LIMIT,
    semantics: null,
    constraintMode: 'strict',
  },
  [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: {
    collection: 'helpful_hints',
    intentRole: POLICY_INTENT_ROLES.HELPFUL_HINT,
    semantics: 'compatibility',
    constraintMode: 'advisory',
  },
  [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: {
    collection: 'helpful_hints',
    intentRole: POLICY_INTENT_ROLES.HELPFUL_HINT,
    semantics: 'compatibility',
    constraintMode: 'advisory',
  },
  [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: {
    collection: 'avoid',
    intentRole: POLICY_INTENT_ROLES.AVOID,
    semantics: null,
    constraintMode: 'advisory',
  },
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function asNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function deriveOperator(values = {}) {
  for (const key of ['require_all', 'require_any', 'prefer', 'include', 'exclude']) {
    const value = values[key];
    if (Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && `${value}`.trim()) {
      return key;
    }
  }

  if (values.mode === 'max' && values.max !== undefined && values.max !== null) return 'max';
  if (values.min !== undefined || values.max !== undefined) return 'range';
  if (values.min_minutes !== undefined || values.max_minutes !== undefined) return 'runtime_range';
  return 'configured';
}

function normalizeEntryMetadata(metadata = {}, fallback = {}) {
  const values = asObject(metadata);
  const constraintMode = values.constraint_mode || values.constraint || values.runtime_mode || values.runtime;

  return {
    semantics: values.semantics || fallback.semantics || null,
    constraint_mode: fallback.constraintMode || constraintMode || (values.strict === true ? 'strict' : null),
  };
}

function makeContractEntry(entry = {}, mapping = {}) {
  const values = asObject(entry.values);
  const metadata = normalizeEntryMetadata(entry.metadata, mapping);

  return {
    intent_role: mapping.intentRole,
    signal_type: entry.signal_type,
    operator: deriveOperator(values),
    values,
    constraint_mode: metadata.constraint_mode,
    semantics: metadata.semantics,
    source: 'policy_cohort_simulation_draft',
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
  };
}

function createContractCollections() {
  return {
    purpose: [],
    hard_limits: [],
    helpful_hints: [],
    avoid: [],
  };
}

function appendDraftEntries(collections, draft = {}) {
  for (const preset of asArray(draft.presets)) {
    for (const [bucket, mapping] of Object.entries(DRAFT_BUCKET_MAPPING)) {
      for (const entry of asArray(preset?.buckets?.[bucket])) {
        collections[mapping.collection].push(makeContractEntry(entry, mapping));
      }
    }
  }
}

function buildReviewBehavior(policy = {}) {
  return {
    auto_classify_threshold: Number.isFinite(Number(policy.auto_classify_threshold))
      ? Number(policy.auto_classify_threshold)
      : null,
    prompt_threshold: Number.isFinite(Number(policy.prompt_threshold))
      ? Number(policy.prompt_threshold)
      : null,
    require_ai_validation: policy.require_ai_validation !== false,
    trust_patterns: policy.trust_patterns !== false,
    trust_rag: policy.trust_rag !== false,
    trust_history: policy.trust_history !== false,
    combination_mode: policy.combination_mode || 'best_match',
  };
}

function makeSimulationNativeContract(contract = {}, policy = {}) {
  const candidate = {
    ...contract,
    schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: asPositiveInteger(policy.id),
    library_id: asPositiveInteger(policy.library_id),
    library_name: asNonEmptyString(policy.library_name),
    library_media_type: asNonEmptyString(policy.library_media_type),
    source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    model: {
      mode: 'cohort_simulation',
      intent_supported: true,
      native_intent: true,
      conversion_available: false,
    },
    purpose: asArray(contract.purpose),
    hard_limits: asArray(contract.hard_limits),
    helpful_hints: asArray(contract.helpful_hints),
    avoid: asArray(contract.avoid),
    review_behavior: {
      ...buildReviewBehavior(policy),
      ...asObject(contract.review_behavior),
    },
    template_links: asArray(contract.template_links),
    warnings: asArray(contract.warnings),
    unsupported_signals: asArray(contract.unsupported_signals),
  };

  return {
    ...candidate,
    validation: validatePolicyIntentContract(candidate),
  };
}

/**
 * Converts a validated, transient editor draft into the same native-intent
 * contract shape consumed by the deterministic runtime evaluator. The result
 * is in-memory only and must never be persisted or used to route media.
 */
export function buildPolicyCohortSimulationDraftContract({ policy = {}, draft } = {}) {
  const validatedDraft = validatePolicyIntentDraftRequest(draft);
  const collections = createContractCollections();
  appendDraftEntries(collections, validatedDraft);

  return makeSimulationNativeContract({
    ...collections,
    review_behavior: buildReviewBehavior(policy),
    template_links: [],
    warnings: [],
    unsupported_signals: [],
  }, policy);
}

/**
 * Current policy configuration is normalized to the native runtime contract
 * only for an in-memory baseline comparison. This is deliberately separate
 * from runtime authority and cannot modify the persisted policy.
 */
export function buildPolicyCohortSimulationCurrentContract(policy = {}) {
  const sourceContract = asObject(policy.policy_intent_contract);
  const contract = Object.keys(sourceContract).length > 0
    ? sourceContract
    : buildPolicyIntentContract(policy);

  return makeSimulationNativeContract(contract, policy);
}

export function buildPolicyCohortSimulationPolicy({ policy = {}, contract = {} } = {}) {
  const valid = contract.validation?.valid === true;

  return {
    id: asPositiveInteger(policy.id),
    library_id: asPositiveInteger(policy.library_id),
    library_name: asNonEmptyString(policy.library_name),
    library_media_type: asNonEmptyString(policy.library_media_type),
    combination_mode: contract.review_behavior?.combination_mode || policy.combination_mode || 'best_match',
    auto_classify_threshold: contract.review_behavior?.auto_classify_threshold ?? policy.auto_classify_threshold,
    prompt_threshold: contract.review_behavior?.prompt_threshold ?? policy.prompt_threshold,
    policy_runtime_authority: {
      sourceId: POLICY_INTENT_SOURCES.NATIVE_INTENT,
      validationOk: valid,
      simulationOnly: true,
    },
    policy_intent_contract: contract,
  };
}

export function normalizePolicyCohortSimulationOutcome(evaluation = {}) {
  if (evaluation.eligible === true) return POLICY_COHORT_SIMULATION_OUTCOME_IDS.ELIGIBLE;

  switch (evaluation.statusId) {
    case POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.PURPOSE_NOT_MATCHED:
      return POLICY_COHORT_SIMULATION_OUTCOME_IDS.PURPOSE_NOT_MATCHED;
    case POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_FAILED:
      return POLICY_COHORT_SIMULATION_OUTCOME_IDS.HARD_LIMIT_FAILED;
    case POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.HARD_LIMIT_UNKNOWN:
      return POLICY_COHORT_SIMULATION_OUTCOME_IDS.HARD_LIMIT_UNKNOWN;
    case POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.NO_PURPOSE:
      return POLICY_COHORT_SIMULATION_OUTCOME_IDS.NO_PURPOSE;
    case POLICY_NATIVE_INTENT_RUNTIME_STATUS_IDS.AUTHORITY_BLOCKED:
      return POLICY_COHORT_SIMULATION_OUTCOME_IDS.AUTHORITY_BLOCKED;
    default:
      return POLICY_COHORT_SIMULATION_OUTCOME_IDS.OTHER;
  }
}

function createOutcomeCounts() {
  return Object.values(POLICY_COHORT_SIMULATION_OUTCOME_IDS)
    .reduce((counts, outcomeId) => ({ ...counts, [outcomeId]: 0 }), {});
}

function summarizeOutcomes(outcomes = []) {
  return asArray(outcomes).reduce((counts, outcomeId) => ({
    ...counts,
    [outcomeId]: asNonNegativeInteger(counts[outcomeId]) + 1,
  }), createOutcomeCounts());
}

function buildGuidance({ sampleSize, transitions }) {
  if (sampleSize === 0) {
    return {
      title: 'No recent deterministic cohort is available',
      description: 'No bounded historic deterministic classification records matched this policy media type and lookback window. This is not evidence that the draft is safe to route.',
    };
  }

  if (transitions.newlyEligible > 0 || transitions.noLongerEligible > 0) {
    return {
      title: 'The proposed policy changes historic eligibility',
      description: 'Review the aggregate change before saving. This is a deterministic eligibility comparison only; it does not predict AI, choose among destinations, or route media.',
    };
  }

  return {
    title: 'No eligibility change in the bounded cohort',
    description: 'The current configuration and proposed draft produced the same eligibility result for this bounded cohort. It does not certify future routing or semantic correctness.',
  };
}

export function buildPolicyCohortSimulation({
  context = {},
  sample = {},
  baselineOutcomes = [],
  proposedOutcomes = [],
  evaluatedAt = new Date(),
} = {}) {
  const policyId = asPositiveInteger(context.policy?.id ?? context.id);
  const libraryId = asPositiveInteger(context.policy?.library_id ?? context.library_id);
  if (!policyId || !libraryId) return null;

  const baseline = summarizeOutcomes(baselineOutcomes);
  const proposed = summarizeOutcomes(proposedOutcomes);
  const pairedOutcomes = asArray(baselineOutcomes).map((baselineOutcome, index) => ({
    baselineOutcome,
    proposedOutcome: proposedOutcomes[index],
  }));
  const transitions = pairedOutcomes.reduce((summary, pair) => {
    const wasEligible = pair.baselineOutcome === POLICY_COHORT_SIMULATION_OUTCOME_IDS.ELIGIBLE;
    const isEligible = pair.proposedOutcome === POLICY_COHORT_SIMULATION_OUTCOME_IDS.ELIGIBLE;
    if (!wasEligible && isEligible) summary.newlyEligible += 1;
    if (wasEligible && !isEligible) summary.noLongerEligible += 1;
    if (wasEligible && isEligible) summary.retainedEligible += 1;
    if (!wasEligible && !isEligible) summary.retainedIneligible += 1;
    return summary;
  }, {
    newlyEligible: 0,
    noLongerEligible: 0,
    retainedEligible: 0,
    retainedIneligible: 0,
  });
  const evaluatedItemCount = asNonNegativeInteger(sample.evaluatedItemCount ?? pairedOutcomes.length);
  const statusId = evaluatedItemCount === 0
    ? POLICY_COHORT_SIMULATION_STATUS_IDS.NO_ELIGIBLE_HISTORIC_ITEMS
    : POLICY_COHORT_SIMULATION_STATUS_IDS.READY;

  return {
    version: `policy_cohort_simulation.v${POLICY_COHORT_SIMULATION_VERSION}`,
    evaluatedAt: toIsoTimestamp(evaluatedAt) || new Date().toISOString(),
    policy: {
      id: policyId,
      name: asNonEmptyString(context.policy?.name ?? context.policy_name) || 'Unnamed policy',
    },
    library: {
      id: libraryId,
      name: asNonEmptyString(context.policy?.library_name ?? context.library_name) || 'Unnamed library',
      mediaType: asNonEmptyString(context.policy?.library_media_type ?? context.library_media_type),
    },
    sample: {
      windowDays: asNonNegativeInteger(sample.windowDays),
      maximumItems: asNonNegativeInteger(sample.maximumItems),
      evaluatedItemCount,
      source: 'recent_deterministic_classification_history',
      rawItemsExposed: false,
    },
    comparison: {
      baseline,
      proposed,
      transitions,
    },
    statusId,
    guidance: buildGuidance({ sampleSize: evaluatedItemCount, transitions }),
    advisory: true,
    draftRetained: false,
    rawConfigurationExposed: false,
    rawHistoricItemsExposed: false,
    routingAffected: false,
    providerAccessed: false,
    databaseWritten: false,
  };
}

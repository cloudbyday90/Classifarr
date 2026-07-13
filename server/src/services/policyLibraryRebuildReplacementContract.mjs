/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  validatePolicyLibraryPolicyRebuildProposal,
} from './policyLibraryPolicyRebuild.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
  validatePolicyIntentContract,
} from './policyIntentSchema.mjs';
import {
  buildNativeHardLimitRuleFromStrictConstraintDescriptor,
} from './policyStrictConstraintDescriptor.mjs';

const POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_VERSION =
  'policy.library_rebuild_replacement_contract.v1';

const POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS = Object.freeze({
  INVALID_PROPOSAL: 'invalid_proposal',
  MISSING_TYPED_PURPOSE: 'missing_typed_purpose',
  UNSUPPORTED_SIGNAL_KEY: 'unsupported_signal_key',
  AMBIGUOUS_HARD_LIMIT: 'ambiguous_hard_limit',
  INVALID_STRICT_CONSTRAINT_DESCRIPTOR: 'invalid_strict_constraint_descriptor',
  INVALID_NATIVE_CONTRACT: 'invalid_native_contract',
});

const KEY_PREFIX_TO_SIGNAL_TYPE = Object.freeze({
  genre: 'genres',
  genres: 'genres',
  keyword: 'keywords',
  keywords: 'keywords',
  studio: 'studios',
  studios: 'studios',
  language: 'language',
  languages: 'language',
  media_type: 'media_type',
  'media-type': 'media_type',
  certification: 'certifications',
  certifications: 'certifications',
  release_year: 'release_year',
  'release-year': 'release_year',
  vote_average: 'vote_average',
  'vote-average': 'vote_average',
  runtime: 'runtime',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return asObject(parsed);
  } catch {
    return {};
  }
}

function resolveSignalType(entry = {}) {
  const prefix = normalizeString(entry.key).split(':', 1)[0].toLowerCase();
  return KEY_PREFIX_TO_SIGNAL_TYPE[prefix] || null;
}

function resolveEntryValue(entry = {}) {
  return normalizeString(entry.value) || normalizeString(entry.label);
}

function buildRule({ entry, collection, intentRole, operator, valueKey, semantics, constraintMode }) {
  const signalType = resolveSignalType(entry);
  const value = resolveEntryValue(entry);
  if (!signalType || !value) return null;

  return {
    intent_role: intentRole,
    collection,
    signal_type: signalType,
    operator,
    values: { [valueKey]: [value] },
    constraint_mode: constraintMode,
    semantics,
    source: 'library_rebuild',
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
  };
}

function buildRules(intentDraft = {}) {
  const rules = [];
  const issues = [];
  const collections = [
    ['belongs_here', 'purpose', 'purpose', 'require_any', 'require_any', 'identity', 'advisory'],
    ['helpful_matches', 'helpful_hints', 'helpful_hint', 'prefer', 'prefer', 'compatibility', 'advisory'],
    ['avoid', 'avoid', 'avoid', 'exclude', 'exclude', 'compatibility', 'advisory'],
  ];

  collections.forEach(([
    sourceField,
    collection,
    intentRole,
    operator,
    valueKey,
    semantics,
    constraintMode,
  ]) => {
    asArray(intentDraft[sourceField]).forEach(entry => {
      const rule = buildRule({
        entry,
        collection,
        intentRole,
        operator,
        valueKey,
        semantics,
        constraintMode,
      });
      if (!rule) {
        issues.push({
          riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS.UNSUPPORTED_SIGNAL_KEY,
          message: 'Rebuild replacement requires typed policy signal keys for executable rules.',
        });
        return;
      }
      rules.push(rule);
    });
  });

  asArray(intentDraft.hard_limits).forEach(entry => {
    if (!Object.prototype.hasOwnProperty.call(asObject(entry), 'strictConstraint')) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS.AMBIGUOUS_HARD_LIMIT,
        message: 'Rebuild replacement cannot infer executable strict-constraint operators from label-only hard limits.',
      });
      return;
    }

    const descriptorResult = buildNativeHardLimitRuleFromStrictConstraintDescriptor(
      entry.strictConstraint
    );
    if (!descriptorResult.ok || !descriptorResult.rule) {
      issues.push({
        riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS.INVALID_STRICT_CONSTRAINT_DESCRIPTOR,
        message: 'Rebuild replacement requires a valid structured strict-constraint descriptor.',
      });
      return;
    }

    rules.push(descriptorResult.rule);
  });

  return { rules, issues };
}

function buildWarnings(intentDraft = {}, proposal = {}) {
  const warningReasonCodes = [
    ...asArray(intentDraft.ask_when).map(entry => normalizeString(entry.reasonCode, 120)),
    ...asArray(proposal.warnings).map(warning => normalizeString(warning.reasonCode, 120)),
  ].filter(Boolean);

  return [...new Set(warningReasonCodes)].slice(0, 16).map(reasonCode => ({
    reason_code: reasonCode,
    severity: 'warning',
    summary: 'Library rebuild retained a review condition for this native intent.',
  }));
}

function buildReviewBehavior({ previousIntent, intentDraft, proposal }) {
  const previousBehavior = parseJsonObject(previousIntent?.review_behavior);
  const reviewReasonCodes = buildWarnings(intentDraft, proposal).map(warning => warning.reason_code);

  return {
    ...previousBehavior,
    library_rebuild: {
      requires_review: reviewReasonCodes.length > 0,
      review_reason_codes: reviewReasonCodes,
      confidence_level: normalizeString(intentDraft.confidence?.level, 40) || null,
      confidence_score: Number.isFinite(Number(intentDraft.confidence?.score))
        ? Number(intentDraft.confidence.score)
        : null,
    },
  };
}

function buildPolicyLibraryRebuildReplacementContract({ proposal = {}, policy = {}, previousIntent = {} } = {}) {
  const proposalValidation = validatePolicyLibraryPolicyRebuildProposal(proposal);
  if (!proposalValidation.ok) {
    return {
      ok: false,
      issueCount: 1,
      issues: [{
        riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS.INVALID_PROPOSAL,
        message: 'Replacement requires a valid library rebuild proposal.',
      }],
      contract: null,
    };
  }

  const intentDraft = asObject(proposal.intentDraft);
  const { rules, issues } = buildRules(intentDraft);
  if (!rules.some(rule => rule.collection === 'purpose')) {
    issues.push({
      riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS.MISSING_TYPED_PURPOSE,
      message: 'Replacement requires at least one typed belongs-here rule.',
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issueCount: issues.length,
      issues,
      contract: null,
    };
  }

  const groupedRules = rules.reduce((groups, rule) => {
    groups[rule.collection] = groups[rule.collection] || [];
    groups[rule.collection].push(rule);
    return groups;
  }, {});
  const contract = {
    schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: Number(policy.id),
    library_id: Number(policy.library_id),
    library_name: normalizeString(proposal.library?.libraryName) || null,
    library_media_type: normalizeString(proposal.library?.mediaType) || null,
    source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    model: {
      mode: 'native_intent',
      intent_supported: true,
      native_intent: true,
      conversion_available: false,
    },
    purpose: groupedRules.purpose || [],
    hard_limits: groupedRules.hard_limits || [],
    helpful_hints: groupedRules.helpful_hints || [],
    avoid: groupedRules.avoid || [],
    review_behavior: buildReviewBehavior({ previousIntent, intentDraft, proposal }),
    template_links: [],
    warnings: buildWarnings(intentDraft, proposal),
    unsupported_signals: [],
  };
  const validation = validatePolicyIntentContract(contract);

  return {
    ok: validation.valid === true,
    issueCount: validation.error_count,
    issues: validation.valid
      ? []
      : [{
        riskId: POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS.INVALID_NATIVE_CONTRACT,
        message: 'Rebuild replacement did not produce a valid native intent contract.',
      }],
    contract: {
      ...contract,
      validation,
    },
  };
}

export {
  POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_RISK_IDS,
  POLICY_LIBRARY_REBUILD_REPLACEMENT_CONTRACT_VERSION,
  buildPolicyLibraryRebuildReplacementContract,
};

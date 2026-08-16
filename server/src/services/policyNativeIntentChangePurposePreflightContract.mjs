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
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
  SUPPORTED_POLICY_INTENT_OPERATORS,
  SUPPORTED_POLICY_INTENT_SIGNAL_TYPES,
} from './policyIntentSchema.mjs';
import {
  POLICY_PURPOSE_COVERAGE_STATUS_IDS,
  buildPolicyPurposeCoverage,
} from './policyPurposeCoverageReviewContract.mjs';

export const POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_VERSION = 1;

export const POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID = 'update_purpose';

const PURPOSE_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios']);
const PURPOSE_CAPABLE_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios', 'media_type']);
const SUPPORTED_OPERATORS = new Set(SUPPORTED_POLICY_INTENT_OPERATORS);
const SUPPORTED_SIGNAL_TYPES = new Set(SUPPORTED_POLICY_INTENT_SIGNAL_TYPES);
const SUPPORTED_SOURCES = new Set(Object.values(POLICY_INTENT_SOURCES));
const SUPPORTED_INFERENCE_STATES = new Set(Object.values(POLICY_INTENT_INFERENCE_STATES));
const COMMAND_KEYS = new Set(['command_id', 'values']);
const ENTRY_KEYS = new Set([
  'signal_type',
  'operator',
  'values',
  'constraint_mode',
  'semantics',
  'source',
  'inference_state',
]);
const VALUE_KEYS = new Set([
  'require_all',
  'require_any',
  'include',
  'prefer',
  'exclude',
  'mode',
  'max',
  'min',
  'min_minutes',
  'max_minutes',
  'when_any',
]);
const REQUIRED_VALUE_KEYS = new Set(['require_all', 'require_any', 'include', 'prefer', 'exclude', 'when_any']);
const MAX_ENTRIES = 100;
const MAX_VALUES_PER_ENTRY = 50;
const MAX_TERM_LENGTH = 120;

export class PolicyNativeIntentChangePurposePreflightValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PolicyNativeIntentChangePurposePreflightValidationError';
    this.code = 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_REQUEST_INVALID';
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
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

function asBoundedStringList(value) {
  if (!Array.isArray(value) || value.length > MAX_VALUES_PER_ENTRY) return null;

  const normalized = value.map(asNonEmptyString);
  if (normalized.some(term => !term || term.length > MAX_TERM_LENGTH)) return null;
  return normalized;
}

function assertOnlyKeys(record, allowedKeys, label) {
  const unknown = Object.keys(record).filter(key => !allowedKeys.has(key));
  if (unknown.length > 0) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      `${label} contains unsupported field(s).`,
    );
  }
}

function normalizeValues(value) {
  const values = asObject(value);
  if (!values) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change entries require a values object.',
    );
  }

  assertOnlyKeys(values, VALUE_KEYS, 'Purpose change entry values');
  if (Object.keys(values).length === 0) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change entry values cannot be empty.',
    );
  }

  const normalized = {};
  for (const [key, entryValue] of Object.entries(values)) {
    if (REQUIRED_VALUE_KEYS.has(key)) {
      const terms = asBoundedStringList(entryValue);
      if (!terms) {
        throw new PolicyNativeIntentChangePurposePreflightValidationError(
          `Purpose change value "${key}" must be a bounded string list.`,
        );
      }
      normalized[key] = terms;
      continue;
    }

    if (key === 'mode') {
      const mode = asNonEmptyString(entryValue);
      if (!mode || !['max', 'min', 'range', 'runtime_range', 'exclude', 'include'].includes(mode)) {
        throw new PolicyNativeIntentChangePurposePreflightValidationError(
          'Purpose change mode is not supported.',
        );
      }
      normalized[key] = mode;
      continue;
    }

    if (key === 'min_minutes' || key === 'max_minutes') {
      const numericValue = Number(entryValue);
      if (!Number.isInteger(numericValue) || numericValue < 0 || numericValue > 100000) {
        throw new PolicyNativeIntentChangePurposePreflightValidationError(
          `Purpose change value "${key}" must be a bounded non-negative integer.`,
        );
      }
      normalized[key] = numericValue;
      continue;
    }

    if (
      (typeof entryValue !== 'string' || !entryValue.trim() || entryValue.trim().length > MAX_TERM_LENGTH) &&
      (typeof entryValue !== 'number' || !Number.isFinite(entryValue) || entryValue < -100000 || entryValue > 100000) &&
      typeof entryValue !== 'boolean'
    ) {
      throw new PolicyNativeIntentChangePurposePreflightValidationError(
        `Purpose change value "${key}" is not supported.`,
      );
    }
    normalized[key] = typeof entryValue === 'string' ? entryValue.trim() : entryValue;
  }

  return normalized;
}

function normalizePurposeEntry(value) {
  const entry = asObject(value);
  if (!entry) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change values must contain objects.',
    );
  }

  assertOnlyKeys(entry, ENTRY_KEYS, 'Purpose change entry');

  const signalType = asNonEmptyString(entry.signal_type);
  const operator = asNonEmptyString(entry.operator);
  const constraintMode = entry.constraint_mode === undefined ? null : asNonEmptyString(entry.constraint_mode);
  const semantics = entry.semantics === undefined ? null : asNonEmptyString(entry.semantics);
  const source = entry.source === undefined
    ? POLICY_INTENT_SOURCES.NATIVE_INTENT
    : asNonEmptyString(entry.source);
  const inferenceState = entry.inference_state === undefined
    ? POLICY_INTENT_INFERENCE_STATES.INFERRED
    : asNonEmptyString(entry.inference_state);

  if (!signalType || !PURPOSE_CAPABLE_SIGNAL_TYPES.has(signalType) || !SUPPORTED_SIGNAL_TYPES.has(signalType)) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change entries must use an identity-capable signal type.',
    );
  }

  if (!operator || !SUPPORTED_OPERATORS.has(operator)) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change entries must use a supported operator.',
    );
  }

  if (constraintMode !== null && !['strict', 'advisory'].includes(constraintMode)) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change entry constraint mode is not supported.',
    );
  }

  if (semantics !== null && !['identity', 'compatibility'].includes(semantics)) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change entry semantics are not supported.',
    );
  }

  if (!source || !SUPPORTED_SOURCES.has(source) || !inferenceState || !SUPPORTED_INFERENCE_STATES.has(inferenceState)) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change entry provenance is not supported.',
    );
  }

  return {
    signalType,
    operator,
    values: normalizeValues(entry.values),
    constraintMode,
    semantics,
    source,
    inferenceState,
  };
}

function collectRequiredTerms(values = {}) {
  return ['require_all', 'require_any'].flatMap(key => Array.isArray(values[key]) ? values[key] : []);
}

/**
 * Validates one explicit native `update_purpose` command and derives only the
 * transient terms used by the coverage query. It does not authorize, persist,
 * or return those terms.
 */
export function buildPolicyNativeIntentChangePurposePreflightCandidate(command) {
  const normalizedCommand = asObject(command);
  if (!normalizedCommand) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'A typed update_purpose change command is required.',
    );
  }

  assertOnlyKeys(normalizedCommand, COMMAND_KEYS, 'Purpose change command');
  if (normalizedCommand.command_id !== POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose coverage preflight accepts only the update_purpose command.',
    );
  }

  if (!Array.isArray(normalizedCommand.values) || normalizedCommand.values.length > MAX_ENTRIES) {
    throw new PolicyNativeIntentChangePurposePreflightValidationError(
      'Purpose change command values must be a bounded array.',
    );
  }

  const entries = normalizedCommand.values.map(normalizePurposeEntry);
  const candidateTermsByKey = new Map();

  for (const entry of entries) {
    if (entry.semantics !== 'identity' || !PURPOSE_SIGNAL_TYPES.has(entry.signalType)) continue;

    for (const term of collectRequiredTerms(entry.values)) {
      const termKey = term.toLowerCase();
      candidateTermsByKey.set(`${entry.signalType}\u0000${termKey}`, {
        signalType: entry.signalType,
        termKey,
      });
    }
  }

  const terms = [...candidateTermsByKey.values()];
  return {
    terms,
    requiredSignalTypeCount: new Set(terms.map(term => term.signalType)).size,
    requiredTermCount: terms.length,
  };
}

function buildGuidance(coverage = {}) {
  switch (coverage.statusId) {
    case POLICY_PURPOSE_COVERAGE_STATUS_IDS.MISSING_SPECIALIZED_COVERAGE:
      return {
        title: 'Review specialized purpose coverage before applying this change',
        description: 'This proposed purpose has no required genre, keyword, or studio identity signal. Consider adding an explicit identity requirement, then run this advisory check again. Applying the native change remains a separate revision-checked action.',
      };
    case POLICY_PURPOSE_COVERAGE_STATUS_IDS.BROAD_OVERLAP_REVIEW_REQUIRED:
      return {
        title: 'Review shared purpose coverage before applying this change',
        description: 'Every proposed required content signal is shared with another active destination of the same media type. Consider a more specific declared purpose, then run this advisory check again. This check does not select a destination or authorize the change.',
      };
    default:
      return {
        title: 'Proposed purpose coverage is distinct',
        description: 'At least one proposed required content signal is not shared with another active destination of the same media type. This advisory result does not approve the native change or validate semantic correctness.',
      };
  }
}

export function buildPolicyNativeIntentChangePurposePreflight({
  context = {},
  candidate = {},
  overlap = {},
  expectedRevision,
  evaluatedAt = new Date(),
} = {}) {
  const revision = asPositiveInteger(context.intent_version);
  const normalizedExpectedRevision = asPositiveInteger(expectedRevision);
  const timestamp = evaluatedAt instanceof Date ? evaluatedAt : new Date(evaluatedAt);

  if (!revision || !normalizedExpectedRevision || Number.isNaN(timestamp.getTime())) return null;

  const coverage = buildPolicyPurposeCoverage({
    required_signal_type_count: candidate.requiredSignalTypeCount,
    required_term_count: candidate.requiredTermCount,
    shared_required_term_count: asNonNegativeInteger(overlap.shared_required_term_count),
    overlapping_destination_count: asNonNegativeInteger(overlap.overlapping_destination_count),
  });

  return {
    version: `policy_native_intent_change_purpose_preflight.v${POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_VERSION}`,
    evaluatedAt: timestamp.toISOString(),
    commandId: POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_COMMAND_ID,
    expectedRevision: normalizedExpectedRevision,
    currentRevision: revision,
    coverage,
    guidance: buildGuidance(coverage),
    advisory: true,
    commandRetained: false,
    rawConfigurationExposed: false,
    changeAuthorized: false,
    routingAffected: false,
    providerAccessed: false,
    databaseWritten: false,
  };
}

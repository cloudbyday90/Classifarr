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
  POLICY_INTENT_COLLECTIONS,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_ROLES,
} from './policyIntentSchema.mjs';

const POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION =
  'policy.strict_constraint_descriptor.v1';
const MAX_DESCRIPTOR_VALUE_COUNT = 20;
const MAX_DESCRIPTOR_TEXT_LENGTH = 160;
const CONTROL_CHARACTER_REPLACEMENT_PATTERN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/gu;

const POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS = Object.freeze({
  UNSAFE_DESCRIPTOR: 'unsafe_strict_constraint_descriptor',
  UNSUPPORTED_DESCRIPTOR_FIELD: 'unsupported_strict_constraint_descriptor_field',
  UNSUPPORTED_VERSION: 'unsupported_strict_constraint_descriptor_version',
  UNSUPPORTED_SIGNAL_TYPE: 'unsupported_strict_constraint_signal_type',
  INVALID_CONSTRAINT_MODE: 'invalid_strict_constraint_mode',
  INVALID_SEMANTICS: 'invalid_strict_constraint_semantics',
  INVALID_OPERATOR: 'invalid_strict_constraint_operator',
  INVALID_VALUES: 'invalid_strict_constraint_values',
  INCOMPATIBLE_OPERATOR: 'incompatible_strict_constraint_operator',
});

const DESCRIPTOR_FIELD_IDS = Object.freeze([
  'version',
  'signal_type',
  'operator',
  'values',
  'constraint_mode',
  'semantics',
]);
const LIST_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios', 'language']);
const RANGE_SIGNAL_TYPES = new Set(['release_year', 'vote_average']);
const SEMANTICS = new Set(['identity', 'compatibility']);

function isPlainDataRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPlainDataArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function getDataProperty(record, key) {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;

  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .normalize('NFKC')
    .replace(CONTROL_CHARACTER_REPLACEMENT_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, MAX_DESCRIPTOR_TEXT_LENGTH);

  return normalized || null;
}

function normalizeStringList(value) {
  if (!isPlainDataArray(value) || value.length === 0 || value.length > MAX_DESCRIPTOR_VALUE_COUNT) {
    return null;
  }

  const normalized = value.map(normalizeText);
  if (normalized.some(item => !item)) return null;

  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function normalizeFiniteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildIssue(riskId, message, path = '') {
  return { riskId, message, path };
}

function validateValueRecord(values, allowedKeys, issues) {
  if (!isPlainDataRecord(values)) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
      'Strict-constraint descriptor values must be a plain data object.',
      'values'
    ));
    return false;
  }

  let valid = true;
  Object.getOwnPropertyNames(values).forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(values, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.UNSAFE_DESCRIPTOR,
        'Strict-constraint descriptor values must use own data properties.',
        `values.${key}`
      ));
      valid = false;
      return;
    }

    if (!allowedKeys.has(key)) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
        'Strict-constraint descriptor values include an unsupported operator field.',
        `values.${key}`
      ));
      valid = false;
    }
  });

  return valid;
}

function deriveListOperator(values) {
  for (const key of ['require_all', 'require_any', 'exclude']) {
    if (Array.isArray(values[key]) && values[key].length > 0) return key;
  }

  return null;
}

function normalizeListDescriptorValues(values, issues) {
  const allowedKeys = new Set(['require_all', 'require_any', 'exclude']);
  if (!validateValueRecord(values, allowedKeys, issues)) return null;

  const normalized = {};
  for (const key of allowedKeys) {
    const rawValue = getDataProperty(values, key);
    if (rawValue === undefined) continue;

    const normalizedValue = normalizeStringList(rawValue);
    if (!normalizedValue) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
        'List strict constraints require non-empty bounded string arrays.',
        `values.${key}`
      ));
      return null;
    }
    normalized[key] = normalizedValue;
  }

  return deriveListOperator(normalized) ? normalized : null;
}

function normalizeMediaTypeDescriptorValues(values, issues) {
  const allowedKeys = new Set(['require_any', 'include', 'exclude']);
  if (!validateValueRecord(values, allowedKeys, issues)) return null;

  const normalized = {};
  for (const key of allowedKeys) {
    const rawValue = getDataProperty(values, key);
    if (rawValue === undefined) continue;

    const normalizedValue = normalizeStringList(rawValue);
    if (!normalizedValue) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
        'Media-type strict constraints require non-empty bounded string arrays.',
        `values.${key}`
      ));
      return null;
    }
    normalized[key] = normalizedValue;
  }

  if (!Object.values(normalized).some(value => value.length > 0)) return null;
  return normalized;
}

function deriveMediaTypeOperator(values) {
  if (Array.isArray(values.require_any) && values.require_any.length > 0) return 'require_any';
  if (Array.isArray(values.include) && values.include.length > 0) return 'include';
  if (Array.isArray(values.exclude) && values.exclude.length > 0) return 'exclude';
  return null;
}

function normalizeCertificationDescriptorValues(values, issues) {
  const allowedKeys = new Set(['mode', 'include', 'exclude', 'max']);
  if (!validateValueRecord(values, allowedKeys, issues)) return null;

  const mode = normalizeText(getDataProperty(values, 'mode'))?.toLowerCase() || null;
  if (!['include', 'exclude', 'max'].includes(mode)) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
      'Certification strict constraints require an include, exclude, or max mode.',
      'values.mode'
    ));
    return null;
  }

  if (mode === 'include') {
    const include = normalizeStringList(getDataProperty(values, 'include'));
    if (!include || getDataProperty(values, 'exclude') !== undefined || getDataProperty(values, 'max') !== undefined) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
        'Certification include constraints require only a non-empty include list.',
        'values'
      ));
      return null;
    }
    return { mode, include: include.map(value => value.toUpperCase()) };
  }

  if (mode === 'exclude') {
    const exclude = normalizeStringList(getDataProperty(values, 'exclude'));
    if (!exclude || getDataProperty(values, 'include') !== undefined || getDataProperty(values, 'max') !== undefined) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
        'Certification exclusion constraints require only a non-empty exclude list.',
        'values'
      ));
      return null;
    }
    return { mode, exclude: exclude.map(value => value.toUpperCase()) };
  }

  const max = normalizeText(getDataProperty(values, 'max'));
  if (!max || getDataProperty(values, 'include') !== undefined || getDataProperty(values, 'exclude') !== undefined) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
      'Certification maximum constraints require only one bounded maximum rating.',
      'values'
    ));
    return null;
  }
  return { mode, max: max.toUpperCase() };
}

function normalizeRangeDescriptorValues(values, issues) {
  const allowedKeys = new Set(['mode', 'min', 'max']);
  if (!validateValueRecord(values, allowedKeys, issues)) return null;

  const minValue = getDataProperty(values, 'min');
  const maxValue = getDataProperty(values, 'max');
  const modeValue = getDataProperty(values, 'mode');
  const min = minValue === undefined ? null : normalizeFiniteNumber(minValue);
  const max = maxValue === undefined ? null : normalizeFiniteNumber(maxValue);
  const mode = modeValue === undefined ? null : normalizeText(modeValue)?.toLowerCase() || null;

  if ((minValue !== undefined && min === null) || (maxValue !== undefined && max === null) ||
      (modeValue !== undefined && mode !== 'max') ||
      (min === null && max === null) ||
      (min !== null && max !== null && min > max) ||
      (mode === 'max' && (max === null || min !== null))) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
      'Numeric strict constraints require finite ordered bounds; max mode requires only a maximum.',
      'values'
    ));
    return null;
  }

  const normalized = {};
  if (mode) normalized.mode = mode;
  if (min !== null) normalized.min = min;
  if (max !== null) normalized.max = max;
  return normalized;
}

function deriveRangeOperator(values) {
  return values.mode === 'max' && values.max !== undefined ? 'max' : 'range';
}

function normalizeRuntimeDescriptorValues(values, issues) {
  const allowedKeys = new Set(['min_minutes', 'max_minutes']);
  if (!validateValueRecord(values, allowedKeys, issues)) return null;

  const minValue = getDataProperty(values, 'min_minutes');
  const maxValue = getDataProperty(values, 'max_minutes');
  const min = minValue === undefined ? null : normalizeFiniteNumber(minValue);
  const max = maxValue === undefined ? null : normalizeFiniteNumber(maxValue);

  if ((minValue !== undefined && min === null) || (maxValue !== undefined && max === null) ||
      (min === null && max === null) ||
      (min !== null && max !== null && min > max)) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
      'Runtime strict constraints require finite ordered minute bounds.',
      'values'
    ));
    return null;
  }

  const normalized = {};
  if (min !== null) normalized.min_minutes = min;
  if (max !== null) normalized.max_minutes = max;
  return normalized;
}

function normalizeDescriptorValues(signalType, values, issues) {
  if (LIST_SIGNAL_TYPES.has(signalType)) {
    const normalized = normalizeListDescriptorValues(values, issues);
    return {
      values: normalized,
      operator: normalized ? deriveListOperator(normalized) : null,
    };
  }

  if (signalType === 'media_type') {
    const normalized = normalizeMediaTypeDescriptorValues(values, issues);
    return {
      values: normalized,
      operator: normalized ? deriveMediaTypeOperator(normalized) : null,
    };
  }

  if (signalType === 'certifications') {
    const normalized = normalizeCertificationDescriptorValues(values, issues);
    return {
      values: normalized,
      operator: normalized?.mode || null,
    };
  }

  if (RANGE_SIGNAL_TYPES.has(signalType)) {
    const normalized = normalizeRangeDescriptorValues(values, issues);
    return {
      values: normalized,
      operator: normalized ? deriveRangeOperator(normalized) : null,
    };
  }

  if (signalType === 'runtime') {
    const normalized = normalizeRuntimeDescriptorValues(values, issues);
    return {
      values: normalized,
      operator: normalized ? 'runtime_range' : null,
    };
  }

  return { values: null, operator: null };
}

function validateDescriptorShape(descriptor, issues) {
  if (!isPlainDataRecord(descriptor)) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.UNSAFE_DESCRIPTOR,
      'Strict-constraint descriptors must be plain data objects.',
      ''
    ));
    return false;
  }

  let valid = true;
  Object.getOwnPropertyNames(descriptor).forEach(key => {
    const property = Object.getOwnPropertyDescriptor(descriptor, key);
    if (!property || !Object.prototype.hasOwnProperty.call(property, 'value')) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.UNSAFE_DESCRIPTOR,
        'Strict-constraint descriptors must use own data properties.',
        key
      ));
      valid = false;
      return;
    }

    if (!DESCRIPTOR_FIELD_IDS.includes(key)) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.UNSUPPORTED_DESCRIPTOR_FIELD,
        'Strict-constraint descriptors may only contain the versioned native-rule fields.',
        key
      ));
      valid = false;
    }
  });

  return valid;
}

function buildPolicyStrictConstraintDescriptor(value = {}) {
  const issues = [];
  if (!validateDescriptorShape(value, issues)) {
    return { ok: false, issueCount: issues.length, issues, descriptor: null };
  }

  const version = getDataProperty(value, 'version');
  const signalType = normalizeText(getDataProperty(value, 'signal_type'))?.toLowerCase() || null;
  const operator = normalizeText(getDataProperty(value, 'operator'))?.toLowerCase() || null;
  const constraintMode = normalizeText(getDataProperty(value, 'constraint_mode'))?.toLowerCase() || null;
  const semantics = normalizeText(getDataProperty(value, 'semantics'))?.toLowerCase() || null;

  if (version !== POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.UNSUPPORTED_VERSION,
      `Strict-constraint descriptors must use ${POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION}.`,
      'version'
    ));
  }
  if (!signalType || ![
    ...LIST_SIGNAL_TYPES,
    'media_type',
    'certifications',
    ...RANGE_SIGNAL_TYPES,
    'runtime',
  ].includes(signalType)) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.UNSUPPORTED_SIGNAL_TYPE,
      'Strict-constraint descriptor signal type is not supported by the runtime evaluator.',
      'signal_type'
    ));
  }
  if (constraintMode !== 'strict') {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_CONSTRAINT_MODE,
      'Strict-constraint descriptors must declare strict constraint mode.',
      'constraint_mode'
    ));
  }
  if (!semantics || !SEMANTICS.has(semantics)) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_SEMANTICS,
      'Strict-constraint descriptors must declare identity or compatibility semantics.',
      'semantics'
    ));
  }

  if (issues.length > 0) {
    return { ok: false, issueCount: issues.length, issues, descriptor: null };
  }

  const normalizedValues = normalizeDescriptorValues(
    signalType,
    getDataProperty(value, 'values'),
    issues
  );
  if (!normalizedValues.values) {
    if (issues.length === 0) {
      issues.push(buildIssue(
        POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INVALID_VALUES,
        'Strict-constraint descriptor values must produce an executable evaluator configuration.',
        'values'
      ));
    }
    return { ok: false, issueCount: issues.length, issues, descriptor: null };
  }

  if (!operator || operator !== normalizedValues.operator) {
    issues.push(buildIssue(
      POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS.INCOMPATIBLE_OPERATOR,
      'Strict-constraint descriptor operator must match the declared executable values.',
      'operator'
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    descriptor: issues.length === 0
      ? {
        version: POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION,
        signal_type: signalType,
        operator,
        values: normalizedValues.values,
        constraint_mode: 'strict',
        semantics,
      }
      : null,
  };
}

function buildPolicyStrictConstraintDescriptorFromNativeRule(rule = {}) {
  if (!isPlainDataRecord(rule)) {
    return buildPolicyStrictConstraintDescriptor(rule);
  }

  return buildPolicyStrictConstraintDescriptor({
    version: POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION,
    signal_type: getDataProperty(rule, 'signal_type'),
    operator: getDataProperty(rule, 'operator'),
    values: getDataProperty(rule, 'values'),
    constraint_mode: getDataProperty(rule, 'constraint_mode'),
    semantics: getDataProperty(rule, 'semantics'),
  });
}

function buildNativeHardLimitRuleFromStrictConstraintDescriptor(descriptor = {}) {
  const result = buildPolicyStrictConstraintDescriptor(descriptor);
  if (!result.ok || !result.descriptor) return result;

  return {
    ...result,
    rule: {
      intent_role: POLICY_INTENT_ROLES.HARD_LIMIT,
      collection: POLICY_INTENT_COLLECTIONS.HARD_LIMITS,
      signal_type: result.descriptor.signal_type,
      operator: result.descriptor.operator,
      values: result.descriptor.values,
      constraint_mode: result.descriptor.constraint_mode,
      semantics: result.descriptor.semantics,
      source: 'library_rebuild',
      inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    },
  };
}

export {
  MAX_DESCRIPTOR_TEXT_LENGTH,
  MAX_DESCRIPTOR_VALUE_COUNT,
  POLICY_STRICT_CONSTRAINT_DESCRIPTOR_RISK_IDS,
  POLICY_STRICT_CONSTRAINT_DESCRIPTOR_VERSION,
  buildNativeHardLimitRuleFromStrictConstraintDescriptor,
  buildPolicyStrictConstraintDescriptor,
  buildPolicyStrictConstraintDescriptorFromNativeRule,
};

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { mergePresetSignals, normalizeSignalConfig } from '../utils/policySignals.mjs';
import {
  getCertificationOrder,
  keywordMatchesTerm,
  parseFiniteNumber,
} from './policyEngineUtils.mjs';

export const POLICY_CONSTRAINT_MODES = Object.freeze({
  ADVISORY: 'advisory',
  STRICT: 'strict',
});

export const POLICY_CONSTRAINT_OUTCOMES = Object.freeze({
  PASS: 'pass',
  FAIL: 'fail',
  UNKNOWN: 'unknown',
  NOT_APPLICABLE: 'not_applicable',
});

const STRICT_ALIASES = new Set(['strict', 'hard', 'required', 'require', 'exclude', 'block']);
const ADVISORY_ALIASES = new Set(['advisory', 'soft', 'score', 'scoring', 'boost']);

const LIST_SIGNAL_TYPES = new Set(['genres', 'keywords', 'studios', 'language']);

function asList(value) {
  return Array.isArray(value) ? value.filter(item => item !== null && item !== undefined) : [];
}

function normalizeTerm(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeList(value) {
  return asList(value).map(normalizeTerm).filter(Boolean);
}

function hasValues(value) {
  return Array.isArray(value) && value.length > 0;
}

function normalizeConstraintModeValue(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (STRICT_ALIASES.has(normalized)) {
    return POLICY_CONSTRAINT_MODES.STRICT;
  }
  if (ADVISORY_ALIASES.has(normalized)) {
    return POLICY_CONSTRAINT_MODES.ADVISORY;
  }
  return null;
}

export function normalizePolicyConstraintModeInput(value) {
  return normalizeConstraintModeValue(value);
}

export function normalizePolicyConstraintMode(config = {}) {
  const normalized = normalizeSignalConfig(config) || {};
  const explicit = normalizeConstraintModeValue(normalized.constraint_mode)
    || normalizeConstraintModeValue(normalized.constraint)
    || normalizeConstraintModeValue(normalized.runtime_mode)
    || normalizeConstraintModeValue(normalized.runtime);

  if (explicit) {
    return explicit;
  }

  return normalized.strict === true
    ? POLICY_CONSTRAINT_MODES.STRICT
    : POLICY_CONSTRAINT_MODES.ADVISORY;
}

function buildResult(signalType, mode, outcome, details = {}) {
  return {
    signal_type: signalType,
    mode,
    outcome,
    reason_code: details.reasonCode || null,
    expected: details.expected || null,
    actual: details.actual ?? null,
  };
}

function getItemListForSignal(signalType, item = {}) {
  if (signalType === 'genres') {
    return normalizeMetadataListLower(item.genres);
  }

  if (signalType === 'keywords') {
    return normalizeMetadataListLower(item.keywords);
  }

  if (signalType === 'studios') {
    const studios = item.studios || item.production_companies || [];
    let parsed = studios;
    if (typeof studios === 'string') {
      try {
        parsed = JSON.parse(studios);
      } catch (_error) {
        parsed = [];
      }
    }
    return asList(parsed)
      .map(entry => normalizeTerm(typeof entry === 'string' ? entry : entry?.name))
      .filter(Boolean);
  }

  if (signalType === 'language') {
    const language = normalizeTerm(item.original_language);
    return language ? [language] : [];
  }

  return [];
}

function evaluateListConstraint(signalType, config, item, mode) {
  const values = getItemListForSignal(signalType, item);
  const requireAll = normalizeList(config.require_all);
  const requireAny = normalizeList(config.require_any);
  const exclude = normalizeList(config.exclude);

  if (!hasValues(requireAll) && !hasValues(requireAny) && !hasValues(exclude)) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.NOT_APPLICABLE);
  }

  if (!hasValues(values)) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.UNKNOWN, {
      reasonCode: `${signalType}_missing`,
      expected: { require_all: requireAll, require_any: requireAny, exclude },
      actual: [],
    });
  }

  if (hasValues(requireAll)) {
    const missing = requireAll.filter(value => !values.includes(value));
    if (missing.length > 0) {
      return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
        reasonCode: `${signalType}_require_all_mismatch`,
        expected: { require_all: requireAll },
        actual: values,
      });
    }
  }

  if (hasValues(requireAny) && !requireAny.some(value => values.includes(value))) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: `${signalType}_require_any_mismatch`,
      expected: { require_any: requireAny },
      actual: values,
    });
  }

  const excluded = exclude.filter(value => values.includes(value));
  if (excluded.length > 0) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: `${signalType}_excluded`,
      expected: { exclude },
      actual: values,
    });
  }

  return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.PASS, {
    expected: { require_all: requireAll, require_any: requireAny, exclude },
    actual: values,
  });
}

function evaluateKeywordConstraint(config, item, mode) {
  const keywords = normalizeMetadataListLower(item.keywords);
  const searchableText = [item.overview, item.title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const requireAll = normalizeList(config.require_all);
  const requireAny = normalizeList(config.require_any);
  const exclude = normalizeList(config.exclude);

  if (!hasValues(requireAll) && !hasValues(requireAny) && !hasValues(exclude)) {
    return buildResult('keywords', mode, POLICY_CONSTRAINT_OUTCOMES.NOT_APPLICABLE);
  }

  const matches = (term) => keywordMatchesTerm(term, keywords, searchableText);

  if (hasValues(requireAll)) {
    const missing = requireAll.filter(term => !matches(term));
    if (missing.length > 0) {
      return buildResult('keywords', mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
        reasonCode: 'keywords_require_all_mismatch',
        expected: { require_all: requireAll },
        actual: keywords,
      });
    }
  }

  if (hasValues(requireAny) && !requireAny.some(matches)) {
    return buildResult('keywords', mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: 'keywords_require_any_mismatch',
      expected: { require_any: requireAny },
      actual: keywords,
    });
  }

  const excluded = exclude.filter(matches);
  if (excluded.length > 0) {
    return buildResult('keywords', mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: 'keywords_excluded',
      expected: { exclude },
      actual: keywords,
    });
  }

  return buildResult('keywords', mode, POLICY_CONSTRAINT_OUTCOMES.PASS, {
    expected: { require_all: requireAll, require_any: requireAny, exclude },
    actual: keywords,
  });
}

function evaluateMediaTypeConstraint(config, item, mode) {
  const include = normalizeList(config.include || config.require_any);
  const exclude = normalizeList(config.exclude);
  const actual = normalizeTerm(item.media_type);

  if (!hasValues(include) && !hasValues(exclude)) {
    return buildResult('media_type', mode, POLICY_CONSTRAINT_OUTCOMES.NOT_APPLICABLE);
  }

  if (!actual) {
    return buildResult('media_type', mode, POLICY_CONSTRAINT_OUTCOMES.UNKNOWN, {
      reasonCode: 'media_type_missing',
      expected: { include, exclude },
      actual: null,
    });
  }

  if (hasValues(include) && !include.includes(actual)) {
    return buildResult('media_type', mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: 'media_type_include_mismatch',
      expected: { include },
      actual,
    });
  }

  if (exclude.includes(actual)) {
    return buildResult('media_type', mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: 'media_type_excluded',
      expected: { exclude },
      actual,
    });
  }

  return buildResult('media_type', mode, POLICY_CONSTRAINT_OUTCOMES.PASS, {
    expected: { include, exclude },
    actual,
  });
}

function evaluateCertificationConstraint(config, item, mode) {
  const actual = String(item.certification || '').trim().toUpperCase();
  const include = asList(config.include).map(value => String(value).trim().toUpperCase()).filter(Boolean);
  const exclude = asList(config.exclude).map(value => String(value).trim().toUpperCase()).filter(Boolean);
  const max = typeof config.max === 'string' ? config.max.trim().toUpperCase() : null;

  if (config.mode !== 'include' && config.mode !== 'exclude' && config.mode !== 'max') {
    return buildResult('certifications', mode, POLICY_CONSTRAINT_OUTCOMES.NOT_APPLICABLE);
  }

  if (!actual) {
    return buildResult('certifications', mode, POLICY_CONSTRAINT_OUTCOMES.UNKNOWN, {
      reasonCode: 'certification_missing',
      expected: { mode: config.mode, include, exclude, max },
      actual: null,
    });
  }

  if (config.mode === 'include' && hasValues(include) && !include.includes(actual)) {
    return buildResult('certifications', mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: 'certification_include_mismatch',
      expected: { include },
      actual,
    });
  }

  if (config.mode === 'exclude' && exclude.includes(actual)) {
    return buildResult('certifications', mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: 'certification_excluded',
      expected: { exclude },
      actual,
    });
  }

  if (config.mode === 'max' && max) {
    const order = getCertificationOrder(max);
    const actualOrder = getCertificationOrder(actual);
    if (order && actualOrder && order === actualOrder && order.indexOf(actual) > order.indexOf(max)) {
      return buildResult('certifications', mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
        reasonCode: 'certification_above_max',
        expected: { max },
        actual,
      });
    }
  }

  return buildResult('certifications', mode, POLICY_CONSTRAINT_OUTCOMES.PASS, {
    expected: { mode: config.mode, include, exclude, max },
    actual,
  });
}

function evaluateRangeConstraint(signalType, config, item, mode, itemKeys, minKey = 'min', maxKey = 'max') {
  const min = parseFiniteNumber(config[minKey]);
  const max = parseFiniteNumber(config[maxKey]);
  const actual = itemKeys
    .map(key => parseFiniteNumber(item[key]))
    .find(value => value !== null) ?? null;

  if (min === null && max === null) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.NOT_APPLICABLE);
  }

  if (actual === null) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.UNKNOWN, {
      reasonCode: `${signalType}_missing`,
      expected: { [minKey]: min, [maxKey]: max },
      actual: null,
    });
  }

  if (min !== null && actual < min) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: `${signalType}_below_min`,
      expected: { [minKey]: min },
      actual,
    });
  }

  if (max !== null && actual > max) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.FAIL, {
      reasonCode: `${signalType}_above_max`,
      expected: { [maxKey]: max },
      actual,
    });
  }

  return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.PASS, {
    expected: { [minKey]: min, [maxKey]: max },
    actual,
  });
}

export function evaluateSignalConstraint(signalType, rawConfig, item = {}) {
  const config = normalizeSignalConfig(rawConfig) || {};
  const mode = normalizePolicyConstraintMode(config);

  if (mode !== POLICY_CONSTRAINT_MODES.STRICT) {
    return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.NOT_APPLICABLE);
  }

  if (signalType === 'keywords') {
    return evaluateKeywordConstraint(config, item, mode);
  }

  if (LIST_SIGNAL_TYPES.has(signalType)) {
    return evaluateListConstraint(signalType, config, item, mode);
  }

  if (signalType === 'media_type') {
    return evaluateMediaTypeConstraint(config, item, mode);
  }

  if (signalType === 'certifications') {
    return evaluateCertificationConstraint(config, item, mode);
  }

  if (signalType === 'release_year') {
    return evaluateRangeConstraint('release_year', config, item, mode, ['year', 'release_year']);
  }

  if (signalType === 'vote_average') {
    return evaluateRangeConstraint('vote_average', config, item, mode, ['rating', 'vote_average']);
  }

  if (signalType === 'runtime') {
    return evaluateRangeConstraint('runtime', config, item, mode, ['runtime'], 'min_minutes', 'max_minutes');
  }

  return buildResult(signalType, mode, POLICY_CONSTRAINT_OUTCOMES.NOT_APPLICABLE);
}

export function evaluatePolicyConstraints(policy = {}, item = {}) {
  const evaluations = [];

  for (const preset of policy.presets || []) {
    const mergedSignals = mergePresetSignals(
      normalizeSignalConfig(preset.signals),
      normalizeSignalConfig(preset.custom_signals)
    );

    for (const [signalType, config] of Object.entries(mergedSignals || {})) {
      const evaluation = evaluateSignalConstraint(signalType, config, item);
      if (evaluation.mode === POLICY_CONSTRAINT_MODES.STRICT) {
        evaluations.push(evaluation);
      }
    }
  }

  const conflicts = evaluations.filter(evaluation => evaluation.outcome === POLICY_CONSTRAINT_OUTCOMES.FAIL);
  const unknown = evaluations.filter(evaluation => evaluation.outcome === POLICY_CONSTRAINT_OUTCOMES.UNKNOWN);
  const passed = evaluations.filter(evaluation => evaluation.outcome === POLICY_CONSTRAINT_OUTCOMES.PASS);

  return {
    schema_version: 1,
    policy_id: policy.id ?? null,
    library_id: policy.library_id ?? null,
    failed: conflicts.length > 0,
    evaluated_count: evaluations.length,
    passed_count: passed.length,
    unknown_count: unknown.length,
    conflict_count: conflicts.length,
    conflicts,
    unknown,
  };
}

export function hasPolicyConstraintFailure(report = null) {
  return report?.failed === true;
}

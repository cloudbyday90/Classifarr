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
  SIGNAL_SEMANTICS,
  hasAffirmativeSignalConstraints,
  mergePresetSignals,
  normalizeSignalConfig,
  resolveSignalSemantics,
} from '../utils/policySignals.mjs';
import {
  POLICY_CONSTRAINT_MODES,
  normalizePolicyConstraintMode,
} from './policyConstraintSemantics.mjs';

export const POLICY_CONFIGURATION_VIEW_SCHEMA_VERSION = 1;

const ROLE_NAMES = Object.freeze({
  IDENTITY: 'identity',
  COMPATIBILITY: 'compatibility',
  STRICT_CONSTRAINT: 'strict_constraint',
  BOOSTER: 'booster',
  EXCLUSION: 'exclusion',
});

const SIGNAL_VALUE_KEYS = [
  'require_all',
  'require_any',
  'prefer',
  'include',
  'exclude',
  'mode',
  'max',
  'min',
  'min_minutes',
  'max_minutes',
];

function asObject(value) {
  const normalized = normalizeSignalConfig(value);
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? normalized
    : {};
}

function hasConfiguredList(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasConfiguredScalar(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function hasExclusionSignal(config) {
  return hasConfiguredList(config?.exclude);
}

function hasPreferenceOnlySignal(config) {
  return hasConfiguredList(config?.prefer)
    && !hasConfiguredList(config?.require_all)
    && !hasConfiguredList(config?.require_any)
    && !hasConfiguredList(config?.include);
}

function hasAnySignalConstraint(signalType, config) {
  return hasAffirmativeSignalConstraints(config, signalType)
    || hasExclusionSignal(config);
}

function pickSignalValues(config = {}) {
  return SIGNAL_VALUE_KEYS.reduce((values, key) => {
    const value = config[key];
    if (Array.isArray(value)) {
      if (value.length > 0) {
        values[key] = value;
      }
      return values;
    }

    if (hasConfiguredScalar(value)) {
      values[key] = value;
    }

    return values;
  }, {});
}

function resolveSignalRole(signalType, config = {}) {
  const constraintMode = normalizePolicyConstraintMode(config);
  const hasConstraint = hasAnySignalConstraint(signalType, config);

  if (constraintMode === POLICY_CONSTRAINT_MODES.STRICT && hasConstraint) {
    return ROLE_NAMES.STRICT_CONSTRAINT;
  }

  if (hasExclusionSignal(config)) {
    return ROLE_NAMES.EXCLUSION;
  }

  if (hasPreferenceOnlySignal(config)) {
    return ROLE_NAMES.BOOSTER;
  }

  if (!hasAffirmativeSignalConstraints(config, signalType)) {
    return null;
  }

  const semantics = resolveSignalSemantics(signalType, config);
  return semantics === SIGNAL_SEMANTICS.IDENTITY
    ? ROLE_NAMES.IDENTITY
    : ROLE_NAMES.COMPATIBILITY;
}

function roleToBucket(role) {
  switch (role) {
    case ROLE_NAMES.IDENTITY:
      return 'identity_signals';
    case ROLE_NAMES.COMPATIBILITY:
      return 'compatibility_signals';
    case ROLE_NAMES.STRICT_CONSTRAINT:
      return 'strict_constraints';
    case ROLE_NAMES.BOOSTER:
      return 'boosters';
    case ROLE_NAMES.EXCLUSION:
      return 'exclusions';
    default:
      return null;
  }
}

function resolveSignalSource(signalType, baseSignals, customSignals) {
  const hasBase = Object.prototype.hasOwnProperty.call(baseSignals, signalType);
  const hasCustom = Object.prototype.hasOwnProperty.call(customSignals, signalType);

  if (hasBase && hasCustom) return 'merged';
  if (hasCustom) return 'custom';
  return 'base';
}

function buildSignalEntry(preset, signalType, config, baseSignals, customSignals) {
  const role = resolveSignalRole(signalType, config);
  if (!role) {
    return null;
  }

  return {
    role,
    signal_type: signalType,
    semantics: resolveSignalSemantics(signalType, config),
    constraint_mode: normalizePolicyConstraintMode(config),
    source: resolveSignalSource(signalType, baseSignals, customSignals),
    preset_id: preset?.preset_id ?? preset?.id ?? null,
    preset_key: preset?.key ?? null,
    preset_name: preset?.name ?? preset?.display_name ?? null,
    preset_weight: Number.isFinite(Number(preset?.weight)) ? Number(preset.weight) : 1,
    values: pickSignalValues(config),
  };
}

function buildWarnings(view) {
  const warnings = [];

  if (view.identity_signals.length === 0 && view.presets.length > 0) {
    warnings.push({
      reason_code: 'no_identity_signals',
      summary: 'Policy presets contain no identity-establishing signals; classification should rely on corroborating evidence.',
    });
  }

  if (view.strict_constraints.length === 0 && view.exclusions.length > 0) {
    warnings.push({
      reason_code: 'advisory_exclusions_only',
      summary: 'Policy exclusions are advisory unless a strict constraint mode is configured.',
    });
  }

  return warnings;
}

function summarize(view, policy) {
  return {
    schema_version: POLICY_CONFIGURATION_VIEW_SCHEMA_VERSION,
    policy_id: policy?.id ?? null,
    library_id: policy?.library_id ?? null,
    library_name: policy?.library_name ?? null,
    library_media_type: policy?.library_media_type ?? null,
    preset_count: view.presets.length,
    counts: {
      identity_signals: view.identity_signals.length,
      compatibility_signals: view.compatibility_signals.length,
      strict_constraints: view.strict_constraints.length,
      boosters: view.boosters.length,
      exclusions: view.exclusions.length,
      warnings: view.warnings.length,
    },
    intent_model: [
      'identity_signals',
      'compatibility_signals',
      'strict_constraints',
      'boosters',
      'exclusions',
    ],
  };
}

export function buildPolicyConfigurationView(policy = {}) {
  const view = {
    schema_version: POLICY_CONFIGURATION_VIEW_SCHEMA_VERSION,
    policy_id: policy?.id ?? null,
    library_id: policy?.library_id ?? null,
    presets: [],
    identity_signals: [],
    compatibility_signals: [],
    strict_constraints: [],
    boosters: [],
    exclusions: [],
    warnings: [],
    summary: null,
  };

  for (const preset of policy?.presets || []) {
    const baseSignals = asObject(preset?.signals);
    const customSignals = asObject(preset?.custom_signals ?? preset?.customSignals);
    const mergedSignals = mergePresetSignals(baseSignals, customSignals);
    const signalEntries = [];

    for (const [signalType, rawConfig] of Object.entries(mergedSignals)) {
      const config = asObject(rawConfig);
      const entry = buildSignalEntry(preset, signalType, config, baseSignals, customSignals);
      if (!entry) {
        continue;
      }

      signalEntries.push(entry);
      const bucket = roleToBucket(entry.role);
      if (bucket) {
        view[bucket].push(entry);
      }
    }

    view.presets.push({
      preset_id: preset?.preset_id ?? preset?.id ?? null,
      preset_key: preset?.key ?? null,
      preset_name: preset?.name ?? preset?.display_name ?? null,
      source: preset?.source ?? null,
      weight: Number.isFinite(Number(preset?.weight)) ? Number(preset.weight) : 1,
      signal_count: signalEntries.length,
      signals: signalEntries,
    });
  }

  view.warnings = buildWarnings(view);
  view.summary = summarize(view, policy);

  return view;
}

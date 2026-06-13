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
  mergePresetSignals,
  normalizeSignalConfig,
} from '../utils/policySignals.mjs';
import { buildPolicyConfigurationView } from './policyConfigurationView.mjs';

export const POLICY_INTENT_CONTRACT_SCHEMA_VERSION = 1;

export const POLICY_INTENT_SOURCES = Object.freeze({
  EMPTY: 'empty',
  LEGACY_PRESETS: 'legacy_presets',
});

export const POLICY_INTENT_INFERENCE_STATES = Object.freeze({
  EMPTY: 'empty',
  INFERRED: 'inferred',
  PARTIAL: 'partial',
});

const SUPPORTED_SIGNAL_TYPES = new Set([
  'genres',
  'keywords',
  'studios',
  'language',
  'media_type',
  'certifications',
  'release_year',
  'vote_average',
  'runtime',
]);

const SUPPORTED_SIGNAL_KEYS = new Set([
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
  'strict',
  'semantics',
  'constraint_mode',
  'constraint',
  'runtime_mode',
  'runtime',
  'weight',
]);

function asObject(value) {
  const normalized = normalizeSignalConfig(value);
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? normalized
    : {};
}

function hasConfiguredValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function deriveOperator(values = {}) {
  for (const key of ['require_all', 'require_any', 'prefer', 'include', 'exclude']) {
    if (hasConfiguredValue(values[key])) {
      return key;
    }
  }

  if (values.mode === 'max' && hasConfiguredValue(values.max)) {
    return 'max';
  }

  if (hasConfiguredValue(values.min) || hasConfiguredValue(values.max)) {
    return 'range';
  }

  if (hasConfiguredValue(values.min_minutes) || hasConfiguredValue(values.max_minutes)) {
    return 'runtime_range';
  }

  return 'configured';
}

function contractEntryFromConfigurationEntry(entry, intentRole) {
  return {
    intent_role: intentRole,
    signal_type: entry.signal_type,
    operator: deriveOperator(entry.values),
    values: entry.values || {},
    constraint_mode: entry.constraint_mode,
    semantics: entry.semantics,
    source: entry.source,
    inference_state: POLICY_INTENT_INFERENCE_STATES.INFERRED,
    preset_id: entry.preset_id,
    preset_key: entry.preset_key,
    preset_name: entry.preset_name,
    preset_weight: entry.preset_weight,
  };
}

function mapConfigurationViewToIntent(configurationView = {}) {
  return {
    purpose: (configurationView.identity_signals || [])
      .map((entry) => contractEntryFromConfigurationEntry(entry, 'purpose')),
    hard_limits: (configurationView.strict_constraints || [])
      .map((entry) => contractEntryFromConfigurationEntry(entry, 'hard_limit')),
    helpful_hints: [
      ...(configurationView.compatibility_signals || [])
        .map((entry) => contractEntryFromConfigurationEntry(entry, 'helpful_hint')),
      ...(configurationView.boosters || [])
        .map((entry) => contractEntryFromConfigurationEntry(entry, 'helpful_hint')),
    ],
    avoid: (configurationView.exclusions || [])
      .map((entry) => contractEntryFromConfigurationEntry(entry, 'avoid')),
  };
}

function buildTemplateLinks(configurationView = {}) {
  return (configurationView.presets || []).map((preset) => ({
    preset_id: preset.preset_id,
    preset_key: preset.preset_key,
    preset_name: preset.preset_name,
    source: preset.source,
    weight: preset.weight,
    signal_count: preset.signal_count,
    link_state: 'attached',
  }));
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

function warningFromConfigurationWarning(warning = {}) {
  return {
    reason_code: warning.reason_code || 'configuration_warning',
    severity: 'warning',
    summary: warning.summary || 'Policy configuration should be reviewed.',
  };
}

function scanUnsupportedSignals(policy = {}) {
  const unsupportedSignals = [];

  for (const preset of policy.presets || []) {
    const baseSignals = asObject(preset?.signals);
    const customSignals = asObject(preset?.custom_signals ?? preset?.customSignals);
    const mergedSignals = mergePresetSignals(baseSignals, customSignals);

    for (const [signalType, config] of Object.entries(mergedSignals)) {
      const normalizedConfig = asObject(config);
      const unsupportedKeys = Object.keys(normalizedConfig)
        .filter((key) => !SUPPORTED_SIGNAL_KEYS.has(key));

      if (!SUPPORTED_SIGNAL_TYPES.has(signalType) || unsupportedKeys.length > 0) {
        unsupportedSignals.push({
          preset_id: preset?.preset_id ?? preset?.id ?? null,
          preset_key: preset?.key ?? null,
          preset_name: preset?.name ?? preset?.display_name ?? null,
          signal_type: signalType,
          reason_code: SUPPORTED_SIGNAL_TYPES.has(signalType)
            ? 'unsupported_signal_keys'
            : 'unsupported_signal_type',
          unsupported_keys: unsupportedKeys,
        });
      }
    }
  }

  return unsupportedSignals;
}

function buildWarnings(configurationView, unsupportedSignals) {
  const warnings = (configurationView.warnings || []).map(warningFromConfigurationWarning);

  if (unsupportedSignals.length > 0) {
    warnings.push({
      reason_code: 'legacy_preset_partial_inference',
      severity: 'warning',
      summary: 'Some legacy preset signals could not be represented cleanly in the intent contract.',
      count: unsupportedSignals.length,
    });
  }

  return warnings;
}

function inferSource(policy = {}) {
  return (policy.presets || []).length > 0
    ? POLICY_INTENT_SOURCES.LEGACY_PRESETS
    : POLICY_INTENT_SOURCES.EMPTY;
}

function inferState(source, unsupportedSignals) {
  if (source === POLICY_INTENT_SOURCES.EMPTY) {
    return POLICY_INTENT_INFERENCE_STATES.EMPTY;
  }

  return unsupportedSignals.length > 0
    ? POLICY_INTENT_INFERENCE_STATES.PARTIAL
    : POLICY_INTENT_INFERENCE_STATES.INFERRED;
}

function buildModelMetadata(source) {
  return {
    mode: source === POLICY_INTENT_SOURCES.LEGACY_PRESETS
      ? 'legacy_presets'
      : 'empty',
    intent_supported: true,
    native_intent: false,
    conversion_available: false,
  };
}

export function buildPolicyIntentContract(policy = {}, options = {}) {
  const configurationView = options.configurationView || policy.configuration_view || buildPolicyConfigurationView(policy);
  const source = inferSource(policy);
  const unsupported_signals = scanUnsupportedSignals(policy);
  const inference_state = inferState(source, unsupported_signals);
  const intent = mapConfigurationViewToIntent(configurationView);
  const warnings = buildWarnings(configurationView, unsupported_signals);

  return {
    schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: policy?.id ?? null,
    library_id: policy?.library_id ?? null,
    library_name: policy?.library_name ?? null,
    library_media_type: policy?.library_media_type ?? null,
    source,
    inference_state,
    model: buildModelMetadata(source),
    purpose: intent.purpose,
    hard_limits: intent.hard_limits,
    helpful_hints: intent.helpful_hints,
    avoid: intent.avoid,
    review_behavior: buildReviewBehavior(policy),
    template_links: buildTemplateLinks(configurationView),
    warnings,
    unsupported_signals,
  };
}

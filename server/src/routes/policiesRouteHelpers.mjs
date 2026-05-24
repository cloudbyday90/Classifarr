/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeSignalSemantics } from '../utils/policySignals.mjs';

export const validCombinationModes = new Set(['best_match', 'average', 'weighted_average', 'require_all']);

export const suggestionStopwords = new Set([
  'a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to', 'with',
  'library', 'libraries', 'media', 'content',
]);

export function tokenizeSuggestionText(value) {
  return Array.from(new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 2)
      .filter((token) => !suggestionStopwords.has(token)),
  ));
}

export function compactSuggestionText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function countTokenOverlap(leftTokens, rightTokens) {
  const right = new Set(rightTokens);
  return leftTokens.filter((token) => right.has(token)).length;
}

export function sanitizeCustomSignals(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const cloned = JSON.parse(JSON.stringify(value));

  for (const [signalType, config] of Object.entries(cloned)) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(config, 'strict')) {
      config.strict = config.strict === true;
    }

    if (Object.prototype.hasOwnProperty.call(config, 'semantics')) {
      const normalizedSemantics = normalizeSignalSemantics(config.semantics);
      if (normalizedSemantics) {
        config.semantics = normalizedSemantics;
      } else {
        delete config.semantics;
      }
    }

    cloned[signalType] = config;
  }

  return cloned;
}

export function normalizePresetAttachmentWeight(value) {
  if (value === undefined || value === null) {
    return 1.0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

export function normalizePresetAttachmentInput(preset = {}) {
  return {
    preset_id: preset?.preset_id ?? preset?.id ?? null,
    weight: normalizePresetAttachmentWeight(preset?.weight),
    customSignals: sanitizeCustomSignals(preset?.customSignals ?? preset?.custom_signals),
  };
}

export function normalizePresetAttachmentInputs(presets) {
  return Array.isArray(presets) ? presets.map(normalizePresetAttachmentInput) : [];
}

export function validateWeightRange(value, label) {
  if (value !== undefined && (value < 0 || value > 1)) {
    return `${label} must be between 0 and 1`;
  }
  return null;
}

export function validatePresetAttachmentWeight(value, label = 'preset weight') {
  if (!Number.isFinite(value) || value <= 0) {
    return `${label} must be a positive number`;
  }
  return null;
}

export function validatePresetAttachmentWeights(presets, labelPrefix = 'preset') {
  for (let index = 0; index < presets.length; index += 1) {
    const preset = presets[index];
    const error = validatePresetAttachmentWeight(preset.weight, `${labelPrefix}[${index}].weight`);
    if (error) {
      return error;
    }
  }
  return null;
}

export function validateCombinationMode(mode) {
  if (mode !== undefined && !validCombinationModes.has(mode)) {
    return `combination_mode must be one of: ${Array.from(validCombinationModes).join(', ')}`;
  }
  return null;
}

export function validatePolicyThresholdPayload(thresholds, validatePolicyDecisionThresholds) {
  const validation = validatePolicyDecisionThresholds(thresholds);
  return validation.isValid ? null : validation.errors[0];
}

export function buildMergedWeightSet(existingPolicy = {}, overrides = {}) {
  return {
    preset_weight: overrides.preset_weight ?? existingPolicy.preset_weight,
    profile_weight: overrides.profile_weight ?? existingPolicy.profile_weight,
    pattern_weight: overrides.pattern_weight ?? existingPolicy.pattern_weight,
    rag_weight: overrides.rag_weight ?? existingPolicy.rag_weight,
    history_weight: overrides.history_weight ?? existingPolicy.history_weight,
  };
}

export function validateWeightSum(weights) {
  const totalWeight = Number(weights.preset_weight || 0)
    + Number(weights.profile_weight || 0)
    + Number(weights.pattern_weight || 0)
    + Number(weights.rag_weight || 0)
    + Number(weights.history_weight || 0);

  if (Math.abs(totalWeight - 1.0) > 0.001) {
    return `Weights must sum to 1.0 (currently ${totalWeight.toFixed(3)})`;
  }

  return null;
}

export function annotatePresetAttachment(preset, normalizeSignalConfig, describePresetRuntimeSemantics) {
  const baseSignals = normalizeSignalConfig(preset?.signals) || {};
  const customSignals = sanitizeCustomSignals(preset?.custom_signals ?? preset?.customSignals) || null;

  return {
    ...preset,
    source: preset?.source || (preset?.is_system === false ? 'custom' : 'builtin'),
    custom_signals: customSignals,
    customSignals,
    runtime_semantics: describePresetRuntimeSemantics(baseSignals, customSignals),
  };
}

export function isLegacyIncompatibleAttachment(preset) {
  return preset?.runtime_semantics?.migration_state === 'advisory_defaulted'
    && preset?.runtime_semantics?.review_recommended === true;
}

export async function fetchPolicyPresetAttachments(db, policyId = null, normalizeSignalConfig, describePresetRuntimeSemantics) {
  const params = [];
  let whereClause = '';

  if (policyId) {
    params.push(policyId);
    whereClause = 'WHERE pp.policy_id = $1';
  }

  const result = await db.query(`
    SELECT 
      lp.id as policy_id,
      lp.name as policy_name,
      l.id as library_id,
      l.name as library_name,
      cp.*,
      pp.weight,
      pp.custom_signals
    FROM policy_presets pp
    JOIN library_policies lp ON pp.policy_id = lp.id
    JOIN libraries l ON lp.library_id = l.id
    JOIN content_presets cp ON pp.preset_id = cp.id
    ${whereClause}
    ORDER BY l.name, lp.name, cp.name
  `, params);

  return result.rows.map((p) => annotatePresetAttachment(p, normalizeSignalConfig, describePresetRuntimeSemantics));
}

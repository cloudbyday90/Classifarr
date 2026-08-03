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
  validatePolicyInitialDeclaredIntent,
} from './policyInitialIntentEstablishmentContract.mjs';

const POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS = Object.freeze({
  SET_PURPOSE_GENRES: 'set_purpose_genres',
});

const POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_SOURCE_IDS = Object.freeze({
  CURRENT_LIBRARY_PROFILE: 'current_library_profile',
});

const MAX_PURPOSE_GENRE_ADJUSTMENTS = 12;
const MAX_PURPOSE_GENRE_VALUE_LENGTH = 120;

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasOnlyKeys(value, expectedKeys) {
  const source = asPlainObject(value);
  if (!source) return false;

  const keys = Object.keys(source).sort();
  const allowedKeys = [...expectedKeys].sort();
  return keys.length === allowedKeys.length && keys.every((key, index) => key === allowedKeys[index]);
}

function normalizePurposeGenreValue(value) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  return normalized && normalized.length <= MAX_PURPOSE_GENRE_VALUE_LENGTH
    ? normalized
    : null;
}

function normalizePurposeGenreValues(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PURPOSE_GENRE_ADJUSTMENTS) {
    return null;
  }

  const values = value.map(normalizePurposeGenreValue);
  if (values.some(entry => !entry) || new Set(values).size !== values.length) return null;

  return values;
}

function normalizeAdjustmentCommands(value, commandKey) {
  if (!Array.isArray(value) || value.length > 1) return null;
  if (value.length === 0) return [];

  const command = asPlainObject(value[0]);
  if (
    !hasOnlyKeys(command, [commandKey, 'values']) ||
    command[commandKey] !== POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES
  ) {
    return null;
  }

  const values = normalizePurposeGenreValues(command.values);
  return values
    ? [{
      commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
      values,
    }]
    : null;
}

function normalizePolicyAuthoringProposalAdjustmentCommands(value) {
  return normalizeAdjustmentCommands(value, 'command_id');
}

function normalizeInternalPolicyAuthoringProposalAdjustmentCommands(value) {
  return normalizeAdjustmentCommands(value, 'commandId');
}

function readPurposeGenreRule(declaredIntent = {}) {
  const purpose = Array.isArray(declaredIntent?.purpose) ? declaredIntent.purpose : [];
  const matchingRules = purpose
    .map((rule, index) => ({ rule: asPlainObject(rule), index }))
    .filter(({ rule }) => (
      rule?.signal_type === 'genres' &&
      rule.operator === 'require_any' &&
      Array.isArray(rule.values?.require_any)
    ));

  if (matchingRules.length !== 1) return null;

  const { rule, index } = matchingRules[0];
  const values = normalizePurposeGenreValues(rule.values.require_any);
  return values ? { rule, index, values } : null;
}

function buildPolicyAuthoringProposalAdjustmentPresentation(declaredIntent = {}) {
  const genreRule = readPurposeGenreRule(declaredIntent);
  const purposeGenres = genreRule
    ? genreRule.values.map(value => Object.freeze({
      value,
      sourceId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_SOURCE_IDS.CURRENT_LIBRARY_PROFILE,
    }))
    : [];

  return Object.freeze({ purposeGenres: Object.freeze(purposeGenres) });
}

function applyPolicyAuthoringProposalAdjustmentCommands({ declaredIntent = {}, adjustmentCommands = [] } = {}) {
  const baseValidation = validatePolicyInitialDeclaredIntent(declaredIntent);
  const commands = normalizeInternalPolicyAuthoringProposalAdjustmentCommands(adjustmentCommands);
  if (!baseValidation.ok || commands === null) return null;
  if (commands.length === 0) return baseValidation.declaredIntent;

  const genreRule = readPurposeGenreRule(baseValidation.declaredIntent);
  if (!genreRule) return null;

  const selectedValues = new Set(commands[0].values);
  if (commands[0].values.some(value => !genreRule.values.includes(value))) return null;

  const adjustedValues = genreRule.values.filter(value => selectedValues.has(value));
  if (adjustedValues.length === 0) return null;

  const adjustedIntent = {
    ...baseValidation.declaredIntent,
    purpose: baseValidation.declaredIntent.purpose.map((rule, index) => (
      index === genreRule.index
        ? {
          ...rule,
          values: {
            ...rule.values,
            require_any: adjustedValues,
          },
        }
        : rule
    )),
  };
  const adjustedValidation = validatePolicyInitialDeclaredIntent(adjustedIntent);

  return adjustedValidation.ok ? adjustedValidation.declaredIntent : null;
}

export {
  MAX_PURPOSE_GENRE_ADJUSTMENTS,
  POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS,
  POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_SOURCE_IDS,
  applyPolicyAuthoringProposalAdjustmentCommands,
  buildPolicyAuthoringProposalAdjustmentPresentation,
  normalizePolicyAuthoringProposalAdjustmentCommands,
};

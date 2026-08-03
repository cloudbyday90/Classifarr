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
  SET_HELPFUL_STUDIOS: 'set_helpful_studios',
});

const POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_SOURCE_IDS = Object.freeze({
  CURRENT_LIBRARY_PROFILE: 'current_library_profile',
});

const MAX_POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMANDS = 2;
const MAX_PURPOSE_GENRE_ADJUSTMENTS = 12;
const MAX_HELPFUL_STUDIO_ADJUSTMENTS = 3;
const MAX_ADJUSTMENT_VALUE_LENGTH = 120;

const ADJUSTMENT_DEFINITIONS = Object.freeze([
  Object.freeze({
    commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
    collection: 'purpose',
    signalType: 'genres',
    operator: 'require_any',
    valuesKey: 'require_any',
    valueLimit: MAX_PURPOSE_GENRE_ADJUSTMENTS,
    presentationKey: 'purposeGenres',
  }),
  Object.freeze({
    commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
    collection: 'helpful_hints',
    signalType: 'studios',
    operator: 'prefer',
    valuesKey: 'prefer',
    valueLimit: MAX_HELPFUL_STUDIO_ADJUSTMENTS,
    presentationKey: 'helpfulStudios',
  }),
]);

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

function findAdjustmentDefinition(commandId) {
  return ADJUSTMENT_DEFINITIONS.find(definition => definition.commandId === commandId) || null;
}

function normalizeAdjustmentValue(value) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  return normalized && normalized.length <= MAX_ADJUSTMENT_VALUE_LENGTH
    ? normalized
    : null;
}

function normalizeAdjustmentValues(value, maximumLength) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumLength) return null;

  const values = value.map(normalizeAdjustmentValue);
  return values.some(entry => !entry) || new Set(values).size !== values.length
    ? null
    : values;
}

function normalizeAdjustmentCommands(value, commandKey) {
  if (!Array.isArray(value) || value.length > MAX_POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMANDS) {
    return null;
  }
  if (value.length === 0) return [];

  const commandIds = new Set();
  const commands = value.map(entry => {
    const command = asPlainObject(entry);
    const definition = findAdjustmentDefinition(command?.[commandKey]);
    if (!definition || !hasOnlyKeys(command, [commandKey, 'values']) || commandIds.has(definition.commandId)) {
      return null;
    }

    const values = normalizeAdjustmentValues(command.values, definition.valueLimit);
    if (!values) return null;

    commandIds.add(definition.commandId);
    return {
      commandId: definition.commandId,
      values,
    };
  });

  if (commands.some(command => !command)) return null;

  return commands.sort((left, right) => (
    ADJUSTMENT_DEFINITIONS.findIndex(definition => definition.commandId === left.commandId) -
    ADJUSTMENT_DEFINITIONS.findIndex(definition => definition.commandId === right.commandId)
  ));
}

function normalizePolicyAuthoringProposalAdjustmentCommands(value) {
  return normalizeAdjustmentCommands(value, 'command_id');
}

function normalizeInternalPolicyAuthoringProposalAdjustmentCommands(value) {
  return normalizeAdjustmentCommands(value, 'commandId');
}

function readAdjustmentRule(declaredIntent = {}, definition) {
  const collection = Array.isArray(declaredIntent?.[definition.collection])
    ? declaredIntent[definition.collection]
    : [];
  const matchingRules = collection
    .map((rule, index) => ({ rule: asPlainObject(rule), index }))
    .filter(({ rule }) => (
      rule?.signal_type === definition.signalType &&
      rule.operator === definition.operator &&
      Array.isArray(rule.values?.[definition.valuesKey])
    ));

  if (matchingRules.length !== 1) return null;

  const { rule, index } = matchingRules[0];
  const values = normalizeAdjustmentValues(rule.values[definition.valuesKey], definition.valueLimit);
  return values ? { index, values } : null;
}

function buildCurrentProfileOptions(rule) {
  return Object.freeze(rule?.values.map(value => Object.freeze({
    value,
    sourceId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_SOURCE_IDS.CURRENT_LIBRARY_PROFILE,
  })) || []);
}

function buildPolicyAuthoringProposalAdjustmentPresentation(declaredIntent = {}) {
  const presentation = ADJUSTMENT_DEFINITIONS.reduce((result, definition) => ({
    ...result,
    [definition.presentationKey]: buildCurrentProfileOptions(readAdjustmentRule(declaredIntent, definition)),
  }), {});

  return Object.freeze(presentation);
}

function applyPolicyAuthoringProposalAdjustmentCommands({ declaredIntent = {}, adjustmentCommands = [] } = {}) {
  const baseValidation = validatePolicyInitialDeclaredIntent(declaredIntent);
  const commands = normalizeInternalPolicyAuthoringProposalAdjustmentCommands(adjustmentCommands);
  if (!baseValidation.ok || commands === null) return null;
  if (commands.length === 0) return baseValidation.declaredIntent;

  const updatesByCollection = new Map();
  for (const command of commands) {
    const definition = findAdjustmentDefinition(command.commandId);
    const rule = definition && readAdjustmentRule(baseValidation.declaredIntent, definition);
    if (!definition || !rule || command.values.some(value => !rule.values.includes(value))) return null;

    const adjustedValues = rule.values.filter(value => command.values.includes(value));
    if (adjustedValues.length === 0) return null;

    const collectionUpdates = updatesByCollection.get(definition.collection) || new Map();
    collectionUpdates.set(rule.index, { definition, adjustedValues });
    updatesByCollection.set(definition.collection, collectionUpdates);
  }

  const adjustedIntent = [...updatesByCollection.entries()].reduce((result, [collection, updates]) => ({
    ...result,
    [collection]: result[collection].map((rule, index) => {
      const update = updates.get(index);
      return update
        ? {
          ...rule,
          values: {
            ...rule.values,
            [update.definition.valuesKey]: update.adjustedValues,
          },
        }
        : rule;
    }),
  }), baseValidation.declaredIntent);
  const adjustedValidation = validatePolicyInitialDeclaredIntent(adjustedIntent);

  return adjustedValidation.ok ? adjustedValidation.declaredIntent : null;
}

export {
  MAX_HELPFUL_STUDIO_ADJUSTMENTS,
  MAX_POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMANDS,
  MAX_PURPOSE_GENRE_ADJUSTMENTS,
  POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS,
  POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_SOURCE_IDS,
  applyPolicyAuthoringProposalAdjustmentCommands,
  buildPolicyAuthoringProposalAdjustmentPresentation,
  normalizePolicyAuthoringProposalAdjustmentCommands,
};

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
  normalizePolicyNativeIntentChangePurposeCommand,
} from './policyNativeIntentChangePurposePreflightContract.mjs';
import {
  projectStoredPurposeRulesForNativeIntentChange,
} from './policyNativeIntentPurposeChangeStoredRuleAdapter.mjs';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

/**
 * Produces the existing native-purpose command shape from stored rules while
 * removing storage provenance. Callers may use it for a server-only comparison
 * key, but must never expose its values outside the established purpose-change
 * read route.
 */
export function buildStoredPurposeChangeCommand(purposeRules = []) {
  const normalizedCommand = normalizePolicyNativeIntentChangePurposeCommand({
    command_id: 'update_purpose',
    values: projectStoredPurposeRulesForNativeIntentChange(purposeRules),
  });

  return {
    command_id: normalizedCommand.command_id,
    values: normalizedCommand.values.map(({
      source: _source,
      inference_state: _inferenceState,
      ...rule
    }) => rule),
  };
}

/**
 * Returns an in-memory equality key for grouping identical prefilled review
 * drafts. The key contains purpose values and is intentionally never returned
 * from an API response or persisted.
 */
export function buildStoredPurposeChangeCommandSignature(purposeRules = []) {
  return JSON.stringify(canonicalize(buildStoredPurposeChangeCommand(purposeRules)));
}

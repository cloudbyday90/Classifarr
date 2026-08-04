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
  loadPendingQuestionCleanupContextState,
} from './policyRuntimePendingQuestionCleanupInventoryRepository.mjs';
import { extractQuestionContext } from '../utils/policyQuestionContext.mjs';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parsePersistedObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function normalizeContextTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function buildCurrentContextState({
  question = {},
  contextState = {},
} = {}) {
  const context = extractQuestionContext(question);
  const libraries = asArray(contextState.libraries);
  const policies = asArray(contextState.policies);
  const libraryById = new Map(libraries
    .map(library => [normalizePositiveInteger(library?.id), library])
    .filter(([libraryId]) => libraryId));
  const policyById = new Map(policies
    .map(policy => [normalizePositiveInteger(policy?.id), policy])
    .filter(([policyId]) => policyId));
  const activeLibraryIds = [...libraryById.entries()]
    .filter(([, library]) => library?.is_active === true)
    .map(([libraryId]) => libraryId)
    .sort((left, right) => left - right);
  const policyReferencesAreCurrent = context.policyIds.every(policyId =>
    policyById.get(policyId)?.enabled === true
  );
  const timestamps = [
    ...context.libraryIds.map(libraryId => libraryById.get(libraryId)?.updated_at),
    ...context.policyIds.map(policyId => policyById.get(policyId)?.context_version),
  ]
    .map(normalizeContextTimestamp)
    .filter(Boolean)
    .map(timestamp => timestamp.getTime());
  const latestTimestamp = timestamps.length === 0 ? null : Math.max(...timestamps);

  return {
    activeLibraryIds,
    contextEvaluated: policyReferencesAreCurrent,
    currentContextVersion: latestTimestamp === null
      ? null
      : new Date(latestTimestamp).toISOString(),
  };
}

async function loadPendingQuestionCleanupCurrentContext({
  client,
  classification = {},
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Pending-question cleanup context requires a transaction client.');
  }

  const question = parsePersistedObject(classification.policy_question ?? classification.policyQuestion);
  const context = extractQuestionContext(question);
  const contextState = await loadPendingQuestionCleanupContextState(client, context);

  return buildCurrentContextState({ question, contextState });
}

export {
  buildCurrentContextState,
  loadPendingQuestionCleanupCurrentContext,
  parsePersistedObject,
};

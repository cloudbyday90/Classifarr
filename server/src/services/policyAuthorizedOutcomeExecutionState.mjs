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
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS,
} from './policyAuthorizedOutcomeExecutionVocabulary.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function normalizeMediaType(value) {
  const mediaType = normalizeString(value, 20).toLowerCase();
  return ['movie', 'tv'].includes(mediaType) ? mediaType : null;
}

function buildBlockedExecutionState(reasonId) {
  return {
    ok: false,
    reasonId,
    classification: null,
    destination: null,
    currentState: null,
  };
}

function normalizeLockedClassification(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    tmdbId: normalizeIdentifier(source.tmdb_id ?? source.tmdbId),
    mediaType: normalizeMediaType(source.media_type ?? source.mediaType),
    status: normalizeString(source.status, 40) || null,
    currentDestinationLibraryId: normalizeIdentifier(
      source.library_id ?? source.currentDestinationLibraryId,
    ),
    currentDestinationLibraryName: normalizeString(
      source.library_name ?? source.currentDestinationLibraryName,
      255,
    ) || null,
  };
}

function normalizeLockedDestination(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    name: normalizeString(source.name, 255) || null,
    mediaType: normalizeMediaType(source.media_type ?? source.mediaType),
    active: source.is_active === true || source.active === true,
  };
}

async function lockPolicyAuthorizedOutcomeExecutionState({
  client,
  intake = {},
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Authorized outcome execution state requires a transaction client.');
  }

  const sourceIntake = asObject(intake);
  const finalOutcome = asObject(sourceIntake.finalOutcome);
  const classificationId = normalizeIdentifier(finalOutcome.itemId ?? sourceIntake.itemId);
  const destinationLibraryId = normalizeIdentifier(finalOutcome.destinationLibraryId);
  const expectedDestinationName = normalizeString(finalOutcome.destinationLibraryName, 255) || null;
  const sourceEventId = normalizeString(sourceIntake.sourceEventId, 160) || null;

  if (!classificationId) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.CLASSIFICATION_NOT_FOUND,
    );
  }
  if (!destinationLibraryId) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.DESTINATION_NOT_FOUND,
    );
  }

  // Every executor uses this lock order: classification first, destination second.
  const classification = normalizeLockedClassification(firstRow(await client.query(
    `SELECT
       id,
       tmdb_id,
       media_type,
       status,
       library_id,
       library_name
     FROM classification_history
     WHERE id = $1
     FOR UPDATE`,
    [classificationId],
  )));
  if (!classification.id || !classification.mediaType) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.CLASSIFICATION_NOT_FOUND,
    );
  }

  const destination = normalizeLockedDestination(firstRow(await client.query(
    `SELECT
       id,
       name,
       media_type,
       is_active
     FROM libraries
     WHERE id = $1
     FOR UPDATE`,
    [destinationLibraryId],
  )));
  if (!destination.id || !destination.name || !destination.mediaType) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.DESTINATION_NOT_FOUND,
    );
  }
  if (!destination.active) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.DESTINATION_INACTIVE,
    );
  }
  if (destination.mediaType !== classification.mediaType) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.DESTINATION_MEDIA_TYPE_MISMATCH,
    );
  }
  if (expectedDestinationName !== destination.name) {
    return buildBlockedExecutionState(
      POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS.DESTINATION_NAME_MISMATCH,
    );
  }

  return {
    ok: true,
    reasonId: null,
    classification,
    destination,
    currentState: {
      classificationId: classification.id,
      sourceEventId,
      destinationLibraryId: destination.id,
      destinationLibraryName: destination.name,
      locked: true,
    },
  };
}

export {
  buildBlockedExecutionState,
  lockPolicyAuthorizedOutcomeExecutionState,
  normalizeLockedClassification,
  normalizeLockedDestination,
};

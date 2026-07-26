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
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

const POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS = Object.freeze({
  CLASSIFICATION_NOT_FOUND: 'manual_correction_execution_classification_not_found',
  DESTINATION_NOT_FOUND: 'manual_correction_execution_destination_not_found',
  DESTINATION_INACTIVE: 'manual_correction_execution_destination_inactive',
  DESTINATION_MEDIA_TYPE_MISMATCH: 'manual_correction_execution_destination_media_type_mismatch',
  CORRECTION_NOT_RECORDED: 'manual_correction_execution_correction_not_recorded',
  LEARNING_ADMISSION_INVALID: 'manual_correction_execution_learning_admission_invalid',
  EXECUTION_BLOCKED: 'manual_correction_execution_authorized_outcome_blocked',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function normalizeMediaType(value) {
  const mediaType = normalizeString(value, 20).toLowerCase();
  return ['movie', 'tv'].includes(mediaType) ? mediaType : null;
}

function normalizeClassification(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    originalLibraryId: normalizeIdentifier(source.library_id ?? source.libraryId),
    tmdbId: normalizeIdentifier(source.tmdb_id ?? source.tmdbId),
    mediaType: normalizeMediaType(source.media_type ?? source.mediaType),
  };
}

function normalizeDestination(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    name: normalizeString(source.name, 255) || null,
    mediaType: normalizeMediaType(source.media_type ?? source.mediaType),
    active: source.is_active === true || source.active === true,
  };
}

async function applyPolicyManualCorrectionLifecycle({
  client,
  classificationId,
  destinationLibraryId,
  actorId,
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Manual correction execution requires a transaction client.');
  }

  const normalizedClassificationId = normalizeIdentifier(classificationId);
  const normalizedDestinationLibraryId = normalizeIdentifier(destinationLibraryId);
  const normalizedActorId = normalizeString(actorId, 128);

  const classification = normalizeClassification(firstRow(await client.query(
    `SELECT id, library_id, tmdb_id, media_type
     FROM classification_history
     WHERE id = $1
     FOR UPDATE`,
    [normalizedClassificationId],
  )));
  if (!classification.id) {
    return { ok: false, reasonId: POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.CLASSIFICATION_NOT_FOUND };
  }

  const destination = normalizeDestination(firstRow(await client.query(
    `SELECT id, name, media_type, is_active
     FROM libraries
     WHERE id = $1
     FOR UPDATE`,
    [normalizedDestinationLibraryId],
  )));
  if (!destination.id || !destination.name || !destination.mediaType) {
    return { ok: false, reasonId: POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.DESTINATION_NOT_FOUND };
  }
  if (!destination.active) {
    return { ok: false, reasonId: POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.DESTINATION_INACTIVE };
  }
  if (destination.mediaType !== classification.mediaType) {
    return { ok: false, reasonId: POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.DESTINATION_MEDIA_TYPE_MISMATCH };
  }

  await client.query(
    `UPDATE classification_history
     SET library_id = $1, library_name = $2, status = 'corrected'
     WHERE id = $3`,
    [destination.id, destination.name, classification.id],
  );
  const correction = firstRow(await client.query(
    `INSERT INTO classification_corrections
       (classification_id, original_library_id, corrected_library_id, corrected_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [classification.id, classification.originalLibraryId, destination.id, normalizedActorId],
  ));
  if (!normalizeIdentifier(correction?.id)) {
    throw new Error(POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS.CORRECTION_NOT_RECORDED);
  }

  return {
    ok: true,
    reasonId: null,
    classification,
    destination,
    correction,
    sourceEventId: `classification_correction:${normalizeIdentifier(correction.id)}`,
  };
}

export {
  POLICY_MANUAL_CORRECTION_EXECUTION_REASON_IDS,
  applyPolicyManualCorrectionLifecycle,
  normalizeClassification,
  normalizeDestination,
};

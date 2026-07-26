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
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

const POLICY_IDENTITY_EVIDENCE_ADMISSION_TABLE =
  'policy_identity_evidence_admissions';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function requireTransactionClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Identity evidence admission persistence requires a transaction client.');
  }
}

function normalizeAdmissionRow(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    sourceId: normalizeString(source.source_id ?? source.sourceId, 80) || null,
    sourceEventId: normalizeString(source.source_event_id ?? source.sourceEventId, 160) || null,
    classificationId: normalizeIdentifier(source.classification_id ?? source.classificationId),
    libraryId: normalizeIdentifier(source.library_id ?? source.libraryId),
    evidenceKey: normalizeString(source.evidence_key ?? source.evidenceKey, 160) || null,
    authoritySourceId: normalizeString(
      source.authority_source_id ?? source.authoritySourceId,
      64,
    ) || null,
  };
}

async function insertPolicyIdentityEvidenceAdmission({ client, record = {} } = {}) {
  requireTransactionClient(client);

  const source = asObject(record);
  const result = await client.query(
    `INSERT INTO ${POLICY_IDENTITY_EVIDENCE_ADMISSION_TABLE} (
       source_id,
       source_event_id,
       classification_id,
       library_id,
       media_type,
       signal_type,
       evidence_key,
       authority_source_id,
       authority_reference,
       authority_policy_id,
       authority_intent_id,
       authority_intent_version,
       authority_fingerprint,
       actor_reference,
       source_system
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
     )
     ON CONFLICT (source_id, source_event_id) DO NOTHING
     RETURNING
       id,
       source_id,
       source_event_id,
       classification_id,
       library_id,
       evidence_key,
       authority_source_id`,
    [
      source.sourceId,
      source.sourceEventId,
      source.classificationId,
      source.libraryId,
      source.mediaType,
      source.signalType,
      source.evidenceKey,
      source.authoritySourceId,
      source.authorityReference,
      source.authorityPolicyId,
      source.authorityIntentId,
      source.authorityIntentVersion,
      source.authorityFingerprint,
      source.actorReference,
      source.sourceSystem,
    ],
  );

  return normalizeAdmissionRow(firstRow(result));
}

async function findPolicyIdentityEvidenceAdmission({
  client,
  sourceId,
  sourceEventId,
} = {}) {
  requireTransactionClient(client);

  const result = await client.query(
    `SELECT
       id,
       source_id,
       source_event_id,
       classification_id,
       library_id,
       evidence_key,
       authority_source_id
     FROM ${POLICY_IDENTITY_EVIDENCE_ADMISSION_TABLE}
     WHERE source_id = $1
       AND source_event_id = $2`,
    [sourceId, sourceEventId],
  );

  return normalizeAdmissionRow(firstRow(result));
}

async function upsertPolicyIdentityEvidenceAdmission({ client, record = {} } = {}) {
  const inserted = await insertPolicyIdentityEvidenceAdmission({ client, record });
  if (inserted.id) {
    return { admission: inserted, replayed: false };
  }

  const existing = await findPolicyIdentityEvidenceAdmission({
    client,
    sourceId: record.sourceId,
    sourceEventId: record.sourceEventId,
  });
  if (!existing.id) {
    throw new Error('Identity evidence admission conflict did not yield an existing admission.');
  }

  return { admission: existing, replayed: true };
}

const policyIdentityEvidenceAdmissionRepository = Object.freeze({
  find: findPolicyIdentityEvidenceAdmission,
  upsert: upsertPolicyIdentityEvidenceAdmission,
});

export {
  POLICY_IDENTITY_EVIDENCE_ADMISSION_TABLE,
  findPolicyIdentityEvidenceAdmission,
  insertPolicyIdentityEvidenceAdmission,
  normalizeAdmissionRow,
  policyIdentityEvidenceAdmissionRepository,
  requireTransactionClient,
  upsertPolicyIdentityEvidenceAdmission,
};

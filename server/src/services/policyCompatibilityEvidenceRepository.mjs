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

const POLICY_COMPATIBILITY_EVIDENCE_TABLE = 'classification_evidence';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function normalizePolicyCompatibilityEvidenceRow(row = {}) {
  const source = asObject(row);

  return {
    id: normalizeIdentifier(source.id),
    scope: normalizeString(source.scope, 50) || null,
    mediaType: normalizeString(source.media_type ?? source.mediaType, 20) || null,
    libraryId: normalizeIdentifier(source.library_id ?? source.libraryId),
    evidenceKey: normalizeString(source.evidence_key ?? source.evidenceKey, 255) || null,
    usageCount: Number(source.usage_count ?? source.usageCount) || 0,
  };
}

async function upsertPolicyCompatibilityEvidence({
  client,
  record = {},
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Compatibility evidence persistence requires a transaction client.');
  }

  const source = asObject(record);
  const result = await client.query(
    `INSERT INTO ${POLICY_COMPATIBILITY_EVIDENCE_TABLE} (
       scope,
       media_type,
       library_id,
       tmdb_id,
       evidence_key,
       evidence_data,
       confidence,
       usage_count,
       success_rate,
       provenance,
       status,
       created_by,
       source_classification_id,
       source_system,
       last_seen_at
     )
     VALUES (
       $1, $2, $3, NULL, $4, $5::jsonb, $6, 1, NULL, $7, $8, $9, $10, $11, NOW()
     )
     ON CONFLICT (scope, media_type, library_id, evidence_key)
       WHERE scope IN ('genre', 'studio', 'franchise', 'certification')
       DO UPDATE SET
         evidence_data = EXCLUDED.evidence_data,
         confidence = GREATEST(classification_evidence.confidence, EXCLUDED.confidence),
         usage_count = classification_evidence.usage_count + 1,
         source_classification_id = EXCLUDED.source_classification_id,
         source_system = EXCLUDED.source_system,
         last_seen_at = NOW(),
         updated_at = NOW()
     RETURNING id, scope, media_type, library_id, evidence_key, usage_count`,
    [
      source.scope,
      source.mediaType,
      source.libraryId,
      source.evidenceKey,
      JSON.stringify(source.evidenceData),
      source.confidence,
      source.provenance,
      source.status,
      source.createdBy,
      source.sourceClassificationId,
      source.sourceSystem,
    ],
  );

  return normalizePolicyCompatibilityEvidenceRow(firstRow(result));
}

const policyCompatibilityEvidenceRepository = Object.freeze({
  upsert: upsertPolicyCompatibilityEvidence,
});

export {
  POLICY_COMPATIBILITY_EVIDENCE_TABLE,
  normalizePolicyCompatibilityEvidenceRow,
  policyCompatibilityEvidenceRepository,
  upsertPolicyCompatibilityEvidence,
};

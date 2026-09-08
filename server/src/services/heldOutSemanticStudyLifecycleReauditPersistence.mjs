/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_STATE_KEY =
  'normal_policy_lifecycle_receipts';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

function parseJson(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Loads only the latest aggregate audit receipt. Lifecycle detail remains in
 * the existing durable source tables and is never returned by this projection.
 */
export async function loadHeldOutSemanticStudyLifecycleReauditState({ db }) {
  const result = await db.query(
    `SELECT source_fingerprint, attempt_count, audit_status_id, audit_receipt
       FROM held_out_semantic_study_lifecycle_reaudit_state
      WHERE state_key = $1`,
    [HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_STATE_KEY],
  );
  const row = firstRow(result);
  if (!row) return null;

  return Object.freeze({
    sourceFingerprint: typeof row.source_fingerprint === 'string' ? row.source_fingerprint : null,
    attemptCount: positiveInteger(row.attempt_count),
    auditStatusId: typeof row.audit_status_id === 'string' ? row.audit_status_id : null,
    auditReceipt: parseJson(row.audit_receipt),
  });
}

/**
 * Persists one fixed, aggregate audit receipt for the current receipt-source
 * state. It intentionally contains no policy, library, media, actor, rule, or
 * configuration values.
 */
export async function saveHeldOutSemanticStudyLifecycleReauditState({
  db,
  source,
  sourceFingerprint,
  attemptCount,
  auditReceipt,
  auditedAt,
}) {
  await db.query(
    `INSERT INTO held_out_semantic_study_lifecycle_reaudit_state (
       state_key,
       source_fingerprint,
       source_receipt,
       attempt_count,
       audit_status_id,
       audit_receipt,
       audited_at
     ) VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7)
     ON CONFLICT (state_key) DO UPDATE SET
       source_fingerprint = EXCLUDED.source_fingerprint,
       source_receipt = EXCLUDED.source_receipt,
       attempt_count = EXCLUDED.attempt_count,
       audit_status_id = EXCLUDED.audit_status_id,
       audit_receipt = EXCLUDED.audit_receipt,
       audited_at = EXCLUDED.audited_at`,
    [
      HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_STATE_KEY,
      sourceFingerprint,
      JSON.stringify(source),
      attemptCount,
      auditReceipt.status.id,
      JSON.stringify(auditReceipt),
      auditedAt,
    ],
  );
}

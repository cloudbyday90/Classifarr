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
  CONTROL_KEY,
} from './policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';

const CONTROL_TABLE = 'policy_candidate_correction_review_corpus_controls';
const AUDIT_EVENT_TABLE = 'policy_candidate_correction_review_corpus_audit_events';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function acquirePolicyCandidateCorrectionRepresentativeReviewCorpusControlLock({
  client,
  lockKey,
} = {}) {
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [lockKey]);
}

export async function lockPolicyCandidateCorrectionRepresentativeReviewCorpusControl({ client } = {}) {
  const result = await client.query(
    `SELECT
       control_key,
       configuration_version,
       purpose_id,
       required_safeguard_ids,
       review_record_retention_days,
       configuration_revision,
       acknowledged_at
     FROM ${CONTROL_TABLE}
     WHERE control_key = $1
     FOR UPDATE`,
    [CONTROL_KEY],
  );

  return firstRow(result);
}

export async function readPolicyCandidateCorrectionRepresentativeReviewCorpusControl({ dbClient } = {}) {
  const result = await dbClient.query(
    `SELECT
       control_key,
       configuration_version,
       purpose_id,
       required_safeguard_ids,
       review_record_retention_days,
       configuration_revision,
       acknowledged_at
     FROM ${CONTROL_TABLE}
     WHERE control_key = $1`,
    [CONTROL_KEY],
  );

  return firstRow(result);
}

export async function upsertPolicyCandidateCorrectionRepresentativeReviewCorpusControl({
  client,
  configuration,
} = {}) {
  const result = await client.query(
    `INSERT INTO ${CONTROL_TABLE} (
       control_key,
       configuration_version,
       purpose_id,
       required_safeguard_ids,
       review_record_retention_days,
       configuration_revision,
       acknowledged_by_actor_id,
       acknowledged_at
     ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::timestamptz)
     ON CONFLICT (control_key) DO UPDATE
     SET configuration_version = EXCLUDED.configuration_version,
         purpose_id = EXCLUDED.purpose_id,
         required_safeguard_ids = EXCLUDED.required_safeguard_ids,
         review_record_retention_days = EXCLUDED.review_record_retention_days,
         configuration_revision = EXCLUDED.configuration_revision,
         acknowledged_by_actor_id = EXCLUDED.acknowledged_by_actor_id,
         acknowledged_at = EXCLUDED.acknowledged_at
     RETURNING
       control_key,
       configuration_version,
       purpose_id,
       required_safeguard_ids,
       review_record_retention_days,
       configuration_revision,
       acknowledged_at`,
    [
      CONTROL_KEY,
      configuration.configurationVersion,
      configuration.purposeId,
      JSON.stringify(configuration.requiredSafeguardIds),
      configuration.reviewRecordRetentionDays,
      configuration.revision,
      configuration.actorId,
      configuration.acknowledgedAt,
    ],
  );

  return firstRow(result);
}

export async function insertPolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvent({
  client,
  event,
} = {}) {
  const result = await client.query(
    `INSERT INTO ${AUDIT_EVENT_TABLE} (
       event_version,
       action_id,
       actor_id,
       previous_configuration_revision,
       configuration_revision,
       purpose_id,
       required_safeguard_ids,
       review_record_retention_days,
       occurred_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::timestamptz)
     RETURNING
       id,
       action_id,
       actor_id,
       previous_configuration_revision,
       configuration_revision,
       required_safeguard_ids,
       review_record_retention_days,
       occurred_at`,
    [
      event.eventVersion,
      event.actionId,
      event.actorId,
      event.previousConfigurationRevision,
      event.configurationRevision,
      event.purposeId,
      JSON.stringify(event.requiredSafeguardIds),
      event.reviewRecordRetentionDays,
      event.occurredAt,
    ],
  );

  return firstRow(result);
}

export async function listPolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents({
  dbClient,
  limit,
} = {}) {
  const result = await dbClient.query(
    `SELECT
       id,
       action_id,
       actor_id,
       previous_configuration_revision,
       configuration_revision,
       required_safeguard_ids,
       review_record_retention_days,
       occurred_at
     FROM ${AUDIT_EVENT_TABLE}
     ORDER BY occurred_at DESC, id DESC
     LIMIT $1`,
    [limit],
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}

export {
  AUDIT_EVENT_TABLE,
  CONTROL_TABLE,
};

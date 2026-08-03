/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function readPolicyAuthoringLibrary({ dbClient, libraryId, lock = false } = {}) {
  const result = await dbClient.query(`
    SELECT id, name, media_type
    FROM libraries
    WHERE id = $1
    ${lock ? 'FOR UPDATE' : ''}
  `, [libraryId]);

  return firstRow(result);
}

export async function readPolicyAuthoringLibraryPolicy({ dbClient, libraryId, lock = false } = {}) {
  const result = await dbClient.query(`
    SELECT
      policy.id,
      policy.library_id,
      policy.name,
      EXISTS(
        SELECT 1
        FROM policy_intents intent
        WHERE intent.policy_id = policy.id
          AND intent.active = TRUE
          AND intent.source = 'native_intent'
      ) AS has_native_intent
    FROM library_policies policy
    WHERE policy.library_id = $1
    ${lock ? 'FOR UPDATE' : ''}
  `, [libraryId]);

  return firstRow(result);
}

export async function readPolicyAuthoringLibraryProfile({ dbClient, libraryId, lock = false } = {}) {
  const result = await dbClient.query(`
    SELECT profile.*, library.media_type
    FROM library_profiles profile
    JOIN libraries library ON library.id = profile.library_id
    WHERE profile.library_id = $1
    ${lock ? 'FOR UPDATE OF profile' : ''}
  `, [libraryId]);

  return firstRow(result);
}

export async function insertPolicyAuthoringProposal({
  client,
  proposalReference,
  libraryId,
  actorId,
  proposalRevision,
  profileFingerprint,
  policyName,
  declaredIntent,
  displaySummary,
  expiresAt,
} = {}) {
  const result = await client.query(`
    INSERT INTO policy_authoring_proposals (
      proposal_reference,
      library_id,
      actor_id,
      proposal_revision,
      profile_fingerprint,
      policy_name,
      canonical_declared_intent,
      display_summary,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz)
    RETURNING *
  `, [
    proposalReference,
    libraryId,
    actorId,
    proposalRevision,
    profileFingerprint,
    policyName,
    JSON.stringify(declaredIntent),
    JSON.stringify(displaySummary),
    expiresAt,
  ]);

  return firstRow(result);
}

export async function lockPolicyAuthoringProposal({ client, proposalReference } = {}) {
  const result = await client.query(`
    SELECT *
    FROM policy_authoring_proposals
    WHERE proposal_reference = $1
    FOR UPDATE
  `, [proposalReference]);

  return firstRow(result);
}

export async function consumePolicyAuthoringProposal({ client, proposalId, policyId, now } = {}) {
  const result = await client.query(`
    UPDATE policy_authoring_proposals
    SET state = 'consumed',
        consumed_policy_id = $2,
        consumed_at = $3::timestamptz,
        updated_at = $3::timestamptz
    WHERE id = $1
      AND state = 'prepared'
    RETURNING id
  `, [proposalId, policyId, now]);

  return firstRow(result)?.id ?? null;
}

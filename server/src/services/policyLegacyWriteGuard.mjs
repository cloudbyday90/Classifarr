/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ConflictError, NotFoundError } from '../utils/appError.mjs';
import {
  POLICY_LEGACY_WRITE_OPERATION_IDS,
  buildPolicyLegacyWriteBoundary,
} from './policyLegacyWriteBoundary.mjs';

const POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED =
  'POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toBlockedFieldGroups(boundary = {}) {
  return [...new Set(
    asArray(boundary.detectedFields?.legacyBehavior)
      .map(field => field.groupId)
      .filter(Boolean)
  )];
}

function buildLegacyWriteConflict(boundary) {
  return new ConflictError(
    'This policy uses native intent and cannot be changed through legacy policy controls.',
    {
      code: POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED,
      operation_id: boundary.operationId,
      blocked_field_groups: toBlockedFieldGroups(boundary),
      required_action: 'use_native_intent_command',
    }
  );
}

/**
 * Returns the policy authority state while the caller holds a transaction. The
 * lock makes the following legacy mutation and native-intent check one atomic
 * decision, rather than trusting an earlier read.
 */
async function lockPolicyAuthorityForWrite({ client, policyId }) {
  const result = await client.query(`
    SELECT
      lp.*,
      EXISTS (
        SELECT 1
        FROM policy_intents pi
        WHERE pi.policy_id = lp.id
          AND pi.active = TRUE
      ) AS native_intent_active
    FROM library_policies lp
    WHERE lp.id = $1
    FOR UPDATE
  `, [policyId]);

  const policy = result.rows?.[0] || null;
  if (!policy) {
    throw new NotFoundError('Policy not found');
  }

  return policy;
}

async function lockPolicyAuthorityForLibraryWrite({ client, libraryId }) {
  const result = await client.query(`
    SELECT
      lp.*,
      EXISTS (
        SELECT 1
        FROM policy_intents pi
        WHERE pi.policy_id = lp.id
          AND pi.active = TRUE
      ) AS native_intent_active
    FROM library_policies lp
    WHERE lp.library_id = $1
    FOR UPDATE
  `, [libraryId]);

  return result.rows?.[0] || null;
}

function assertLegacyPolicyWriteAllowed({
  policy,
  payload = {},
  operationId = POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
} = {}) {
  const boundary = buildPolicyLegacyWriteBoundary({
    policy,
    payload,
    operationId,
    nativeWriteReady: false,
    nativeDefaultReady: false,
  });

  if (!boundary.allowed) {
    throw buildLegacyWriteConflict(boundary);
  }

  return boundary;
}

export {
  POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED,
  assertLegacyPolicyWriteAllowed,
  lockPolicyAuthorityForLibraryWrite,
  lockPolicyAuthorityForWrite,
};

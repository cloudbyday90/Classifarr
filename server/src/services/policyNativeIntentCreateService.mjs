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
  POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS,
  applyPolicyInitialIntentEstablishmentInTransaction,
} from './policyInitialIntentEstablishmentService.mjs';
import {
  buildInitialIntentRequestFingerprint,
} from './policyInitialIntentEstablishmentContract.mjs';
import {
  buildNativePolicyCreateAdvisoryLockKey,
} from './policyNativeIntentCreateIdempotency.mjs';
import {
  insertNativeIntentPolicy,
  lockNativePolicyCreateReceipt,
  tryLockNativePolicyCreateIdempotencyKey,
} from './policyNativeIntentCreatePersistence.mjs';

export class PolicyNativeIntentCreateConflictError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PolicyNativeIntentCreateConflictError';
    this.code = code;
  }
}

function buildReplayEstablishment(receipt) {
  return {
    statusId: POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.REPLAYED,
    establishment: {
      intentId: Number(receipt.intent_id),
      applied: false,
      replayed: true,
    },
    summary: {
      routingConfigured: receipt.routing_configured === true,
      ruleCount: Number(receipt.rule_count) || 0,
    },
  };
}

function matchesNativePolicyCreateReplay({ receipt, policy, actorId, establishmentRequest }) {
  return receipt?.state === 'established'
    && Number(receipt.policy_id) > 0
    && Number(receipt.intent_id) > 0
    && Number(receipt.library_id) === Number(policy.libraryId)
    && receipt.policy_name === policy.name
    && Number(receipt.accepted_by) === Number(actorId)
    && receipt.request_fingerprint === buildInitialIntentRequestFingerprint(establishmentRequest);
}

export async function createNativeIntentPolicyInTransaction({
  client,
  policy,
  actorId,
  establishmentRequest,
} = {}) {
  const lockAcquired = await tryLockNativePolicyCreateIdempotencyKey({
    client,
    lockKey: buildNativePolicyCreateAdvisoryLockKey(establishmentRequest?.idempotency_key),
  });
  if (!lockAcquired) {
    throw new PolicyNativeIntentCreateConflictError(
      'A native policy create request with this idempotency key is still in progress.',
      'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_IN_PROGRESS'
    );
  }

  const existingReceipt = await lockNativePolicyCreateReceipt({
    client,
    idempotencyKey: establishmentRequest.idempotency_key,
  });
  if (existingReceipt) {
    if (!matchesNativePolicyCreateReplay({
      receipt: existingReceipt,
      policy,
      actorId,
      establishmentRequest,
    })) {
      throw new PolicyNativeIntentCreateConflictError(
        'This Idempotency-Key is already bound to another native policy create request.',
        'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_REUSED'
      );
    }

    return {
      policy: {
        id: Number(existingReceipt.policy_id),
        library_id: Number(existingReceipt.library_id),
        name: existingReceipt.policy_name,
      },
      nativeIntentEstablishment: buildReplayEstablishment(existingReceipt),
    };
  }

  const createdPolicy = await insertNativeIntentPolicy({ client, policy });
  if (!createdPolicy?.id) {
    throw new Error('Native policy creation did not return a policy identifier.');
  }

  const nativeIntentEstablishment = await applyPolicyInitialIntentEstablishmentInTransaction({
    client,
    policyId: createdPolicy.id,
    actorId,
    request: establishmentRequest,
  });
  if (nativeIntentEstablishment.statusId
    !== POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS.ESTABLISHED) {
    throw new PolicyNativeIntentCreateConflictError(
      'Native policy intent could not be created. No policy changes were saved.',
      'POLICY_NATIVE_INTENT_CREATE_BLOCKED'
    );
  }

  return {
    policy: createdPolicy,
    nativeIntentEstablishment,
  };
}

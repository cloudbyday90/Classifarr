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

function normalizePolicyId(value) {
  const policyId = Number(value);
  return Number.isInteger(policyId) && policyId > 0 ? policyId : null;
}

async function lockPolicyContext({ client, policyId }) {
  const result = await client.query(
    `SELECT id, library_id
     FROM library_policies
     WHERE id = $1
     FOR SHARE`,
    [policyId],
  );

  return firstRow(result);
}

async function lockReplacementExecutionGate({ client, policyId }) {
  const result = await client.query(
    `SELECT
       id,
       policy_id,
       intent_id,
       library_id,
       state,
       transition_fingerprint,
       proposal_fingerprint,
       rollback_plan_fingerprint,
       verification_run_id,
       verification_run_fingerprint,
       rollback_snapshot_id,
       replacement_intent_id,
       replacement_event_id,
       replacement_applied_at
     FROM policy_library_rebuild_execution_gates
     WHERE policy_id = $1
       AND state = 'replacement_applied'
     ORDER BY replacement_applied_at DESC, id DESC
     LIMIT 1
     FOR SHARE`,
    [policyId],
  );

  return firstRow(result);
}

async function lockVerificationReceipt({ client, verificationRunId }) {
  if (!verificationRunId) return null;

  const result = await client.query(
    `SELECT
       id,
       policy_id,
       intent_id,
       library_id,
       acceptance_transition_fingerprint,
       source_id,
       source_media_type,
       source_deterministic_order_id,
       source_coverage_sufficient,
       source_audit_ok,
       source_audit_issue_count,
       verifier_status_id,
       verifier_fingerprint,
       verifier_difference_count,
       verifier_emitted_difference_count,
       verifier_differences_truncated,
       verifier_audit_ok,
       verifier_audit_issue_count,
       coordinator_audit_ok,
       coordinator_audit_issue_count
     FROM policy_migration_verification_runs
     WHERE id = $1
     FOR SHARE`,
    [verificationRunId],
  );

  return firstRow(result);
}

async function lockRollbackSnapshot({ client, rollbackSnapshotId, policyId }) {
  if (!rollbackSnapshotId) return null;

  const result = await client.query(
    `SELECT
       id,
       policy_id,
       intent_id,
       payload_redacted,
       expires_at,
       restored_at
     FROM policy_intent_rollback_snapshots
     WHERE id = $1
       AND policy_id = $2
     FOR SHARE`,
    [rollbackSnapshotId, policyId],
  );

  return firstRow(result);
}

async function lockReplacementEvent({ client, replacementEventId, policyId }) {
  if (!replacementEventId) return null;

  const result = await client.query(
    `SELECT
       id,
       policy_id,
       intent_id,
       event_type,
       metadata ->> 'executionGateId' AS execution_gate_id,
       metadata ->> 'rollbackSnapshotId' AS rollback_snapshot_id,
       metadata ->> 'verificationRunId' AS verification_run_id,
       metadata ->> 'transitionFingerprint' AS transition_fingerprint,
       metadata ->> 'verificationRunFingerprint' AS verification_run_fingerprint
     FROM policy_intent_migration_events
     WHERE id = $1
       AND policy_id = $2
     FOR SHARE`,
    [replacementEventId, policyId],
  );

  return firstRow(result);
}

async function lockActiveNativeIntents({ client, policyId, libraryId }) {
  const result = await client.query(
    `SELECT id, policy_id, library_id
     FROM policy_intents
     WHERE policy_id = $1
       AND library_id = $2
       AND active = TRUE
       AND source = 'native_intent'
       AND inference_state = 'inferred'
       AND validation_status IN ('valid', 'warning')
     ORDER BY id ASC
     FOR SHARE`,
    [policyId, libraryId],
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}

async function loadPolicyLibraryRebuildLegacyDeletionEvidence({ client, policyId } = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Library rebuild legacy deletion readiness requires a transaction client.');
  }

  const normalizedPolicyId = normalizePolicyId(policyId);
  if (!normalizedPolicyId) {
    return {
      policy: null,
      executionGate: null,
      verificationReceipt: null,
      rollbackSnapshot: null,
      replacementEvent: null,
      activeNativeIntents: [],
    };
  }

  // Writers lock the policy before their dependent evidence. Taking shared
  // locks in the same order prevents this read from combining two cutovers.
  const policy = await lockPolicyContext({ client, policyId: normalizedPolicyId });
  if (!policy) {
    return {
      policy: null,
      executionGate: null,
      verificationReceipt: null,
      rollbackSnapshot: null,
      replacementEvent: null,
      activeNativeIntents: [],
    };
  }

  const executionGate = await lockReplacementExecutionGate({
    client,
    policyId: normalizedPolicyId,
  });
  const verificationReceipt = await lockVerificationReceipt({
    client,
    verificationRunId: executionGate?.verification_run_id,
  });
  const rollbackSnapshot = await lockRollbackSnapshot({
    client,
    rollbackSnapshotId: executionGate?.rollback_snapshot_id,
    policyId: normalizedPolicyId,
  });
  const replacementEvent = await lockReplacementEvent({
    client,
    replacementEventId: executionGate?.replacement_event_id,
    policyId: normalizedPolicyId,
  });
  const activeNativeIntents = await lockActiveNativeIntents({
    client,
    policyId: normalizedPolicyId,
    libraryId: policy.library_id,
  });

  return {
    policy,
    executionGate,
    verificationReceipt,
    rollbackSnapshot,
    replacementEvent,
    activeNativeIntents,
  };
}

export {
  loadPolicyLibraryRebuildLegacyDeletionEvidence,
};

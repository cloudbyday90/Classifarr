/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const maximumSafeId = Number.MAX_SAFE_INTEGER;

// Bind the exact type emitted by the capture and replacement producers.
function producerReferenceSql(column) {
  return `CASE WHEN ${column} > ${maximumSafeId}
               THEN to_jsonb(${column}::text)
               ELSE to_jsonb(${column})
          END`;
}

// Removal readiness also accepts exact decimal strings for safe companions.
function replacementReferenceMatchesSql(key, column) {
  const metadata = `replacement_event.metadata -> '${key}'`;
  return `(${metadata} = to_jsonb(${column}::text)
           OR (${column} <= ${maximumSafeId}
               AND jsonb_typeof(${metadata}) = 'number'
               AND replacement_event.metadata ->> '${key}' = ${column}::text))`;
}

const captureProofSql = `CASE
         WHEN execution.intent_id > ${maximumSafeId} OR execution.verification_run_id > ${maximumSafeId}
         THEN EXISTS (
           SELECT 1
           FROM policy_intent_migration_events capture_event
           WHERE capture_event.id = execution.migration_event_id
             AND capture_event.id > 0
             AND capture_event.policy_id = execution.policy_id
             AND capture_event.intent_id = execution.intent_id
             AND capture_event.event_type = 'rollback_snapshot_created'
             AND capture_event.reason_code = 'library_rebuild_snapshot_persisted'
             AND capture_event.metadata -> 'snapshotId' = ${producerReferenceSql('execution.rollback_snapshot_id')}
             AND capture_event.metadata ->> 'transitionFingerprint' = execution.transition_fingerprint
             AND capture_event.metadata -> 'verificationRunId' = ${producerReferenceSql('execution.verification_run_id')}
             AND capture_event.metadata ->> 'verificationRunFingerprint' = execution.verification_run_fingerprint
             AND (execution.intent_id <= ${maximumSafeId}
                  OR capture_event.metadata -> 'originalIntentId' = to_jsonb(execution.intent_id::text))
         )
         ELSE TRUE
       END`;

const replacementIntentProofSql = `CASE
         WHEN execution.intent_id > ${maximumSafeId} OR execution.replacement_intent_id > ${maximumSafeId}
         THEN replacement_event.metadata -> 'executionGateId' = ${producerReferenceSql('execution.id')}
           AND replacement_event.metadata -> 'replacementIntentId' = ${producerReferenceSql('execution.replacement_intent_id')}
           AND (execution.intent_id <= ${maximumSafeId}
                OR replacement_event.metadata -> 'originalIntentId' = to_jsonb(execution.intent_id::text))
         ELSE TRUE
       END`;

export const LIBRARY_REBUILD_LIFECYCLE_PROOF_SQL = `CASE
         WHEN execution.intent_id > ${maximumSafeId}
           OR execution.replacement_intent_id > ${maximumSafeId}
           OR execution.id > ${maximumSafeId}
           OR execution.rollback_snapshot_id > ${maximumSafeId}
           OR execution.verification_run_id > ${maximumSafeId}
         THEN execution.intent_id > 0
           AND execution.replacement_intent_id > 0
           AND execution.id > 0
           AND execution.rollback_snapshot_id > 0
           AND execution.verification_run_id > 0
           AND ${replacementReferenceMatchesSql('executionGateId', 'execution.id')}
           AND ${replacementReferenceMatchesSql('rollbackSnapshotId', 'execution.rollback_snapshot_id')}
           AND ${replacementReferenceMatchesSql('verificationRunId', 'execution.verification_run_id')}
           AND replacement_event.metadata ->> 'transitionFingerprint' = execution.transition_fingerprint
           AND replacement_event.metadata ->> 'verificationRunFingerprint' = execution.verification_run_fingerprint
           AND ${replacementIntentProofSql}
           AND ${captureProofSql}
         ELSE TRUE
       END`;

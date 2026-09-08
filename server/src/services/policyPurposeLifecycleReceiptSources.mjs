/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS = Object.freeze({
  INITIAL_INTENT_ESTABLISHMENT: 'initial_intent_establishment',
  NATIVE_INTENT_CHANGE: 'native_intent_change',
  LIBRARY_REBUILD_REPLACEMENT: 'library_rebuild_replacement',
});

function normalizeScope(value) {
  if (value === 'active-policy-inventory' || value === 'recent-receipt-window') {
    return value;
  }

  throw new TypeError('Policy-purpose lifecycle receipt sources require a known fixed query scope.');
}

function activePolicyScopeJoin(scope, tableAlias) {
  return scope === 'active-policy-inventory'
    ? `JOIN active_native_policies active ON active.policy_id = ${tableAlias}.policy_id`
    : '';
}

function recentWindowSql(scope, occurredAtSql, receiptIdSql) {
  return scope === 'recent-receipt-window'
    ? `ORDER BY ${occurredAtSql} DESC NULLS LAST, ${receiptIdSql} DESC
       LIMIT $1`
    : '';
}

/**
 * Produces the fixed SQL CTEs for lifecycle records that ordinary native
 * authoring already persists. A library rebuild is admitted only when its
 * terminal execution gate, immutable verification run, replacement event,
 * source revision, and replacement revision all agree. The SQL never selects
 * an identifier, fingerprint, actor, library, policy, rule value, media row,
 * or configuration value for the application layer.
 */
export function buildPolicyPurposeLifecycleReceiptSourceCtesSql({ scope } = {}) {
  const normalizedScope = normalizeScope(scope);
  const initialScopeJoin = activePolicyScopeJoin(normalizedScope, 'establishment');
  const changeScopeJoin = activePolicyScopeJoin(normalizedScope, 'change_receipt');
  const rebuildScopeJoin = activePolicyScopeJoin(normalizedScope, 'execution');

  return `initial_lifecycle_receipts AS (
       SELECT
         establishment.intent_id,
         establishment.policy_id,
         1::INTEGER AS expected_intent_version,
         establishment.established_at AS occurred_at,
         establishment.id AS receipt_id,
         '${POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.INITIAL_INTENT_ESTABLISHMENT}'::TEXT
           AS lifecycle_transition
       FROM policy_initial_intent_establishments establishment
       ${initialScopeJoin}
       WHERE establishment.state = 'established'
         AND establishment.intent_id IS NOT NULL
       ${recentWindowSql(normalizedScope, 'establishment.established_at', 'establishment.id')}
     ),
     change_lifecycle_receipts AS (
       SELECT
         change_receipt.target_intent_id AS intent_id,
         change_receipt.policy_id,
         change_receipt.target_intent_version AS expected_intent_version,
         change_receipt.created_at AS occurred_at,
         change_receipt.id AS receipt_id,
         '${POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.NATIVE_INTENT_CHANGE}'::TEXT
           AS lifecycle_transition
       FROM policy_native_intent_change_receipts change_receipt
       ${changeScopeJoin}
       WHERE change_receipt.result_status_id = 'applied'
       ${recentWindowSql(normalizedScope, 'change_receipt.created_at', 'change_receipt.id')}
     ),
     library_rebuild_replacement_lifecycle_receipts AS (
       SELECT
         execution.replacement_intent_id AS intent_id,
         execution.policy_id,
         replacement_event.target_version AS expected_intent_version,
         execution.replacement_applied_at AS occurred_at,
         replacement_event.id AS receipt_id,
         '${POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.LIBRARY_REBUILD_REPLACEMENT}'::TEXT
           AS lifecycle_transition
       FROM policy_library_rebuild_execution_gates execution
       JOIN policy_intent_migration_events replacement_event
         ON replacement_event.id = execution.replacement_event_id
        AND replacement_event.policy_id = execution.policy_id
        AND replacement_event.intent_id = execution.replacement_intent_id
        AND replacement_event.event_type = 'library_rebuild_replacement_applied'
       JOIN policy_intents source_intent
         ON source_intent.id = execution.intent_id
        AND source_intent.policy_id = execution.policy_id
        AND source_intent.library_id = execution.library_id
       JOIN policy_intents replacement_intent
         ON replacement_intent.id = execution.replacement_intent_id
        AND replacement_intent.policy_id = execution.policy_id
        AND replacement_intent.library_id = execution.library_id
       JOIN policy_migration_verification_runs verification_run
         ON verification_run.id = execution.verification_run_id
        AND verification_run.policy_id = execution.policy_id
        AND verification_run.intent_id = execution.intent_id
        AND verification_run.library_id = execution.library_id
        AND verification_run.acceptance_transition_fingerprint = execution.transition_fingerprint
        AND verification_run.verifier_fingerprint = execution.verification_run_fingerprint
       ${rebuildScopeJoin}
       WHERE execution.state = 'replacement_applied'
         AND execution.replacement_intent_id IS NOT NULL
         AND execution.replacement_event_id IS NOT NULL
         AND execution.replacement_applied_at IS NOT NULL
         AND replacement_event.source_version = source_intent.intent_version
         AND replacement_event.target_version = replacement_intent.intent_version
         AND verification_run.run_version = 1
         AND verification_run.source_coverage_sufficient = TRUE
         AND verification_run.source_audit_ok = TRUE
         AND verification_run.source_audit_issue_count = 0
         AND verification_run.verifier_status_id = 'no_migration_differences'
         AND verification_run.verifier_difference_count = 0
         AND verification_run.verifier_emitted_difference_count = 0
         AND verification_run.verifier_differences_truncated = FALSE
         AND verification_run.verifier_audit_ok = TRUE
         AND verification_run.verifier_audit_issue_count = 0
         AND verification_run.coordinator_audit_ok = TRUE
         AND verification_run.coordinator_audit_issue_count = 0
       ${recentWindowSql(normalizedScope, 'execution.replacement_applied_at', 'replacement_event.id')}
     ),
     normal_lifecycle_receipts AS (
       SELECT * FROM initial_lifecycle_receipts

       UNION ALL

       SELECT * FROM change_lifecycle_receipts

       UNION ALL

       SELECT * FROM library_rebuild_replacement_lifecycle_receipts
     )`;
}

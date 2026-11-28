/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { INITIAL_ESTABLISHMENT_RECEIPT_PROOF_JOINS_SQL } from './policyInitialEstablishmentReceiptProofSql.mjs';
import { POLICY_ROLLBACK_PAYLOAD_SECTION_IDS } from './policyRollbackSnapshotWindow.mjs';

const requiredSections = JSON.stringify(Object.values(POLICY_ROLLBACK_PAYLOAD_SECTION_IDS));

// Both callers scope the snapshot to the current policy. PostgreSQL supplies
// exact ownership and shape checks without projecting evidence in readiness.
export const INITIAL_ESTABLISHMENT_ROLLBACK_PROOF_SQL = `EXISTS (
         SELECT 1 FROM policy_initial_intent_establishments establishment
         ${INITIAL_ESTABLISHMENT_RECEIPT_PROOF_JOINS_SQL}
         WHERE establishment.rollback_snapshot_id = snapshot.id
           AND establishment.policy_id = policy.id
           AND establishment.library_id = policy.library_id
           AND establishment.intent_id = snapshot.intent_id
           AND establishment.state = 'established'
           AND establishment.accepted_by > 0
           AND snapshot.snapshot_version = 1
       )`;

export const INITIAL_ESTABLISHMENT_ROLLBACK_MANIFEST_SQL = `CASE
         WHEN snapshot.restored_at IS NULL AND snapshot.payload_redacted IS FALSE THEN COALESCE(
           snapshot.snapshot_payload -> 'policy_id' IN (to_jsonb(policy.id), to_jsonb(policy.id::text))
           AND snapshot.snapshot_payload -> 'library_id' IN (to_jsonb(policy.library_id), to_jsonb(policy.library_id::text))
           AND jsonb_typeof(snapshot.snapshot_payload -> 'restore_sections') = 'array'
           AND (snapshot.snapshot_payload -> 'restore_sections') @> '${requiredSections}'::jsonb
           AND jsonb_typeof(snapshot.snapshot_payload -> 'legacy_policy') = 'object'
           AND jsonb_typeof(snapshot.snapshot_payload -> 'presets') = 'array'
           AND snapshot.snapshot_payload ? 'routing_target',
           FALSE
         )
         ELSE FALSE
       END`;

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
  POLICY_LEARNING_TIER_IDS,
} from './policyLearningGuard.mjs';

const POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_COMMAND_VERSION =
  'policy.authorized_outcome_persistence_command.v1';

const POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS = Object.freeze({
  READY: 'ready',
  OUTCOME_ONLY: 'outcome_only',
  BLOCKED: 'blocked',
});

const POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS = Object.freeze({
  RECORD_FINAL_OUTCOME: 'record_final_outcome',
  VERIFY_RECORDED_FINAL_OUTCOME: 'verify_recorded_final_outcome',
  WRITE_EXACT_ITEM_MEMORY: 'write_exact_item_memory',
  WRITE_COMPATIBILITY_EVIDENCE: 'write_compatibility_evidence',
  WRITE_IDENTITY_EVIDENCE: 'write_identity_evidence',
  QUEUE_PROFILE_REFRESH: 'queue_profile_refresh',
});

const POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_ACTOR_TYPE_IDS = Object.freeze({
  OPERATOR: 'operator',
  SYSTEM: 'system',
});

const POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS = Object.freeze({
  OUTCOME_AUTHORIZED: 'authorized_persistence_outcome_authorized',
  LEARNING_AUTHORIZED: 'authorized_persistence_learning_authorized',
  LEARNING_NOT_AUTHORIZED: 'authorized_persistence_learning_not_authorized',
  PROFILE_REFRESH_AUTHORIZED: 'authorized_persistence_profile_refresh_authorized',
  INVALID_INTAKE: 'authorized_persistence_invalid_intake',
  INVALID_GUARD_DECISION: 'authorized_persistence_invalid_guard_decision',
  SOURCE_MISMATCH: 'authorized_persistence_source_mismatch',
  SOURCE_EVENT_MISMATCH: 'authorized_persistence_source_event_mismatch',
  FINAL_OUTCOME_MISMATCH: 'authorized_persistence_final_outcome_mismatch',
  CURRENT_STATE_MISSING: 'authorized_persistence_current_state_missing',
  CURRENT_STATE_MISMATCH: 'authorized_persistence_current_state_mismatch',
  TRANSACTION_LOCK_REQUIRED: 'authorized_persistence_transaction_lock_required',
  AUTHORIZATION_REVALIDATION_REQUIRED: 'authorized_persistence_authorization_revalidation_required',
  OUTCOME_NOT_AUTHORIZED: 'authorized_persistence_outcome_not_authorized',
  SOURCE_NOT_AUTHORIZED: 'authorized_persistence_source_not_authorized',
  ACTOR_MISMATCH: 'authorized_persistence_actor_mismatch',
  UNSUPPORTED_LEARNING_TIER: 'authorized_persistence_unsupported_learning_tier',
  LEARNING_CANDIDATE_MISSING: 'authorized_persistence_learning_candidate_missing',
  LEARNING_DESTINATION_MISMATCH: 'authorized_persistence_learning_destination_mismatch',
  FINAL_OUTCOME_VERIFICATION_REQUIRES_EXACT_ITEM_MEMORY:
    'authorized_persistence_final_outcome_verification_requires_exact_item_memory',
});

const POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_authorized_outcome_persistence_command_version',
  INVALID_STATUS: 'invalid_authorized_outcome_persistence_command_status',
  INVALID_FINAL_OUTCOME: 'invalid_authorized_outcome_persistence_final_outcome',
  MISSING_OUTCOME_OPERATION: 'missing_authorized_outcome_persistence_outcome_operation',
  INVALID_FINAL_OUTCOME_VERIFICATION_OPERATION:
    'invalid_authorized_outcome_persistence_final_outcome_verification_operation',
  INVALID_READY_LEARNING_OPERATION: 'invalid_ready_authorized_outcome_persistence_learning_operation',
  OUTCOME_ONLY_HAS_LEARNING_OPERATION: 'outcome_only_authorized_persistence_has_learning_operation',
  UNAUTHORIZED_OUTCOME_OPERATION: 'unauthorized_outcome_persistence_outcome_operation',
  UNAUTHORIZED_LEARNING_OPERATION: 'unauthorized_outcome_persistence_learning_operation',
  ACTOR_MISMATCH: 'authorized_outcome_persistence_actor_mismatch',
  LEARNING_DESTINATION_MISMATCH: 'authorized_outcome_persistence_learning_destination_mismatch',
  INVALID_PROFILE_REFRESH_OPERATION: 'invalid_authorized_outcome_profile_refresh_operation',
  PROFILE_REFRESH_DESTINATION_MISMATCH: 'authorized_outcome_profile_refresh_destination_mismatch',
  PROFILE_REFRESH_REASON_MISSING: 'authorized_outcome_profile_refresh_reason_missing',
  SOURCE_EVENT_MISMATCH: 'authorized_outcome_persistence_source_event_mismatch',
  CURRENT_STATE_MISMATCH: 'authorized_outcome_persistence_current_state_mismatch',
  SIDE_EFFECT_REPORTED: 'authorized_outcome_persistence_side_effect_reported',
});

const LEARNING_OPERATION_BY_TIER = Object.freeze({
  [POLICY_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY]:
    POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_EXACT_ITEM_MEMORY,
  [POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE]:
    POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_COMPATIBILITY_EVIDENCE,
  [POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE]:
    POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_IDENTITY_EVIDENCE,
});

export {
  LEARNING_OPERATION_BY_TIER,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_ACTOR_TYPE_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_COMMAND_VERSION,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_REASON_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS,
};

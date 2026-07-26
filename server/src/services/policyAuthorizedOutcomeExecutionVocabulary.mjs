/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_AUTHORIZED_OUTCOME_EXECUTION_VERSION =
  'policy.authorized_outcome_transaction_executor.v1';

const POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS = Object.freeze({
  APPLIED: 'applied',
  REPLAYED: 'replayed',
  BLOCKED: 'blocked',
  SOURCE_EVENT_MISMATCH: 'source_event_mismatch',
});

const POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS = Object.freeze({
  INVALID_INTAKE: 'authorized_outcome_execution_invalid_intake',
  CLASSIFICATION_NOT_FOUND: 'authorized_outcome_execution_classification_not_found',
  DESTINATION_NOT_FOUND: 'authorized_outcome_execution_destination_not_found',
  DESTINATION_INACTIVE: 'authorized_outcome_execution_destination_inactive',
  DESTINATION_MEDIA_TYPE_MISMATCH: 'authorized_outcome_execution_destination_media_type_mismatch',
  DESTINATION_NAME_MISMATCH: 'authorized_outcome_execution_destination_name_mismatch',
  COMMAND_BLOCKED: 'authorized_outcome_execution_command_blocked',
  SOURCE_EVENT_MISMATCH: 'authorized_outcome_execution_source_event_mismatch',
  FINAL_OUTCOME_PERSISTED: 'authorized_outcome_execution_final_outcome_persisted',
  EXACT_ITEM_MEMORY_PERSISTED: 'authorized_outcome_execution_exact_item_memory_persisted',
  EXACT_ITEM_MEMORY_ALREADY_PRESENT: 'authorized_outcome_execution_exact_item_memory_already_present',
  COMPATIBILITY_EVIDENCE_PERSISTED: 'authorized_outcome_execution_compatibility_evidence_persisted',
  IDENTITY_EVIDENCE_ADMISSION_PERSISTED:
    'authorized_outcome_execution_identity_evidence_admission_persisted',
  PROFILE_REFRESH_OUTBOX_PERSISTED:
    'authorized_outcome_execution_profile_refresh_outbox_persisted',
  LEARNING_OPERATION_UNAVAILABLE: 'authorized_outcome_execution_learning_operation_unavailable',
  PROFILE_REFRESH_UNAVAILABLE: 'authorized_outcome_execution_profile_refresh_unavailable',
});

export {
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_REASON_IDS,
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_STATUS_IDS,
  POLICY_AUTHORIZED_OUTCOME_EXECUTION_VERSION,
};

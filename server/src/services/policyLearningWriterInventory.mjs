/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const POLICY_LEARNING_WRITER_CLASSIFICATIONS = Object.freeze({
  AUTHORIZED_EXECUTOR: 'authorized_executor_integration',
  CONTROLLED_MAINTENANCE: 'controlled_maintenance_only',
  MIGRATION_ONLY: 'migration_only',
  REMOVED_FROM_RUNTIME: 'removed_from_normal_runtime',
  DELETION_CANDIDATE: 'deletion_candidate',
});

const REQUIRED_EXECUTOR_CONTROLS = Object.freeze([
  'learning_guard',
  'command_audit',
  'source_event_receipt',
  'provenance_record',
]);

function defineWriter(entry) {
  return Object.freeze({
    automaticRuntimeWriteAllowed: false,
    requiredControls: Object.freeze([]),
    ...entry,
    sourcePaths: Object.freeze([...entry.sourcePaths]),
    requiredControls: Object.freeze([...(entry.requiredControls || [])]),
  });
}

const POLICY_LEARNING_WRITER_INVENTORY = Object.freeze([
  defineWriter({
    id: 'authorized_outcome_exact_item_memory',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.AUTHORIZED_EXECUTOR,
    automaticRuntimeWriteAllowed: true,
    writeTarget: 'classification_evidence:item_exact',
    sourcePaths: [
      'server/src/services/policyAuthorizedOutcomeTransactionExecutor.mjs',
      'server/src/services/policyAuthorizedOutcomeExecutionEffects.mjs',
    ],
    requiredControls: REQUIRED_EXECUTOR_CONTROLS,
  }),
  defineWriter({
    id: 'authorized_outcome_destination_evidence',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.AUTHORIZED_EXECUTOR,
    automaticRuntimeWriteAllowed: true,
    writeTarget: 'classification_evidence:compatibility_or_identity',
    sourcePaths: [
      'server/src/services/policyAuthorizedOutcomeTransactionExecutor.mjs',
      'server/src/services/policyRefreshBackedEvidencePersistence.mjs',
      'server/src/services/policyCompatibilityEvidenceWriter.mjs',
      'server/src/services/policyIdentityEvidenceAuthorityWriter.mjs',
    ],
    requiredControls: REQUIRED_EXECUTOR_CONTROLS,
  }),
  defineWriter({
    id: 'evidence_administration',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.CONTROLLED_MAINTENANCE,
    writeTarget: 'classification_evidence:status_or_filtered_purge',
    sourcePaths: ['server/src/routes/evidenceRouteShared.mjs'],
  }),
  defineWriter({
    id: 'backup_restore_evidence',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.CONTROLLED_MAINTENANCE,
    writeTarget: 'legacy_patterns_and_classification_evidence:restore_or_replace',
    sourcePaths: [
      'server/src/services/backupRestore.mjs',
      'server/src/services/backupRestoreTables.mjs',
    ],
  }),
  defineWriter({
    id: 'clear_and_resync_cleanup',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.CONTROLLED_MAINTENANCE,
    writeTarget: 'legacy_patterns:destructive_clear',
    sourcePaths: ['server/src/services/queueCarsaCleanup.mjs'],
  }),
  defineWriter({
    id: 'classification_evidence_backfill',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.MIGRATION_ONLY,
    writeTarget: 'classification_evidence:legacy_backfill',
    sourcePaths: ['server/src/services/classificationEvidenceMigrationBackfillService.mjs'],
  }),
  defineWriter({
    id: 'automatic_pattern_reinforcement',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
    writeTarget: 'legacy_patterns_and_classification_evidence:genre_reinforcement',
    sourcePaths: ['server/src/services/classificationServiceCore.mjs'],
  }),
  defineWriter({
    id: 'queue_admin_exact_memory',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
    writeTarget: 'classification_evidence:item_exact',
    sourcePaths: ['server/src/services/queueAdminService.mjs'],
  }),
  defineWriter({
    id: 'retry_evidence_purge',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
    writeTarget: 'classification_evidence:item_exact_purge',
    sourcePaths: [
      'server/src/routes/classificationRouteShared.mjs',
      'server/src/services/classificationRetryService.mjs',
    ],
  }),
  defineWriter({
    id: 'reclassification_learned_correction',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
    writeTarget: 'learned_corrections:upsert',
    sourcePaths: [
      'server/src/services/reclassificationService.mjs',
      'server/src/services/reclassificationQueries.mjs',
    ],
  }),
  defineWriter({
    id: 'media_sync_learned_correction',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
    writeTarget: 'learned_corrections:upsert',
    sourcePaths: ['server/src/services/mediaSyncLibraryStateService.mjs'],
  }),
  defineWriter({
    id: 'classification_evidence_reinforcement_service',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.DELETION_CANDIDATE,
    writeTarget: 'legacy_patterns_and_classification_evidence:genre_reinforcement',
    sourcePaths: ['server/src/services/classificationEvidenceReinforcementService.mjs'],
  }),
  defineWriter({
    id: 'pattern_reinforcement_service',
    classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.DELETION_CANDIDATE,
    writeTarget: 'legacy_patterns:automatic_reinforcement',
    sourcePaths: ['server/src/services/patternReinforcementService.mjs'],
  }),
]);

function hasRequiredExecutorControls(requiredControls) {
  return REQUIRED_EXECUTOR_CONTROLS.every((control) => requiredControls.includes(control));
}

function evaluatePolicyLearningWriterInventory(inventory = POLICY_LEARNING_WRITER_INVENTORY) {
  const violations = [];
  const seenIds = new Set();
  const classifications = new Set(Object.values(POLICY_LEARNING_WRITER_CLASSIFICATIONS));

  for (const entry of inventory) {
    if (!entry?.id || seenIds.has(entry.id)) {
      violations.push({ id: entry?.id || null, reason: 'missing_or_duplicate_id' });
      continue;
    }
    seenIds.add(entry.id);

    if (!classifications.has(entry.classification)) {
      violations.push({ id: entry.id, reason: 'unknown_classification' });
    }
    if (!Array.isArray(entry.sourcePaths) || entry.sourcePaths.length === 0) {
      violations.push({ id: entry.id, reason: 'missing_source_paths' });
    }
    if (!entry.writeTarget) {
      violations.push({ id: entry.id, reason: 'missing_write_target' });
    }

    if (entry.classification === POLICY_LEARNING_WRITER_CLASSIFICATIONS.AUTHORIZED_EXECUTOR) {
      if (!entry.automaticRuntimeWriteAllowed) {
        violations.push({ id: entry.id, reason: 'executor_runtime_write_not_allowed' });
      }
      if (!hasRequiredExecutorControls(entry.requiredControls || [])) {
        violations.push({ id: entry.id, reason: 'executor_controls_incomplete' });
      }
    } else if (entry.automaticRuntimeWriteAllowed) {
      violations.push({ id: entry.id, reason: 'non_executor_runtime_write_allowed' });
    }
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations.map((violation) => Object.freeze(violation))),
  });
}

export {
  POLICY_LEARNING_WRITER_CLASSIFICATIONS,
  POLICY_LEARNING_WRITER_INVENTORY,
  REQUIRED_EXECUTOR_CONTROLS,
  evaluatePolicyLearningWriterInventory,
};

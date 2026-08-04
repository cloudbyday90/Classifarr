import { describe, expect, test } from '@jest/globals';

import {
  POLICY_LEARNING_WRITER_CLASSIFICATIONS,
  POLICY_LEARNING_WRITER_INVENTORY,
  REQUIRED_EXECUTOR_CONTROLS,
  evaluatePolicyLearningWriterInventory,
} from '../../services/policyLearningWriterInventory.mjs';

describe('policyLearningWriterInventory', () => {
  test('permits automatic learning writes only through guarded authorized executors', () => {
    const evaluation = evaluatePolicyLearningWriterInventory();

    expect(evaluation).toEqual({ valid: true, violations: [] });

    const runtimeWriters = POLICY_LEARNING_WRITER_INVENTORY.filter(
      (entry) => entry.automaticRuntimeWriteAllowed,
    );
    expect(runtimeWriters).toHaveLength(2);
    expect(runtimeWriters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'authorized_outcome_exact_item_memory',
        classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.AUTHORIZED_EXECUTOR,
        requiredControls: REQUIRED_EXECUTOR_CONTROLS,
      }),
      expect.objectContaining({
        id: 'authorized_outcome_destination_evidence',
        classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.AUTHORIZED_EXECUTOR,
        requiredControls: REQUIRED_EXECUTOR_CONTROLS,
      }),
    ]));
  });

  test('records retired runtime mutation paths and remaining removal candidates', () => {
    const classificationsById = new Map(
      POLICY_LEARNING_WRITER_INVENTORY.map((entry) => [entry.id, entry.classification]),
    );

    expect(Object.fromEntries(classificationsById)).toEqual(expect.objectContaining({
      automatic_pattern_reinforcement:
        POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
      queue_admin_exact_memory:
        POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
      retry_evidence_purge:
        POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
      reclassification_learned_correction:
        POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
      media_sync_learned_correction:
        POLICY_LEARNING_WRITER_CLASSIFICATIONS.REMOVED_FROM_RUNTIME,
      classification_evidence_reinforcement_service:
        POLICY_LEARNING_WRITER_CLASSIFICATIONS.DELETION_CANDIDATE,
    }));
  });

  test('fails closed when a non-executor entry grants automatic runtime writes', () => {
    const evaluation = evaluatePolicyLearningWriterInventory([{
      id: 'unsafe_writer',
      classification: POLICY_LEARNING_WRITER_CLASSIFICATIONS.MIGRATION_ONLY,
      automaticRuntimeWriteAllowed: true,
      writeTarget: 'classification_evidence:item_exact',
      sourcePaths: ['server/src/services/unsafeWriter.mjs'],
      requiredControls: [],
    }]);

    expect(evaluation).toEqual({
      valid: false,
      violations: [{ id: 'unsafe_writer', reason: 'non_executor_runtime_write_allowed' }],
    });
  });
});

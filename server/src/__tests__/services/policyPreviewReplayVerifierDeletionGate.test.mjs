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
  POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_VERSION,
  REQUIRED_DELETION_POLICY,
  buildPolicyPreviewReplayVerifierDeletionGate,
  validatePolicyPreviewReplayVerifierDeletionGate,
} from '../../services/policyPreviewReplayVerifierDeletionGate.mjs';
import {
  listPolicyPreviewReplayVerifierArtifacts,
} from '../../services/policyPreviewReplayVerifierCutline.mjs';

const ALL_CONDITIONS_PROVEN = {
  migrationParityEvidence: { proven: true },
  nativeStorageCutoverEvidence: { complete: true, unconvertedPolicyCount: 0 },
  rollbackRetentionEvidence: { expired: true },
  rebuildBindingEvidence: { noActiveBinding: true },
};

describe('policyPreviewReplayVerifierDeletionGate', () => {
  test('reports ready when all four exit criteria are explicitly proven', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate(ALL_CONDITIONS_PROVEN);

    expect(gate).toEqual(expect.objectContaining({
      version: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_VERSION,
      statusId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.READY_FOR_VERIFIER_DELETION,
      readyForDeletion: true,
      riskCount: 0,
      risks: [],
    }));
    expect(gate.validation.ok).toBe(true);
    expect(gate.nextStep.stepId).toBe('execute_verifier_deletion_or_promotion');
    expect(gate.artifacts.activeCount).toBeGreaterThan(0);
    expect(gate.deletionPolicy).toEqual(REQUIRED_DELETION_POLICY);
    expect(Object.values(gate.sideEffects).every(value => value === false)).toBe(true);
  });

  test('fails closed when migration parity evidence is missing', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate({
      ...ALL_CONDITIONS_PROVEN,
      migrationParityEvidence: undefined,
    });

    expect(gate.readyForDeletion).toBe(false);
    expect(gate.statusId).toBe(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_MIGRATION_PARITY);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.MIGRATION_PARITY_EVIDENCE_MISSING,
      }),
    ]));
  });

  test('fails closed when migration parity is explicitly not proven', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate({
      ...ALL_CONDITIONS_PROVEN,
      migrationParityEvidence: { proven: false },
    });

    expect(gate.readyForDeletion).toBe(false);
    expect(gate.statusId).toBe(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_MIGRATION_PARITY);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.MIGRATION_PARITY_NOT_PROVEN,
      }),
    ]));
  });

  test('fails closed when native storage cutover is incomplete', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate({
      ...ALL_CONDITIONS_PROVEN,
      nativeStorageCutoverEvidence: { complete: false },
    });

    expect(gate.readyForDeletion).toBe(false);
    expect(gate.statusId).toBe(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_NATIVE_STORAGE_CUTOVER);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.NATIVE_STORAGE_CUTOVER_NOT_COMPLETE,
      }),
    ]));
  });

  test('fails closed when rollback retention window has not expired', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate({
      ...ALL_CONDITIONS_PROVEN,
      rollbackRetentionEvidence: { expired: false },
    });

    expect(gate.readyForDeletion).toBe(false);
    expect(gate.statusId).toBe(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_ROLLBACK_RETENTION);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.ROLLBACK_RETENTION_NOT_EXPIRED,
      }),
    ]));
  });

  test('fails closed when an active rebuild binding remains', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate({
      ...ALL_CONDITIONS_PROVEN,
      rebuildBindingEvidence: { noActiveBinding: false },
    });

    expect(gate.readyForDeletion).toBe(false);
    expect(gate.statusId).toBe(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_ACTIVE_REBUILD_BINDING);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.ACTIVE_REBUILD_BINDING_REMAINS,
      }),
    ]));
  });

  test('fails closed when all conditions are unproven', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate({});

    expect(gate.readyForDeletion).toBe(false);
    expect(gate.riskCount).toBeGreaterThanOrEqual(4);
    expect(gate.statusId).toBe(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_MIGRATION_PARITY);
  });

  test('reports blocked by cutline inventory when no active artifacts exist', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate({
      artifacts: [],
      ...ALL_CONDITIONS_PROVEN,
    });

    expect(gate.readyForDeletion).toBe(false);
    expect(gate.statusId).toBe(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_CUTLINE_INVENTORY);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.CUTLINE_INVENTORY_EMPTY,
      }),
    ]));
  });

  test('reports blocked by cutline inventory when an active artifact lacks exit criteria', () => {
    const artifacts = listPolicyPreviewReplayVerifierArtifacts();
    const tamperedArtifact = {
      ...artifacts[0],
      exitCriterionIds: [],
    };

    const gate = buildPolicyPreviewReplayVerifierDeletionGate({
      artifacts: [tamperedArtifact, ...artifacts.slice(1)],
      ...ALL_CONDITIONS_PROVEN,
    });

    expect(gate.readyForDeletion).toBe(false);
    expect(gate.statusId).toBe(
      POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_STATUS_IDS.BLOCKED_BY_CUTLINE_INVENTORY);
    expect(gate.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.CUTLINE_INVENTORY_DRIFT,
      }),
    ]));
  });

  test('rejects a gate that claims ready but has risks', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate({
      migrationParityEvidence: { proven: false },
    });
    const tampered = {
      ...gate,
      readyForDeletion: true,
    };

    const validation = validatePolicyPreviewReplayVerifierDeletionGate(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.READY_STATUS_INVALID,
      }),
    ]));
  });

  test('rejects a deletion policy that allows immediate execution', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate(ALL_CONDITIONS_PROVEN);
    const tampered = {
      ...gate,
      deletionPolicy: { ...REQUIRED_DELETION_POLICY, executeDeletionNow: true },
    };

    const validation = validatePolicyPreviewReplayVerifierDeletionGate(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.UNSAFE_DELETION_EXECUTION,
      }),
    ]));
  });

  test('rejects a gate that reports a performed side effect', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate(ALL_CONDITIONS_PROVEN);
    const tampered = {
      ...gate,
      sideEffects: { ...gate.sideEffects, filesDeleted: true },
    };

    const validation = validatePolicyPreviewReplayVerifierDeletionGate(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });

  test('rejects a gate with an unsupported version', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate(ALL_CONDITIONS_PROVEN);
    const tampered = { ...gate, version: 'policy.preview_replay_verifier_deletion_gate.v0' };

    const validation = validatePolicyPreviewReplayVerifierDeletionGate(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_DELETION_GATE_RISK_IDS.VERSION_MISMATCH,
      }),
    ]));
  });

  test('promotion evidence is not required when no artifact needs it', () => {
    const gate = buildPolicyPreviewReplayVerifierDeletionGate(ALL_CONDITIONS_PROVEN);

    expect(gate.conditions.promotionReplacement.required).toBe(false);
    expect(gate.conditions.promotionReplacement.accepted).toBe(true);
    expect(gate.readyForDeletion).toBe(true);
  });
});

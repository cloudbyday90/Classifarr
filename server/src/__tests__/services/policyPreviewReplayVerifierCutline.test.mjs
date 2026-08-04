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
  POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS,
  POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS,
  buildPolicyPreviewReplayVerifierCutlineAudit,
  listPolicyPreviewReplayVerifierArtifacts,
  validatePolicyPreviewReplayVerifierArtifact,
} from '../../services/policyPreviewReplayVerifierCutline.mjs';

describe('policyPreviewReplayVerifierCutline', () => {
  test('keeps only bounded internal verifiers and proves retired diagnostics remain absent', () => {
    const audit = buildPolicyPreviewReplayVerifierCutlineAudit();

    expect(audit).toEqual(expect.objectContaining({
      version: 'policy.preview_replay_verifier_cutline.v1',
      ok: true,
      activeArtifactCount: 10,
      retiredArtifactCount: 9,
      nextStep: expect.objectContaining({
        stepId: 'retained_migration_boundary_and_receipt_handoff',
      }),
    }));
    expect(audit.byDisposition).toEqual(expect.objectContaining({
      [POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.SERVER_CONTRACT_VERIFIER]: 1,
      [POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.MIGRATION_PARITY_VERIFIER]: 8,
      [POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.EVIDENCE_REDUCER_CANDIDATE]: 1,
      [POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE]: 9,
    }));
    expect(audit.artifacts.every(artifact =>
      artifact.normalWorkflowSurface === false &&
      artifact.browserReachable === false &&
      artifact.httpExposed === false &&
      artifact.rawPayloadAllowed === false &&
      artifact.outputBounded === true
    )).toBe(true);
  });

  test('requires the server contract and evidence reducer candidate to remain side-effect free', () => {
    const artifacts = listPolicyPreviewReplayVerifierArtifacts();
    const internalArtifacts = artifacts.filter(artifact => [
      POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.SERVER_CONTRACT_VERIFIER,
      POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.EVIDENCE_REDUCER_CANDIDATE,
    ].includes(artifact.dispositionId));

    expect(internalArtifacts).toHaveLength(2);
    expect(internalArtifacts.every(artifact =>
      artifact.sideEffectProfileId === POLICY_PREVIEW_REPLAY_VERIFIER_SIDE_EFFECT_PROFILE_IDS.NONE
    )).toBe(true);
  });

  test('rejects a normal-workflow HTTP diagnostic that exposes raw or unbounded output', () => {
    const artifact = {
      ...listPolicyPreviewReplayVerifierArtifacts()[0],
      normalWorkflowSurface: true,
      browserReachable: true,
      httpExposed: true,
      rawPayloadAllowed: true,
      outputBounded: false,
    };

    const validation = validatePolicyPreviewReplayVerifierArtifact({ artifact });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.NORMAL_WORKFLOW_SURFACE,
      }),
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.BROWSER_SURFACE_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.HTTP_SURFACE_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.RAW_OR_UNBOUNDED_OUTPUT,
      }),
    ]));
  });

  test('fails the cutline when a retired preview surface is reintroduced', () => {
    const artifacts = listPolicyPreviewReplayVerifierArtifacts();
    const retiredArtifact = artifacts.find(artifact =>
      artifact.dispositionId ===
        POLICY_PREVIEW_REPLAY_VERIFIER_DISPOSITION_IDS.DELETE_WITH_OLD_UI_SURFACE
    );
    const audit = buildPolicyPreviewReplayVerifierCutlineAudit({
      artifacts,
      exists: () => true,
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.RETIRED_SOURCE_REINTRODUCED,
        path: retiredArtifact.path,
      }),
    ]));
  });

  test('fails active records without a bounded future exit', () => {
    const artifact = {
      ...listPolicyPreviewReplayVerifierArtifacts()[0],
      exitCriterionIds: [],
    };

    const validation = validatePolicyPreviewReplayVerifierArtifact({ artifact });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_PREVIEW_REPLAY_VERIFIER_CUTLINE_RISK_IDS.MISSING_EXIT_CRITERIA,
      }),
    ]));
  });
});

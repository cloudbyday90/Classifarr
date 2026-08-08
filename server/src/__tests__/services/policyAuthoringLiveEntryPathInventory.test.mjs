/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  POLICY_AUTHORING_LIVE_ACTION_KIND_IDS,
  POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS,
  POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS,
  POLICY_AUTHORING_LIVE_INVENTORY_STATUS_IDS,
  auditActions,
  auditArtifactPaths,
  auditEntryPoints,
  buildPolicyAuthoringLiveEntryPathInventory,
  listPolicyAuthoringLiveActions,
  listPolicyAuthoringLiveEntryPathArtifactPaths,
  listPolicyAuthoringLiveEntryPoints,
} from '../../services/policyAuthoringLiveEntryPathInventory.mjs';

const repositoryRoot = resolve(process.cwd(), '..');
const artifactExists = artifactPath => existsSync(resolve(repositoryRoot, artifactPath));

describe('policy authoring live entry-path inventory', () => {
  test('captures the current source-backed entry points and visible action classifications', () => {
    const result = buildPolicyAuthoringLiveEntryPathInventory({ artifactExists });

    expect(result).toEqual(expect.objectContaining({
      version: 2,
      auditId: 'policy_authoring_live_entry_path_inventory',
      inventoryComplete: true,
      sourceExperienceReady: true,
      renderedExperienceReady: false,
      statusId: POLICY_AUTHORING_LIVE_INVENTORY_STATUS_IDS.SOURCE_AUDITED,
      nextStep: expect.objectContaining({
        id: 'live_entry_path_browser_verification',
      }),
    }));
    expect(result.artifactAudit).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: listPolicyAuthoringLiveEntryPathArtifactPaths().length,
    }));
    expect(result.entryPointAudit).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: listPolicyAuthoringLiveEntryPoints().length,
    }));
    expect(result.actionAudit).toEqual(expect.objectContaining({
      ok: true,
      checkedCount: listPolicyAuthoringLiveActions().length,
    }));
    expect(result.browserEvidence).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS.NOT_RUN,
      issues: [expect.objectContaining({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.LIVE_BROWSER_EVIDENCE_PENDING,
      })],
    }));
    expect(result.entryPoints).toContainEqual(expect.objectContaining({
      id: 'selected_library_proposal_route',
      normalAuthoring: true,
      reachable: true,
    }));
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'admit_server_prepared_proposal',
        kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.SERVER_ACTION,
        serverContract: 'POST /policies/operator-workflow/libraries/:libraryId/proposals/:proposalReference/admission',
      }),
      expect.objectContaining({
        id: 'automatic_profile_recovery_status',
        kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.READ_ONLY_INFORMATION,
      }),
    ]));
  });

  test('records controlled browser verification separately from source evidence', () => {
    const result = buildPolicyAuthoringLiveEntryPathInventory({
      artifactExists,
      browserEvidenceStatus:
        POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS.CONTROLLED_RENDER_VERIFIED,
    });

    expect(result).toEqual(expect.objectContaining({
      sourceExperienceReady: true,
      renderedExperienceReady: true,
      remediation: [],
      nextStep: expect.objectContaining({
        id: 'ai_provider_capability_authority_modes',
      }),
    }));
    expect(result.browserEvidence).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_LIVE_BROWSER_EVIDENCE_STATUS_IDS.CONTROLLED_RENDER_VERIFIED,
      mode: 'controlled_browser_render',
      issues: [],
    }));
  });

  test('fails closed when the browser-evidence status is unknown', () => {
    const result = buildPolicyAuthoringLiveEntryPathInventory({
      artifactExists,
      browserEvidenceStatus: 'unverified_environment',
    });

    expect(result.renderedExperienceReady).toBe(false);
    expect(result.browserEvidence.issues).toEqual([expect.objectContaining({
      riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.LIVE_BROWSER_EVIDENCE_STATUS_INVALID,
    })]);
  });

  test('fails closed when repository artifact evidence cannot be checked', () => {
    const result = buildPolicyAuthoringLiveEntryPathInventory();

    expect(result).toEqual(expect.objectContaining({
      inventoryComplete: false,
      sourceExperienceReady: false,
      statusId: POLICY_AUTHORING_LIVE_INVENTORY_STATUS_IDS.INVALID,
      remediation: [],
    }));
    expect(result.artifactAudit.issues).toEqual([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ARTIFACT_RESOLVER_REQUIRED,
      }),
    ]);
  });

  test('reports missing artifacts and invalid entry or action classifications', () => {
    const artifactAudit = auditArtifactPaths(['missing-artifact.mjs'], () => false);
    const [entryPoint] = listPolicyAuthoringLiveEntryPoints();
    const [action] = listPolicyAuthoringLiveActions();
    const entryPointAudit = auditEntryPoints([{
      ...entryPoint,
      id: 'invalid_entry_point',
      kindId: 'unsupported_entry_kind',
    }]);
    const actionAudit = auditActions([
      action,
      {
        ...action,
        kindId: 'unsupported_action_kind',
      },
    ], listPolicyAuthoringLiveEntryPoints());

    expect(artifactAudit).toEqual(expect.objectContaining({
      ok: false,
      missingPaths: ['missing-artifact.mjs'],
      issues: [expect.objectContaining({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ARTIFACT_MISSING,
      })],
    }));
    expect(entryPointAudit.issues).toEqual([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ENTRY_POINT_KIND_INVALID,
      }),
    ]);
    expect(actionAudit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_ID_DUPLICATE,
      POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_KIND_INVALID,
    ]));
  });

  test('rejects duplicate or incomplete entry points', () => {
    const [entryPoint] = listPolicyAuthoringLiveEntryPoints();
    const result = auditEntryPoints([
      entryPoint,
      { ...entryPoint, sourcePaths: [] },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ENTRY_POINT_ID_DUPLICATE,
      POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ENTRY_POINT_INCOMPLETE,
    ]));
  });

  test('rejects an action that is disconnected from the entry inventory or lacks its server contract', () => {
    const [action] = listPolicyAuthoringLiveActions();
    const result = auditActions([{
      ...action,
      id: 'invalid_server_action',
      entryPointId: 'unknown_entry_point',
      kindId: POLICY_AUTHORING_LIVE_ACTION_KIND_IDS.SERVER_ACTION,
      serverContract: null,
    }], listPolicyAuthoringLiveEntryPoints());

    expect(result.ok).toBe(false);
    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_ENTRY_POINT_UNKNOWN,
      POLICY_AUTHORING_LIVE_INVENTORY_RISK_IDS.ACTION_INCOMPLETE,
    ]));
  });
});

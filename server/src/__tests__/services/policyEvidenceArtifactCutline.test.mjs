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
  POLICY_ENGINE_ARTIFACT_DECISION_IDS,
  listPolicyEngineArtifactInventoryGroups,
} from '../../services/policyEngineArtifactInventory.mjs';
import {
  POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS,
  POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS,
  buildPolicyEvidenceArtifactCutlineAudit,
  listPolicyEvidenceArtifactSuccessors,
} from '../../services/policyEvidenceArtifactCutline.mjs';

function buildPassingInventoryAudit() {
  return {
    ok: true,
    issueCount: 0,
  };
}

describe('policyEvidenceArtifactCutline', () => {
  test('reconciles every active cutline group with one bounded engine successor', () => {
    const audit = buildPolicyEvidenceArtifactCutlineAudit({
      buildInventoryAudit: buildPassingInventoryAudit,
    });

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      reconciledGroupCount: 4,
      successorCount: 4,
      evidenceMappingCount: 0,
      successorIds: expect.arrayContaining([
        POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.RUNTIME_DECISION_CHAIN,
      ]),
      sideEffects: {
        databaseRead: false,
        mediaServerRead: false,
        providerLookupPerformed: false,
        policyStorageMutated: false,
      },
      nextStep: expect.objectContaining({ stepId: 'evidence_engine' }),
    }));
  });

  test('requires every active rewrite, replacement, and deletion group to have a successor', () => {
    const successorMappings = listPolicyEvidenceArtifactSuccessors()
      .filter(mapping => mapping.groupId !== 'legacy_scoring_runtime');

    const audit = buildPolicyEvidenceArtifactCutlineAudit({
      successorMappings,
      buildInventoryAudit: buildPassingInventoryAudit,
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.MISSING_SUCCESSOR,
        groupId: 'legacy_scoring_runtime',
      }),
    ]));
  });

  test('requires evidence successors to use admitted source-to-bucket mappings', () => {
    const audit = buildPolicyEvidenceArtifactCutlineAudit({
      groups: [{
        id: 'evidence_projection_group',
        decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.REPLACE_WITH_ENGINE,
      }],
      successorMappings: [{
        groupId: 'evidence_projection_group',
        successorId: POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.EVIDENCE_PROJECTION,
        evidenceMappings: [
          {
            bucketId: 'unknown_bucket',
            sourceId: 'unknown_source',
          },
          {
            bucketId: 'identity_evidence',
            sourceId: 'metadata_enrichment',
          },
        ],
      }],
      buildInventoryAudit: buildPassingInventoryAudit,
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.UNKNOWN_EVIDENCE_BUCKET,
      POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.UNKNOWN_EVIDENCE_SOURCE,
      POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.EVIDENCE_SOURCE_NOT_ALLOWED_FOR_BUCKET,
    ]));
  });

  test('rejects unknown and duplicate successor mappings', () => {
    const groups = [
      {
        id: 'replacement_group',
        decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.REPLACE_WITH_ENGINE,
      },
    ];
    const audit = buildPolicyEvidenceArtifactCutlineAudit({
      groups,
      successorMappings: [
        {
          groupId: 'replacement_group',
          successorId: 'unknown_successor',
        },
        {
          groupId: 'replacement_group',
          successorId: POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.INTENT_ENGINE,
          evidenceMappings: [{ bucketId: 'identity_evidence', sourceId: 'operator_declared_intent' }],
        },
        {
          groupId: 'missing_group',
          successorId: POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.INTENT_ENGINE,
        },
      ],
      buildInventoryAudit: buildPassingInventoryAudit,
    });

    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.UNKNOWN_SUCCESSOR,
      POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.DUPLICATE_SUCCESSOR_GROUP,
      POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.UNKNOWN_SUCCESSOR_GROUP,
    ]));
  });

  test('rejects evidence mappings on a non-evidence successor', () => {
    const successorMappings = listPolicyEvidenceArtifactSuccessors().map(mapping => (
      mapping.groupId === 'advanced_builder_controls'
        ? {
          ...mapping,
          evidenceMappings: [{
            bucketId: 'identity_evidence',
            sourceId: 'operator_declared_intent',
          }],
        }
        : mapping
    ));

    const audit = buildPolicyEvidenceArtifactCutlineAudit({
      successorMappings,
      buildInventoryAudit: buildPassingInventoryAudit,
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.NON_EVIDENCE_SUCCESSOR_HAS_EVIDENCE_MAPPING,
        groupId: 'advanced_builder_controls',
      }),
    ]));
  });

  test('refuses reconciliation when the artifact inventory itself is not valid', () => {
    const audit = buildPolicyEvidenceArtifactCutlineAudit({
      buildInventoryAudit: () => ({ ok: false, issueCount: 1 }),
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.INVENTORY_AUDIT_FAILED,
      }),
    ]));
  });

  test('keeps the inventory source of truth separate from the successor mapping', () => {
    const reconciledGroupIds = listPolicyEngineArtifactInventoryGroups()
      .filter(group => [
        POLICY_ENGINE_ARTIFACT_DECISION_IDS.REWRITE_FOR_ENGINE,
        POLICY_ENGINE_ARTIFACT_DECISION_IDS.REPLACE_WITH_ENGINE,
        POLICY_ENGINE_ARTIFACT_DECISION_IDS.DELETE_AFTER_CUTOVER,
      ].includes(group.decisionId))
      .map(group => group.id)
      .sort();
    const mappedGroupIds = listPolicyEvidenceArtifactSuccessors()
      .map(mapping => mapping.groupId)
      .sort();

    expect(mappedGroupIds).toEqual(reconciledGroupIds);
  });
});

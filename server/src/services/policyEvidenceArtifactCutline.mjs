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
  buildPolicyEngineArtifactInventoryAudit,
  listPolicyEngineArtifactInventoryGroups,
} from './policyEngineArtifactInventory.mjs';
import {
  listPolicyEvidenceBuckets,
  listPolicyEvidenceSources,
} from './policyEvidenceEngine.mjs';

const POLICY_EVIDENCE_ARTIFACT_CUTLINE_VERSION =
  'policy.evidence_artifact_cutline.v1';

const POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS = Object.freeze({
  RUNTIME_DECISION_CHAIN: 'runtime_decision_chain',
  EVIDENCE_PROJECTION: 'evidence_projection',
  INTENT_ENGINE: 'intent_engine',
  AUTOMATION_READINESS: 'automation_readiness',
  OPERATOR_WORKFLOW: 'operator_workflow',
  MIGRATION_DELETION: 'migration_deletion',
});

const POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS = Object.freeze({
  INVENTORY_AUDIT_FAILED: 'inventory_audit_failed',
  MISSING_SUCCESSOR: 'missing_successor',
  UNKNOWN_SUCCESSOR_GROUP: 'unknown_successor_group',
  DUPLICATE_SUCCESSOR_GROUP: 'duplicate_successor_group',
  UNKNOWN_SUCCESSOR: 'unknown_successor',
  MISSING_EVIDENCE_MAPPING: 'missing_evidence_mapping',
  UNKNOWN_EVIDENCE_BUCKET: 'unknown_evidence_bucket',
  UNKNOWN_EVIDENCE_SOURCE: 'unknown_evidence_source',
  EVIDENCE_SOURCE_NOT_ALLOWED_FOR_BUCKET: 'evidence_source_not_allowed_for_bucket',
  NON_EVIDENCE_SUCCESSOR_HAS_EVIDENCE_MAPPING:
    'non_evidence_successor_has_evidence_mapping',
});

const RECONCILED_DECISION_IDS = Object.freeze([
  POLICY_ENGINE_ARTIFACT_DECISION_IDS.REWRITE_FOR_ENGINE,
  POLICY_ENGINE_ARTIFACT_DECISION_IDS.REPLACE_WITH_ENGINE,
  POLICY_ENGINE_ARTIFACT_DECISION_IDS.DELETE_AFTER_CUTOVER,
]);

function freezeSuccessorMappings(mappings) {
  return Object.freeze(mappings.map(mapping => Object.freeze({
    ...mapping,
    evidenceMappings: Object.freeze((mapping.evidenceMappings || []).map(entry =>
      Object.freeze({ ...entry })
    )),
  })));
}

const DEFAULT_POLICY_EVIDENCE_ARTIFACT_SUCCESSORS = freezeSuccessorMappings([
  {
    groupId: 'legacy_scoring_runtime',
    successorId: POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.RUNTIME_DECISION_CHAIN,
  },
  {
    groupId: 'legacy_scoring_tests',
    successorId: POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.RUNTIME_DECISION_CHAIN,
  },
  {
    groupId: 'advanced_builder_controls',
    successorId: POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.AUTOMATION_READINESS,
  },
  {
    groupId: 'policy_builder_summary_shell',
    successorId: POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.OPERATOR_WORKFLOW,
  },
]);

const SUCCESSOR_IDS = new Set(Object.values(POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildIssue(riskId, message, details = {}) {
  return {
    riskId,
    message,
    ...details,
  };
}

function listPolicyEvidenceArtifactSuccessors() {
  return DEFAULT_POLICY_EVIDENCE_ARTIFACT_SUCCESSORS;
}

function isReconciledArtifactGroup(group = {}) {
  return RECONCILED_DECISION_IDS.includes(normalizeString(group.decisionId));
}

function buildPolicyEvidenceArtifactCutlineAudit({
  groups = listPolicyEngineArtifactInventoryGroups(),
  successorMappings = listPolicyEvidenceArtifactSuccessors(),
  evidenceBuckets = listPolicyEvidenceBuckets(),
  evidenceSources = listPolicyEvidenceSources(),
  buildInventoryAudit = buildPolicyEngineArtifactInventoryAudit,
} = {}) {
  const issues = [];
  const inventoryAudit = buildInventoryAudit({ groups });
  const reconciledGroups = asArray(groups).filter(isReconciledArtifactGroup);
  const groupIds = new Set(reconciledGroups.map(group => normalizeString(group.id)));
  const bucketIds = new Set(asArray(evidenceBuckets).map(bucket => normalizeString(bucket.id)));
  const sourcesById = new Map(asArray(evidenceSources).map(source => [
    normalizeString(source.id),
    source,
  ]));
  const mappingsByGroupId = new Map();
  let evidenceMappingCount = 0;

  if (inventoryAudit?.ok !== true) {
    issues.push(buildIssue(
      POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.INVENTORY_AUDIT_FAILED,
      'The policy evidence artifact cutline requires a passing artifact inventory audit.'
    ));
  }

  asArray(successorMappings).forEach(candidate => {
    const mapping = asObject(candidate);
    const groupId = normalizeString(mapping.groupId);
    const successorId = normalizeString(mapping.successorId);
    const evidenceMappings = asArray(mapping.evidenceMappings);

    if (!groupIds.has(groupId)) {
      issues.push(buildIssue(
        POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.UNKNOWN_SUCCESSOR_GROUP,
        'Artifact successor mappings must refer to an active rewrite, replacement, or deletion group.',
        { groupId: groupId || null }
      ));
      return;
    }

    if (mappingsByGroupId.has(groupId)) {
      issues.push(buildIssue(
        POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.DUPLICATE_SUCCESSOR_GROUP,
        'Each reconciled artifact group can have only one successor mapping.',
        { groupId }
      ));
      return;
    }

    mappingsByGroupId.set(groupId, mapping);

    if (!SUCCESSOR_IDS.has(successorId)) {
      issues.push(buildIssue(
        POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.UNKNOWN_SUCCESSOR,
        'Artifact successor mappings must use a known bounded engine successor.',
        { groupId, successorId: successorId || null }
      ));
      return;
    }

    if (successorId !== POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS.EVIDENCE_PROJECTION) {
      if (evidenceMappings.length > 0) {
        issues.push(buildIssue(
          POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.NON_EVIDENCE_SUCCESSOR_HAS_EVIDENCE_MAPPING,
          'Only evidence-projection successors can declare evidence bucket/source mappings.',
          { groupId, successorId }
        ));
      }
      return;
    }

    if (evidenceMappings.length === 0) {
      issues.push(buildIssue(
        POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.MISSING_EVIDENCE_MAPPING,
        'Evidence-projection successors must declare at least one bounded bucket/source mapping.',
        { groupId }
      ));
      return;
    }

    evidenceMappings.forEach(evidenceMapping => {
      const bucketId = normalizeString(evidenceMapping?.bucketId);
      const sourceId = normalizeString(evidenceMapping?.sourceId);
      const source = sourcesById.get(sourceId);
      evidenceMappingCount += 1;

      if (!bucketIds.has(bucketId)) {
        issues.push(buildIssue(
          POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.UNKNOWN_EVIDENCE_BUCKET,
          'Evidence-projection successors must use known evidence buckets.',
          { groupId, bucketId: bucketId || null, sourceId: sourceId || null }
        ));
      }

      if (!source) {
        issues.push(buildIssue(
          POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.UNKNOWN_EVIDENCE_SOURCE,
          'Evidence-projection successors must use known evidence sources.',
          { groupId, bucketId: bucketId || null, sourceId: sourceId || null }
        ));
      } else if (bucketIds.has(bucketId) && !asArray(source.allowedBucketIds).includes(bucketId)) {
        issues.push(buildIssue(
          POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.EVIDENCE_SOURCE_NOT_ALLOWED_FOR_BUCKET,
          'Evidence-projection mappings must respect source-to-bucket admission rules.',
          { groupId, bucketId, sourceId }
        ));
      }
    });
  });

  reconciledGroups.forEach(group => {
    const groupId = normalizeString(group.id);
    if (!mappingsByGroupId.has(groupId)) {
      issues.push(buildIssue(
        POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS.MISSING_SUCCESSOR,
        'Every active rewrite, replacement, or deletion artifact group requires one explicit successor.',
        { groupId }
      ));
    }
  });

  return {
    version: POLICY_EVIDENCE_ARTIFACT_CUTLINE_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    reconciledGroupCount: reconciledGroups.length,
    successorCount: mappingsByGroupId.size,
    evidenceMappingCount,
    successorIds: [...new Set(asArray(successorMappings)
      .map(mapping => normalizeString(mapping?.successorId))
      .filter(Boolean))]
      .sort(),
    inventoryAudit: {
      ok: inventoryAudit?.ok === true,
      issueCount: Number(inventoryAudit?.issueCount) || 0,
    },
    issues,
    sideEffects: {
      databaseRead: false,
      mediaServerRead: false,
      providerLookupPerformed: false,
      policyStorageMutated: false,
    },
    nextStep: {
      stepId: 'evidence_engine',
      label: 'Evidence Engine',
      reason: 'Every active legacy artifact group now has an explicit bounded engine successor before evidence-engine completion is recorded.',
    },
  };
}

export {
  POLICY_EVIDENCE_ARTIFACT_CUTLINE_RISK_IDS,
  POLICY_EVIDENCE_ARTIFACT_SUCCESSOR_IDS,
  POLICY_EVIDENCE_ARTIFACT_CUTLINE_VERSION,
  buildPolicyEvidenceArtifactCutlineAudit,
  listPolicyEvidenceArtifactSuccessors,
};

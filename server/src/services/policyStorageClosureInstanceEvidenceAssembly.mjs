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
  buildPolicyStorageCurrentClosureAudit,
} from './policyStorageCurrentClosureAudit.mjs';
import {
  buildPolicyStorageClosureRequirementAudit,
} from './policyStorageClosureRequirementAudit.mjs';

const POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_VERSION =
  'policy.storage_closure_instance_evidence_assembly.v1';

const POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS =
  Object.freeze({
    COMPLETE: 'complete',
    BLOCKED_BY_CURRENT_CLOSURE: 'blocked_by_current_closure',
    BLOCKED_BY_REQUIREMENT_AUDIT: 'blocked_by_requirement_audit',
    BLOCKED_BY_SIDE_EFFECTS: 'blocked_by_side_effects',
  });

function summarizeSideEffects(sideEffects = {}) {
  return {
    filesRead: true,
    filesWritten: sideEffects.filesWritten === true,
    storageChanged: sideEffects.storageChanged === true,
    gitCommandsRun: sideEffects.gitCommandsRun === true,
    commandsExecuted: sideEffects.commandsExecuted === true,
    manifestWritten: sideEffects.manifestWritten === true,
  };
}

function determineStatusId({ currentClosureAudit = {}, requirementAudit = {}, sideEffects = {} } = {}) {
  if (Object.entries(sideEffects).some(([key, value]) => key !== 'filesRead' && value === true)) {
    return POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS
      .BLOCKED_BY_SIDE_EFFECTS;
  }

  if (currentClosureAudit.complete !== true || currentClosureAudit.validation?.ok !== true) {
    return POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS
      .BLOCKED_BY_CURRENT_CLOSURE;
  }

  if (requirementAudit.complete !== true || requirementAudit.validation?.ok !== true) {
    return POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS
      .BLOCKED_BY_REQUIREMENT_AUDIT;
  }

  return POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS.COMPLETE;
}

async function buildPolicyStorageClosureInstanceEvidenceAssembly({
  cwd = process.cwd(),
  completionAuditArtifact = {},
  validationEvidence = {},
  generatedAt = null,
  sideEffects = {},
  fileExists,
  readTextFile,
} = {}) {
  const combinedSideEffects = summarizeSideEffects(sideEffects);
  const currentClosureAudit = await buildPolicyStorageCurrentClosureAudit({
    cwd,
    completionAuditArtifact,
    validationEvidence,
    generatedAt,
    sideEffects: combinedSideEffects,
    fileExists,
    readTextFile,
  });
  const requirementAudit = await buildPolicyStorageClosureRequirementAudit({
    cwd,
    currentClosureAudit,
    generatedAt,
    sideEffects: combinedSideEffects,
    fileExists,
    readTextFile,
  });
  const statusId = determineStatusId({
    currentClosureAudit,
    requirementAudit,
    sideEffects: combinedSideEffects,
  });

  return {
    version: POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    statusId,
    complete:
      statusId ===
      POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS.COMPLETE,
    currentClosureAudit,
    requirementAudit,
    summary: {
      currentClosureAuditComplete: currentClosureAudit.complete === true,
      currentClosureAuditValidationOk: currentClosureAudit.validation?.ok === true,
      requirementAuditComplete: requirementAudit.complete === true,
      requirementAuditValidationOk: requirementAudit.validation?.ok === true,
    },
    sideEffects: combinedSideEffects,
    executionPolicy: {
      assemblesExistingEvidence: true,
      requiresFingerprintValidCompletionAuditArtifact: true,
      requiresFingerprintValidValidationEvidence: true,
      allowsEvidenceSynthesis: false,
      allowsValidationCommandExecution: false,
      allowsFileWritesInsideService: false,
      allowsStorageMutation: false,
      allowsGitCommands: false,
      allowsNetworkCalls: false,
    },
    nextStep: {
      stepId: 'policy_storage_closure_instance_evidence_complete',
      label: 'Policy Storage Instance Evidence Complete',
      reason:
        statusId === POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS.COMPLETE
          ? 'Current closure and requirement-audit evidence are complete for the selected checkout.'
          : 'Resolve the reported current closure or requirement-audit evidence gaps, then assemble a fresh artifact chain.',
    },
  };
}

export {
  POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_STATUS_IDS,
  POLICY_STORAGE_CLOSURE_INSTANCE_EVIDENCE_ASSEMBLY_VERSION,
  buildPolicyStorageClosureInstanceEvidenceAssembly,
};

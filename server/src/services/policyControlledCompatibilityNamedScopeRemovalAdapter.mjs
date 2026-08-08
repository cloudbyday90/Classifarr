/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionActions.mjs';
import {
  runPolicyControlledCompatibilityNamedScopePreApplyRecheck,
} from './policyControlledCompatibilityNamedScopePreApplyRecheck.mjs';
import {
  asArray,
  asObject,
  buildPolicyControlledCompatibilityNamedScopeRemovalAdapterNextStep,
  buildPolicyControlledCompatibilityNamedScopeRemovalAdapterSideEffects,
  buildRisk,
  determinePolicyControlledCompatibilityNamedScopeRemovalAdapterStatusId,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_VERSION,
  summarizePolicyControlledCompatibilityNamedScopePreApplyVerification,
} from './policyControlledCompatibilityNamedScopeRemovalAdapterShared.mjs';
import {
  evaluatePolicyControlledCompatibilityNamedScopeRemovalGate,
} from './policyControlledCompatibilityNamedScopeRemovalGate.mjs';
import {
  evaluatePolicyControlledCompatibilityNamedScopeRemovalSelection,
} from './policyControlledCompatibilityNamedScopeRemovalSelection.mjs';
import {
  derivePolicyControlledCompatibilityNamedScopeSourceEdit,
} from './policyControlledCompatibilityNamedScopeSourceEdit.mjs';
import {
  readPolicyControlledCompatibilityNamedScopeSource,
} from './policyControlledCompatibilityNamedScopeSourceRead.mjs';
import {
  verifyPolicyCompatibilityDeletionPreApplyChange,
} from './policyCompatibilityDeletionPreApplyChangeDetector.mjs';

function normalizeTimestamp(value) {
  const timestamp = typeof value === 'string' ? value.trim() : '';
  const timestampMs = Date.parse(timestamp);

  return Number.isFinite(timestampMs) ? new Date(timestampMs).toISOString() : null;
}

function buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
  executionGate = null,
  fileSystem = fs,
  now = new Date().toISOString(),
  pathModule = path,
  preApplyChangeDetector = verifyPolicyCompatibilityDeletionPreApplyChange,
  repoRoot = process.cwd(),
  selectedEntryIdentity = null,
} = {}) {
  const evaluationTime = normalizeTimestamp(now);
  const timestampRisks = evaluationTime ? [] : [buildRisk(
    POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.EXECUTION_GATE_REVALIDATION_FAILED,
    'Scope-aware removal requires a valid dry-run evaluation timestamp.'
  )];
  const executionGateEvaluation = evaluationTime
    ? evaluatePolicyControlledCompatibilityNamedScopeRemovalGate({ executionGate, now: evaluationTime })
    : { gate: asObject(executionGate), revalidatedGate: null, risks: [] };
  const selection = evaluatePolicyControlledCompatibilityNamedScopeRemovalSelection({
    executionGate: executionGateEvaluation.gate,
    selectedEntryIdentity,
  });
  const firstPreApply = selection.entry
    ? runPolicyControlledCompatibilityNamedScopePreApplyRecheck({
      entry: selection.entry,
      executionGate: executionGateEvaluation.gate,
      preApplyChangeDetector,
      repoRoot,
    })
    : { verification: null, risk: null };
  const sourceRead = selection.entry && !firstPreApply.risk
    ? readPolicyControlledCompatibilityNamedScopeSource({
      entry: selection.entry,
      fileSystem,
      pathModule,
      repoRoot,
    })
    : { risks: [], sourceText: null };
  const secondPreApply = selection.entry && !firstPreApply.risk && sourceRead.sourceText !== null
    ? runPolicyControlledCompatibilityNamedScopePreApplyRecheck({
      entry: selection.entry,
      executionGate: executionGateEvaluation.gate,
      preApplyChangeDetector,
      repoRoot,
    })
    : { verification: null, risk: null };
  const sourceEdit = sourceRead.sourceText !== null && !secondPreApply.risk
    ? derivePolicyControlledCompatibilityNamedScopeSourceEdit({
      sourceText: sourceRead.sourceText,
      sourceTextFragments: selection.normalizedEntry.sourceTextFragments,
      testNameFragments: selection.normalizedEntry.testNameFragments,
    })
    : null;
  const risks = [
    ...timestampRisks,
    ...executionGateEvaluation.risks,
    ...selection.risks,
    ...(firstPreApply.risk ? [firstPreApply.risk] : []),
    ...sourceRead.risks,
    ...(secondPreApply.risk ? [secondPreApply.risk] : []),
    ...asArray(sourceEdit?.risks),
  ];
  const readyForScopeRemovalReview = risks.length === 0 && sourceEdit?.ready === true;
  const result = {
    version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_VERSION,
    statusId: readyForScopeRemovalReview
      ? POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS
        .READY_FOR_SCOPE_REMOVAL_REVIEW
      : determinePolicyControlledCompatibilityNamedScopeRemovalAdapterStatusId(risks),
    readyForScopeRemovalReview,
    evaluationTime: evaluationTime || null,
    selectedScope: {
      entryIdentity: selection.requestedIdentity,
      path: selection.normalizedEntry.path || null,
      actionId: selection.normalizedEntry.actionId || null,
      wholeFileDeletion: selection.normalizedEntry.wholeFileDeletion,
      sourceTextFragments: selection.normalizedEntry.sourceTextFragments,
      testNameFragments: selection.normalizedEntry.testNameFragments,
    },
    executionGate: {
      originalStatusId: executionGateEvaluation.gate.statusId || null,
      originalValidationOk: executionGateEvaluation.gate.validation?.ok === true,
      revalidatedStatusId: executionGateEvaluation.revalidatedGate?.statusId || null,
      revalidatedValidationOk: executionGateEvaluation.revalidatedGate?.validation?.ok === true,
      executionPlanArtifactFingerprint:
        executionGateEvaluation.gate.executionPlanArtifact?.artifactFingerprint?.fingerprint || null,
    },
    preflight: {
      entryIdentity: selection.preflightObservation?.entryIdentity || null,
      observationStatusId: selection.preflightObservation?.statusId || null,
      beforeSourceRead:
        summarizePolicyControlledCompatibilityNamedScopePreApplyVerification(
          firstPreApply.verification
        ),
      afterSourceRead:
        summarizePolicyControlledCompatibilityNamedScopePreApplyVerification(
          secondPreApply.verification
        ),
    },
    source: sourceEdit?.source || {
      byteLength: null,
      fingerprint: null,
      sourceFragmentObservations: [],
    },
    dryRun: sourceEdit?.dryRun || null,
    riskCount: risks.length,
    risks,
    sideEffects: buildPolicyControlledCompatibilityNamedScopeRemovalAdapterSideEffects(),
    executionPolicy: {
      revalidateExecutionGateAtDryRunTime: true,
      requireExactNamedScopeIdentity: true,
      requireExactPreflightObservationIdentity: true,
      requireReadyNamedScopeEntry: true,
      requireMeaningfulReplacementEvidence: true,
      requireReadOnlyPreApplyRecheckBeforeSourceRead: true,
      requireReadOnlyPreApplyRecheckAfterSourceRead: true,
      requireRegularNonSymlinkRetainedFile: true,
      requireBoundedSourceRead: true,
      requireExactTestNameDeclarations: true,
      prohibitWholeFileDeletion: true,
      allowSourceWrite: false,
      allowFileDeletion: false,
      allowStorageMutation: false,
      allowGitMutationCommands: false,
    },
    nextStep: buildPolicyControlledCompatibilityNamedScopeRemovalAdapterNextStep({
      readyForScopeRemovalReview,
    }),
  };

  return {
    ...result,
    validation: validatePolicyControlledCompatibilityNamedScopeRemovalDryRun(result),
  };
}

function validatePolicyControlledCompatibilityNamedScopeRemovalDryRun(dryRun = {}) {
  const issues = [];

  if (!Object.values(POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS)
    .includes(dryRun.statusId)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.UNKNOWN_STATUS,
      'Scope-aware removal dry-run status must be known.'
    ));
  }
  if (dryRun.riskCount !== asArray(dryRun.risks).length) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.RISK_COUNT_MISMATCH,
      'Scope-aware removal dry-run risk count must match its risk list.'
    ));
  }
  if (dryRun.readyForScopeRemovalReview !== (dryRun.riskCount === 0)) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.READY_STATE_MISMATCH,
      'Scope-aware removal dry-run readiness must match its risk count.'
    ));
  }
  if (dryRun.readyForScopeRemovalReview === true && (
    dryRun.selectedScope?.wholeFileDeletion !== false ||
    dryRun.dryRun?.operationId !== POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS
      .REMOVE_NAMED_TEST_SCOPE ||
    !Array.isArray(dryRun.dryRun?.edits) ||
    dryRun.dryRun.edits.length === 0
  )) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SELECTED_ENTRY_VALIDATION_FAILED,
      'A ready scope-aware removal dry run requires bounded named-test-scope edits and an explicit no-whole-file-deletion boundary.'
    ));
  }

  const policy = asObject(dryRun.executionPolicy);
  if (
    policy.revalidateExecutionGateAtDryRunTime !== true ||
    policy.requireExactNamedScopeIdentity !== true ||
    policy.requireExactPreflightObservationIdentity !== true ||
    policy.requireReadyNamedScopeEntry !== true ||
    policy.requireMeaningfulReplacementEvidence !== true ||
    policy.requireReadOnlyPreApplyRecheckBeforeSourceRead !== true ||
    policy.requireReadOnlyPreApplyRecheckAfterSourceRead !== true ||
    policy.requireRegularNonSymlinkRetainedFile !== true ||
    policy.requireBoundedSourceRead !== true ||
    policy.requireExactTestNameDeclarations !== true ||
    policy.prohibitWholeFileDeletion !== true ||
    policy.allowSourceWrite !== false ||
    policy.allowFileDeletion !== false ||
    policy.allowStorageMutation !== false ||
    policy.allowGitMutationCommands !== false
  ) {
    issues.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SIDE_EFFECT_PERFORMED,
      'Scope-aware removal dry-run must retain its read-only execution policy.'
    ));
  }

  Object.entries(asObject(dryRun.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Scope-aware removal dry-run cannot report side effect "${key}".`
      ));
    }
  });

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

function createPolicyControlledCompatibilityNamedScopeRemovalAdapter(options = {}) {
  return {
    buildDryRun(input = {}) {
      return buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
        ...options,
        ...input,
      });
    },
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_VERSION,
  buildPolicyControlledCompatibilityNamedScopeRemovalDryRun,
  createPolicyControlledCompatibilityNamedScopeRemovalAdapter,
  validatePolicyControlledCompatibilityNamedScopeRemovalDryRun,
};

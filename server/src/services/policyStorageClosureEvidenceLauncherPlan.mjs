/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'node:path';

const POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_PLAN_VERSION =
  'policy.storage_closure_evidence_launcher_plan.v1';
const POLICY_STORAGE_CLOSURE_EVIDENCE_COMMAND_TIMEOUTS_MS = Object.freeze({
  validationEvidence: 15 * 60 * 1000,
  instanceEvidenceAssembly: 5 * 60 * 1000,
});

function isWithinDirectory({ directory, candidate }) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeRequiredPath(value, fallback) {
  const normalizedValue = String(value || '').trim();
  return normalizedValue || fallback;
}

function buildPolicyStorageClosureEvidenceLauncherPlan({
  cwd = process.cwd(),
  completionAuditArtifactPath = '',
  outputDirectory = '.tmp/policy-storage',
  generatedAt = null,
  allowBlocked = false,
} = {}) {
  const selectedCwd = path.resolve(normalizeRequiredPath(cwd, process.cwd()));
  const resolvedOutputDirectory = path.resolve(
    selectedCwd,
    normalizeRequiredPath(outputDirectory, '.tmp/policy-storage')
  );
  const completionArtifact = String(completionAuditArtifactPath || '').trim();
  const issues = [];

  if (!completionArtifact) {
    issues.push('completion_audit_artifact_missing');
  }
  if (!isWithinDirectory({ directory: selectedCwd, candidate: resolvedOutputDirectory })) {
    issues.push('output_directory_outside_selected_checkout');
  }

  const validationEvidencePath = path.join(resolvedOutputDirectory, 'validation-evidence.json');
  const assemblyPath = path.join(resolvedOutputDirectory, 'instance-evidence-assembly.json');
  const currentClosurePath = path.join(resolvedOutputDirectory, 'current-closure-audit.json');
  const requirementAuditPath = path.join(resolvedOutputDirectory, 'requirement-audit.json');
  const assemblyArgs = [
    '--cwd', selectedCwd,
    '--completion-audit-artifact', completionArtifact,
    '--validation-evidence', validationEvidencePath,
    '--output', assemblyPath,
    '--current-closure-output', currentClosurePath,
    '--requirement-audit-output', requirementAuditPath,
  ];

  if (generatedAt) assemblyArgs.push('--generated-at', generatedAt);
  if (allowBlocked) assemblyArgs.push('--allow-blocked');

  return {
    version: POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_PLAN_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    selectedCwd,
    outputs: {
      validationEvidencePath,
      assemblyPath,
      currentClosurePath,
      requirementAuditPath,
    },
    commands: [
      {
        commandId: 'validation_evidence',
        scriptPath: 'scripts/generate-policy-storage-closure-validation-evidence.mjs',
        timeoutMs: POLICY_STORAGE_CLOSURE_EVIDENCE_COMMAND_TIMEOUTS_MS.validationEvidence,
        args: ['--cwd', selectedCwd, '--output', validationEvidencePath],
      },
      {
        commandId: 'instance_evidence_assembly',
        scriptPath: 'scripts/assemble-policy-storage-closure-instance-evidence.mjs',
        timeoutMs:
          POLICY_STORAGE_CLOSURE_EVIDENCE_COMMAND_TIMEOUTS_MS.instanceEvidenceAssembly,
        args: assemblyArgs,
      },
    ],
  };
}

export {
  POLICY_STORAGE_CLOSURE_EVIDENCE_COMMAND_TIMEOUTS_MS,
  POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_PLAN_VERSION,
  buildPolicyStorageClosureEvidenceLauncherPlan,
};

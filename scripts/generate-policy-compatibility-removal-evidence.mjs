#!/usr/bin/env node
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
  scanPolicyStorageClosureReferences,
} from './lib/policyStorageClosureReferenceScanner.mjs';
import {
  collectPolicyCompatibilityRemovalReferenceScan,
} from './lib/policyCompatibilityRemovalEvidenceReferenceScan.mjs';
import {
  buildPolicyCompatibilityRemovalEvidenceRegeneration,
} from '../server/src/services/policyCompatibilityRemovalEvidenceRegeneration.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS,
} from '../server/src/services/policyCompatibilityRemovalCompletionAuditArtifact.mjs';
import {
  resolvePolicyStorageClosureExecutionPlanSource,
} from '../server/src/services/policyStorageClosureExecutionPlanSource.mjs';

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    executionPlanArtifactPath: null,
    nextBatchAuthorizationArtifactPath: null,
    reviewArtifactFingerprint: '',
    validationEvidencePath: null,
    outputPath: null,
    completionAuditArtifactOutputPath: null,
    allowBlocked: false,
    requireComplete: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--cwd') {
      options.cwd = argv[index + 1] || options.cwd;
      index += 1;
      continue;
    }
    if (arg === '--execution-plan-artifact') {
      options.executionPlanArtifactPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--next-batch-authorization-artifact') {
      options.nextBatchAuthorizationArtifactPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--review-artifact-fingerprint') {
      options.reviewArtifactFingerprint = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--validation-evidence') {
      options.validationEvidencePath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--completion-audit-artifact-output') {
      options.completionAuditArtifactOutputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--allow-blocked') {
      options.allowBlocked = true;
      continue;
    }
    if (arg === '--require-complete') {
      options.requireComplete = true;
      continue;
    }
    if (arg === '--generated-at') {
      options.generatedAt = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/generate-policy-compatibility-removal-evidence.mjs [options]',
    '',
    'Options:',
    '  --cwd <path>                               Repository root and base for relative artifact paths. Defaults to process cwd.',
    '  --execution-plan-artifact <json>           Required ready fingerprint-valid compatibility deletion execution-plan artifact JSON.',
    '  --next-batch-authorization-artifact <json> Required fingerprint-valid next-batch authorization artifact JSON.',
    '  --review-artifact-fingerprint <sha256>     Required applied removal-review artifact fingerprint.',
    '  --validation-evidence <json>               Required current validation-evidence JSON.',
    '  --output <json>                            Write evidence-regeneration JSON to this path.',
    '  --completion-audit-artifact-output <json>  Write the nested completion-audit artifact JSON when the full evidence chain is present.',
    '  --allow-blocked                            Allow writing blocked diagnostic output, including missing-input readiness diagnostics.',
    '  --require-complete                         Exit non-zero unless the evidence is complete.',
    '  --generated-at <iso>                       Optional generatedAt timestamp for stable tests.',
    '  --help                                     Print this help message.',
  ].join('\n');
}

function resolveArtifactPath(cwd, filePath) {
  return path.resolve(cwd, filePath);
}

function readJsonFile(cwd, filePath, label) {
  if (!filePath) {
    return null;
  }

  const resolvedPath = resolveArtifactPath(cwd, filePath);

  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${label} JSON at ${resolvedPath}: ${err.message}`);
  }
}

function getMissingRequiredInputs(options = {}) {
  const missing = [];

  if (!options.executionPlanArtifactPath) {
    missing.push('execution-plan artifact');
  }
  if (!options.nextBatchAuthorizationArtifactPath) {
    missing.push('next-batch authorization artifact');
  }
  if (!String(options.reviewArtifactFingerprint || '').trim()) {
    missing.push('review artifact fingerprint');
  }
  if (!options.validationEvidencePath) {
    missing.push('validation evidence');
  }

  return missing;
}

function writeJsonFile(cwd, filePath, value) {
  if (!filePath) {
    return;
  }

  const resolvedPath = resolveArtifactPath(cwd, filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

function fileExistsAtRepositoryPath(cwd, repositoryPath) {
  return fs.existsSync(path.resolve(cwd, repositoryPath));
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error('');
    console.error(usage());
    process.exit(2);
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  const cwd = path.resolve(process.cwd(), options.cwd);
  let executionPlanArtifact;
  let nextBatchAuthorizationArtifact;
  let validationEvidence;
  const missingRequiredInputs = getMissingRequiredInputs(options);

  if (missingRequiredInputs.length > 0 && options.allowBlocked !== true) {
    console.error(
      `Missing required compatibility-removal evidence input(s): ${missingRequiredInputs.join(', ')}.`
    );
    console.error(
      'Pass --allow-blocked only to write a non-authoritative readiness diagnostic.'
    );
    process.exit(2);
  }

  try {
    executionPlanArtifact = readJsonFile(
      cwd,
      options.executionPlanArtifactPath,
      'execution-plan artifact'
    );
    nextBatchAuthorizationArtifact = readJsonFile(
      cwd,
      options.nextBatchAuthorizationArtifactPath,
      'next-batch authorization artifact'
    );
    validationEvidence = readJsonFile(
      cwd,
      options.validationEvidencePath,
      'validation evidence'
    );
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const referenceScan = collectPolicyCompatibilityRemovalReferenceScan({
    missingRequiredInputs,
    cwd,
    executionPlanArtifact,
    resolveExecutionPlanSource: resolvePolicyStorageClosureExecutionPlanSource,
    scanReferences: scanPolicyStorageClosureReferences,
  });
  const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
    executionPlanArtifact,
    nextBatchAuthorizationArtifact,
    reviewArtifactFingerprint: options.reviewArtifactFingerprint,
    validationEvidence,
    referenceScan,
    fileExists: repositoryPath => fileExistsAtRepositoryPath(cwd, repositoryPath),
    generatedAt: options.generatedAt,
  });

  if (
    evidence.statusId ===
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.BLOCKED &&
    options.allowBlocked !== true
  ) {
    console.error(
      'Compatibility-removal evidence regeneration is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: evidence.statusId,
      complete: evidence.complete,
      riskCount: evidence.riskCount,
      risks: evidence.risks,
      completionAuditArtifactStatusId: evidence.completionAuditArtifact?.statusId || null,
      completionAuditArtifactRiskCount: evidence.completionAuditArtifact?.riskCount ?? null,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(cwd, options.outputPath, evidence);
    if (evidence.completionAuditArtifact !== null) {
      writeJsonFile(
        cwd,
        options.completionAuditArtifactOutputPath,
        evidence.completionAuditArtifact
      );
    }
  } catch (err) {
    console.error(`Could not write compatibility-removal evidence JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(evidence, null, 2));

  if (options.requireComplete && evidence.complete !== true) {
    process.exit(1);
  }

  process.exit(
    evidence.statusId ===
      POLICY_COMPATIBILITY_REMOVAL_COMPLETION_AUDIT_ARTIFACT_STATUS_IDS.BLOCKED
      ? 1
      : 0
  );
}

main().catch(err => {
  console.error(`Could not generate compatibility-removal evidence JSON: ${err.message}`);
  process.exit(2);
});

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
  buildPolicyStorageClosureFinalRemovalAudit,
} from '../server/src/services/policyStorageClosureFinalRemovalAudit.mjs';
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
    requireComplete: false,
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
    if (arg === '--require-complete') {
      options.requireComplete = true;
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
    'Usage: node scripts/generate-policy-storage-closure-final-removal-audit.mjs [options]',
    '',
    'Options:',
    '  --cwd <path>                    Repository root. Defaults to process cwd.',
    '  --execution-plan-artifact <json> Required approved compatibility deletion execution-plan artifact JSON.',
    '  --next-batch-authorization-artifact <json> Required fingerprint-valid next-batch authorization artifact JSON.',
    '  --review-artifact-fingerprint <sha256> Required applied removal-review artifact fingerprint.',
    '  --validation-evidence <json>    Optional policy storage closure validation evidence JSON.',
    '  --output <json>                 Write final-removal-audit JSON to this path.',
    '  --require-complete              Exit non-zero unless the audit completes.',
    '  --help                          Print this help message.',
  ].join('\n');
}

function readJsonFile(filePath, label, { required = false } = {}) {
  if (!filePath) {
    if (required) {
      throw new Error(`Missing required ${label} JSON path.`);
    }

    return {};
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);

  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${label} JSON at ${resolvedPath}: ${err.message}`);
  }
}

function writeJsonFile(filePath, value) {
  if (!filePath) {
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
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

  try {
    executionPlanArtifact = readJsonFile(
      options.executionPlanArtifactPath,
      'execution-plan artifact', {
      required: true,
      }
    );
    nextBatchAuthorizationArtifact = readJsonFile(
      options.nextBatchAuthorizationArtifactPath,
      'next-batch authorization artifact',
      { required: true }
    );
    validationEvidence = readJsonFile(
      options.validationEvidencePath,
      'validation evidence'
    );
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const executionPlanSource = resolvePolicyStorageClosureExecutionPlanSource({
    executionPlanArtifact,
  });
  if (!executionPlanSource.ok) {
    console.error('Execution-plan artifact is not an approved storage-closure manifest source.');
    console.error(JSON.stringify({
      issueCount: executionPlanSource.issueCount,
      issues: executionPlanSource.issues,
    }, null, 2));
    process.exit(2);
  }

  const evidence = await buildPolicyStorageClosureFinalRemovalAudit({
    executionPlanArtifact,
    nextBatchAuthorizationArtifact,
    reviewArtifactFingerprint: options.reviewArtifactFingerprint,
    validationEvidence,
    referenceScan: scanPolicyStorageClosureReferences({
      cwd,
      manifestPaths: executionPlanSource.manifestPaths,
    }),
    fileExists: repositoryPath => fileExistsAtRepositoryPath(cwd, repositoryPath),
  });

  try {
    writeJsonFile(options.outputPath, evidence.audit);
  } catch (err) {
    console.error(`Could not write final-removal-audit JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(evidence, null, 2));

  if (options.requireComplete && evidence.complete !== true) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Could not generate storage-closure final-removal audit JSON: ${err.message}`);
  process.exit(2);
});

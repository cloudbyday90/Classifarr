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
  buildPolicyCompatibilityRemovalEvidenceRegeneration,
} from '../server/src/services/policyCompatibilityRemovalEvidenceRegeneration.mjs';

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    executionPlanPath: null,
    nextBatchAuthorizationArtifactPath: null,
    reviewArtifactFingerprint: '',
    validationEvidencePath: null,
    outputPath: null,
    completionAuditArtifactOutputPath: null,
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
    if (arg === '--execution-plan') {
      options.executionPlanPath = argv[index + 1] || null;
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
    '  --cwd <path>                               Repository root. Defaults to process cwd.',
    '  --execution-plan <json>                    Required current compatibility deletion execution-plan JSON.',
    '  --next-batch-authorization-artifact <json> Required fingerprint-valid next-batch authorization artifact JSON.',
    '  --review-artifact-fingerprint <sha256>     Required applied removal-review artifact fingerprint.',
    '  --validation-evidence <json>               Required current validation-evidence JSON.',
    '  --output <json>                            Write evidence-regeneration JSON to this path.',
    '  --completion-audit-artifact-output <json>  Write the nested completion-audit artifact JSON.',
    '  --require-complete                         Exit non-zero unless the evidence is complete.',
    '  --generated-at <iso>                       Optional generatedAt timestamp for stable tests.',
    '  --help                                     Print this help message.',
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
  let executionPlan;
  let nextBatchAuthorizationArtifact;
  let validationEvidence;

  try {
    executionPlan = readJsonFile(options.executionPlanPath, 'execution plan', {
      required: true,
    });
    nextBatchAuthorizationArtifact = readJsonFile(
      options.nextBatchAuthorizationArtifactPath,
      'next-batch authorization artifact',
      { required: true }
    );
    validationEvidence = readJsonFile(
      options.validationEvidencePath,
      'validation evidence',
      { required: true }
    );
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const manifestPaths = Array.isArray(executionPlan.manifest?.entries)
    ? executionPlan.manifest.entries.map(entry => entry?.path).filter(Boolean)
    : [];
  const evidence = await buildPolicyCompatibilityRemovalEvidenceRegeneration({
    executionPlan,
    nextBatchAuthorizationArtifact,
    reviewArtifactFingerprint: options.reviewArtifactFingerprint,
    validationEvidence,
    referenceScan: scanPolicyStorageClosureReferences({
      cwd,
      manifestPaths,
    }),
    fileExists: repositoryPath => fileExistsAtRepositoryPath(cwd, repositoryPath),
    generatedAt: options.generatedAt,
  });

  try {
    writeJsonFile(options.outputPath, evidence);
    writeJsonFile(
      options.completionAuditArtifactOutputPath,
      evidence.completionAuditArtifact
    );
  } catch (err) {
    console.error(`Could not write compatibility-removal evidence JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(evidence, null, 2));

  if (options.requireComplete && evidence.complete !== true) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Could not generate compatibility-removal evidence JSON: ${err.message}`);
  process.exit(2);
});

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
  getExecutionPlanManifestPaths,
} from '../server/src/services/policyStorageClosureFinalRemovalAudit.mjs';

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    executionPlanPath: null,
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
    if (arg === '--execution-plan') {
      options.executionPlanPath = argv[index + 1] || null;
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
    '  --execution-plan <json>         Required compatibility deletion execution-plan JSON.',
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

function main() {
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
  let validationEvidence;

  try {
    executionPlan = readJsonFile(options.executionPlanPath, 'execution plan', {
      required: true,
    });
    validationEvidence = readJsonFile(
      options.validationEvidencePath,
      'validation evidence'
    );
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const manifestPaths = getExecutionPlanManifestPaths(executionPlan);
  const evidence = buildPolicyStorageClosureFinalRemovalAudit({
    executionPlan,
    validationEvidence,
    referenceScan: scanPolicyStorageClosureReferences({
      cwd,
      manifestPaths,
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

main();

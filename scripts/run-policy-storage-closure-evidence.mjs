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
  buildPolicyStorageClosureCurrentEvidenceRun,
} from '../server/src/services/policyStorageClosureCurrentEvidenceCollector.mjs';

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    completionAuditArtifactPath: null,
    validationEvidencePath: null,
    requireComplete: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--cwd') {
      options.cwd = argv[index + 1] || options.cwd;
      index += 1;
      continue;
    }
    if (arg === '--completion-audit-artifact') {
      options.completionAuditArtifactPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--validation-evidence') {
      options.validationEvidencePath = argv[index + 1] || null;
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
    'Usage: node scripts/run-policy-storage-closure-evidence.mjs [options]',
    '',
    'Options:',
    '  --cwd <path>                    Repository root. Defaults to process cwd.',
    '  --completion-audit-artifact <json>',
    '                                  JSON file containing a fingerprint-valid compatibility-removal completion-audit artifact.',
    '  --validation-evidence <json>    JSON file containing focused/lint/markdown/full validation evidence.',
    '  --require-complete              Exit non-zero unless the evidence run completes.',
    '  --help                          Print this help message.',
  ].join('\n');
}

function readJsonFile(filePath, label) {
  if (!filePath) {
    return {};
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);

  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${label} JSON at ${resolvedPath}: ${err.message}`);
  }
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

  let completionAuditArtifact;
  let validationEvidence;

  try {
    completionAuditArtifact = readJsonFile(
      options.completionAuditArtifactPath,
      'completion audit artifact'
    );
    validationEvidence = readJsonFile(
      options.validationEvidencePath,
      'validation evidence'
    );
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const result = await buildPolicyStorageClosureCurrentEvidenceRun({
    cwd: path.resolve(process.cwd(), options.cwd),
    completionAuditArtifact,
    validationEvidence,
  });

  console.log(JSON.stringify(result, null, 2));

  if (options.requireComplete && result.evidenceRun.complete !== true) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Could not run policy storage closure evidence: ${err.message}`);
  process.exit(2);
});

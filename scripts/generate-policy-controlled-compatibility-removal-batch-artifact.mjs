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
  buildPolicyControlledCompatibilityRemovalBatchArtifact,
} from '../server/src/services/policyControlledCompatibilityRemovalBatchArtifact.mjs';

function parseArgs(argv = []) {
  const options = {
    executionPlanArtifactPath: null,
    inputPath: null,
    outputPath: null,
    artifactOutputPath: null,
    allowBlocked: false,
    generatedAt: null,
    now: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--execution-plan-artifact') {
      options.executionPlanArtifactPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--input') {
      options.inputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--artifact-output') {
      options.artifactOutputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--allow-blocked') {
      options.allowBlocked = true;
      continue;
    }
    if (arg === '--generated-at') {
      options.generatedAt = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--now') {
      options.now = argv[index + 1] || null;
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
    'Usage: node scripts/generate-policy-controlled-compatibility-removal-batch-artifact.mjs [options]',
    '',
    'Options:',
    '  --execution-plan-artifact <json> Required v2 execution-plan artifact JSON.',
    '  --input <json>             Required input with bound preflightEvidence and removal review data.',
    '  --output <json>            Write nested removal-batch JSON to this path.',
    '  --artifact-output <json>   Write wrapper artifact JSON to this path.',
    '  --allow-blocked            Allow writing blocked removal-batch output.',
    '  --generated-at <iso>       Optional generatedAt timestamp for stable tests.',
    '  --now <iso>                Optional current timestamp for stable tests.',
    '  --help                     Print this help message.',
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

  let executionPlanArtifact;
  let input;

  try {
    executionPlanArtifact = readJsonFile(
      options.executionPlanArtifactPath,
      'execution-plan artifact',
      {
        required: true,
      }
    );
    input = readJsonFile(options.inputPath, 'removal-batch input evidence', {
      required: true,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const artifact = buildPolicyControlledCompatibilityRemovalBatchArtifact({
    executionPlanArtifact,
    input,
    generatedAt: options.generatedAt,
    now: options.now,
  });

  if (artifact.ready !== true && options.allowBlocked !== true) {
    console.error(
      'Controlled compatibility removal batch artifact is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: artifact.statusId,
      riskCount: artifact.riskCount,
      risks: artifact.risks,
      executionGateStatusId: artifact.executionGate.statusId,
      removalBatchStatusId: artifact.removalBatch.statusId,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, artifact.removalBatch);
    writeJsonFile(options.artifactOutputPath, artifact);
  } catch (err) {
    console.error(`Could not write controlled removal batch JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(artifact, null, 2));
  process.exit(artifact.ready === true ? 0 : 1);
}

main();

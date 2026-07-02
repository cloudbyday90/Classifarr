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
  buildPolicyBuilderPhase8NextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../server/src/services/policyBuilderPhase8NextCompatibilityRemovalBatchAuthorizationArtifact.mjs';

function parseArgs(argv = []) {
  const options = {
    postRemovalVerificationPath: null,
    executionPlanPath: null,
    inputPath: null,
    outputPath: null,
    artifactOutputPath: null,
    allowBlocked: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--post-removal-verification') {
      options.postRemovalVerificationPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--execution-plan') {
      options.executionPlanPath = argv[index + 1] || null;
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
    'Usage: node scripts/generate-policy-builder-phase-8r-next-batch-authorization.mjs [options]',
    '',
    'Options:',
    '  --post-removal-verification <json>  Required Phase 8R.19 verification JSON.',
    '  --execution-plan <json>             Required Phase 8R.15 execution-plan JSON.',
    '  --input <json>                      Required Phase 8R.20 authorization input JSON.',
    '  --output <json>                     Write nested authorization JSON to this path.',
    '  --artifact-output <json>            Write wrapper artifact JSON to this path.',
    '  --allow-blocked                     Allow writing blocked authorization output.',
    '  --generated-at <iso>                Optional generatedAt timestamp for stable tests.',
    '  --help                              Print this help message.',
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

  let postRemovalVerification;
  let executionPlan;
  let input;

  try {
    postRemovalVerification = readJsonFile(
      options.postRemovalVerificationPath,
      'post-removal verification',
      { required: true }
    );
    executionPlan = readJsonFile(options.executionPlanPath, 'execution plan', {
      required: true,
    });
    input = readJsonFile(options.inputPath, 'next-batch authorization input evidence', {
      required: true,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const artifact =
    buildPolicyBuilderPhase8NextCompatibilityRemovalBatchAuthorizationArtifact({
      postRemovalVerification,
      executionPlan,
      input,
      generatedAt: options.generatedAt,
    });

  if (
    artifact.readyForNextBatch !== true &&
    artifact.completedNoRemainingPaths !== true &&
    options.allowBlocked !== true
  ) {
    console.error(
      'Phase 8R next compatibility removal batch authorization artifact is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: artifact.statusId,
      riskCount: artifact.riskCount,
      risks: artifact.risks,
      authorizationStatusId: artifact.authorization.statusId,
      authorizationRiskCount: artifact.authorization.riskCount,
      authorizationRisks: artifact.authorization.risks,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, artifact.authorization);
    writeJsonFile(options.artifactOutputPath, artifact);
  } catch (err) {
    console.error(`Could not write next-batch authorization JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(artifact, null, 2));
  process.exit(artifact.statusId === 'blocked' ? 1 : 0);
}

main();

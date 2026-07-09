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
  buildPolicyBuilderPhase8CompletionCheckpointArtifact,
} from '../server/src/services/policyBuilderPhase8CompletionCheckpointArtifact.mjs';

function parseArgs(argv = []) {
  const options = {
    componentEvidencePath: null,
    roadmapEvidencePath: null,
    completionAuditArtifactPath: null,
    validationEvidencePath: null,
    changelogEvidencePath: null,
    outputPath: null,
    artifactOutputPath: null,
    allowBlocked: false,
    requireComplete: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--component-evidence') {
      options.componentEvidencePath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--roadmap-evidence') {
      options.roadmapEvidencePath = argv[index + 1] || null;
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
    if (arg === '--changelog-evidence') {
      options.changelogEvidencePath = argv[index + 1] || null;
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
    'Usage: node scripts/generate-policy-builder-phase-8r-completion-checkpoint.mjs [options]',
    '',
    'Options:',
    '  --component-evidence <json>        Required Phase 8R component evidence array JSON.',
    '  --roadmap-evidence <json>          Required Phase 8R roadmap evidence JSON.',
    '  --completion-audit-artifact <json> Required compatibility-removal completion-audit artifact JSON.',
    '  --validation-evidence <json>       Required Phase 8R validation evidence JSON.',
    '  --changelog-evidence <json>        Required Phase 8R changelog evidence JSON.',
    '  --output <json>                    Write nested checkpoint JSON to this path.',
    '  --artifact-output <json>           Write wrapper artifact JSON to this path.',
    '  --allow-blocked                    Allow writing blocked checkpoint output.',
    '  --require-complete                 Exit non-zero unless the checkpoint artifact is complete.',
    '  --generated-at <iso>               Optional generatedAt timestamp for stable tests.',
    '  --help                             Print this help message.',
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

  let componentEvidence;
  let roadmapEvidence;
  let completionAuditArtifact;
  let validationEvidence;
  let changelogEvidence;

  try {
    componentEvidence = readJsonFile(
      options.componentEvidencePath,
      'component evidence',
      { required: true }
    );
    roadmapEvidence = readJsonFile(
      options.roadmapEvidencePath,
      'roadmap evidence',
      { required: true }
    );
    completionAuditArtifact = readJsonFile(
      options.completionAuditArtifactPath,
      'completion audit artifact',
      { required: true }
    );
    validationEvidence = readJsonFile(
      options.validationEvidencePath,
      'validation evidence',
      { required: true }
    );
    changelogEvidence = readJsonFile(
      options.changelogEvidencePath,
      'changelog evidence',
      { required: true }
    );
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const artifact = buildPolicyBuilderPhase8CompletionCheckpointArtifact({
    componentEvidence,
    roadmapEvidence,
    completionAuditArtifact,
    validationEvidence,
    changelogEvidence,
    generatedAt: options.generatedAt,
  });

  if (artifact.statusId === 'blocked' && options.allowBlocked !== true) {
    console.error(
      'Phase 8R completion checkpoint artifact is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: artifact.statusId,
      riskCount: artifact.riskCount,
      risks: artifact.risks,
      checkpointStatusId: artifact.checkpoint.statusId,
      checkpointRiskCount: artifact.checkpoint.riskCount,
      checkpointRisks: artifact.checkpoint.risks,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, artifact.checkpoint);
    writeJsonFile(options.artifactOutputPath, artifact);
  } catch (err) {
    console.error(`Could not write Phase 8R completion checkpoint JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(artifact, null, 2));

  if (options.requireComplete && artifact.complete !== true) {
    process.exit(1);
  }

  process.exit(artifact.statusId === 'blocked' ? 1 : 0);
}

main();

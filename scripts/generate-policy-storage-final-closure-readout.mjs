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
  buildPolicyStorageFinalClosureReadout,
} from '../server/src/services/policyStorageFinalClosureReadout.mjs';

function parseArgs(argv = []) {
  const options = {
    checkpointArtifactPath: null,
    outputPath: null,
    allowBlocked: false,
    requireComplete: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--checkpoint-artifact') {
      options.checkpointArtifactPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
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
    'Usage: node scripts/generate-policy-storage-final-closure-readout.mjs [options]',
    '',
    'Options:',
    '  --checkpoint-artifact <json> Required policy storage completion-checkpoint artifact JSON.',
    '  --output <json>              Write policy storage final closure readout JSON to this path.',
    '  --allow-blocked              Allow writing blocked readout output.',
    '  --require-complete           Exit non-zero unless the readout is complete.',
    '  --generated-at <iso>         Optional generatedAt timestamp for stable tests.',
    '  --help                       Print this help message.',
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

  let checkpointArtifact;

  try {
    checkpointArtifact = readJsonFile(
      options.checkpointArtifactPath,
      'checkpoint artifact',
      { required: true }
    );
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const readout = buildPolicyStorageFinalClosureReadout({
    checkpointArtifact,
    generatedAt: options.generatedAt,
  });

  if (readout.statusId !== 'complete' && options.allowBlocked !== true) {
    console.error(
      'Policy storage final closure readout is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: readout.statusId,
      riskCount: readout.riskCount,
      risks: readout.risks,
      operatorSummary: readout.operatorSummary,
      checkpointStatusId: readout.checkpointSummary.statusId,
      checkpointArtifactStatusId: readout.checkpointArtifactSummary.statusId,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, readout);
  } catch (err) {
    console.error(`Could not write policy storage final closure readout JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(readout, null, 2));

  if (options.requireComplete && readout.complete !== true) {
    process.exit(1);
  }

  process.exit(readout.statusId === 'complete' ? 0 : 1);
}

main();

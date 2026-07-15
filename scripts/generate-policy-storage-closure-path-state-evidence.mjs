#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  collectPolicyStorageClosurePathStateObservations,
} from '../server/src/services/policyStorageClosurePathStateCollector.mjs';
import {
  buildPolicyStorageClosurePathStateEvidence,
} from '../server/src/services/policyStorageClosurePathStateEvidence.mjs';

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    executionPlanArtifactPath: null,
    generatedAt: null,
    outputPath: null,
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
    if (arg === '--generated-at') {
      options.generatedAt = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
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
    'Usage: node scripts/generate-policy-storage-closure-path-state-evidence.mjs [options]',
    '',
    'Options:',
    '  --cwd <path>                    Repository root. Defaults to process cwd.',
    '  --execution-plan-artifact <json> Required approved compatibility deletion execution-plan artifact JSON.',
    '  --generated-at <iso8601>        Optional stable evidence timestamp for reproducible local checks.',
    '  --output <json>                 Write checkout path-state evidence JSON to this path.',
    '  --help                          Print this help message.',
  ].join('\n');
}

function readJsonFile(filePath) {
  if (!filePath) {
    throw new Error('Missing required execution-plan artifact JSON path.');
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);

  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read execution-plan artifact JSON at ${resolvedPath}: ${err.message}`);
  }
}

function writeJsonFile(filePath, value) {
  if (!filePath) return;

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

  try {
    executionPlanArtifact = readJsonFile(options.executionPlanArtifactPath);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const collection = collectPolicyStorageClosurePathStateObservations({
    executionPlanArtifact,
    cwd: path.resolve(process.cwd(), options.cwd),
  });

  if (!collection.executionPlanSource.ok) {
    console.error('Execution-plan artifact is not an approved storage-closure manifest source.');
    console.error(JSON.stringify({
      issueCount: collection.executionPlanSource.issueCount,
      issues: collection.executionPlanSource.issues,
    }, null, 2));
    process.exit(2);
  }

  const evidence = buildPolicyStorageClosurePathStateEvidence({
    executionPlanArtifact,
    observations: collection.observations,
    generatedAt: options.generatedAt,
    sideEffects: { filesRead: true },
  });

  if (!evidence.captured || !evidence.validation.ok) {
    console.error('Could not capture valid checkout path-state evidence.');
    console.error(JSON.stringify({
      riskCount: evidence.riskCount,
      risks: evidence.risks,
      validation: evidence.validation,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, evidence);
  } catch (err) {
    console.error(`Could not write checkout path-state evidence JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(evidence, null, 2));
}

main();

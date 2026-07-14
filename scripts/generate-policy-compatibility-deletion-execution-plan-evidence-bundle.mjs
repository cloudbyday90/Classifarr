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

import * as db from '../server/src/config/database.mjs';
import {
  loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
} from '../server/src/services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  closeDatabasePool,
  runCliMain,
  shouldRunCli,
} from '../server/src/utils/cliRuntime.mjs';

function parseArgs(argv = []) {
  const options = {
    inputPath: null,
    outputPath: null,
    requireReady: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

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
    if (arg === '--require-ready') {
      options.requireReady = true;
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
    'Usage: node scripts/generate-policy-compatibility-deletion-execution-plan-evidence-bundle.mjs [options]',
    '',
    'Options:',
    '  --input <json>        Required cutover, gate, and safety input JSON. The current enabled-policy inventory is read from the database.',
    '  --output <json>       Write the side-effect-free evidence bundle to this path.',
    '  --require-ready       Exit non-zero unless the current evidence bundle is ready for execution planning.',
    '  --generated-at <iso>  Optional collection timestamp for stable tests.',
    '  --help                Print this help message.',
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
  } catch (error) {
    throw new Error(`Could not read ${label} JSON at ${resolvedPath}: ${error.message}`);
  }
}

function writeJsonFile(filePath, value) {
  if (!filePath) return;

  const resolvedPath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error('');
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(usage());
    await closeDatabasePool(db);
    return;
  }

  let input;

  try {
    input = readJsonFile(options.inputPath, 'execution-plan evidence input', {
      required: true,
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    await closeDatabasePool(db);
    return;
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    console.error('Execution-plan evidence input must be a JSON object.');
    process.exitCode = 2;
    await closeDatabasePool(db);
    return;
  }

  const executionEvidenceInput = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== 'now' && key !== 'generatedAt')
  );

  await runCliMain({
    execute: () => loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle(db, {
      ...executionEvidenceInput,
      generatedAt: options.generatedAt ?? input.generatedAt ?? null,
    }),
    onSuccess: async evidenceBundle => {
      writeJsonFile(options.outputPath, evidenceBundle);
      console.log(JSON.stringify(evidenceBundle, null, 2));
    },
    shouldFail: evidenceBundle => (
      options.requireReady && evidenceBundle.readyForExecutionPlan !== true
    ),
    failureMessage: 'Could not generate compatibility deletion execution-plan evidence bundle',
    cleanup: () => closeDatabasePool(db),
  });
}

if (shouldRunCli(import.meta)) {
  await main();
}

export {
  parseArgs,
  readJsonFile,
  usage,
  writeJsonFile,
};

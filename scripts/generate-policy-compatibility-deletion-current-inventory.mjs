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
  loadPolicyCompatibilityDeletionCurrentInventory,
} from '../server/src/services/policyCompatibilityDeletionCurrentInventory.mjs';
import {
  closeDatabasePool,
  runCliMain,
  shouldRunCli,
} from '../server/src/utils/cliRuntime.mjs';

function parseArgs(argv = []) {
  const options = {
    outputPath: null,
    requireAllEnabledPoliciesNative: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--require-all-enabled-policies-native') {
      options.requireAllEnabledPoliciesNative = true;
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
    'Usage: node scripts/generate-policy-compatibility-deletion-current-inventory.mjs [options]',
    '',
    'Options:',
    '  --output <json>                            Write the read-only inventory artifact to this path.',
    '  --require-all-enabled-policies-native      Exit non-zero unless every enabled policy has one valid active native intent.',
    '  --generated-at <iso>                       Optional generatedAt timestamp for stable tests.',
    '  --help                                     Print this help message.',
  ].join('\n');
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

  await runCliMain({
    execute: () => loadPolicyCompatibilityDeletionCurrentInventory(db, {
      generatedAt: options.generatedAt,
    }),
    onSuccess: async inventory => {
      writeJsonFile(options.outputPath, inventory);
      console.log(JSON.stringify(inventory, null, 2));
    },
    shouldFail: inventory => (
      options.requireAllEnabledPoliciesNative &&
      inventory.allEnabledPoliciesNative !== true
    ),
    failureMessage: 'Could not generate compatibility deletion current inventory',
    cleanup: () => closeDatabasePool(db),
  });
}

if (shouldRunCli(import.meta)) {
  await main();
}

export {
  parseArgs,
  usage,
  writeJsonFile,
};

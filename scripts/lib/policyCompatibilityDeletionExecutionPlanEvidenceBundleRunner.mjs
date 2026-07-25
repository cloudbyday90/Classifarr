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

const POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES = Object.freeze({
  BLOCKED: 1,
  INPUT_OR_OUTPUT_ERROR: 2,
  SUCCESS: 0,
});

function parseArgs(argv = []) {
  const options = {
    inputPath: null,
    outputPath: null,
    requireReady: false,
    generatedAt: null,
  };

  const readOptionValue = (optionName, index) => {
    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${optionName}.`);
    }

    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--input') {
      options.inputPath = readOptionValue(arg, index);
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = readOptionValue(arg, index);
      index += 1;
      continue;
    }
    if (arg === '--require-ready') {
      options.requireReady = true;
      continue;
    }
    if (arg === '--generated-at') {
      options.generatedAt = readOptionValue(arg, index);
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error('Unsupported command argument.');
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/generate-policy-compatibility-deletion-execution-plan-evidence-bundle.mjs [options]',
    '',
    'Options:',
    '  --input <json>        Required gate and safety input JSON. Current policy inventory and native runtime reads are collected from the database.',
    '  --output <json>       Write the side-effect-free evidence bundle to this path.',
    '  --require-ready       Exit non-zero unless the current evidence bundle is ready for execution planning.',
    '  --generated-at <iso>  Optional collection timestamp for stable tests.',
    '  --help                Print this help message.',
  ].join('\n');
}

function readJsonFile(
  filePath,
  label,
  {
    required = false,
    cwd = process.cwd(),
    fileSystem = fs,
    pathModule = path,
  } = {}
) {
  if (!filePath) {
    if (required) {
      throw new Error(`Missing required ${label} JSON path.`);
    }

    return {};
  }

  const resolvedPath = pathModule.resolve(cwd, filePath);

  try {
    return JSON.parse(fileSystem.readFileSync(resolvedPath, 'utf8'));
  } catch (_error) {
    throw new Error(`Could not read ${label} JSON.`);
  }
}

function writeJsonFile(
  filePath,
  value,
  {
    cwd = process.cwd(),
    fileSystem = fs,
    pathModule = path,
  } = {}
) {
  if (!filePath) {
    return;
  }

  const resolvedPath = pathModule.resolve(cwd, filePath);

  try {
    fileSystem.mkdirSync(pathModule.dirname(resolvedPath), { recursive: true });
    fileSystem.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
  } catch (_error) {
    throw new Error('Could not write compatibility deletion execution-plan evidence JSON.');
  }
}

function isJsonObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildExecutionEvidenceInput(input = {}) {
  const databaseOwnedEvidenceKeys = new Set([
    'convertedPolicy',
    'convertedPolicies',
    'unconvertedPolicy',
    'unconvertedPolicies',
  ]);

  return Object.fromEntries(
    Object.entries(input).filter(([key]) => (
      key !== 'now' &&
      key !== 'generatedAt' &&
      !databaseOwnedEvidenceKeys.has(key)
    ))
  );
}

async function closeResources({ closeDatabasePool, db, stderr }) {
  try {
    await closeDatabasePool?.(db);
    return true;
  } catch (_error) {
    stderr('Could not close compatibility deletion evidence resources.');
    return false;
  }
}

async function runPolicyCompatibilityDeletionExecutionPlanEvidenceBundleCli({
  argv = [],
  db,
  loadEvidenceBundle,
  closeDatabasePool,
  cwd = process.cwd(),
  fileSystem = fs,
  pathModule = path,
  stdout = message => console.log(message),
  stderr = message => console.error(message),
} = {}) {
  let options = null;
  let outcome = {
    exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.SUCCESS,
    evidenceBundle: null,
  };

  try {
    try {
      options = parseArgs(argv);
    } catch (error) {
      stderr(error.message);
      stderr('');
      stderr(usage());
      outcome.exitCode = POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES
        .INPUT_OR_OUTPUT_ERROR;
    }

    if (options?.help) {
      stdout(usage());
    }

    if (options && !options.help) {
      let input;
      try {
        input = readJsonFile(options.inputPath, 'execution-plan evidence input', {
          required: true,
          cwd,
          fileSystem,
          pathModule,
        });
      } catch (error) {
        stderr(error.message);
        outcome.exitCode = POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES
          .INPUT_OR_OUTPUT_ERROR;
      }

      if (outcome.exitCode === POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.SUCCESS) {
        if (!isJsonObject(input)) {
          stderr('Execution-plan evidence input must be a JSON object.');
          outcome.exitCode = POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES
            .INPUT_OR_OUTPUT_ERROR;
        }
      }

      let evidenceBundle;
      if (outcome.exitCode === POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.SUCCESS) {
        try {
          evidenceBundle = await loadEvidenceBundle(db, {
            ...buildExecutionEvidenceInput(input),
            generatedAt: options.generatedAt ?? input.generatedAt ?? null,
          });
        } catch (_error) {
          stderr('Could not generate compatibility deletion execution-plan evidence bundle.');
          outcome.exitCode = POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.BLOCKED;
        }
      }

      if (outcome.exitCode === POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.SUCCESS) {
        try {
          writeJsonFile(options.outputPath, evidenceBundle, {
            cwd,
            fileSystem,
            pathModule,
          });
          stdout(JSON.stringify(evidenceBundle, null, 2));
        } catch (error) {
          stderr(error.message);
          outcome.exitCode = POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES
            .INPUT_OR_OUTPUT_ERROR;
        }
      }

      outcome.evidenceBundle = evidenceBundle;
      if (
        outcome.exitCode === POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.SUCCESS &&
        options.requireReady &&
        evidenceBundle.readyForExecutionPlan !== true
      ) {
        outcome.exitCode = POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.BLOCKED;
      }
    }
  } finally {
    const closed = await closeResources({ closeDatabasePool, db, stderr });

    if (!closed && outcome.exitCode === POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.SUCCESS) {
      outcome.exitCode = POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES.BLOCKED;
    }
  }

  return outcome;
}

export {
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_CLI_EXIT_CODES,
  buildExecutionEvidenceInput,
  parseArgs,
  readJsonFile,
  runPolicyCompatibilityDeletionExecutionPlanEvidenceBundleCli,
  usage,
  writeJsonFile,
};

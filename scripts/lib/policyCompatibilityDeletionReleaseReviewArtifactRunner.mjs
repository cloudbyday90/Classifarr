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
  buildPolicyCompatibilityDeletionReleaseReviewArtifact,
} from '../../server/src/services/policyCompatibilityDeletionReleaseReviewArtifact.mjs';

const TEMPORARY_OUTPUT_DIRECTORY = '.tmp';

const POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES =
  Object.freeze({
    BLOCKED: 1,
    INPUT_OR_OUTPUT_ERROR: 2,
    SUCCESS: 0,
  });

function parseArgs(argv = []) {
  const options = {
    generatedAt: null,
    help: false,
    inputPath: null,
    outputPath: null,
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
    'Usage: node scripts/generate-policy-compatibility-deletion-release-review-artifact.mjs [options]',
    '',
    'Options:',
    '  --input <json>        Required current execution-plan evidence bundle inside this checkout.',
    '  --output <json>       Required new review artifact JSON path under .tmp.',
    '  --generated-at <iso>  Optional timestamp for stable verification.',
    '  --help                Print this help message.',
  ].join('\n');
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPathInside(rootPath, candidatePath, pathModule = path) {
  const relativePath = pathModule.relative(rootPath, candidatePath);

  return relativePath !== '' &&
    !relativePath.startsWith(`..${pathModule.sep}`) &&
    relativePath !== '..' &&
    !pathModule.isAbsolute(relativePath);
}

function resolveCheckedInputPath({ workspaceRoot, inputPath, fileSystem, pathModule }) {
  const realWorkspaceRoot = fileSystem.realpathSync(workspaceRoot);
  const resolvedPath = pathModule.resolve(realWorkspaceRoot, inputPath || '');
  const realInputPath = fileSystem.realpathSync(resolvedPath);

  if (
    !isPathInside(realWorkspaceRoot, realInputPath, pathModule) ||
    pathModule.extname(realInputPath).toLowerCase() !== '.json' ||
    !fileSystem.statSync(realInputPath).isFile()
  ) {
    throw new Error('Review artifact input must be a JSON file inside this checkout.');
  }

  return realInputPath;
}

function resolveCheckedOutputPath({ workspaceRoot, outputPath, fileSystem, pathModule }) {
  const realWorkspaceRoot = fileSystem.realpathSync(workspaceRoot);
  const resolvedPath = pathModule.resolve(realWorkspaceRoot, outputPath || '');
  const relativeOutputPath = pathModule.relative(realWorkspaceRoot, resolvedPath);

  if (
    !isPathInside(realWorkspaceRoot, resolvedPath, pathModule) ||
    !relativeOutputPath.startsWith(`${TEMPORARY_OUTPUT_DIRECTORY}${pathModule.sep}`) ||
    pathModule.extname(resolvedPath).toLowerCase() !== '.json' ||
    fileSystem.existsSync(resolvedPath)
  ) {
    throw new Error('Review artifact output must be a new JSON file under .tmp.');
  }

  const outputDirectory = pathModule.dirname(resolvedPath);
  fileSystem.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const realOutputDirectory = fileSystem.realpathSync(outputDirectory);
  const realTemporaryDirectory = fileSystem.realpathSync(
    pathModule.join(realWorkspaceRoot, TEMPORARY_OUTPUT_DIRECTORY)
  );
  const realOutputPath = pathModule.join(
    realOutputDirectory,
    pathModule.basename(resolvedPath)
  );

  if (!isPathInside(realTemporaryDirectory, realOutputPath, pathModule)) {
    throw new Error('Review artifact output must remain under .tmp.');
  }

  return realOutputPath;
}

function readJsonFile(filePath, fileSystem = fs) {
  try {
    const value = JSON.parse(fileSystem.readFileSync(filePath, 'utf8'));
    return isObject(value) ? value : null;
  } catch (_error) {
    return null;
  }
}

function writeJsonFile(filePath, value, fileSystem = fs) {
  try {
    fileSystem.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function createOutcome({ exitCode, artifact = null, outputPath = null } = {}) {
  return {
    artifact,
    exitCode,
    outputPath,
  };
}

function runPolicyCompatibilityDeletionReleaseReviewArtifact({
  argv = [],
  cwd = process.cwd(),
  fileSystem = fs,
  pathModule = path,
  now = null,
  stderr = message => console.error(message),
  stdout = message => console.log(message),
} = {}) {
  let options;

  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr(error.message);
    stderr('');
    stderr(usage());
    return createOutcome({
      exitCode:
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.INPUT_OR_OUTPUT_ERROR,
    });
  }

  if (options.help) {
    stdout(usage());
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.SUCCESS,
    });
  }

  if (!options.inputPath || !options.outputPath) {
    stderr('Review artifact input and output paths are required.');
    return createOutcome({
      exitCode:
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.INPUT_OR_OUTPUT_ERROR,
    });
  }

  let inputPath;
  let outputPath;
  try {
    inputPath = resolveCheckedInputPath({
      workspaceRoot: cwd,
      inputPath: options.inputPath,
      fileSystem,
      pathModule,
    });
    outputPath = resolveCheckedOutputPath({
      workspaceRoot: cwd,
      outputPath: options.outputPath,
      fileSystem,
      pathModule,
    });
  } catch (error) {
    stderr(error.message);
    return createOutcome({
      exitCode:
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.INPUT_OR_OUTPUT_ERROR,
    });
  }

  const executionPlanEvidenceBundle = readJsonFile(inputPath, fileSystem);
  if (!executionPlanEvidenceBundle) {
    stderr('Could not read a JSON object from the execution-plan evidence bundle.');
    return createOutcome({
      exitCode:
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.INPUT_OR_OUTPUT_ERROR,
    });
  }

  const artifact = buildPolicyCompatibilityDeletionReleaseReviewArtifact({
    executionPlanEvidenceBundle,
    generatedAt: options.generatedAt,
    now,
  });

  if (artifact.validation.ok !== true) {
    stderr('Could not build a valid release review artifact.');
    return createOutcome({
      artifact,
      exitCode: POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.BLOCKED,
    });
  }

  if (!writeJsonFile(outputPath, artifact, fileSystem)) {
    stderr('Could not write release review artifact JSON.');
    return createOutcome({
      artifact,
      exitCode:
        POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.INPUT_OR_OUTPUT_ERROR,
    });
  }

  stdout(JSON.stringify(artifact, null, 2));
  return createOutcome({
    artifact,
    exitCode: artifact.reviewRequired === true
      ? POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.SUCCESS
      : POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES.BLOCKED,
    outputPath,
  });
}

export {
  POLICY_COMPATIBILITY_DELETION_RELEASE_REVIEW_ARTIFACT_CLI_EXIT_CODES,
  parseArgs,
  runPolicyCompatibilityDeletionReleaseReviewArtifact,
  usage,
};

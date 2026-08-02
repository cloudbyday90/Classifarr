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

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  MAX_MANIFEST_ENTRY_COUNT,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS,
  buildPolicyCompatibilityDeletionPreflightEvidenceArtifact,
} from '../../server/src/services/policyCompatibilityDeletionPreflightEvidenceArtifact.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
} from '../../server/src/services/policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';

const PREFLIGHT_EVIDENCE_COLLECTOR_VERSION =
  'policy.compatibility_deletion_preflight_evidence_collector.v2';
const TEMPORARY_OUTPUT_DIRECTORY = '.tmp';
const MAX_ARTIFACT_BYTES = 1024 * 1024;
const REVISION_PATTERN = /^[a-f0-9]{40,64}$/u;

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES = Object.freeze({
  BLOCKED: 1,
  FAILURE: 2,
  SUCCESS: 0,
});

const POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS = Object.freeze({
  FAILED: 'failed',
  INVALID: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
  MISSING: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING,
  OBSERVED: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED,
  STALE: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE,
});

function createSystemCommandRunner() {
  return ({ command, args, cwd }) => spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
}

function parseArgs(argv = []) {
  const options = {
    artifactPath: null,
    help: false,
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

    if (arg === '--execution-plan-artifact') {
      options.artifactPath = readOptionValue(arg, index);
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = readOptionValue(arg, index);
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
    'Usage: node scripts/collect-policy-compatibility-deletion-preflight-evidence.mjs [options]',
    '',
    'Options:',
    '  --execution-plan-artifact <json>  Required approved execution-plan artifact inside the reviewed checkout.',
    '  --output <json>                   Required new output JSON under .tmp in the reviewed checkout.',
    '  --help                            Print this help message.',
  ].join('\n');
}

function normalizeCommandResult(result) {
  return {
    status: Number.isInteger(result?.status) ? result.status : null,
    stdout: typeof result?.stdout === 'string' ? result.stdout.trim() : '',
  };
}

function runCommand(commandRunner, command, args, cwd) {
  try {
    return normalizeCommandResult(commandRunner({ command, args, cwd }));
  } catch (_error) {
    return { status: null, stdout: '' };
  }
}

function runSuccessfulCommand(commandRunner, command, args, cwd) {
  const result = runCommand(commandRunner, command, args, cwd);

  return result.status === 0 ? result.stdout : null;
}

function isPathInside(rootPath, candidatePath, pathModule = path) {
  const relativePath = pathModule.relative(rootPath, candidatePath);

  return relativePath !== '' &&
    !relativePath.startsWith(`..${pathModule.sep}`) &&
    relativePath !== '..' &&
    !pathModule.isAbsolute(relativePath);
}

function isSameOrPathInside(rootPath, candidatePath, pathModule = path) {
  return rootPath === candidatePath || isPathInside(rootPath, candidatePath, pathModule);
}

function toPortablePath(value, pathModule = path) {
  return value.split(pathModule.sep).join('/');
}

function assertDirectoryPathHasNoSymbolicLinks({
  directoryPath,
  fileSystem,
  pathModule,
  workspaceRoot,
}) {
  if (!isSameOrPathInside(workspaceRoot, directoryPath, pathModule)) {
    throw new Error('Preflight evidence output must remain inside the reviewed checkout.');
  }

  const relativePath = pathModule.relative(workspaceRoot, directoryPath);
  const pathSegments = relativePath ? relativePath.split(pathModule.sep) : [];
  let currentPath = workspaceRoot;

  for (const segment of pathSegments) {
    currentPath = pathModule.join(currentPath, segment);
    const stat = fileSystem.lstatSync(currentPath);

    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('Preflight evidence output directories cannot use symbolic links.');
    }
  }
}

function resolveOutputPath({ workspaceRoot, outputPath, fileSystem, pathModule }) {
  const resolvedPath = pathModule.resolve(workspaceRoot, outputPath || '');
  const realWorkspaceRoot = fileSystem.realpathSync(workspaceRoot);
  const relativePath = pathModule.relative(realWorkspaceRoot, resolvedPath);

  if (
    !isPathInside(realWorkspaceRoot, resolvedPath, pathModule) ||
    !relativePath.startsWith(`${TEMPORARY_OUTPUT_DIRECTORY}${pathModule.sep}`) ||
    pathModule.extname(resolvedPath).toLowerCase() !== '.json' ||
    fileSystem.existsSync(resolvedPath)
  ) {
    throw new Error('Preflight evidence output must be a new JSON file under .tmp.');
  }

  return {
    absolutePath: resolvedPath,
    relativePath,
    workspaceRoot: realWorkspaceRoot,
  };
}

function prepareOutputPath({ output, fileSystem, pathModule }) {
  const outputDirectory = pathModule.dirname(output.absolutePath);
  const temporaryDirectory = pathModule.join(output.workspaceRoot, TEMPORARY_OUTPUT_DIRECTORY);

  fileSystem.mkdirSync(outputDirectory, { recursive: true });

  assertDirectoryPathHasNoSymbolicLinks({
    directoryPath: outputDirectory,
    fileSystem,
    pathModule,
    workspaceRoot: output.workspaceRoot,
  });

  const realOutputDirectory = fileSystem.realpathSync(outputDirectory);
  const realTemporaryDirectory = fileSystem.realpathSync(temporaryDirectory);
  const realOutputPath = pathModule.join(
    realOutputDirectory,
    pathModule.basename(output.absolutePath)
  );

  if (
    !isPathInside(output.workspaceRoot, realTemporaryDirectory, pathModule) ||
    !isPathInside(realTemporaryDirectory, realOutputPath, pathModule)
  ) {
    throw new Error('Preflight evidence output must remain under .tmp.');
  }

  return {
    absolutePath: realOutputPath,
    relativePath: pathModule.relative(output.workspaceRoot, realOutputPath),
  };
}

function readArtifact({ workspaceRoot, artifactPath, fileSystem, pathModule }) {
  const resolvedPath = pathModule.resolve(workspaceRoot, artifactPath || '');

  if (!isPathInside(workspaceRoot, resolvedPath, pathModule)) {
    throw new Error('Execution-plan artifact must remain inside the reviewed checkout.');
  }

  const relativePath = pathModule.relative(workspaceRoot, resolvedPath);
  const base = {
    artifactPath: toPortablePath(relativePath, pathModule),
    statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED,
  };

  if (pathModule.extname(resolvedPath).toLowerCase() !== '.json') {
    return {
      artifact: {},
      observation: {
        ...base,
        statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
      },
    };
  }

  if (!fileSystem.existsSync(resolvedPath)) {
    return {
      artifact: {},
      observation: {
        ...base,
        statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING,
      },
    };
  }

  try {
    const stat = fileSystem.lstatSync(resolvedPath);

    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_ARTIFACT_BYTES) {
      return {
        artifact: {},
        observation: {
          ...base,
          statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
        },
      };
    }

    const realArtifactPath = fileSystem.realpathSync(resolvedPath);

    if (!isPathInside(workspaceRoot, realArtifactPath, pathModule)) {
      return {
        artifact: {},
        observation: {
          ...base,
          statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
        },
      };
    }

    const artifact = JSON.parse(fileSystem.readFileSync(realArtifactPath, 'utf8'));

    return artifact && typeof artifact === 'object' && !Array.isArray(artifact)
      ? { artifact, observation: base }
      : {
        artifact: {},
        observation: {
          ...base,
          statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
        },
      };
  } catch (_error) {
    return {
      artifact: {},
      observation: {
        ...base,
        statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
      },
    };
  }
}

function isSafeManifestPath(value, workspaceRoot, pathModule) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    /[\u0000-\u001f]/u.test(value) ||
    pathModule.isAbsolute(value)
  ) {
    return null;
  }

  const resolvedPath = pathModule.resolve(workspaceRoot, value);

  if (!isPathInside(workspaceRoot, resolvedPath, pathModule)) {
    return null;
  }

  return {
    resolvedPath,
    sourcePath: value,
    trackedPath: toPortablePath(pathModule.relative(workspaceRoot, resolvedPath), pathModule),
  };
}

function observeManifestEntry({
  commandRunner,
  entry,
  index,
  workspaceRoot,
  fileSystem,
  pathModule,
}) {
  const sourcePath = entry?.path;
  const base = {
    entryIdentity: buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry),
    index,
    path: typeof sourcePath === 'string' ? sourcePath : null,
  };
  const safePath = isSafeManifestPath(sourcePath, workspaceRoot, pathModule);

  if (!safePath) {
    return {
      ...base,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
    };
  }

  if (!fileSystem.existsSync(safePath.resolvedPath)) {
    return {
      ...base,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING,
    };
  }

  try {
    const stat = fileSystem.lstatSync(safePath.resolvedPath);
    const realPath = fileSystem.realpathSync(safePath.resolvedPath);

    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      !isPathInside(workspaceRoot, realPath, pathModule)
    ) {
      return {
        ...base,
        statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
      };
    }
  } catch (_error) {
    return {
      ...base,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
    };
  }

  const headEntry = runCommand(
    commandRunner,
    'git',
    ['cat-file', '-e', `HEAD:${safePath.trackedPath}`],
    workspaceRoot
  );

  return {
    ...base,
    statusId: headEntry.status === 0
      ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED
      : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING,
  };
}

function observeManifestEntries({ commandRunner, artifact, workspaceRoot, fileSystem, pathModule }) {
  const entries = Array.isArray(artifact?.executionPlan?.manifest?.entries)
    ? artifact.executionPlan.manifest.entries
    : [];

  return entries.slice(0, MAX_MANIFEST_ENTRY_COUNT).map((entry, index) => observeManifestEntry({
    commandRunner,
    entry,
    index,
    workspaceRoot,
    fileSystem,
    pathModule,
  }));
}

function writeJsonFile(filePath, value, fileSystem = fs) {
  fileSystem.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function createOutcome({ exitCode, outputPath = null, sourceRevision = null, statusId }) {
  return {
    version: PREFLIGHT_EVIDENCE_COLLECTOR_VERSION,
    exitCode,
    outputPath,
    sourceRevision,
    statusId,
  };
}

function writeOutcome({ outcome, stdout }) {
  stdout(JSON.stringify(outcome, null, 2));
  return outcome;
}

async function runPolicyCompatibilityDeletionPreflightEvidenceCollector({
  argv = [],
  commandRunner = createSystemCommandRunner(),
  cwd = process.cwd(),
  fileSystem = fs,
  now = () => new Date(),
  pathModule = path,
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
      exitCode: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.FAILURE,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.FAILED,
    });
  }

  if (options.help) {
    stdout(usage());
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.SUCCESS,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.OBSERVED,
    });
  }

  if (!options.artifactPath || !options.outputPath) {
    stderr('Execution-plan artifact and output paths are required.');
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.FAILURE,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.FAILED,
    });
  }

  const workspaceRoot = runSuccessfulCommand(
    commandRunner,
    'git',
    ['rev-parse', '--show-toplevel'],
    cwd
  );

  if (!workspaceRoot) {
    stderr('Could not identify a reviewed Git checkout.');
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.FAILURE,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.FAILED,
    });
  }

  let output;
  let artifactResult;
  let realWorkspaceRoot;
  try {
    realWorkspaceRoot = fileSystem.realpathSync(workspaceRoot);
    output = resolveOutputPath({
      workspaceRoot: realWorkspaceRoot,
      outputPath: options.outputPath,
      fileSystem,
      pathModule,
    });
    artifactResult = readArtifact({
      workspaceRoot: realWorkspaceRoot,
      artifactPath: options.artifactPath,
      fileSystem,
      pathModule,
    });
  } catch (error) {
    stderr(error.message);
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.FAILURE,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.FAILED,
    });
  }

  const sourceRevision = runSuccessfulCommand(
    commandRunner,
    'git',
    ['rev-parse', 'HEAD'],
    realWorkspaceRoot
  )?.toLowerCase();
  const worktreeResult = runCommand(
    commandRunner,
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    realWorkspaceRoot
  );
  const checkoutObservation = {
    clean: worktreeResult.status === 0 && worktreeResult.stdout === '',
    sourceRevision: REVISION_PATTERN.test(sourceRevision || '') ? sourceRevision : null,
    statusId: worktreeResult.status === 0 && REVISION_PATTERN.test(sourceRevision || '')
      ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED
      : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID,
  };
  const manifestObservations = observeManifestEntries({
    commandRunner,
    artifact: artifactResult.artifact,
    workspaceRoot: realWorkspaceRoot,
    fileSystem,
    pathModule,
  });
  const generatedAt = now();
  const evidenceArtifact = buildPolicyCompatibilityDeletionPreflightEvidenceArtifact({
    artifactObservation: artifactResult.observation,
    checkoutObservation,
    executionPlanArtifact: artifactResult.artifact,
    generatedAt,
    manifestObservations,
    now: generatedAt,
  });

  try {
    output = prepareOutputPath({ output, fileSystem, pathModule });
    writeJsonFile(output.absolutePath, evidenceArtifact, fileSystem);
  } catch (error) {
    stderr(`Could not write preflight evidence artifact: ${error.message}`);
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.FAILURE,
      sourceRevision: checkoutObservation.sourceRevision,
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS.FAILED,
    });
  }

  const collected = evidenceArtifact.statusId ===
    POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED;

  return writeOutcome({
    outcome: createOutcome({
      exitCode: collected
        ? POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.SUCCESS
        : POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES.BLOCKED,
      outputPath: toPortablePath(output.relativePath, pathModule),
      sourceRevision: checkoutObservation.sourceRevision,
      statusId: evidenceArtifact.statusId,
    }),
    stdout,
  });
}

export {
  MAX_ARTIFACT_BYTES,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_EXIT_CODES,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_COLLECTOR_STATUS_IDS,
  PREFLIGHT_EVIDENCE_COLLECTOR_VERSION,
  parseArgs,
  runPolicyCompatibilityDeletionPreflightEvidenceCollector,
  usage,
};

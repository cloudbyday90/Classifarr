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
  buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary,
} from './policyCompatibilityDeletionEvidenceDiagnosticSummary.mjs';

const CONTAINER_NAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/iu;
const CONTAINER_USER_PATTERN = /^\d+:\d+$/u;
const IMAGE_ID_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const REVISION_PATTERN = /^[a-f0-9]{40,64}$/u;
const TEMPORARY_OUTPUT_DIRECTORY = '.tmp';
const MAINTENANCE_RUNNER_VERSION =
  'policy.compatibility_deletion_evidence_maintenance_runner.v1';

const POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES =
  Object.freeze({
    BLOCKED: 1,
    FAILURE: 2,
    SUCCESS: 0,
  });

const POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS =
  Object.freeze({
    BLOCKED_BY_IMAGE_PROVENANCE: 'blocked_by_image_provenance',
    BLOCKED_BY_WORKTREE: 'blocked_by_worktree',
    BLOCKED_BY_EVIDENCE: 'blocked_by_evidence',
    FAILED: 'failed',
    READY: 'ready',
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
    containerName: null,
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

    if (arg === '--container') {
      options.containerName = readOptionValue(arg, index);
      index += 1;
      continue;
    }
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
    'Usage: node scripts/run-policy-compatibility-deletion-evidence-maintenance.mjs [options]',
    '',
    'Options:',
    '  --container <name>  Required running Classifarr container name.',
    '  --input <json>      Optional reviewed evidence input JSON inside the reviewed checkout.',
    '  --output <json>     Required new output JSON under .tmp in the reviewed checkout.',
    '  --help              Print this help message.',
  ].join('\n');
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

  if (result.status !== 0) {
    return null;
  }

  return result.stdout;
}

function isPathInside(rootPath, candidatePath, pathModule = path) {
  const relativePath = pathModule.relative(rootPath, candidatePath);
  return relativePath !== '' &&
    !relativePath.startsWith(`..${pathModule.sep}`) &&
    relativePath !== '..' &&
    !pathModule.isAbsolute(relativePath);
}

function resolveCheckedInputPath({ workspaceRoot, inputPath, fileSystem, pathModule }) {
  const resolvedPath = pathModule.resolve(workspaceRoot, inputPath || '');
  const realWorkspaceRoot = fileSystem.realpathSync(workspaceRoot);
  const realInputPath = fileSystem.realpathSync(resolvedPath);

  if (!isPathInside(realWorkspaceRoot, realInputPath, pathModule)) {
    throw new Error('Evidence input must remain inside the reviewed checkout.');
  }

  if (!fileSystem.statSync(realInputPath).isFile()) {
    throw new Error('Evidence input must be a JSON file.');
  }
  if (pathModule.extname(realInputPath).toLowerCase() !== '.json') {
    throw new Error('Evidence input must be a JSON file.');
  }

  return {
    absolutePath: realInputPath,
    relativePath: pathModule.relative(realWorkspaceRoot, realInputPath),
    workspaceRoot: realWorkspaceRoot,
  };
}

function resolveCheckedOutputPath({ workspaceRoot, outputPath, fileSystem, pathModule }) {
  const resolvedPath = pathModule.resolve(workspaceRoot, outputPath || '');
  const realWorkspaceRoot = fileSystem.realpathSync(workspaceRoot);
  const relativeOutputPath = pathModule.relative(realWorkspaceRoot, resolvedPath);

  if (
    !isPathInside(realWorkspaceRoot, resolvedPath, pathModule) ||
    !relativeOutputPath.startsWith(`${TEMPORARY_OUTPUT_DIRECTORY}${pathModule.sep}`) ||
    pathModule.extname(resolvedPath).toLowerCase() !== '.json'
  ) {
    throw new Error('Evidence output must be a new JSON file under .tmp.');
  }

  if (fileSystem.existsSync(resolvedPath)) {
    throw new Error('Evidence output already exists.');
  }

  return {
    absolutePath: resolvedPath,
    relativePath: relativeOutputPath,
    workspaceRoot: realWorkspaceRoot,
  };
}

function prepareCheckedOutputPath({ output, fileSystem, pathModule }) {
  const { absolutePath, workspaceRoot } = output;

  const outputDirectory = pathModule.dirname(absolutePath);
  fileSystem.mkdirSync(outputDirectory, { recursive: true });
  const realOutputDirectory = fileSystem.realpathSync(outputDirectory);
  const realTemporaryDirectory = fileSystem.realpathSync(
    pathModule.join(workspaceRoot, TEMPORARY_OUTPUT_DIRECTORY)
  );
  const realOutputPath = pathModule.join(
    realOutputDirectory,
    pathModule.basename(absolutePath)
  );

  if (!isPathInside(realTemporaryDirectory, realOutputPath, pathModule)) {
    throw new Error('Evidence output must remain under .tmp.');
  }

  return {
    absolutePath: realOutputPath,
    directoryPath: realOutputDirectory,
    relativePath: pathModule.relative(workspaceRoot, realOutputPath),
    workspaceRoot,
  };
}

function toContainerPath(relativePath, pathModule = path) {
  return relativePath.split(pathModule.sep).join('/');
}

function buildDockerRunArguments({
  containerName,
  containerUser,
  imageId,
  inputRelativePath,
  outputDirectory,
  outputFileName,
  workspaceRoot,
  pathModule = path,
}) {
  const containerInputPath = inputRelativePath
    ? path.posix.join('/app/source', toContainerPath(inputRelativePath, pathModule))
    : null;
  const containerOutputPath = path.posix.join('/app/output', outputFileName);

  return [
    'run',
    '--rm',
    '--pull', 'never',
    '--network', `container:${containerName}`,
    '--user', containerUser,
    '--read-only',
    '--memory', '256m',
    '--pids-limit', '64',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=64m',
    '--security-opt', 'no-new-privileges:true',
    '--cap-drop', 'ALL',
    '--mount', `type=bind,source=${workspaceRoot},target=/app/source,readonly`,
    '--mount', `type=bind,source=${outputDirectory},target=/app/output`,
    '--workdir', '/app/source',
    '--env', 'NODE_ENV=production',
    '--env', 'POSTGRES_HOST=localhost',
    '--env', 'POSTGRES_PORT=5432',
    '--env', 'POSTGRES_DB=classifarr',
    '--env', 'POSTGRES_USER=classifarr',
    '--env', 'POSTGRES_PASSWORD=',
    '--env', 'POSTGRES_POOL_MAX=1',
    '--env', 'POSTGRES_CONNECT_RETRIES=0',
    '--env', 'POSTGRES_CONN_TIMEOUT_MS=5000',
    '--env', 'POSTGRES_STATEMENT_TIMEOUT_MS=30000',
    '--env', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=30000',
    imageId,
    'node',
    'scripts/generate-policy-compatibility-deletion-execution-plan-evidence-bundle.mjs',
    ...(inputRelativePath ? ['--input', containerInputPath] : []),
    '--output', containerOutputPath,
    '--require-ready',
  ];
}

function readCollectedEvidence(outputPath, fileSystem = fs) {
  try {
    const value = JSON.parse(fileSystem.readFileSync(outputPath, 'utf8'));
    return isObject(value) &&
      typeof value.readyForExecutionPlan === 'boolean' &&
      typeof value.statusId === 'string' &&
      isObject(value.validation) &&
      typeof value.validation.ok === 'boolean' &&
      Number.isInteger(value.riskCount) &&
      value.riskCount >= 0 &&
      Array.isArray(value.risks) &&
      value.riskCount === value.risks.length &&
      value.readyForExecutionPlan === (value.riskCount === 0) &&
      (value.readyForExecutionPlan !== true || value.validation.ok === true)
      ? value
      : null;
  } catch (_error) {
    return null;
  }
}

function createOutcome({
  exitCode,
  statusId,
  diagnostic = null,
  outputPath = null,
  sourceRevision = null,
} = {}) {
  return {
    version: MAINTENANCE_RUNNER_VERSION,
    exitCode,
    diagnostic,
    outputPath,
    sourceRevision,
    statusId,
  };
}

function writeOutcome({ outcome, stdout }) {
  stdout(JSON.stringify(outcome, null, 2));
  return outcome;
}

async function runPolicyCompatibilityDeletionEvidenceMaintenance({
  argv = [],
  commandRunner = createSystemCommandRunner(),
  cwd = process.cwd(),
  fileSystem = fs,
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
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED,
    });
  }

  if (options.help) {
    stdout(usage());
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.SUCCESS,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.READY,
    });
  }

  if (!options.containerName || !CONTAINER_NAME_PATTERN.test(options.containerName)) {
    stderr('A valid Classifarr container name is required.');
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED,
    });
  }

  let workspaceRoot;
  let sourceRevision;
  let input;
  let output;
  try {
    workspaceRoot = runSuccessfulCommand(
      commandRunner,
      'git',
      ['rev-parse', '--show-toplevel'],
      cwd
    );
    const worktreeStatus = runSuccessfulCommand(
      commandRunner,
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      workspaceRoot || cwd
    );
    sourceRevision = runSuccessfulCommand(
      commandRunner,
      'git',
      ['rev-parse', 'HEAD'],
      workspaceRoot || cwd
    )?.toLowerCase();

    if (!workspaceRoot || !sourceRevision || !REVISION_PATTERN.test(sourceRevision)) {
      throw new Error('Could not verify the reviewed checkout.');
    }
    if (worktreeStatus === null) {
      throw new Error('Could not verify the reviewed checkout.');
    }
    if (worktreeStatus !== '') {
      return createOutcome({
        exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.BLOCKED,
        sourceRevision,
        statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS
          .BLOCKED_BY_WORKTREE,
      });
    }

    input = options.inputPath
      ? resolveCheckedInputPath({
        workspaceRoot,
        inputPath: options.inputPath,
        fileSystem,
        pathModule,
      })
      : null;
    output = resolveCheckedOutputPath({
      workspaceRoot: input?.workspaceRoot || workspaceRoot,
      outputPath: options.outputPath,
      fileSystem,
      pathModule,
    });
  } catch (error) {
    stderr(error.message);
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE,
      sourceRevision,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED,
    });
  }

  const running = runSuccessfulCommand(
    commandRunner,
    'docker',
    ['inspect', '--format', '{{.State.Running}}', options.containerName],
    workspaceRoot
  );
  const imageId = runSuccessfulCommand(
    commandRunner,
    'docker',
    ['inspect', '--format', '{{.Image}}', options.containerName],
    workspaceRoot
  );
  const containerUser = runSuccessfulCommand(
    commandRunner,
    'docker',
    ['inspect', '--format', '{{.Config.User}}', options.containerName],
    workspaceRoot
  );

  if (
    running !== 'true' ||
    !imageId ||
    !IMAGE_ID_PATTERN.test(imageId) ||
    !containerUser ||
    !CONTAINER_USER_PATTERN.test(containerUser)
  ) {
    stderr('Could not verify a safe running Classifarr container.');
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE,
      sourceRevision,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED,
    });
  }

  const imageRevision = runSuccessfulCommand(
    commandRunner,
    'docker',
    [
      'image',
      'inspect',
      '--format',
      '{{index .Config.Labels "org.opencontainers.image.revision"}}',
      imageId,
    ],
    workspaceRoot
  )?.toLowerCase();

  if (!imageRevision || !REVISION_PATTERN.test(imageRevision) || imageRevision !== sourceRevision) {
    stderr('The target image is not revision-matched to the reviewed checkout.');
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.BLOCKED,
      sourceRevision,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS
        .BLOCKED_BY_IMAGE_PROVENANCE,
    });
  }

  try {
    output = prepareCheckedOutputPath({
      output,
      fileSystem,
      pathModule,
    });
  } catch (error) {
    stderr(error.message);
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE,
      sourceRevision,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED,
    });
  }

  const dockerResult = runCommand(
    commandRunner,
    'docker',
    buildDockerRunArguments({
      containerName: options.containerName,
      containerUser,
      imageId,
      inputRelativePath: input?.relativePath || null,
      outputDirectory: output.directoryPath,
      outputFileName: pathModule.basename(output.absolutePath),
      workspaceRoot: input?.workspaceRoot || workspaceRoot,
      pathModule,
    }),
    workspaceRoot
  );
  const evidenceBundle = readCollectedEvidence(output.absolutePath, fileSystem);

  if (!evidenceBundle) {
    stderr('The maintenance runner did not produce a valid evidence bundle.');
    return createOutcome({
      exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE,
      sourceRevision,
      statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED,
    });
  }

  const diagnostic = buildPolicyCompatibilityDeletionEvidenceDiagnosticSummary(
    evidenceBundle
  );

  if (evidenceBundle.readyForExecutionPlan === true && dockerResult.status === 0) {
    return writeOutcome({
      outcome: createOutcome({
        exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.SUCCESS,
        diagnostic,
        outputPath: toContainerPath(output.relativePath, pathModule),
        sourceRevision,
        statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.READY,
      }),
      stdout,
    });
  }

  if (evidenceBundle.readyForExecutionPlan === false && dockerResult.status === 1) {
    return writeOutcome({
      outcome: createOutcome({
        exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.BLOCKED,
        diagnostic,
        outputPath: toContainerPath(output.relativePath, pathModule),
        sourceRevision,
        statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS
          .BLOCKED_BY_EVIDENCE,
      }),
      stdout,
    });
  }

  stderr('The maintenance runner received an inconsistent evidence result.');
  return createOutcome({
    exitCode: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES.FAILURE,
    sourceRevision,
    statusId: POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS.FAILED,
  });
}

export {
  MAINTENANCE_RUNNER_VERSION,
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_EXIT_CODES,
  POLICY_COMPATIBILITY_DELETION_EVIDENCE_MAINTENANCE_STATUS_IDS,
  buildDockerRunArguments,
  parseArgs,
  runPolicyCompatibilityDeletionEvidenceMaintenance,
  usage,
};

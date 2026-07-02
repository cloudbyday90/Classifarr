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
  PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS,
} from '../server/src/services/policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs';
import {
  buildPolicyBuilderPhase8ControlledRemovalApplyArtifact,
} from '../server/src/services/policyBuilderPhase8ControlledRemovalApplyArtifact.mjs';

function parseArgs(argv = []) {
  const options = {
    removalBatchPath: null,
    inputPath: null,
    outputPath: null,
    artifactOutputPath: null,
    allowBlocked: false,
    applyFiles: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--removal-batch') {
      options.removalBatchPath = argv[index + 1] || null;
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
    if (arg === '--apply-files') {
      options.applyFiles = true;
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
    'Usage: node scripts/generate-policy-builder-phase-8r-removal-apply.mjs [options]',
    '',
    'Options:',
    '  --removal-batch <json>    Required Phase 8R.17 removal-batch JSON.',
    '  --input <json>            Required Phase 8R.18 apply input JSON.',
    '  --output <json>           Write nested apply-result JSON to this path.',
    '  --artifact-output <json>  Write wrapper artifact JSON to this path.',
    '  --apply-files             Apply supported delete/remove-test actions to files.',
    '  --allow-blocked           Allow writing blocked apply output.',
    '  --generated-at <iso>      Optional generatedAt timestamp for stable tests.',
    '  --help                    Print this help message.',
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

function normalizeRepoPath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function resolveRepoRelativePath(repoPath) {
  const normalizedPath = normalizeRepoPath(repoPath);

  if (!normalizedPath) {
    throw new Error('Removal entry path is empty.');
  }

  if (path.isAbsolute(normalizedPath)) {
    throw new Error(`Removal entry path must be repo-relative: ${repoPath}`);
  }

  const repoRoot = process.cwd();
  const resolvedPath = path.resolve(repoRoot, normalizedPath);
  const relativePath = path.relative(repoRoot, resolvedPath);

  if (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Removal entry path escapes the repository: ${repoPath}`);
  }

  return {
    normalizedPath,
    resolvedPath,
  };
}

function createFileApplyAdapter({ applyFiles = false } = {}) {
  return {
    async applyEntry(entry = {}) {
      const { normalizedPath, resolvedPath } = resolveRepoRelativePath(entry.path);
      const actionId = entry.actionId;
      const supportedAction = [
        PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
        PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
      ].includes(actionId);

      if (!supportedAction) {
        return {
          path: normalizedPath,
          actionId,
          categoryId: entry.categoryId,
          applied: false,
          operationId: null,
          sideEffects: {
            filesDeleted: false,
            filesArchived: false,
            routesRemoved: false,
            testsRemoved: false,
            storageChanged: false,
            gitCommandsRun: false,
          },
        };
      }

      if (applyFiles !== true) {
        return {
          path: normalizedPath,
          actionId,
          categoryId: entry.categoryId,
          applied: false,
          operationId: 'apply-files-flag-required',
          sideEffects: {
            filesDeleted: false,
            filesArchived: false,
            routesRemoved: false,
            testsRemoved: false,
            storageChanged: false,
            gitCommandsRun: false,
          },
        };
      }

      const stat = fs.statSync(resolvedPath, { throwIfNoEntry: false });

      if (!stat || !stat.isFile()) {
        return {
          path: normalizedPath,
          actionId,
          categoryId: entry.categoryId,
          applied: false,
          operationId: 'file-not-found',
          sideEffects: {
            filesDeleted: false,
            filesArchived: false,
            routesRemoved: false,
            testsRemoved: false,
            storageChanged: false,
            gitCommandsRun: false,
          },
        };
      }

      fs.rmSync(resolvedPath, {
        force: false,
        recursive: false,
      });

      return {
        path: normalizedPath,
        actionId,
        categoryId: entry.categoryId,
        applied: true,
        operationId: `deleted:${normalizedPath}`,
        sideEffects: {
          filesDeleted: true,
          filesArchived: false,
          routesRemoved: false,
          testsRemoved:
            actionId === PHASE8R_COMPATIBILITY_PATH_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
          storageChanged: false,
          gitCommandsRun: false,
        },
      };
    },
  };
}

async function main() {
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

  let removalBatch;
  let input;

  try {
    removalBatch = readJsonFile(options.removalBatchPath, 'removal batch', {
      required: true,
    });
    input = readJsonFile(options.inputPath, 'removal apply input evidence', {
      required: true,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const artifact = await buildPolicyBuilderPhase8ControlledRemovalApplyArtifact({
    removalBatch,
    input,
    applyAdapter: createFileApplyAdapter({
      applyFiles: options.applyFiles,
    }),
    generatedAt: options.generatedAt,
  });

  if (artifact.applied !== true && options.allowBlocked !== true) {
    console.error(
      'Phase 8R controlled removal apply artifact is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: artifact.statusId,
      riskCount: artifact.riskCount,
      risks: artifact.risks,
      applyStatusId: artifact.applyResult.statusId,
      applyRiskCount: artifact.applyResult.riskCount,
      applyRisks: artifact.applyResult.risks,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, artifact.applyResult);
    writeJsonFile(options.artifactOutputPath, artifact);
  } catch (err) {
    console.error(`Could not write controlled removal apply JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(artifact, null, 2));
  process.exit(artifact.applied === true ? 0 : 1);
}

main();

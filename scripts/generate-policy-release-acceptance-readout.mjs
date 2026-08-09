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
  POLICY_RELEASE_ACCEPTANCE_MODE_IDS,
  buildPolicyReleaseAcceptanceReadout,
} from '../server/src/services/policyReleaseAcceptanceManifest.mjs';

function parseArgs(argv = []) {
  const options = {
    baselineOperatorDecisionMetricPath: null,
    ciReadoutPath: null,
    generatedAt: null,
    installationEvidencePath: null,
    isolatedRuntimeAcceptanceStatusId: null,
    modeId: null,
    operatorDecisionMetricPath: null,
    outputPath: null,
    repositoryValidationStatusId: null,
    requirePassed: false,
    sourceRevision: null,
  };
  const flagMap = new Map([
    ['--mode', 'modeId'],
    ['--source-revision', 'sourceRevision'],
    ['--repository-validation', 'repositoryValidationStatusId'],
    ['--isolated-runtime-acceptance', 'isolatedRuntimeAcceptanceStatusId'],
    ['--ci-readout', 'ciReadoutPath'],
    ['--installation-evidence', 'installationEvidencePath'],
    ['--operator-decision-metric', 'operatorDecisionMetricPath'],
    ['--baseline-operator-decision-metric', 'baselineOperatorDecisionMetricPath'],
    ['--output', 'outputPath'],
    ['--generated-at', 'generatedAt'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--require-passed') {
      options.requirePassed = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    const key = flagMap.get(arg);
    if (!key) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    options[key] = argv[index + 1] || null;
    index += 1;
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/generate-policy-release-acceptance-readout.mjs [options]',
    '',
    'Modes:',
    '  ci            Records repository and isolated acceptance. It does not attest an installation.',
    '  installation  Combines a passed CI readout with fingerprint-bound installation evidence.',
    '',
    'Options:',
    '  --mode <ci|installation>                           Required acceptance scope.',
    '  --source-revision <sha>                            Required source revision.',
    '  --repository-validation <passed|blocked|not_applicable>  Required in ci mode.',
    '  --isolated-runtime-acceptance <passed|blocked|not_applicable> Required in ci mode.',
    '  --ci-readout <json>                                Required in installation mode.',
    '  --installation-evidence <json>                     Required in installation mode.',
    '  --operator-decision-metric <json>                  Optional current aggregate metric.',
    '  --baseline-operator-decision-metric <json>         Optional comparable baseline metric.',
    '  --output <json>                                    Required output path.',
    '  --generated-at <iso>                               Optional generated timestamp.',
    '  --require-passed                                   Exit non-zero unless required components pass.',
    '  --help                                             Print this help text.',
  ].join('\n');
}

function readJsonFile(filePath, label, { required = false } = {}) {
  if (!filePath) {
    if (required) {
      throw new Error(`Missing required ${label} path.`);
    }

    return null;
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${label} at ${resolvedPath}: ${error.message}`);
  }
}

function writeJsonFile(filePath, value) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
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
    return;
  }

  if (!options.modeId || !options.sourceRevision || !options.outputPath) {
    console.error('mode, source-revision, and output are required.');
    console.error('');
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  try {
    const isCi = options.modeId === POLICY_RELEASE_ACCEPTANCE_MODE_IDS.CI;
    const ciReadout = readJsonFile(options.ciReadoutPath, 'CI readout', { required: !isCi });
    const installationEvidence = readJsonFile(
      options.installationEvidencePath,
      'installation evidence',
      { required: !isCi }
    );
    const readout = buildPolicyReleaseAcceptanceReadout({
      modeId: options.modeId,
      sourceRevision: options.sourceRevision,
      repositoryValidationStatusId: options.repositoryValidationStatusId,
      isolatedRuntimeAcceptanceStatusId: options.isolatedRuntimeAcceptanceStatusId,
      ciReadout,
      installationEvidence,
      operatorDecisionMetric: readJsonFile(
        options.operatorDecisionMetricPath,
        'operator-decision metric'
      ),
      baselineOperatorDecisionMetric: readJsonFile(
        options.baselineOperatorDecisionMetricPath,
        'baseline operator-decision metric'
      ),
      generatedAt: options.generatedAt,
    });

    writeJsonFile(options.outputPath, readout);
    console.log(JSON.stringify(readout, null, 2));

    if (!readout.validation.ok ||
      (options.requirePassed && readout.complete !== true)) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

main();

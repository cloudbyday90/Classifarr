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
  buildPolicyReleaseInstallationEvidence,
} from '../server/src/services/policyReleaseInstallationEvidence.mjs';

function parseArgs(argv = []) {
  const options = {
    approvalEnvironment: null,
    approvalWorkflowUrl: null,
    attestedAt: null,
    changeReference: null,
    deploymentFingerprint: null,
    generatedAt: null,
    outputPath: null,
    sourceRevision: null,
  };
  const flagMap = new Map([
    ['--deployment-fingerprint', 'deploymentFingerprint'],
    ['--source-revision', 'sourceRevision'],
    ['--approval-environment', 'approvalEnvironment'],
    ['--approval-workflow-url', 'approvalWorkflowUrl'],
    ['--change-reference', 'changeReference'],
    ['--attested-at', 'attestedAt'],
    ['--output', 'outputPath'],
    ['--generated-at', 'generatedAt'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

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
    'Usage: node scripts/generate-policy-release-installation-evidence.mjs [options]',
    '',
    'Builds a privacy-bounded active-installation evidence artifact. The approval workflow URL must identify the protected-environment run that recorded this deployment.',
    '',
    'Options:',
    '  --deployment-fingerprint <value> Immutable deployed image digest or equivalent deployment fingerprint.',
    '  --source-revision <sha>           Source commit deployed by that artifact.',
    '  --approval-environment <name>     Protected GitHub Actions environment name.',
    '  --approval-workflow-url <url>     HTTPS GitHub Actions workflow-run URL.',
    '  --change-reference <value>        Bounded change, release, or deployment reference.',
    '  --attested-at <iso>               Approval-attestation timestamp.',
    '  --output <json>                   Required output path.',
    '  --generated-at <iso>              Optional generated timestamp for reproducible evidence.',
    '  --help                            Print this help text.',
  ].join('\n');
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

  const required = [
    'deploymentFingerprint',
    'sourceRevision',
    'approvalEnvironment',
    'approvalWorkflowUrl',
    'changeReference',
    'attestedAt',
    'outputPath',
  ];
  const missing = required.filter(key => !options[key]);
  if (missing.length > 0) {
    console.error(`Missing required options: ${missing.join(', ')}`);
    console.error('');
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  const evidence = buildPolicyReleaseInstallationEvidence({
    deploymentFingerprint: options.deploymentFingerprint,
    sourceRevision: options.sourceRevision,
    approvalWorkflow: {
      environmentName: options.approvalEnvironment,
      workflowRunUrl: options.approvalWorkflowUrl,
      changeReference: options.changeReference,
      attestedAt: options.attestedAt,
    },
    generatedAt: options.generatedAt,
  });

  if (!evidence.validation.ok) {
    console.error(JSON.stringify(evidence.validation, null, 2));
    process.exitCode = 1;
    return;
  }

  writeJsonFile(options.outputPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
}

main();

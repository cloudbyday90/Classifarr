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

import path from 'node:path';
import process from 'node:process';

import {
  POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_PLAN_VERSION,
  buildPolicyStorageClosureEvidenceLauncherPlan,
} from '../server/src/services/policyStorageClosureEvidenceLauncherPlan.mjs';
import { runPolicyStorageClosureEvidenceCommand } from '../server/src/services/policyStorageClosureEvidenceLauncherRunner.mjs';

const POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_VERSION =
  'policy.storage_closure_evidence_launcher.v1';

function requireOptionValue({ argv, index, optionName }) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    completionAuditArtifactPath: '',
    outputDirectory: '.tmp/policy-storage',
    generatedAt: null,
    allowBlocked: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--cwd') {
      options.cwd = requireOptionValue({ argv, index, optionName: arg });
      index += 1;
    } else if (arg === '--completion-audit-artifact') {
      options.completionAuditArtifactPath = requireOptionValue({ argv, index, optionName: arg });
      index += 1;
    } else if (arg === '--output-directory') {
      options.outputDirectory = requireOptionValue({ argv, index, optionName: arg });
      index += 1;
    } else if (arg === '--generated-at') {
      options.generatedAt = requireOptionValue({ argv, index, optionName: arg });
      index += 1;
    } else if (arg === '--allow-blocked') {
      options.allowBlocked = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/run-policy-storage-closure-evidence-launcher.mjs [options]',
    '  --completion-audit-artifact <json> Required current completion-audit artifact.',
    '  --cwd <path>                       Selected checkout. Defaults to process cwd.',
    '  --output-directory <path>          Relative artifact directory inside --cwd.',
    '  --allow-blocked                     Preserve blocked assembly diagnostics.',
    '  --dry-run                           Print the fixed launch plan without executing it.',
  ].join('\n');
}

function createResultSummary(command, result) {
  return {
    commandId: command.commandId,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
  };
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) {
    console.error(error.message); console.error(usage()); return 2;
  }
  if (options.help) { console.log(usage()); return 0; }
  const plan = buildPolicyStorageClosureEvidenceLauncherPlan({
    cwd: path.resolve(process.cwd(), options.cwd),
    completionAuditArtifactPath: options.completionAuditArtifactPath,
    outputDirectory: options.outputDirectory,
    generatedAt: options.generatedAt,
    allowBlocked: options.allowBlocked,
  });
  if (!plan.ok) {
    console.error(JSON.stringify({
      version: POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_VERSION,
      statusId: 'invalid',
      issues: plan.issues,
    }, null, 2));
    return 2;
  }
  if (options.dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return 0;
  }

  const results = [];
  for (const command of plan.commands) {
    console.log(JSON.stringify({
      version: POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_VERSION,
      statusId: 'running',
      commandId: command.commandId,
    }));
    const result = await runPolicyStorageClosureEvidenceCommand({
      cwd: plan.selectedCwd,
      ...command,
    });
    results.push(createResultSummary(command, result));
    if (result.exitCode !== 0) {
      console.error(JSON.stringify({
        version: POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_VERSION,
        statusId: 'blocked',
        results,
      }, null, 2));
      return 1;
    }
  }
  console.log(JSON.stringify({
    version: POLICY_STORAGE_CLOSURE_EVIDENCE_LAUNCHER_VERSION,
    statusId: 'complete',
    outputs: plan.outputs,
    results,
  }, null, 2));
  return 0;
}

main().then(exitCode => { process.exitCode = exitCode; }).catch(error => {
  process.exitCode = 2; console.error(`Could not run policy storage closure evidence launcher: ${error.message}`);
});

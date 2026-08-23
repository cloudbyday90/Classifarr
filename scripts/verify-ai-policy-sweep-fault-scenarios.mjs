/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  AI_POLICY_SWEEP_FAULT_SCENARIO_VERSION,
  runAiPolicySweepFaultScenarioDocument,
} from './lib/aiPolicySweepFaultScenario.mjs';

const DEFAULT_SCENARIOS_PATH = path.resolve('scripts/fixtures/ai-policy-sweep.fault-scenarios.json');

function parseArgs(argv) {
  const args = {
    outputPath: null,
    scenariosPath: process.env.CLASSIFARR_FAULT_SCENARIOS || DEFAULT_SCENARIOS_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === '--scenarios' && next) {
      args.scenariosPath = path.resolve(next);
      index += 1;
    } else if (argument === '--output' && next) {
      args.outputPath = path.resolve(next);
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node scripts/verify-ai-policy-sweep-fault-scenarios.mjs [options]',
    '',
    'This deterministic local harness makes no HTTP requests and writes no application data.',
    '',
    'Options:',
    '  --scenarios <path>  Fault-scenario JSON document',
    '  --output <path>     Bounded report path (default: .tmp/reports/...)',
  ].join('\n'));
}

function formatTimestampForPath(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function buildDefaultOutputPath() {
  return path.resolve('.tmp/reports', `ai-policy-sweep-fault-scenarios-${formatTimestampForPath()}.json`);
}

function toBoundedValidationIssues(issues) {
  return issues.map(issue => ({ id: issue.id, path: issue.path }));
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const document = JSON.parse(await readFile(args.scenariosPath, 'utf8'));
  const outcome = runAiPolicySweepFaultScenarioDocument(document);
  const outputPath = args.outputPath || buildDefaultOutputPath();
  const report = {
    version: AI_POLICY_SWEEP_FAULT_SCENARIO_VERSION,
    generatedAt: new Date().toISOString(),
    execution: {
      applicationWrites: 0,
      mediaSubmissions: 0,
      networkRequests: 0,
      type: 'deterministic_fault_contract',
    },
    validation: {
      ok: outcome.validation.ok,
      scenarioCount: outcome.validation.scenarioCount,
      issues: toBoundedValidationIssues(outcome.validation.issues),
    },
    results: outcome.results,
    summary: outcome.summary,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Fault scenarios: ${outcome.validation.scenarioCount}`);
  console.log(`Scenario contracts passed: ${outcome.summary.passedScenarioCount}`);
  console.log(`Scenario contracts failed: ${outcome.summary.failedScenarioCount}`);
  console.log(`Detected fault signals: ${outcome.summary.detectedFaultSignalCount}`);
  console.log(`Report: ${outputPath}`);

  if (!outcome.validation.ok || outcome.summary.failedScenarioCount > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});

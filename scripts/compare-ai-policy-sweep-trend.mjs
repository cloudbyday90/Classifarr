/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

import {
  AiClassificationEvaluationTrendBaselineValidationError,
  compareAiClassificationEvaluationSweepReports,
} from './lib/aiClassificationEvaluationTrendBaseline.mjs';

const USAGE = `Usage: node scripts/compare-ai-policy-sweep-trend.mjs --baseline <report.json> --candidate <report.json> [--output <.tmp/reports/artifact.json>]`;

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function parseArguments(argv) {
  const options = { baselinePath: null, candidatePath: null, outputPath: null };
  const optionNames = new Map([
    ['--baseline', 'baselinePath'],
    ['--candidate', 'candidatePath'],
    ['--output', 'outputPath'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      return { help: true };
    }
    const property = optionNames.get(argument);
    if (!property) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    if (options[property] !== null) {
      throw new Error(`${argument} may only be supplied once`);
    }
    options[property] = readOptionValue(argv, index, argument);
    index += 1;
  }

  if (!options.baselinePath || !options.candidatePath) {
    throw new Error('--baseline and --candidate are required');
  }
  return options;
}

function createDefaultOutputName(now = new Date()) {
  return `ai-policy-sweep-trend-${now.toISOString().replace(/[:.]/g, '-')}.json`;
}

function resolveSafeOutputPath({ workspaceRoot, outputPath, now }) {
  const reportsDirectory = resolve(workspaceRoot, '.tmp', 'reports');
  const resolvedOutputPath = resolve(
    workspaceRoot,
    outputPath ?? resolve(reportsDirectory, createDefaultOutputName(now)),
  );
  const relativePath = relative(reportsDirectory, resolvedOutputPath);
  if (!relativePath || dirname(resolvedOutputPath) !== reportsDirectory ||
    basename(relativePath) !== relativePath || relativePath.startsWith('..') ||
    isAbsolute(relativePath)) {
    throw new Error('Trend artifact output must be a file inside .tmp/reports');
  }
  return { reportsDirectory, resolvedOutputPath };
}

async function readJsonReport(filePath, label) {
  let content;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`Unable to read ${label} report`);
  }

  try {
    return {
      content,
      report: JSON.parse(content),
    };
  } catch {
    throw new Error(`${label} report is not valid JSON`);
  }
}

function fingerprintContent(content) {
  return {
    algorithm: 'sha256',
    fingerprint: createHash('sha256').update(content, 'utf8').digest('hex'),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const workspaceRoot = process.cwd();
  const baselinePath = resolve(workspaceRoot, options.baselinePath);
  const candidatePath = resolve(workspaceRoot, options.candidatePath);
  const [baseline, candidate] = await Promise.all([
    readJsonReport(baselinePath, 'baseline'),
    readJsonReport(candidatePath, 'candidate'),
  ]);
  const now = new Date();
  const artifact = compareAiClassificationEvaluationSweepReports({
    baselineReport: baseline.report,
    candidateReport: candidate.report,
    baselineReportFingerprint: fingerprintContent(baseline.content),
    candidateReportFingerprint: fingerprintContent(candidate.content),
    createdAt: now.toISOString(),
  });
  const { reportsDirectory, resolvedOutputPath } = resolveSafeOutputPath({
    workspaceRoot,
    outputPath: options.outputPath,
    now,
  });
  await mkdir(reportsDirectory, { recursive: true });
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });

  process.stdout.write(
    `Trend comparison complete: ${artifact.summary.comparedCohortCount} matching cohort(s), ` +
    `${artifact.summary.regressionCount} regression(s), ` +
    `human review ${artifact.summary.humanReviewRequired ? 'required' : 'not triggered'}.\n`,
  );
  process.stdout.write(`Trend artifact: ${resolvedOutputPath}\n`);
}

main().catch(error => {
  const message = error instanceof AiClassificationEvaluationTrendBaselineValidationError ||
    error instanceof Error ? error.message : 'Trend comparison failed';
  process.stderr.write(`Trend comparison failed: ${message}\n`);
  process.stderr.write(`${USAGE}\n`);
  process.exitCode = 1;
});

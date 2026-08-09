/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/* eslint-disable security/detect-non-literal-fs-filename -- The explicit CLI output path is the command's documented artifact destination. */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  pool,
  query,
} from '../config/database.mjs';
import {
  collectPolicyOperatorDecisionMetric,
} from '../services/policyOperatorDecisionMetricRepository.mjs';

function parseArgs(argv = []) {
  const options = {
    generatedAt: null,
    measurementScopeId: null,
    outputPath: null,
    windowEndedAt: null,
    windowStartedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--scope-id') {
      options.measurementScopeId = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--window-start') {
      options.windowStartedAt = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--window-end') {
      options.windowEndedAt = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
      index += 1;
    } else if (arg === '--generated-at') {
      options.generatedAt = argv[index + 1] || null;
      index += 1;
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
    'Usage: generatePolicyOperatorDecisionMetric.mjs [options]',
    '',
    'Reads aggregate classification-history counts only. It never writes data or emits titles, library names, identifiers, configuration, or secrets.',
    '',
    'Options:',
    '  --scope-id <id>            Stable aggregate scope, for example all_classification_history.',
    '  --window-start <iso>       Inclusive ISO-8601 measurement-window start.',
    '  --window-end <iso>         Exclusive ISO-8601 measurement-window end.',
    '  --output <json>            Required path for the privacy-bounded metric artifact.',
    '  --generated-at <iso>       Optional generated timestamp for reproducible evidence.',
    '  --help                     Print this help text.',
  ].join('\n');
}

function writeJsonFile(filePath, value) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeStdout(value) {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value) {
  process.stderr.write(`${value}\n`);
}

async function runPolicyOperatorDecisionMetricCli({ argv = process.argv.slice(2) } = {}) {
  let options;

  try {
    options = parseArgs(argv);
  } catch (error) {
    writeStderr(error.message);
    writeStderr('');
    writeStderr(usage());
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    writeStdout(usage());
    return;
  }

  if (
    !options.measurementScopeId ||
    !options.windowStartedAt ||
    !options.windowEndedAt ||
    !options.outputPath
  ) {
    writeStderr('scope-id, window-start, window-end, and output are required.');
    writeStderr('');
    writeStderr(usage());
    process.exitCode = 2;
    return;
  }

  const metric = await collectPolicyOperatorDecisionMetric({
    db: { query },
    measurementScopeId: options.measurementScopeId,
    windowStartedAt: options.windowStartedAt,
    windowEndedAt: options.windowEndedAt,
    generatedAt: options.generatedAt,
  });

  if (!metric.validation.ok) {
    writeStderr(JSON.stringify(metric.validation, null, 2));
    process.exitCode = 1;
    return;
  }

  writeJsonFile(options.outputPath, metric);
  writeStdout(JSON.stringify(metric, null, 2));
}

async function main() {
  try {
    await runPolicyOperatorDecisionMetricCli();
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

const isDirectExecution = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  await main();
}

export {
  runPolicyOperatorDecisionMetricCli,
};

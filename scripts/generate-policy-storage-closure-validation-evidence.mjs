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

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS,
  buildPolicyStorageClosureValidationEvidence,
  commandToString,
} from '../server/src/services/policyStorageClosureValidationEvidence.mjs';

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    outputPath: null,
    continueOnFailure: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--cwd') {
      options.cwd = argv[index + 1] || options.cwd;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--bail') {
      options.continueOnFailure = false;
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
    'Usage: node scripts/generate-policy-storage-closure-validation-evidence.mjs [options]',
    '',
    'Options:',
    '  --cwd <path>       Repository root. Defaults to process cwd.',
    '  --output <json>    Write validation evidence JSON to this path.',
    '  --bail             Stop after the first failed validation command.',
    '  --help             Print this help message.',
  ].join('\n');
}

function resolveNpmCliPath(command) {
  const npmExecPath = process.env.npm_execpath;

  if (!npmExecPath) {
    return null;
  }
  if (command === 'npm') {
    return npmExecPath;
  }

  const npxCliPath = path.join(path.dirname(npmExecPath), 'npx-cli.js');
  return fs.existsSync(npxCliPath) ? npxCliPath : null;
}

function buildSpawnInvocation(commandSpec = {}) {
  if (commandSpec.command === 'node') {
    return {
      command: process.execPath,
      args: commandSpec.args,
    };
  }
  if (['npm', 'npx'].includes(commandSpec.command)) {
    const cliPath = resolveNpmCliPath(commandSpec.command);

    if (cliPath) {
      return {
        command: process.execPath,
        args: [cliPath, ...commandSpec.args],
      };
    }
  }

  return {
    command: commandSpec.command,
    args: commandSpec.args,
  };
}

function writeJsonFile(filePath, value) {
  if (!filePath) {
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

function runCommand(commandSpec, { cwd }) {
  return new Promise(resolve => {
    const startedAt = new Date();
    const resolvedCwd = path.resolve(cwd, commandSpec.cwd || '.');
    const invocation = buildSpawnInvocation(commandSpec);
    let child;
    let outputTail = '';
    const appendOutput = chunk => {
      outputTail = `${outputTail}${chunk.toString()}`.slice(-2000);
    };

    try {
      child = spawn(invocation.command, invocation.args, {
        cwd: resolvedCwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });
    } catch (err) {
      const finishedAt = new Date();
      resolve({
        checkId: commandSpec.checkId,
        exitCode: 1,
        signal: null,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        message: err.message,
      });
      return;
    }

    child.stdout.on('data', chunk => {
      appendOutput(chunk);
      process.stderr.write(chunk);
    });
    child.stderr.on('data', chunk => {
      appendOutput(chunk);
      process.stderr.write(chunk);
    });
    child.on('error', err => {
      const finishedAt = new Date();
      resolve({
        checkId: commandSpec.checkId,
        exitCode: 1,
        signal: null,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        message: err.message,
      });
    });
    child.on('exit', (exitCode, signal) => {
      const finishedAt = new Date();
      const passed = exitCode === 0;

      resolve({
        checkId: commandSpec.checkId,
        exitCode: exitCode ?? 1,
        signal,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        message: passed
          ? 'Validation command passed.'
          : `Validation command failed: ${commandToString(commandSpec)}`,
        outputTail: passed ? undefined : outputTail,
      });
    });
  });
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

  const cwd = path.resolve(process.cwd(), options.cwd);
  const commandResults = [];

  for (const commandSpec of POLICY_STORAGE_CLOSURE_VALIDATION_COMMANDS) {
    console.error(`[policy-storage-closure-validation] ${commandSpec.label}`);
    const commandResult = await runCommand(commandSpec, { cwd });
    commandResults.push(commandResult);

    if (commandResult.exitCode !== 0 && !options.continueOnFailure) {
      break;
    }
  }

  const evidence = buildPolicyStorageClosureValidationEvidence({
    commandResults,
  });

  try {
    writeJsonFile(options.outputPath, evidence);
  } catch (err) {
    console.error(`Could not write validation evidence JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(evidence, null, 2));
  process.exit(evidence.complete ? 0 : 1);
}

main();

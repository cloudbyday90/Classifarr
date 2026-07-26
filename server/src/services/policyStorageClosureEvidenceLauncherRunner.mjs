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
import path from 'node:path';
import process from 'node:process';

const POLICY_STORAGE_CLOSURE_EVIDENCE_TERMINATION_GRACE_MS = 10_000;

function createFailedCommandResult({ signal = null, timedOut = false } = {}) {
  return {
    exitCode: 1,
    signal,
    timedOut,
  };
}

function runPolicyStorageClosureEvidenceCommand({
  cwd,
  scriptPath,
  args,
  timeoutMs,
  terminationGraceMs = POLICY_STORAGE_CLOSURE_EVIDENCE_TERMINATION_GRACE_MS,
  spawnProcess = spawn,
}) {
  return new Promise(resolve => {
    let child;
    let settled = false;
    let timedOut = false;
    let timeoutId;
    let forceTerminationId;
    let finalizationId;

    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      clearTimeout(forceTerminationId);
      clearTimeout(finalizationId);
      resolve(result);
    };

    try {
      child = spawnProcess(process.execPath, [path.resolve(cwd, scriptPath), ...args], {
        cwd,
        shell: false,
        stdio: 'ignore',
      });
    } catch {
      finish(createFailedCommandResult());
      return;
    }

    timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');

      // A command that ignores graceful termination must not leave the launcher waiting.
      forceTerminationId = setTimeout(() => {
        if (child.exitCode === null) {
          child.kill('SIGKILL');
        }
        finalizationId = setTimeout(() => {
          finish(createFailedCommandResult({ signal: 'SIGKILL', timedOut: true }));
        }, terminationGraceMs);
      }, terminationGraceMs);
    }, timeoutMs);

    child.once('error', () => {
      finish(createFailedCommandResult({ timedOut }));
    });
    child.once('close', (exitCode, signal) => {
      finish({
        exitCode: exitCode ?? 1,
        signal,
        timedOut,
      });
    });
  });
}

export {
  POLICY_STORAGE_CLOSURE_EVIDENCE_TERMINATION_GRACE_MS,
  runPolicyStorageClosureEvidenceCommand,
};

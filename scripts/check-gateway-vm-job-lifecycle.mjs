#!/usr/bin/env node
/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// No environment inputs, real VM adapter, imported receipts or power operations.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runVmJobSimulations } from './lib/gatewayVmJobSimulation.mjs';

export function runVmJobLifecycleCli(args) {
  if (args.length !== 1 || args[0] !== '--simulate') throw new Error('gateway_vm_job_invocation_invalid');
  return runVmJobSimulations();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runVmJobLifecycleCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.status === 'matched' ? 0 : 2;
  } catch {
    process.stdout.write(`${JSON.stringify({ version: 1, mode: 'simulation', status: 'invalid',
      liveOperationsEnabled: false, studyReady: false, error: 'gateway_vm_job_invocation_invalid' })}\n`);
    process.exitCode = 1;
  }
}

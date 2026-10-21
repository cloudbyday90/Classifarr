#!/usr/bin/env node
/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// One-shot administrator setup. See docs/architecture/study-vm-creation-design.md.
// No required environment variables; --plan is pure, --create writes new local resources.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStudyVm, planVmCreation } from './lib/gatewayVmCreation.mjs';

export async function runVmCreationCli(args, { create = createStudyVm, signal } = {}) {
  if (args.length !== 5 || !['--plan', '--create'].includes(args[0]) || args[1] !== '--vm-parent'
    || args[3] !== '--disk-parent') throw new Error('gateway_vm_creation_arguments_invalid');
  const parents = { vmParent: args[2], diskParent: args[4] };
  const plan = planVmCreation(parents);
  if (args[0] === '--plan') return { version: 1, status: 'planned', plan, requiresAdministrator: true,
    automaticRetry: false, studyReady: false, handoffAuthenticated: false };
  return create(parents, { signal });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  try {
    const result = await runVmCreationCli(process.argv.slice(2), { signal: controller.signal });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = ['planned', 'created_off'].includes(result.status) ? 0 : 2;
  } catch {
    process.stdout.write(`${JSON.stringify({ version: 1, status: 'invalid', automaticRetry: false,
      studyReady: false, handoffAuthenticated: false, error: 'gateway_vm_creation_arguments_invalid' })}\n`);
    process.exitCode = 1;
  } finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
}

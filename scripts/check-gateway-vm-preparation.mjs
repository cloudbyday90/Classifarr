#!/usr/bin/env node
/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Read-only preparation checks. Usage/exit codes: docs/operations/gateway-hyperv-setup.md.
// No required environment variables, imported authority, provisioning or study execution.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { captureGuestPreparation } from './lib/gatewayVmGuest.mjs';
import { captureHypervPreparation } from './lib/gatewayVmProbe.mjs';
import { isVmGuid, isVmRevision, requireGatewayVmProfile, vmCheck, vmPreparationResult } from './lib/gatewayVmPreparation.mjs';
import { assessVmHandoffFile } from './lib/gatewayVmHandoffFile.mjs';

export function runVmPreparationCli(args, { host = captureHypervPreparation, guest = captureGuestPreparation, handoff = assessVmHandoffFile } = {}) {
  requireGatewayVmProfile();
  if (args.length === 1 && args[0] === '--profile') return vmPreparationResult('profile', [vmCheck('committed_profile', true)]);
  if (args.length === 5 && args[0] === '--host' && args[1] === '--vm-id' && isVmGuid(args[2])
    && args[3] === '--switch-id' && isVmGuid(args[4])) return host({ vmId: args[2], switchId: args[4] });
  if (args.length === 3 && args[0] === '--guest' && args[1] === '--revision' && isVmRevision(args[2])) {
    return guest({ root: fileURLToPath(new URL('../', import.meta.url)), revision: args[2] });
  }
  if (args.length === 7 && args[0] === '--handoff' && args[1] === '--file' && args[3] === '--vm-id'
    && isVmGuid(args[4]) && args[5] === '--switch-id' && isVmGuid(args[6])) {
    return handoff({ file: args[2], vmId: args[4], switchId: args[6] });
  }
  throw new Error('gateway_vm_arguments_invalid');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runVmPreparationCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.status === 'matched' ? 0 : 2;
  } catch {
    process.stdout.write(`${JSON.stringify({ version: 2, status: 'invalid', studyReady: false,
      liveOperationsEnabled: false, handoffAuthenticated: false,
      error: 'gateway_vm_invocation_or_profile_invalid' })}\n`);
    process.exitCode = 1;
  }
}

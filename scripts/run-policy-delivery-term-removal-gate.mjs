#!/usr/bin/env node

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  buildPolicyDeliveryTermRemovalRepositoryAudit,
} from './lib/policyDeliveryTermCompletionRepositoryScan.mjs';

function parseArgs(argv = []) {
  const options = {
    requireValid: false,
    showHelp: false,
  };

  argv.forEach(arg => {
    if (arg === '--require-valid') {
      options.requireValid = true;
      return;
    }

    if (arg === '--help' || arg === '-h') {
      options.showHelp = true;
      return;
    }

    throw new Error(`Unknown option: ${arg}`);
  });

  return options;
}

function usage() {
  return [
    'Usage: node scripts/run-policy-delivery-term-removal-gate.mjs [--require-valid]',
    '',
    'Verifies production delivery-term removal and bounded compatibility readers.',
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.showHelp) {
    console.log(usage());
    return;
  }

  const audit = buildPolicyDeliveryTermRemovalRepositoryAudit({
    generatedAt: new Date().toISOString(),
  });

  console.log(JSON.stringify(audit, null, 2));

  if (options.requireValid && audit.complete !== true) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

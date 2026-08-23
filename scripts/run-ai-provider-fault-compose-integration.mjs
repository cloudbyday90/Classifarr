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

import process from 'node:process';
import { resolve } from 'node:path';
import {
  AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS,
  runAiProviderFaultComposeIntegration,
} from './lib/aiProviderFaultComposeIntegration.mjs';

function usage() {
  return [
    'Usage:',
    '  npm run test:integration:ai-provider-fault-compose',
    '',
    'Starts an isolated, fixed test-only Ollama fault stub and always removes it.',
  ].join('\n');
}

async function main() {
  if (process.argv.slice(2).length > 0) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const result = await runAiProviderFaultComposeIntegration({ cwd: resolve(process.cwd()) });
    process.stdout.write(`AI provider fault Compose integration passed (${result.projectName}).\n`);
  } catch (error) {
    const statusId = error?.statusId || AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.INVALID_INPUT;
    process.stderr.write(`AI provider fault Compose integration failed: ${statusId}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}

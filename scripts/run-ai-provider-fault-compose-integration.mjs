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
import {
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
  createAiProviderFaultComposeReceipt,
  writeAiProviderFaultComposeReceipt,
} from './lib/aiProviderFaultComposeReceipt.mjs';

function usage() {
  return [
    'Usage:',
    '  npm run test:integration:ai-provider-fault-compose',
    '',
    'Starts an isolated, fixed test-only Ollama fault stub and always removes it.',
  ].join('\n');
}

function receiptSourceRevision(environment = process.env) {
  const sourceRevision = environment.CLASSIFARR_AI_PROVIDER_FAULT_RECEIPT_SOURCE_REVISION;
  return typeof sourceRevision === 'string' && sourceRevision.length > 0
    ? sourceRevision
    : null;
}

function writeReceipt({ outcome, sourceRevision, statusId }) {
  if (!sourceRevision) {
    return false;
  }
  writeAiProviderFaultComposeReceipt(createAiProviderFaultComposeReceipt({
    outcome,
    sourceRevision,
    statusId,
  }));
  return true;
}

async function main() {
  if (process.argv.slice(2).length > 0) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }

  const sourceRevision = receiptSourceRevision();
  try {
    const result = await runAiProviderFaultComposeIntegration({ cwd: resolve(process.cwd()) });
    const wroteReceipt = writeReceipt({
      outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED,
      sourceRevision,
      statusId: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
    });
    process.stdout.write(wroteReceipt
      ? 'AI provider fault Compose integration passed; bounded receipt written.\n'
      : `AI provider fault Compose integration passed (${result.projectName}).\n`);
  } catch (error) {
    const statusId = error?.statusId || AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS.INVALID_INPUT;
    try {
      writeReceipt({
        outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.FAILED,
        sourceRevision,
        statusId,
      });
    } catch (_receiptError) {
      // The fixed receipt boundary must never leak a nested failure or raw test data.
    }
    process.stderr.write(`AI provider fault Compose integration failed: ${statusId}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}

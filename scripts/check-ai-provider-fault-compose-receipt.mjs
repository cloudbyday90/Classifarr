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

import { readAiProviderFaultComposeReceipt } from './lib/aiProviderFaultComposeReceipt.mjs';

function usage() {
  return 'Usage: node scripts/check-ai-provider-fault-compose-receipt.mjs';
}

function main() {
  if (process.argv.slice(2).length > 0) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const expectedSourceRevision = process.env.CLASSIFARR_AI_PROVIDER_FAULT_RECEIPT_SOURCE_REVISION;
    const receipt = readAiProviderFaultComposeReceipt();
    if (receipt.source_revision !== expectedSourceRevision) {
      throw new Error('source revision mismatch');
    }
    process.stdout.write(`Verified AI provider fault Compose receipt: ${receipt.outcome}.\n`);
  } catch (_error) {
    process.stderr.write('AI provider fault Compose receipt verification failed.\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}

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

import * as db from '../server/src/config/database.mjs';
import {
  loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
} from '../server/src/services/policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs';
import {
  closeDatabasePool,
  shouldRunCli,
} from './lib/cliRuntime.mjs';
import {
  runPolicyCompatibilityDeletionExecutionPlanEvidenceBundleCli,
} from './lib/policyCompatibilityDeletionExecutionPlanEvidenceBundleRunner.mjs';

async function main() {
  const outcome =
    await runPolicyCompatibilityDeletionExecutionPlanEvidenceBundleCli({
      argv: process.argv.slice(2),
      db,
      loadEvidenceBundle:
        loadPolicyCompatibilityDeletionExecutionPlanEvidenceBundle,
      closeDatabasePool,
    });

  process.exitCode = outcome.exitCode;
  return outcome;
}

if (shouldRunCli(import.meta)) {
  await main();
}

export { main };

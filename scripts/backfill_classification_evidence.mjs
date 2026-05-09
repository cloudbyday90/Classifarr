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

import * as db from '../server/src/config/database.mjs';
import { classificationEvidenceKeyBuilder as keyBuilder } from '../server/src/services/classificationEvidenceKeyBuilder.mjs';
import {
  formatSummary,
  runBackfill,
} from '../server/src/services/classificationEvidenceBackfillCliService.mjs';
export {
  BACKFILL_SCOPE,
  DISCOVERED_PATTERN_SCOPES,
  formatSummary,
  runBackfill,
  transformDiscoveredPatternRow,
  transformLearningPatternRow,
} from '../server/src/services/classificationEvidenceBackfillCliService.mjs';
import { closeDatabasePool, failCli, shouldRunCli } from './lib/cliRuntime.mjs';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    console.log(`Running backfill_classification_evidence${dryRun ? ' (DRY RUN)' : ''}...`);
    const summary = await runBackfill({ db, keyBuilder, dryRun });
    console.log(formatSummary(summary, dryRun));
    if (summary.errors.length > 0) failCli();
  } catch (err) {
    console.error('Backfill failed:', err.message);
    failCli();
  } finally {
    await closeDatabasePool(db);
  }
}

if (shouldRunCli(import.meta)) {
  await main();
}

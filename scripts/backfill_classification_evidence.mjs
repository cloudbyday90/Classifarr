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
import {
  formatSummary,
  run,
} from '../server/src/services/classificationEvidenceMigrationBackfillService.mjs';
export {
  CLASSIFICATION_EVIDENCE_BACKFILL_BATCH_SIZE,
  formatSummary,
  run,
  transformDiscoveredPatternRow,
  transformExactMatchRow,
  transformGenrePatternRow,
} from '../server/src/services/classificationEvidenceMigrationBackfillService.mjs';
import { closeDatabasePool, runCliMain, shouldRunCli } from '../server/src/utils/cliRuntime.mjs';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await runCliMain({
    execute: () => run({ database: db, dryRun }),
    onSuccess: (summary) => console.log(formatSummary(summary)),
    shouldFail: (summary) => summary.errors.length > 0,
    failureMessage: 'Backfill failed',
    cleanup: () => closeDatabasePool(db),
  });
}

if (shouldRunCli(import.meta)) {
  await main();
}

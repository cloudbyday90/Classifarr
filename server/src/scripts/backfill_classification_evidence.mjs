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

/**
 * Phase 2 classification evidence backfill CLI.
 *
 * USAGE
 *   node server/src/scripts/backfill_classification_evidence.mjs
 *   node server/src/scripts/backfill_classification_evidence.mjs --dry-run
 */

import {
  formatSummary,
  run,
} from '../services/classificationEvidenceMigrationBackfillService.mjs';
import { runCliMain, shouldRunCli } from '../utils/cliRuntime.mjs';

export {
  CLASSIFICATION_EVIDENCE_BACKFILL_BATCH_SIZE,
  formatSummary,
  run,
  transformDiscoveredPatternRow,
  transformExactMatchRow,
  transformGenrePatternRow
} from '../services/classificationEvidenceMigrationBackfillService.mjs';

/* eslint-disable no-console */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await runCliMain({
    execute: () => run({ dryRun }),
    onSuccess: (summary) => console.log(formatSummary(summary)),
    shouldFail: (summary) => summary.errors.length > 0,
    failureMessage: 'Backfill failed',
  });
}

if (shouldRunCli(import.meta)) {
  await main();
}

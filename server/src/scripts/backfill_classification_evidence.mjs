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

import { run } from '../services/classificationEvidenceMigrationBackfillService.mjs';

export {
  CLASSIFICATION_EVIDENCE_BACKFILL_BATCH_SIZE,
  run,
  transformDiscoveredPatternRow,
  transformExactMatchRow,
  transformGenrePatternRow
} from '../services/classificationEvidenceMigrationBackfillService.mjs';

/* eslint-disable no-console */
async function main() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    const summary = await run({ dryRun });
    console.log('\n=== Classification Evidence Backfill ===');
    console.log(dryRun ? '[DRY RUN - no rows written]' : '[LIVE RUN]');
    console.log('\nlearning_patterns:');
    console.log(`  processed: ${summary.learning_patterns.processed}`);
    console.log(`  inserted:  ${summary.learning_patterns.inserted}`);
    console.log(`  skipped:   ${summary.learning_patterns.skipped}`);
    console.log('\ndiscovered_patterns:');
    console.log(`  processed: ${summary.discovered_patterns.processed}`);
    console.log(`  inserted:  ${summary.discovered_patterns.inserted}`);
    console.log(`  skipped:   ${summary.discovered_patterns.skipped}`);
    if (summary.errors.length > 0) {
      console.error('\nErrors:', summary.errors);
      process.exitCode = 1;
      return;
    }
    console.log('\nDone.');
  } catch (err) {
    console.error('Backfill failed:', err.message);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}

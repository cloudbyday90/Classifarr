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
 * Phase 2 classification evidence backfill verification CLI.
 *
 * USAGE
 *   node server/src/scripts/verify_classification_evidence_backfill.mjs
 *   node server/src/scripts/verify_classification_evidence_backfill.mjs --verbose
 */

import { verify } from '../services/classificationEvidenceMigrationVerificationService.mjs';

export {
  countBySource,
  countDiscoveredPatternsSource,
  countLearningPatternsSource,
  findExactMatchWithoutTmdbId,
  findMalformedKeys,
  verify
} from '../services/classificationEvidenceMigrationVerificationService.mjs';

/* eslint-disable no-console */
async function main() {
  try {
    const report = await verify();
    console.log('\n=== Classification Evidence Backfill Verification ===\n');
    for (const check of report.checks) {
      const icon = check.passed ? 'PASS' : 'FAIL';
      console.log(`  [${icon}] ${check.name}`);
      if (!check.passed || process.argv.includes('--verbose')) {
        console.log(`      ${check.detail}`);
      }
    }
    console.log('');
    if (report.passed) {
      console.log('All checks passed.');
      return;
    }

    const failures = report.checks.filter((check) => !check.passed).length;
    console.error(`${failures} check(s) failed.`);
    process.exitCode = 1;
  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}

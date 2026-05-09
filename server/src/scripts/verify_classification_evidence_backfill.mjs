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

import {
  formatReport,
  verify,
} from '../services/classificationEvidenceMigrationVerificationService.mjs';
import { runCliMain, shouldRunCli } from '../utils/cliRuntime.mjs';

export {
  countBySource,
  countDiscoveredPatternsSource,
  countLearningPatternsSource,
  formatReport,
  findExactMatchWithoutTmdbId,
  findMalformedKeys,
  verify
} from '../services/classificationEvidenceMigrationVerificationService.mjs';

/* eslint-disable no-console */
async function main() {
  const verbose = process.argv.includes('--verbose');
  await runCliMain({
    execute: () => verify(),
    onSuccess: (report) => console.log(formatReport(report, { verbose })),
    shouldFail: (report) => !report.passed,
    failureMessage: 'Verification failed',
  });
}

if (shouldRunCli(import.meta)) {
  await main();
}

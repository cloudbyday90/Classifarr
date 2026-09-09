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

import * as db from '../config/database.mjs';
import { buildDatabaseHealthSummary } from './databaseHealthSummary.mjs';
import { loadDatabaseHealthSummary } from './databaseHealthSummaryRepository.mjs';
import {
  databaseHealthTransitionReceiptRepository,
} from './databaseHealthTransitionReceiptRepository.mjs';
import {
  projectDatabaseHealthTransitionReceipt,
} from './databaseHealthTransitionReceipt.mjs';
import {
  createDatabaseHealthTransitionObservationService,
} from './databaseHealthTransitionObservationService.mjs';

/**
 * Defers construction until an ordinary observation actually runs. That keeps
 * scheduler registration independent of an eager database connection while the
 * observer itself still requires the strict transaction boundary.
 */
export function observeDatabaseHealthTransition() {
  return createDatabaseHealthTransitionObservationService({
    database: db,
    loadSummary: loadDatabaseHealthSummary,
    buildSummary: buildDatabaseHealthSummary,
    transitionRepository: databaseHealthTransitionReceiptRepository,
    projectReceipt: projectDatabaseHealthTransitionReceipt,
  }).observe();
}

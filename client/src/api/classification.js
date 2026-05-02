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

import classificationOperationsApi, {
  classify,
  getClassificationProfile,
  getClassificationProgress,
  getHistory,
  getLiveFeed,
  getPendingClassifications,
  getSecondPassEvaluation,
  getStats,
  resolvePendingClassification,
  retryClassifications,
  submitCorrection,
} from './classificationOperations'
import reclassificationBatchesApi, {
  cancelReclassificationBatch,
  createReclassificationBatch,
  executeReclassificationBatch,
  getReclassificationBatchStatus,
  pauseReclassificationBatch,
  resumeReclassificationBatch,
  retryReclassificationItem,
  skipReclassificationItem,
  validateReclassificationBatch,
} from './reclassificationBatches'

const classificationApi = {
  ...classificationOperationsApi,
  ...reclassificationBatchesApi,
}

export {
  classify,
  getHistory,
  submitCorrection,
  getStats,
  getClassificationProfile,
  getClassificationProgress,
  getSecondPassEvaluation,
  getLiveFeed,
  getPendingClassifications,
  resolvePendingClassification,
  retryClassifications,
  createReclassificationBatch,
  validateReclassificationBatch,
  executeReclassificationBatch,
  pauseReclassificationBatch,
  resumeReclassificationBatch,
  cancelReclassificationBatch,
  getReclassificationBatchStatus,
  skipReclassificationItem,
  retryReclassificationItem,
}

export default classificationApi

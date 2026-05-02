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

import ragAdvancedApi, {
  clearRagEmbeddings,
  exportRagConfig,
  exportRagLogs,
  exportRagMetrics,
  getRagAdvancedConfig,
  resetRagCircuitBreaker,
  resetRagConfig,
  updateRagAdvancedConfig,
  warmupRagModel,
} from './ragAdvancedApi'
import ragBackfillApi, {
  clearManualBackfill,
  getBackfillConfig,
  getBackfillStatus,
  pauseManualBackfill,
  resumeManualBackfill,
  startManualBackfill,
  updateBackfillConfig,
} from './ragBackfillApi'
import ragImageEmbeddingApi, {
  getImageModelMetadata,
  getRagGraphFillRate,
  reembedImages,
  testImageEmbeddingConnection,
} from './ragImageEmbeddingApi'
import ragStatusApi, {
  getLatestRagFallbackIncident,
  getRagDetailed,
  getRagPromotionReadiness,
  getRagStatus,
} from './ragStatusApi'
import ragTextEmbeddingApi, {
  getRagTextModels,
  testRagConnection,
} from './ragTextEmbeddingApi'

const ragApi = {
  ...ragStatusApi,
  ...ragTextEmbeddingApi,
  ...ragBackfillApi,
  ...ragAdvancedApi,
  ...ragImageEmbeddingApi,
}

export {
  getRagStatus,
  getRagDetailed,
  getRagTextModels,
  getBackfillStatus,
  getBackfillConfig,
  updateBackfillConfig,
  startManualBackfill,
  pauseManualBackfill,
  resumeManualBackfill,
  clearManualBackfill,
  testRagConnection,
  resetRagCircuitBreaker,
  warmupRagModel,
  exportRagConfig,
  exportRagLogs,
  exportRagMetrics,
  getLatestRagFallbackIncident,
  getRagPromotionReadiness,
  getRagAdvancedConfig,
  updateRagAdvancedConfig,
  clearRagEmbeddings,
  resetRagConfig,
  testImageEmbeddingConnection,
  getImageModelMetadata,
  getRagGraphFillRate,
  reembedImages,
}

export default ragApi

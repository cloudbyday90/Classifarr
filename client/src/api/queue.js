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

import queueConfigApi, {
  getQueueSettings,
  getQueueStats,
  updateQueueSettings,
} from './queueConfigApi'
import queueOperationsApi, {
  cancelAllPendingTasks,
  clearAndResync,
  clearCompletedTasks,
  clearFailedTasks,
  getAiGenerationStatus,
  getLiveStats,
  processEnrichmentRetries,
  reprocessCompleted,
  retryAllFailedTasks,
} from './queueOperationsApi'
import queueTasksApi, {
  cancelQueueTask,
  dismissQueueTask,
  getQueueFailed,
  getQueuePending,
  retryQueueTask,
} from './queueTasksApi'

const queueApi = {
  ...queueConfigApi,
  ...queueTasksApi,
  ...queueOperationsApi,
}

export {
  getQueueStats,
  getQueueSettings,
  updateQueueSettings,
  getQueuePending,
  getQueueFailed,
  retryQueueTask,
  dismissQueueTask,
  cancelQueueTask,
  clearCompletedTasks,
  clearFailedTasks,
  retryAllFailedTasks,
  cancelAllPendingTasks,
  reprocessCompleted,
  clearAndResync,
  getLiveStats,
  getAiGenerationStatus,
  processEnrichmentRetries,
}

export default queueApi

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="command-center">
    <main
      id="main-content"
      tabindex="-1"
    >
      <div class="status-bar">
        <div class="status-bar-left">
          <h1 class="status-bar-title">
            COMMAND CENTER
          </h1>
          <div class="status-bar-live">
            <Badge
              :variant="isAnyDataStale ? 'warning' : 'success'"
              size="sm"
            >
              {{ isAnyDataStale ? 'Updating' : 'Live' }}
            </Badge>
            <span class="status-bar-time">{{ lastUpdatedText }}</span>
          </div>
        </div>
        <div class="status-bar-right">
          <div
            class="status-indicator"
            :class="aiOnline ? 'status-online' : 'status-offline'"
          >
            <span class="status-dot" />
            <span>AI {{ aiOnline ? 'Online' : 'Offline' }}</span>
          </div>
          <div
            class="status-indicator"
            :class="workerStatusClass"
          >
            <span class="status-dot" />
            <span>Worker {{ workerStatusLabel }}</span>
          </div>
          <div class="status-stat">
            <span class="status-stat-value">{{ queuePendingCount }}</span>
            <span class="status-stat-label">Queue</span>
          </div>
          <div
            class="status-stat"
            :class="{ 'status-stat-alert': needsAttentionItems.length > 0 }"
          >
            <span class="status-stat-value">{{ needsAttentionItems.length }}</span>
            <span class="status-stat-label">Action</span>
          </div>
        </div>
      </div>

      <p
        class="sr-only"
        aria-live="polite"
      >
        {{ statusAnnounceText }}
      </p>

      <p
        v-if="actionError"
        role="alert"
        aria-live="assertive"
        class="action-error"
      >
        {{ actionError }}
      </p>

      <div
        v-if="legacyRouteNotice"
        class="legacy-notice"
      >
        <p class="legacy-notice-message">
          {{ legacyRouteNotice.message }}
        </p>
        <div class="legacy-notice-actions">
          <button
            v-for="action in legacyRouteNotice.actions"
            :key="`legacy-route-action-${action.label}`"
            type="button"
            class="legacy-notice-btn"
            @click="router.push(action.to)"
          >
            {{ action.label }}
          </button>
          <button
            type="button"
            class="legacy-notice-btn legacy-notice-btn-dismiss"
            @click="dismissLegacyRouteNotice"
          >
            Dismiss
          </button>
        </div>
      </div>

      <section
        id="alerts"
        aria-label="Alerts"
      >
        <div
          v-if="alerts.length"
          class="alerts-banner"
        >
          <div
            v-for="alert in alerts"
            :key="alert.id"
            class="alert-item"
          >
            <span class="alert-icon">!</span>
            <span class="alert-message">{{ alert.message }}</span>
            <Button
              variant="warning"
              size="sm"
              @click="alert.action()"
            >
              {{ alert.actionLabel }}
            </Button>
          </div>
        </div>
      </section>

      <div class="command-center-main">
        <div class="primary-panels">
          <ProcessingPanel
            :ai-generation-telemetry-line="aiGenerationTelemetryLine"
            :ai-online="aiOnline"
            :completed-stage-count="completedStageCount"
            :format-duration-ms="formatDurationMs"
            :format-media-type="formatMediaType"
            :format-number="formatNumber"
            :gap-percent-complete="gapPercentComplete"
            :gap-processed-count="gapProcessedCount"
            :gap-total-count="gapTotalCount"
            :is-action-busy="isActionBusy"
            :is-mobile-viewport="isMobileViewport"
            :library-sync-current-library="librarySyncCurrentLibrary"
            :library-sync-is-running="librarySyncIsRunning"
            :library-sync-percent-complete="librarySyncPercentComplete"
            :library-sync-processed-count="librarySyncProcessedCount"
            :library-sync-remaining-count="librarySyncRemainingCount"
            :library-sync-total-count="librarySyncTotalCount"
            :next-stage-label="nextStageLabel"
            :stage-label="stageLabel"
            :stage-rows="stageRows"
            :primary-active-task="primaryActiveTask"
            :queue-pending-count="queuePendingCount"
            :safe-percent="safePercent"
            :task-media-type="taskMediaType"
            :task-title="taskTitle"
            :up-next-count="upNextCount"
            :up-next-tasks="upNextTasks"
            @cancel-all-pending="cancelAllPendingTasks"
            @cancel-pending-task="cancelPendingTask"
            @open-media-server-settings="router.push({ path: '/settings', query: { tab: 'ai' } })"
            @open-processing-details="openProcessingDetails"
          />

          <section
            id="needs-attention"
            class="panel panel-action"
          >
            <div class="panel-header">
              <h2 class="panel-title">
                Needs Attention
              </h2>
              <span
                v-if="needsAttentionItems.length"
                class="panel-badge"
              >{{ needsAttentionItems.length }}</span>
            </div>
            <div class="panel-content">
              <NeedsAttentionPanel
                :items="needsAttentionItems"
                :change-mode="changeMode"
                :manual-library-by-item-id="manualLibraryByItemId"
                :format-media-type="formatMediaType"
                :safe-percent="safePercent"
                :libraries-for-media-type="librariesForMediaType"
                :is-action-busy="isActionBusy"
                @toggle-change-mode="toggleChangeMode"
                @retry-item="retryNeedsAttentionItem"
                @resolve-option="({ item, answerSelection }) => resolveWithOption(item, answerSelection)"
                @update-manual-library="updateManualLibrarySelection"
                @confirm-all="confirmAllNeedsAttention"
                @retry-all="retryAllNeedsAttention"
              />
            </div>
          </section>
        </div>

        <ProcessingDetailsSheet
          :open="showProcessingBottomSheet"
          :task="processingDetailTask"
          :stage-label="stageLabel"
          :stage-rows="stageRows"
          @close="closeProcessingDetails"
        />

        <CommandCenterOverviewSections
          :active-libraries-summary="activeLibrariesSummary"
          :configure-media-server-message="configureMediaServerMessage"
          :enrichment-completed-items="enrichmentCompletedItems"
          :enrichment-not-needed-items="enrichmentNotNeededItems"
          :enrichment-deferred-items="enrichmentDeferredItems"
          :enrichment-enriched="enrichmentEnriched"
          :enrichment-failed-items="enrichmentFailedItems"
          :enrichment-omdb="enrichmentOmdb"
          :enrichment-omdb-pending="enrichmentOmdbPending"
          :enrichment-pending-items="enrichmentPendingItems"
          :enrichment-processing-items="enrichmentProcessingItems"
          :enrichment-progress="enrichmentProgress"
          :enrichment-web-search="enrichmentWebSearch"
          :enrichment-web-search-deferred="enrichmentWebSearchDeferred"
          :enrichment-web-search-pending="enrichmentWebSearchPending"
          :enrichment-total="enrichmentTotal"
          :expanded-sections="expandedSections"
          :failed-queue-tasks="failedQueueTasks"
          :format-number="formatNumber"
          :format-percent-or-dash="formatPercentOrDash"
          :format-relative-time="formatRelativeTime"
          :is-action-busy="isActionBusy"
          :recently-completed-items="recentlyCompletedItems"
          :safe-percent="safePercent"
          :show-configure-media-server-cta="showConfigureMediaServerCta"
          :show-enrichment-section="showEnrichmentSection"
          :task-title="taskTitle"
          :today-avg-confidence="todayAvgConfidence"
          :today-classified-count="todayClassifiedCount"
          :today-manual-count="todayManualCount"
          :truncate-error="truncateError"
          @dismiss-failed-task="dismissFailedTask"
          @open-media-server-settings="openMediaServerSettings"
          @process-enrichment-retries="processEnrichmentRetries"
          @retry-all-failed="retryAllFailed"
          @retry-failed-task="retryFailedTask"
          @toggle-section="toggleSection"
        />

        <QuickAddPanel
          :expanded="expandedSections.quickadd"
          :query="quickAddQuery"
          :results="quickAddResults"
          :searching="quickAddSearching"
          :selected="quickAddSelected"
          :submitting="quickAddSubmitting"
          :error-message="quickAddError"
          :success-message="quickAddSuccess"
          :format-media-type="formatMediaType"
          @toggle="toggleSection('quickadd')"
          @update:query="updateQuickAddQuery"
          @search="searchQuickAdd"
          @submit="submitQuickAdd"
          @select-result="selectQuickAddResult"
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button } from '@/components/common'
import CommandCenterOverviewSections from '@/components/command-center/CommandCenterOverviewSections.vue'
import NeedsAttentionPanel from '@/components/command-center/NeedsAttentionPanel.vue'
import ProcessingPanel from '@/components/command-center/ProcessingPanel.vue'
import ProcessingDetailsSheet from '@/components/command-center/ProcessingDetailsSheet.vue'
import QuickAddPanel from '@/components/command-center/QuickAddPanel.vue'
import { useCommandCenterData } from '@/composables/useCommandCenterData'
import { useCommandCenterOperations } from '@/composables/useCommandCenterOperations'
import { useNeedsAttentionActions } from '@/composables/useNeedsAttentionActions'
import { useProcessingDetails } from '@/composables/useProcessingDetails'
import { useQuickAdd } from '@/composables/useQuickAdd'
import { useCommandCenterShell } from '@/composables/useCommandCenterShell'

const router = useRouter()
const route = useRoute()

const {
  dismissLegacyRouteNotice,
  expandedSections,
  isMobileViewport,
  legacyRouteNotice,
  toggleSection,
} = useCommandCenterShell({ route, router })

const {
  activeLibraries,
  activeLibrariesSummary,
  activeProcessingTasks,
  aiOnline,
  alerts,
  configureMediaServerMessage,
  enrichmentCompletedItems,
  enrichmentNotNeededItems,
  enrichmentDeferredItems,
  enrichmentEnriched,
  enrichmentFailedItems,
  enrichmentOmdb,
  enrichmentOmdbPending,
  enrichmentPendingItems,
  enrichmentProcessingItems,
  enrichmentProgress,
  enrichmentWebSearch,
  enrichmentWebSearchDeferred,
  enrichmentWebSearchPending,
  enrichmentTotal,
  failedQueueTasks,
  gapPercentComplete,
  gapProcessedCount,
  gapTotalCount,
  librarySyncCurrentLibrary,
  librarySyncIsRunning,
  librarySyncPercentComplete,
  librarySyncProcessedCount,
  librarySyncRemainingCount,
  librarySyncTotalCount,
  isAnyDataStale,
  lastUpdatedText,
  needsAttentionItems,
  aiGenerationTelemetryLine,
  pendingQueueTasks,
  primaryActiveTask,
  queuePendingCount,
  refreshOperationalData,
  recentlyCompletedItems,
  showConfigureMediaServerCta,
  showEnrichmentSection,
  statusAnnounceText,
  todayAvgConfidence,
  todayClassifiedCount,
  todayManualCount,
  upNextCount,
  upNextTasks,
  workerStatusClass,
  workerStatusLabel,
} = useCommandCenterData({ router })

const {
  actionError,
  cancelAllPendingTasks,
  cancelPendingTask,
  dismissFailedTask,
  formatDurationMs,
  formatMediaType,
  formatNumber,
  formatPercentOrDash,
  formatRelativeTime,
  isActionBusy,
  openMediaServerSettings,
  processEnrichmentRetries,
  retryAllFailed,
  retryFailedTask,
  runActionWithBusy,
  safePercent,
  taskMediaType,
  taskTitle,
  truncateError,
} = useCommandCenterOperations({
  pendingQueueTasks,
  refreshOperationalData,
  router,
})

const {
  closeProcessingDetails,
  completedStageCount,
  nextStageLabel,
  openProcessingDetails,
  stageLabel,
  stageRows,
  processingDetailTask,
  showProcessingBottomSheet,
} = useProcessingDetails({
  activeProcessingTasks,
  isMobileViewport,
})

const {
  quickAddError,
  quickAddQuery,
  quickAddResults,
  quickAddSearching,
  quickAddSelected,
  quickAddSubmitting,
  quickAddSuccess,
  searchQuickAdd,
  selectQuickAddResult,
  submitQuickAdd,
  updateQuickAddQuery,
} = useQuickAdd({ refreshData: refreshOperationalData })

const {
  changeMode,
  confirmAllNeedsAttention,
  librariesForMediaType,
  manualLibraryByItemId,
  resolveWithOption,
  retryAllNeedsAttention,
  retryNeedsAttentionItem,
  toggleChangeMode,
  updateManualLibrarySelection,
} = useNeedsAttentionActions({
  activeLibraries,
  needsAttentionItems,
  runActionWithBusy,
  setActionError: (message) => {
    actionError.value = message
  },
})
</script>

<style scoped>
.command-center {
  min-height: 100vh;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.status-bar {
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(to bottom, #111827, #111827ee);
  border-bottom: 1px solid #374151;
  backdrop-filter: blur(8px);
}

.status-bar-title {
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #e5e7eb;
}

.status-bar-live {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.status-bar-time {
  font-size: 0.75rem;
  color: #6b7280;
}

.status-bar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6b7280;
}

.status-online .status-dot {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.status-offline .status-dot {
  background: #ef4444;
}

.status-warning .status-dot {
  background: #f59e0b;
  box-shadow: 0 0 6px #f59e0b;
}

.status-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  background: #1f2937;
}

.status-stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: #f3f4f6;
  line-height: 1;
}

.status-stat-label {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.status-stat-alert .status-stat-value {
  color: #fbbf24;
}

.action-error {
  margin: 1rem 1.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #991b1b;
  background: rgba(127, 29, 29, 0.2);
  color: #fca5a5;
  font-size: 0.875rem;
}

.legacy-notice {
  margin: 0 1.5rem 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #1e40af;
  background: rgba(30, 64, 175, 0.15);
}

.legacy-notice-message {
  font-size: 0.875rem;
  color: #bfdbfe;
}

.legacy-notice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.legacy-notice-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #1e40af;
  background: rgba(30, 64, 175, 0.2);
  color: #bfdbfe;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.legacy-notice-btn:hover {
  background: rgba(30, 64, 175, 0.3);
}

.legacy-notice-btn-dismiss {
  border-color: #4b5563;
  background: #1f2937;
  color: #e5e7eb;
}

.legacy-notice-btn-dismiss:hover {
  background: #374151;
}

.alerts-banner {
  margin: 0 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alert-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #92400e;
  background: rgba(146, 64, 14, 0.1);
}

.alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f59e0b;
  color: #000;
  font-size: 0.75rem;
  font-weight: 700;
}

.alert-message {
  flex: 1;
  font-size: 0.875rem;
  color: #fcd34d;
}

.command-center-main {
  padding: 1rem 1.5rem 2rem;
}

.primary-panels {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 1024px) {
  .primary-panels {
    grid-template-columns: 1fr 1fr;
  }
}

.panel {
  border-radius: 0.75rem;
  border: 1px solid #374151;
  background: #1f2937;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid #374151;
  background: #111827;
}

.panel-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #9ca3af;
}

.panel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.5rem;
  border-radius: 9999px;
  background: #f59e0b;
  color: #000;
  font-size: 0.75rem;
  font-weight: 700;
}

.panel-content {
  padding: 1.25rem;
}

@media (max-width: 1023px) {
  .status-bar {
    padding: 0.75rem 1rem;
  }

  .status-bar-right {
    width: 100%;
    justify-content: flex-start;
  }

  .command-center-main {
    padding: 1rem;
  }

  .panel-content {
    padding: 1rem;
  }
}
</style>

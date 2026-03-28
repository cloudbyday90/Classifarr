<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="command-center">
    <main id="main-content" tabindex="-1">
      <div class="status-bar">
        <div class="status-bar-left">
          <h1 class="status-bar-title">COMMAND CENTER</h1>
          <div class="status-bar-live">
            <Badge :variant="isAnyDataStale ? 'warning' : 'success'" size="sm">
              {{ isAnyDataStale ? 'Updating' : 'Live' }}
            </Badge>
            <span class="status-bar-time">{{ lastUpdatedText }}</span>
          </div>
        </div>
        <div class="status-bar-right">
          <div class="status-indicator" :class="aiOnline ? 'status-online' : 'status-offline'">
            <span class="status-dot"></span>
            <span>AI {{ aiOnline ? 'Online' : 'Offline' }}</span>
          </div>
          <div class="status-indicator" :class="workerStatusClass">
            <span class="status-dot"></span>
            <span>Worker {{ workerStatusLabel }}</span>
          </div>
          <div class="status-stat">
            <span class="status-stat-value">{{ queuePendingCount }}</span>
            <span class="status-stat-label">Queue</span>
          </div>
          <div class="status-stat" :class="{ 'status-stat-alert': needsAttentionItems.length > 0 }">
            <span class="status-stat-value">{{ needsAttentionItems.length }}</span>
            <span class="status-stat-label">Action</span>
          </div>
        </div>
      </div>

      <p class="sr-only" aria-live="polite">{{ statusAnnounceText }}</p>

      <p v-if="actionError" role="alert" aria-live="assertive" class="action-error">
        {{ actionError }}
      </p>

      <div v-if="legacyRouteNotice" class="legacy-notice">
        <p class="legacy-notice-message">{{ legacyRouteNotice.message }}</p>
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
          <button type="button" class="legacy-notice-btn legacy-notice-btn-dismiss" @click="dismissLegacyRouteNotice">
            Dismiss
          </button>
        </div>
      </div>

      <section id="alerts" aria-label="Alerts">
        <div v-if="alerts.length" class="alerts-banner">
          <div v-for="alert in alerts" :key="alert.id" class="alert-item">
            <span class="alert-icon">!</span>
            <span class="alert-message">{{ alert.message }}</span>
            <Button variant="warning" size="sm" @click="alert.action()">{{ alert.actionLabel }}</Button>
          </div>
        </div>
      </section>

      <div class="command-center-main">
        <div class="primary-panels">
          <section id="processing" class="panel panel-processing">
            <div class="panel-header">
              <h2 class="panel-title">Processing</h2>
            </div>
            <div class="panel-content">
              <div v-if="primaryActiveTask" class="processing-active">
                <div class="processing-title-row">
                  <h3 class="processing-title">
                    {{ primaryActiveTask.title }}
                    <span v-if="primaryActiveTask.year" class="processing-year">({{ primaryActiveTask.year }})</span>
                  </h3>
                  <span class="processing-percent">{{ safePercent(primaryActiveTask.progress) }}%</span>
                </div>

                <div class="processing-progress">
                  <div class="processing-progress-bar" :style="{ width: `${safePercent(primaryActiveTask.progress)}%` }"></div>
                </div>

                <div class="processing-phase-info">
                  <span class="processing-phase-current">
                    {{ phaseLabel(primaryActiveTask.currentPhase) }}
                  </span>
                  <span class="processing-phase-step">
                    Step {{ primaryActiveTask.phaseIndex || 1 }} of {{ primaryActiveTask.totalPhases || 8 }}
                  </span>
                  <span class="processing-phase-duration">
                    {{ formatDurationMs(primaryActiveTask.phaseDuration) }}
                  </span>
                </div>

                <div class="processing-stepper">
                  <div
                    v-for="(row, index) in phaseRows(primaryActiveTask)"
                    :key="row.name"
                    class="stepper-item"
                    :class="{
                      'stepper-complete': row.status === 'complete',
                      'stepper-active': row.status === 'in_progress',
                      'stepper-pending': row.status === 'pending',
                      'stepper-skipped': row.status === 'skipped'
                    }"
                  >
                    <div class="stepper-marker">
                      <svg v-if="row.status === 'complete'" class="stepper-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                      </svg>
                      <span v-else-if="row.status === 'in_progress'" class="stepper-pulse"></span>
                      <span v-else-if="row.status === 'skipped'" class="stepper-skip-marker">-</span>
                      <span v-else class="stepper-circle"></span>
                    </div>
                    <div
                      v-if="index < phaseRows(primaryActiveTask).length - 1"
                      class="stepper-connector"
                      :class="{
                        'stepper-connector-active': row.status === 'complete',
                        'stepper-connector-skipped': row.status === 'skipped'
                      }"
                    ></div>
                    <div class="stepper-content">
                      <span class="stepper-label">{{ row.label }}</span>
                      <span v-if="row.timing" class="stepper-timing">{{ row.timing }}</span>
                    </div>
                  </div>
                </div>

                <div class="processing-meta">
                  <span>{{ completedPhaseCount(primaryActiveTask) }} phases complete</span>
                  <span>Next: {{ nextPhaseLabel(primaryActiveTask) }}</span>
                </div>

                <div v-if="isMobileViewport" class="processing-mobile-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-haspopup="dialog"
                    @click="openProcessingDetails(primaryActiveTask.taskId || primaryActiveTask.id, $event)"
                  >
                    View Details
                  </Button>
                </div>

                <p v-if="aiGenerationTelemetryLine" class="processing-telemetry">{{ aiGenerationTelemetryLine }}</p>

                <div class="processing-queue-stats">
                  <span>Queue: {{ queuePendingCount }} pending</span>
                  <span>Library: {{ formatNumber(gapProcessedCount) }} / {{ formatNumber(gapTotalCount) }} ({{ gapPercentComplete }}%)</span>
                </div>
              </div>

              <div v-else class="processing-idle">
                <div v-if="!aiOnline && queuePendingCount > 0" class="idle-waiting-ai">
                  <div class="idle-icon idle-icon-warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <p class="idle-title">Waiting for AI</p>
                  <p class="idle-subtitle">{{ queuePendingCount }} task{{ queuePendingCount === 1 ? '' : 's' }} queued but AI provider is offline</p>
                  <Button variant="ghost" size="sm" @click="router.push({ path: '/settings', query: { tab: 'ai' } })">
                    Check AI Settings
                  </Button>
                </div>
                <div v-else>
                  <div class="idle-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p class="idle-title">No active processing</p>
                  <p class="idle-subtitle">Library: {{ formatNumber(gapProcessedCount) }} / {{ formatNumber(gapTotalCount) }} ({{ gapPercentComplete }}%)</p>
                </div>
              </div>

              <div v-if="upNextTasks.length" class="up-next">
                <div class="up-next-header">
                  <span class="up-next-title">Up Next ({{ upNextCount }})</span>
                  <Button
                    v-if="upNextCount > 0"
                    variant="ghost"
                    size="sm"
                    :disabled="isActionBusy('cancel-all')"
                    :loading="isActionBusy('cancel-all')"
                    @click="cancelAllPendingTasks"
                  >
                    Cancel All
                  </Button>
                </div>
                <div class="up-next-list">
                  <div v-for="task in upNextTasks" :key="`up-next-${task.id}`" class="up-next-item">
                    <div class="up-next-info">
                      <span class="up-next-name">{{ taskTitle(task) }}</span>
                      <span class="up-next-type">{{ formatMediaType(taskMediaType(task)) }}</span>
                    </div>
                    <Button variant="ghost" size="sm" class="up-next-cancel" @click="cancelPendingTask(task.id)">
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="needs-attention" class="panel panel-action">
            <div class="panel-header">
              <h2 class="panel-title">Needs Attention</h2>
              <span v-if="needsAttentionItems.length" class="panel-badge">{{ needsAttentionItems.length }}</span>
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
                @resolve-option="({ item, option, selectedOptionLabel }) => resolveWithOption(item, option, selectedOptionLabel)"
                @update-manual-library="updateManualLibrarySelection"
                @resolve-manual="resolveManualChange"
                @confirm-all="confirmAllNeedsAttention"
                @retry-all="retryAllNeedsAttention"
              />
            </div>
          </section>
        </div>

        <ProcessingDetailsSheet
          :open="showProcessingBottomSheet"
          :task="processingDetailTask"
          :phase-label="phaseLabel"
          :phase-rows="phaseRows"
          @close="closeProcessingDetails"
        />

        <section id="errors" class="secondary-section" :class="{ 'has-errors': failedQueueTasks.length > 0 }">
          <div class="secondary-section-header" @click="toggleSection('errors')">
            <h2 class="secondary-section-title">
              Errors
              <span v-if="failedQueueTasks.length" class="secondary-section-count">({{ failedQueueTasks.length }})</span>
            </h2>
            <div class="secondary-section-actions">
              <Button
                v-if="failedQueueTasks.length"
                variant="warning"
                size="sm"
                :disabled="isActionBusy('retry-all-failed')"
                :loading="isActionBusy('retry-all-failed')"
                @click.stop="retryAllFailed"
              >
                Retry All
              </Button>
              <span class="secondary-section-toggle">{{ expandedSections.errors ? '−' : '+' }}</span>
            </div>
          </div>
          <div v-if="expandedSections.errors" class="secondary-section-content">
            <div v-if="failedQueueTasks.length" class="errors-list">
              <article v-for="task in failedQueueTasks" :key="task.id" class="error-item">
                <div class="error-info">
                  <p class="error-title">{{ taskTitle(task) }}</p>
                  <p class="error-meta">{{ task.task_type }} • {{ formatRelativeTime(task.completed_at || task.created_at) }}</p>
                  <p class="error-message">{{ truncateError(task.error_message) }}</p>
                </div>
                <div class="error-actions">
                  <Button variant="warning" size="sm" @click="retryFailedTask(task.id)">Retry</Button>
                  <Button variant="ghost" size="sm" @click="dismissFailedTask(task.id)">Dismiss</Button>
                </div>
              </article>
            </div>
            <div v-else class="secondary-idle">
              <span class="secondary-idle-check">✓</span>
              <span>No errors</span>
            </div>
          </div>
        </section>

        <section id="enrichment" v-if="showEnrichmentSection" class="secondary-section">
          <div class="secondary-section-header" @click="toggleSection('enrichment')">
            <h2 class="secondary-section-title">
              Enrichment
              <span class="secondary-section-count">({{ enrichmentProgress }}%)</span>
            </h2>
            <div class="secondary-section-actions">
              <Button
                v-if="enrichmentOmdbPending > 0"
                variant="secondary"
                size="sm"
                :disabled="isActionBusy('process-enrichment-retries-omdb')"
                :loading="isActionBusy('process-enrichment-retries-omdb')"
                @click.stop="processEnrichmentRetries('omdb')"
              >
                Retry OMDb ({{ enrichmentOmdbPending }})
              </Button>
              <Button
                v-if="enrichmentTavilyPending > 0"
                variant="warning"
                size="sm"
                :disabled="isActionBusy('process-enrichment-retries-tavily')"
                :loading="isActionBusy('process-enrichment-retries-tavily')"
                @click.stop="processEnrichmentRetries('tavily')"
              >
                Retry Tavily ({{ enrichmentTavilyPending }})
              </Button>
              <span class="secondary-section-toggle">{{ expandedSections.enrichment ? '−' : '+' }}</span>
            </div>
          </div>
          <div v-if="expandedSections.enrichment" class="secondary-section-content">
            <div class="enrichment-progress">
              <div class="enrichment-bar">
                <div class="enrichment-bar-fill" :style="{ width: `${enrichmentProgress}%` }"></div>
              </div>
              <p class="enrichment-stats">
                {{ formatNumber(enrichmentEnriched) }} / {{ formatNumber(enrichmentTotal) }} enriched
                • OMDb: {{ formatNumber(enrichmentOmdb) }}<span v-if="enrichmentOmdbPending > 0" class="enrichment-pending"> (+{{ formatNumber(enrichmentOmdbPending) }} pending)</span>
                • Tavily: {{ formatNumber(enrichmentTavily) }}<span v-if="enrichmentTavilyPending > 0" class="enrichment-pending"> (+{{ formatNumber(enrichmentTavilyPending) }} pending)</span>
              </p>
            </div>
          </div>
        </section>

        <section id="recently-completed" class="secondary-section">
          <div class="secondary-section-header" @click="toggleSection('recent')">
            <h2 class="secondary-section-title">Recently Completed</h2>
            <div class="secondary-section-actions">
              <router-link :to="{ path: '/history', query: { source: 'command-center' } }" class="secondary-section-link" @click.stop>
                View History →
              </router-link>
              <span class="secondary-section-toggle">{{ expandedSections.recent ? '−' : '+' }}</span>
            </div>
          </div>
          <div v-if="expandedSections.recent" class="secondary-section-content">
            <div v-if="recentlyCompletedItems.length" class="recent-list">
              <div v-for="item in recentlyCompletedItems" :key="`recent-${item.id}`" class="recent-item">
                <span class="recent-info">
                  {{ item.title }} → {{ item.library || 'Unassigned' }} ({{ safePercent(item.confidence) }}%)
                </span>
                <span class="recent-time">{{ formatRelativeTime(item.timestamp) }}</span>
              </div>
            </div>
            <p v-else class="secondary-empty">No recent classifications yet.</p>
          </div>
        </section>

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

        <section id="libraries" class="secondary-section">
          <div class="secondary-section-header" @click="toggleSection('libraries')">
            <h2 class="secondary-section-title">Libraries</h2>
            <div class="secondary-section-actions">
              <router-link to="/libraries" class="secondary-section-link" @click.stop>
                Manage →
              </router-link>
              <span class="secondary-section-toggle">{{ expandedSections.libraries ? '−' : '+' }}</span>
            </div>
          </div>
          <div v-if="expandedSections.libraries" class="secondary-section-content">
            <div v-if="showConfigureMediaServerCta" class="libraries-cta">
              <p>{{ configureMediaServerMessage }}</p>
              <Button variant="warning" size="sm" @click="openMediaServerSettings">Configure Media Server</Button>
            </div>
            <div v-if="activeLibrariesSummary.length" class="libraries-list">
              <div v-for="library in activeLibrariesSummary" :key="`library-summary-${library.id}`" class="library-item">
                <span class="library-name">{{ library.name }}</span>
                <span class="library-stats">
                  {{ formatNumber(library.itemCount) }} items • +{{ formatNumber(library.todayCount) }} today • {{ formatPercentOrDash(library.autoPercent) }} auto
                </span>
              </div>
            </div>
            <p v-else-if="!showConfigureMediaServerCta" class="secondary-empty">No active libraries found.</p>
          </div>
        </section>

        <section id="today" class="secondary-section secondary-section-last">
          <div class="secondary-section-header" @click="toggleSection('today')">
            <h2 class="secondary-section-title">Today's Summary</h2>
            <span class="secondary-section-toggle">{{ expandedSections.today ? '−' : '+' }}</span>
          </div>
          <div v-if="expandedSections.today" class="secondary-section-content">
            <p class="today-stats">
              {{ formatNumber(todayClassifiedCount) }} classified
              • {{ safePercent(todayAvgConfidence) }}% avg confidence
              • {{ formatNumber(todayManualCount) }} manual
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import { Badge, Button } from '@/components/common'
import NeedsAttentionPanel from '@/components/command-center/NeedsAttentionPanel.vue'
import ProcessingDetailsSheet from '@/components/command-center/ProcessingDetailsSheet.vue'
import QuickAddPanel from '@/components/command-center/QuickAddPanel.vue'
import { useCommandCenterData } from '@/composables/useCommandCenterData'
import { useNeedsAttentionActions } from '@/composables/useNeedsAttentionActions'
import { useQuickAdd } from '@/composables/useQuickAdd'

const router = useRouter()
const route = useRoute()

const phaseLabels = {
  queued: 'Queued',
  metadata_fetch: 'Metadata Fetch',
  policy_eval: 'Policy Evaluation',
  rag_analysis: 'RAG Analysis',
  signal_combine: 'Signal Combination',
  ai_analysis: 'AI Analysis',
  decision: 'Decision',
  notification: 'Notification',
}
const lockedPhaseOrder = ['queued', 'metadata_fetch', 'policy_eval', 'rag_analysis', 'signal_combine', 'ai_analysis', 'decision', 'notification']

const actionError = ref('')
const actionBusy = ref({})
const expandedProcessingTaskId = ref(null)
const processingDetailTriggerRef = ref(null)
const isMobileViewport = ref(false)
const expandedSections = ref({
  errors: true,
  enrichment: true,
  recent: true,
  quickadd: false,
  libraries: true,
  today: false,
})

function toggleSection(section) {
  expandedSections.value = { ...expandedSections.value, [section]: !expandedSections.value[section] }
}

const {
  activeLibraries,
  activeLibrariesSummary,
  activeProcessingTasks,
  aiOnline,
  alerts,
  configureMediaServerMessage,
  enrichmentEnriched,
  enrichmentOmdb,
  enrichmentOmdbPending,
  enrichmentProgress,
  enrichmentTavily,
  enrichmentTavilyPending,
  enrichmentTotal,
  failedQueueTasks,
  gapPercentComplete,
  gapProcessedCount,
  gapTotalCount,
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
  resolveManualChange,
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

const processingDetailTask = computed(() => {
  if (!expandedProcessingTaskId.value) return null
  return activeProcessingTasks.value.find(task => (task.taskId || task.id) === expandedProcessingTaskId.value) || null
})
const showProcessingBottomSheet = computed(() => Boolean(isMobileViewport.value && processingDetailTask.value))

const legacyRouteNotice = computed(() => {
  const source = String(route.query.legacyRoute || '').toLowerCase()
  if (!source) return null

  if (source === 'activity') {
    return {
      message: 'You were redirected from Live Activity. Operational live processing now runs in Command Center.',
      actions: [
        { label: 'Go To Processing', to: { path: '/', hash: '#processing' } },
        { label: 'Open Notifications', to: { path: '/notifications' } },
      ],
    }
  }

  if (source === 'queue') {
    return {
      message: 'You were redirected from Queue. Primary queue operations now live in Command Center; advanced controls are in Settings > Queue.',
      actions: [
        { label: 'Go To Processing', to: { path: '/', hash: '#processing' } },
        { label: 'Open Settings Queue', to: { path: '/settings', query: { tab: 'queue' } } },
      ],
    }
  }

  if (source === 'migration') {
    return {
      message: 'Migration workflows are deprecated. Use Policies, Presets, and Tuning for active rule management.',
      actions: [
        { label: 'Open Policies', to: { path: '/policies' } },
        { label: 'Open Presets', to: { path: '/presets' } },
        { label: 'Open Tuning', to: { path: '/tuning-suggestions' } },
      ],
    }
  }

  if (source === 'dashboard') {
    return {
      message: 'You were redirected from Dashboard. Command Center is now the primary operational surface.',
      actions: [
        { label: 'Go To Alerts', to: { path: '/', hash: '#alerts' } },
        { label: 'Go To Today', to: { path: '/', hash: '#today' } },
      ],
    }
  }

  return null
})

function dismissLegacyRouteNotice() {
  const query = { ...route.query }
  delete query.legacyRoute
  router.replace({ path: route.path, hash: route.hash, query })
}

function isActionBusy(key) { return Boolean(actionBusy.value[key]) }

async function runActionWithBusy(key, actionFn, refreshFn = refreshOperationalData) {
  actionError.value = ''
  actionBusy.value = { ...actionBusy.value, [key]: true }
  try {
    await actionFn()
    if (refreshFn) await refreshFn()
  } catch (error) {
    actionError.value = error?.response?.data?.error || error?.message || 'Action failed'
  } finally {
    actionBusy.value = { ...actionBusy.value, [key]: false }
  }
}

function phaseLabel(phaseId) { return phaseLabels[phaseId] || phaseId || 'Unknown' }
function safePercent(value) { const n = Number(value || 0); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0 }
function formatPercentOrDash(value) { if (!Number.isFinite(Number(value))) return '--'; return `${safePercent(value)}%` }
function formatDurationMs(value) { const n = Number(value || 0); return Number.isFinite(n) && n > 0 ? `${(n / 1000).toFixed(1)}s` : '0.0s' }
function formatNumber(value) { const n = Number(value || 0); return Number.isFinite(n) ? n.toLocaleString() : '0' }
function formatMediaType(value) { if (!value) return 'Unknown'; return value === 'tv' ? 'TV' : `${value.charAt(0).toUpperCase()}${value.slice(1)}` }

function formatRelativeTime(value) {
  if (!value) return 'unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown time'
  const diffMs = Math.max(0, Date.now() - date.getTime())
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function truncateError(message, maxLength = 120) { if (!message) return 'No error details available.'; return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message }
function completedPhaseCount(task) { return (Array.isArray(task?.phases) ? task.phases : []).filter(phase => phase.status === 'complete').length }
function nextPhaseLabel(task) { const next = (Array.isArray(task?.phases) ? task.phases : []).find(phase => phase.status === 'pending'); return next ? (next.label || phaseLabel(next.name)) : 'Complete' }
function openProcessingDetails(taskId, event = null) {
  const isClosingCurrentTask = expandedProcessingTaskId.value === taskId
  if (!isClosingCurrentTask && event?.currentTarget) {
    processingDetailTriggerRef.value = event.currentTarget
  }
  expandedProcessingTaskId.value = isClosingCurrentTask ? null : taskId
}
function closeProcessingDetails() { expandedProcessingTaskId.value = null }

function phaseRows(task) {
  const phases = Array.isArray(task?.phases) ? task.phases : []
  const phaseByName = new Map(phases.map((phase) => [phase.name, phase]))
  const currentPhase = task?.currentPhase || null
  const currentPhaseIndex = lockedPhaseOrder.indexOf(currentPhase)
  const phaseIndex = Number(task?.phaseIndex || 0)

  return lockedPhaseOrder.map((phaseName, index) => {
    const source = phaseByName.get(phaseName) || {}
    let status = source.status

    if (!status) {
      if (currentPhaseIndex >= 0) {
        if (index < currentPhaseIndex) status = 'complete'
        else if (index === currentPhaseIndex) status = 'in_progress'
        else status = 'pending'
      } else if (phaseIndex > 0) {
        if (index < phaseIndex - 1) status = 'complete'
        else if (index === phaseIndex - 1) status = 'in_progress'
        else status = 'pending'
      } else {
        status = index === 0 ? 'in_progress' : 'pending'
      }
    }

    const timing = status === 'in_progress'
      ? 'running...'
      : (status === 'complete' && Number.isFinite(Number(source.duration_ms))
        ? formatDurationMs(source.duration_ms)
        : (status === 'skipped' ? 'skipped' : ''))

    return {
      name: phaseName,
      label: source.label || phaseLabel(phaseName),
      status,
      timing,
    }
  })
}

function parseTaskPayload(task) {
  if (!task?.payload) return {}
  if (typeof task.payload === 'object') return task.payload
  try { return JSON.parse(task.payload) } catch { return {} }
}

function taskTitle(task) { const payload = parseTaskPayload(task); return payload.title || payload.media?.title || payload.subject || task.title || `Task #${task.id}` }
function taskMediaType(task) {
  const payload = parseTaskPayload(task)
  const type = payload?.media?.media_type || payload?.media_type || payload?.mediaType || payload?.subject?.mediaType || payload?.request?.media?.mediaType || payload?.type || null
  return type === 'series' ? 'tv' : type
}

async function cancelPendingTask(taskId) { await runActionWithBusy(taskId === pendingQueueTasks.value[0]?.id ? 'cancel-first' : `cancel-${taskId}`, async () => { await api.cancelQueueTask(taskId) }) }
async function cancelAllPendingTasks() { await runActionWithBusy('cancel-all', async () => { await api.cancelAllPendingTasks() }) }

async function processEnrichmentRetries(type = 'tavily') { await runActionWithBusy(`process-enrichment-retries-${type}`, async () => { await api.processEnrichmentRetries({ limit: 50, enrichmentType: type }) }) }

async function retryFailedTask(taskId) { await runActionWithBusy(`retry-failed-${taskId}`, async () => { await api.retryQueueTask(taskId) }) }
async function dismissFailedTask(taskId) { await runActionWithBusy(`dismiss-failed-${taskId}`, async () => { await api.dismissQueueTask(taskId) }) }
async function retryAllFailed() { await runActionWithBusy('retry-all-failed', async () => { await api.retryAllFailedTasks() }) }

function openMediaServerSettings() {
  router.push({ path: '/settings', query: { tab: 'media-server' } })
}

let mobileMediaQueryList = null

function applyViewportMode(matches) {
  isMobileViewport.value = Boolean(matches)
}

function handleMobileViewportChange(event) {
  applyViewportMode(event.matches)
}

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mobileMediaQueryList = window.matchMedia('(max-width: 1023px)')
    applyViewportMode(mobileMediaQueryList.matches)
    if (typeof mobileMediaQueryList.addEventListener === 'function') {
      mobileMediaQueryList.addEventListener('change', handleMobileViewportChange)
    } else if (typeof mobileMediaQueryList.addListener === 'function') {
      mobileMediaQueryList.addListener(handleMobileViewportChange)
    }
  }
})

watch(showProcessingBottomSheet, async (isOpen, wasOpen) => {
  if (!isOpen && wasOpen) {
    await nextTick()
    processingDetailTriggerRef.value?.focus?.()
  }
})

watch(processingDetailTask, (task) => {
  if (!task && expandedProcessingTaskId.value) {
    expandedProcessingTaskId.value = null
  }
})

onBeforeUnmount(() => {
  if (mobileMediaQueryList) {
    if (typeof mobileMediaQueryList.removeEventListener === 'function') {
      mobileMediaQueryList.removeEventListener('change', handleMobileViewportChange)
    } else if (typeof mobileMediaQueryList.removeListener === 'function') {
      mobileMediaQueryList.removeListener(handleMobileViewportChange)
    }
  }
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

.processing-active {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.processing-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.processing-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f3f4f6;
  line-height: 1.3;
}

.processing-year {
  font-weight: 400;
  color: #6b7280;
}

.processing-percent {
  font-size: 1.125rem;
  font-weight: 700;
  color: #e5e7eb;
  white-space: nowrap;
}

.processing-progress {
  height: 8px;
  border-radius: 9999px;
  background: #374151;
  overflow: hidden;
}

.processing-progress-bar {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(to right, #3b82f6, #22d3ee);
  transition: width 0.3s ease;
}

.processing-phase-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.processing-phase-current {
  color: #60a5fa;
  font-weight: 500;
}

.processing-stepper {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-top: 0.5rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: #111827;
}

.stepper-item {
  display: flex;
  align-items: center;
  min-width: 80px;
  flex: 1;
  position: relative;
}

.stepper-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #374151;
  flex-shrink: 0;
}

.stepper-complete .stepper-marker {
  background: #22c55e;
  color: #fff;
}

.stepper-active .stepper-marker {
  background: #3b82f6;
}

.stepper-pending .stepper-marker {
  background: #374151;
}

.stepper-skipped .stepper-marker {
  background: #78350f;
  color: #fcd34d;
}

.stepper-icon {
  width: 14px;
  height: 14px;
}

.stepper-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.stepper-circle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
}

.stepper-skip-marker {
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1;
}

.stepper-connector {
  position: absolute;
  left: 24px;
  top: 12px;
  width: calc(100% - 24px);
  height: 2px;
  background: #374151;
}

.stepper-connector-active {
  background: #22c55e;
}

.stepper-connector-skipped {
  background: #92400e;
}

.stepper-content {
  display: none;
  margin-left: 0.5rem;
}

@media (min-width: 768px) {
  .stepper-content {
    display: flex;
    flex-direction: column;
  }

  .stepper-item {
    flex-direction: column;
    align-items: flex-start;
    min-width: auto;
  }

  .stepper-connector {
    display: none;
  }
}

.stepper-label {
  font-size: 0.625rem;
  color: #6b7280;
  white-space: nowrap;
}

.stepper-complete .stepper-label {
  color: #9ca3af;
}

.stepper-active .stepper-label {
  color: #60a5fa;
}

.stepper-skipped .stepper-label {
  color: #fbbf24;
}

.stepper-timing {
  font-size: 0.625rem;
  color: #4b5563;
}

.processing-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.processing-mobile-actions {
  margin-top: 0.75rem;
}

.processing-telemetry {
  font-size: 0.75rem;
  color: #6b7280;
}

.processing-queue-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.processing-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.idle-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 1rem;
  color: #22c55e;
}

.idle-icon-warning {
  color: #f59e0b;
}

.idle-title {
  font-size: 1rem;
  font-weight: 600;
  color: #e5e7eb;
  margin-bottom: 0.25rem;
}

.idle-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.75rem;
}

.idle-waiting-ai {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.up-next {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid #374151;
}

.up-next-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.up-next-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.up-next-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.up-next-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid #374151;
  background: #111827;
}

.up-next-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.up-next-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #e5e7eb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.up-next-type {
  font-size: 0.6875rem;
  color: #6b7280;
}

.up-next-cancel {
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
}

.secondary-section {
  margin-bottom: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #374151;
  background: #1f2937;
  overflow: hidden;
}

.secondary-section.has-errors {
  border-color: #991b1b;
}

.secondary-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #111827;
  cursor: pointer;
  user-select: none;
}

.secondary-section-header:hover {
  background: #1a2332;
}

.secondary-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9ca3af;
}

.secondary-section-count {
  font-weight: 400;
  color: #6b7280;
  margin-left: 0.25rem;
}

.secondary-section-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.secondary-section-link {
  font-size: 0.75rem;
  color: #60a5fa;
  text-decoration: none;
}

.secondary-section-link:hover {
  color: #93c5fd;
}

.secondary-section-toggle {
  font-size: 1rem;
  font-weight: 600;
  color: #6b7280;
  width: 1.25rem;
  text-align: center;
}

.secondary-section-content {
  padding: 1rem;
  border-top: 1px solid #374151;
}

.errors-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.error-item {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #374151;
  background: #111827;
}

.error-info {
  flex: 1;
  min-width: 200px;
}

.error-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #f3f4f6;
}

.error-meta {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.error-message {
  font-size: 0.75rem;
  color: #f87171;
  margin-top: 0.25rem;
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.secondary-idle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #22c55e;
}

.secondary-idle-check {
  font-size: 1rem;
}

.enrichment-progress {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.enrichment-bar {
  height: 6px;
  border-radius: 9999px;
  background: #374151;
  overflow: hidden;
}

.enrichment-bar-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(to right, #22c55e, #3b82f6);
  transition: width 0.3s ease;
}

.enrichment-stats {
  font-size: 0.75rem;
  color: #9ca3af;
}

.enrichment-pending {
  color: #fbbf24;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recent-item {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #374151;
  background: #111827;
}

.recent-info {
  font-size: 0.8125rem;
  color: #e5e7eb;
}

.recent-time {
  font-size: 0.75rem;
  color: #6b7280;
}

.secondary-empty {
  font-size: 0.875rem;
  color: #6b7280;
}

.libraries-cta {
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #92400e;
  background: rgba(146, 64, 14, 0.1);
  margin-bottom: 0.75rem;
}

.libraries-cta p {
  font-size: 0.8125rem;
  color: #fcd34d;
  margin-bottom: 0.5rem;
}

.libraries-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.library-item {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #374151;
  background: #111827;
}

.library-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #e5e7eb;
}

.library-stats {
  font-size: 0.75rem;
  color: #6b7280;
}

.today-stats {
  font-size: 0.875rem;
  color: #e5e7eb;
}

.secondary-section-last {
  margin-bottom: 0;
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

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section id="errors" class="secondary-section" :class="{ 'has-errors': failedQueueTasks.length > 0 }">
    <div class="secondary-section-header" @click="$emit('toggle-section', 'errors')">
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
          @click.stop="$emit('retry-all-failed')"
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
            <Button variant="warning" size="sm" @click="$emit('retry-failed-task', task.id)">Retry</Button>
            <Button variant="ghost" size="sm" @click="$emit('dismiss-failed-task', task.id)">Dismiss</Button>
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
    <div class="secondary-section-header" @click="$emit('toggle-section', 'enrichment')">
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
          @click.stop="$emit('process-enrichment-retries', 'omdb')"
        >
          Retry OMDb ({{ enrichmentOmdbPending }})
        </Button>
        <Button
          v-if="enrichmentTavilyPending > 0"
          variant="warning"
          size="sm"
          :disabled="isActionBusy('process-enrichment-retries-tavily')"
          :loading="isActionBusy('process-enrichment-retries-tavily')"
          @click.stop="$emit('process-enrichment-retries', 'tavily')"
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
        <div class="enrichment-state-grid" aria-label="Enrichment state summary">
          <div class="enrichment-state-card enrichment-state-card-success">
            <span class="enrichment-state-label">Processed</span>
            <Badge variant="success">{{ formatNumber(enrichmentCompletedItems || enrichmentEnriched) }}</Badge>
          </div>
          <div class="enrichment-state-card enrichment-state-card-info">
            <span class="enrichment-state-label">Processing</span>
            <Badge variant="info">{{ formatNumber(enrichmentProcessingItems) }}</Badge>
          </div>
          <div class="enrichment-state-card enrichment-state-card-warning">
            <span class="enrichment-state-label">Pending</span>
            <Badge variant="warning">{{ formatNumber(enrichmentPendingItems) }}</Badge>
          </div>
          <div class="enrichment-state-card enrichment-state-card-warning" :class="{ 'enrichment-state-card-muted': enrichmentDeferredItems === 0 }">
            <span class="enrichment-state-label">Deferred</span>
            <Badge :variant="enrichmentDeferredItems > 0 ? 'warning' : 'default'">{{ formatNumber(enrichmentDeferredItems) }}</Badge>
          </div>
          <div class="enrichment-state-card enrichment-state-card-error" :class="{ 'enrichment-state-card-muted': enrichmentFailedItems === 0 }">
            <span class="enrichment-state-label">Failed</span>
            <Badge :variant="enrichmentFailedItems > 0 ? 'error' : 'default'">{{ formatNumber(enrichmentFailedItems) }}</Badge>
          </div>
        </div>
        <p class="enrichment-stats">
          {{ formatNumber(enrichmentEnriched) }} / {{ formatNumber(enrichmentTotal) }} processed
          • OMDb: {{ formatNumber(enrichmentOmdb) }}<span v-if="enrichmentOmdbPending > 0" class="enrichment-pending"> (+{{ formatNumber(enrichmentOmdbPending) }} pending)</span>
          • Tavily: {{ formatNumber(enrichmentTavily) }}<span v-if="enrichmentTavilyPending > 0" class="enrichment-pending"> (+{{ formatNumber(enrichmentTavilyPending) }} pending)</span><span v-if="enrichmentTavilyDeferred > 0" class="enrichment-deferred"> (+{{ formatNumber(enrichmentTavilyDeferred) }} deferred)</span>
        </p>
        <p v-if="enrichmentTavilyDeferred > 0" class="enrichment-note">
          Tavily deferred items are waiting for the provider's monthly quota reset. OMDb/core processing is not blocked.
        </p>
      </div>
    </div>
  </section>

  <section id="recently-completed" class="secondary-section">
    <div class="secondary-section-header" @click="$emit('toggle-section', 'recent')">
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

  <section id="libraries" class="secondary-section">
    <div class="secondary-section-header" @click="$emit('toggle-section', 'libraries')">
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
        <Button variant="warning" size="sm" @click="$emit('open-media-server-settings')">Configure Media Server</Button>
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
    <div class="secondary-section-header" @click="$emit('toggle-section', 'today')">
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
</template>

<script setup>
import { Badge, Button } from '@/components/common'

defineProps({
  activeLibrariesSummary: { type: Array, default: () => [] },
  configureMediaServerMessage: { type: String, default: '' },
  enrichmentCompletedItems: { type: Number, default: 0 },
  enrichmentDeferredItems: { type: Number, default: 0 },
  enrichmentEnriched: { type: Number, default: 0 },
  enrichmentFailedItems: { type: Number, default: 0 },
  enrichmentOmdb: { type: Number, default: 0 },
  enrichmentOmdbPending: { type: Number, default: 0 },
  enrichmentPendingItems: { type: Number, default: 0 },
  enrichmentProcessingItems: { type: Number, default: 0 },
  enrichmentProgress: { type: Number, default: 0 },
  enrichmentTavily: { type: Number, default: 0 },
  enrichmentTavilyDeferred: { type: Number, default: 0 },
  enrichmentTavilyPending: { type: Number, default: 0 },
  enrichmentTotal: { type: Number, default: 0 },
  expandedSections: { type: Object, required: true },
  failedQueueTasks: { type: Array, default: () => [] },
  formatNumber: { type: Function, required: true },
  formatPercentOrDash: { type: Function, required: true },
  formatRelativeTime: { type: Function, required: true },
  isActionBusy: { type: Function, required: true },
  recentlyCompletedItems: { type: Array, default: () => [] },
  safePercent: { type: Function, required: true },
  showConfigureMediaServerCta: { type: Boolean, default: false },
  showEnrichmentSection: { type: Boolean, default: false },
  taskTitle: { type: Function, required: true },
  todayAvgConfidence: { type: Number, default: 0 },
  todayClassifiedCount: { type: Number, default: 0 },
  todayManualCount: { type: Number, default: 0 },
  truncateError: { type: Function, required: true },
})

defineEmits([
  'dismiss-failed-task',
  'open-media-server-settings',
  'process-enrichment-retries',
  'retry-all-failed',
  'retry-failed-task',
  'toggle-section',
])
</script>

<style scoped>
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

.enrichment-state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.625rem;
}

.enrichment-state-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #374151;
  background: #111827;
}

.enrichment-state-card-muted {
  opacity: 0.72;
}

.enrichment-state-card-success {
  border-color: rgba(34, 197, 94, 0.35);
}

.enrichment-state-card-info {
  border-color: rgba(59, 130, 246, 0.35);
}

.enrichment-state-card-warning {
  border-color: rgba(245, 158, 11, 0.35);
}

.enrichment-state-card-error {
  border-color: rgba(239, 68, 68, 0.35);
}

.enrichment-state-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #d1d5db;
}

.enrichment-pending {
  color: #fbbf24;
}

.enrichment-deferred {
  color: #f97316;
}

.enrichment-note {
  font-size: 0.75rem;
  color: #f59e0b;
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
</style>

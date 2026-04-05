<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
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
            v-for="(row, index) in currentPhaseRows"
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
              v-if="index < currentPhaseRows.length - 1"
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
            @click="$emit('open-processing-details', primaryActiveTask.taskId || primaryActiveTask.id, $event)"
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
          <Button variant="ghost" size="sm" @click="$emit('open-media-server-settings')">
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
            @click="$emit('cancel-all-pending')"
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
            <Button variant="ghost" size="sm" class="up-next-cancel" @click="$emit('cancel-pending-task', task.id)">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Button } from '@/components/common'

const props = defineProps({
  aiGenerationTelemetryLine: { type: String, default: '' },
  aiOnline: { type: Boolean, default: false },
  completedPhaseCount: { type: Function, required: true },
  formatDurationMs: { type: Function, required: true },
  formatMediaType: { type: Function, required: true },
  formatNumber: { type: Function, required: true },
  gapPercentComplete: { type: Number, default: 0 },
  gapProcessedCount: { type: Number, default: 0 },
  gapTotalCount: { type: Number, default: 0 },
  isActionBusy: { type: Function, required: true },
  isMobileViewport: { type: Boolean, default: false },
  nextPhaseLabel: { type: Function, required: true },
  phaseLabel: { type: Function, required: true },
  phaseRows: { type: Function, required: true },
  primaryActiveTask: { type: Object, default: null },
  queuePendingCount: { type: Number, default: 0 },
  safePercent: { type: Function, required: true },
  taskMediaType: { type: Function, required: true },
  taskTitle: { type: Function, required: true },
  upNextCount: { type: Number, default: 0 },
  upNextTasks: { type: Array, default: () => [] },
})

defineEmits([
  'cancel-all-pending',
  'cancel-pending-task',
  'open-media-server-settings',
  'open-processing-details',
])

const currentPhaseRows = computed(() => props.phaseRows(props.primaryActiveTask))
</script>

<style scoped>
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

@media (max-width: 1023px) {
  .panel-content {
    padding: 1rem;
  }
}
</style>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    id="processing"
    class="panel panel-processing"
  >
    <div class="panel-header">
      <h2 class="panel-title">
        Processing
      </h2>
    </div>
    <div class="panel-content">
      <div
        v-if="librarySyncIsRunning"
        class="processing-active"
      >
        <div class="processing-title-row">
          <h3 class="processing-title">
            Syncing Plex Library
          </h3>
          <span class="processing-percent">{{ safePercent(librarySyncPercentComplete) }}%</span>
        </div>

        <div class="processing-progress">
          <div
            class="processing-progress-bar"
            :style="{ width: `${safePercent(librarySyncPercentComplete)}%` }"
          />
        </div>

        <div class="processing-phase-info">
          <span class="processing-phase-current">Plex inventory import</span>
          <span
            v-if="librarySyncCurrentLibrary"
            class="processing-phase-step"
          >Current library: {{ librarySyncCurrentLibrary }}</span>
          <span>{{ formatNumber(librarySyncRemainingCount) }} waiting to sync</span>
        </div>

        <div class="processing-queue-stats">
          <span>Library: {{ formatNumber(librarySyncProcessedCount) }} / {{ formatNumber(librarySyncTotalCount) }} ({{ librarySyncPercentComplete }}%)</span>
        </div>
      </div>

      <div
        v-else
        class="processing-idle"
      >
        <div class="idle-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p class="idle-title">
          No active processing
        </p>
        <p class="idle-subtitle">
          Library: {{ formatNumber(librarySyncProcessedCount) }} / {{ formatNumber(librarySyncTotalCount) }} ({{ librarySyncPercentComplete }}%)
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  formatNumber: { type: Function, required: true },
  librarySyncCurrentLibrary: { type: String, default: '' },
  librarySyncIsRunning: { type: Boolean, default: false },
  librarySyncPercentComplete: { type: Number, default: 0 },
  librarySyncProcessedCount: { type: Number, default: 0 },
  librarySyncRemainingCount: { type: Number, default: 0 },
  librarySyncTotalCount: { type: Number, default: 0 },
  safePercent: { type: Function, required: true },
})
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

@media (max-width: 1023px) {
  .panel-content {
    padding: 1rem;
  }
}
</style>

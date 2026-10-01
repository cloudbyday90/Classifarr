<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <section
    class="rounded-lg border border-gray-700 bg-background-light p-5 space-y-4"
    aria-labelledby="image-index-progress-heading"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2
        id="image-index-progress-heading"
        class="text-xl font-semibold"
      >
        Image search maintenance
      </h2>
      <button
        type="button"
        class="px-3 py-2 rounded border border-gray-500 text-sm hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 aria-disabled:opacity-60"
        :aria-disabled="loading"
        @click="refresh"
      >
        {{ loading ? 'Checking…' : 'Refresh repair status' }}
      </button>
    </div>
    <div
      role="status"
      aria-atomic="true"
    >
      <p
        class="font-semibold text-lg"
        :class="presentation.color"
      >
        {{ loading ? 'Checking repair status…' : presentation.label }}
      </p>
      <p
        v-if="!loading"
        class="text-gray-200 mt-1"
      >
        {{ denied ? 'Administrator access is required to view repair status.' : presentation.description }}
      </p>
    </div>
    <template v-if="report && !loading">
      <div v-if="report.indexes">
        <p class="text-sm text-gray-300 mb-2">
          {{ verifiedCount }} of 3 indexes verified — not a build percentage
        </p>
        <ul class="grid gap-2 sm:grid-cols-3">
          <li
            v-for="index in report.indexes"
            :key="index.key"
            class="rounded border border-gray-600 p-3"
            :class="index.status === 'verified' ? 'bg-emerald-950 text-emerald-200' : 'bg-gray-800 text-amber-200'"
          >
            <span aria-hidden="true">{{ index.status === 'verified' ? '✓' : '○' }}</span>
            {{ imageIndexLabels[index.key] }}
            <span class="block text-sm capitalize">{{ index.status }}</span>
          </li>
        </ul>
      </div>
      <p
        v-if="report.automatic"
        class="text-sm text-gray-300"
      >
        Automatic attempts started: {{ report.automatic.started }} / {{ report.automatic.limit }}
        <span
          v-if="report.automatic.nextEligibleAt"
          class="block"
        >
          Automatic cooldown ends: <time :datetime="report.automatic.nextEligibleAt">{{ formatTime(report.automatic.nextEligibleAt) }}</time>.
          Other readiness checks still apply.
        </span>
      </p>
    </template>
    <p
      v-if="!loading && !denied"
      class="text-sm"
    >
      <strong>Next:</strong> {{ presentation.action }}
    </p>
    <p class="text-xs text-gray-400">
      Read-only snapshot. Refresh does not start a repair.
      <span v-if="report && !loading">Checked <time :datetime="report.observedAt">{{ formatTime(report.observedAt) }}</time>.</span>
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { getImageIndexProgress } from '@/api/systemHealthApi'
import { imageIndexLabels, presentImageIndexProgress } from '@/utils/imageIndexProgressPresentation'

const report = ref(null)
const loading = ref(false)
const denied = ref(false)
let disposed = false
const presentation = computed(() => presentImageIndexProgress(report.value))
const verifiedCount = computed(() => report.value?.indexes?.filter(index => index.status === 'verified').length ?? 0)
const formatTime = value => new Date(value).toLocaleString()
async function refresh() {
  if (loading.value || disposed) return
  loading.value = true
  try {
    const result = await getImageIndexProgress()
    if (!disposed) { report.value = result; denied.value = false }
  } catch (error) {
    // Never leave an earlier green snapshot looking current after a failed refresh.
    if (!disposed) { report.value = null; denied.value = error.response?.status === 403 }
  } finally {
    if (!disposed) loading.value = false
  }
}
onMounted(refresh)
onBeforeUnmount(() => { disposed = true })
</script>

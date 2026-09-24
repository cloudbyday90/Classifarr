<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <details
    v-if="available"
    class="batch-activity"
  >
    <summary>
      Batch activity
      <span v-if="activeCount"> · {{ activeCount }} running or paused on this page</span>
      <span v-if="recoveryCount"> · {{ recoveryCount }} unresolved moves on this page</span>
      <span v-if="errorMessage"> · Status unavailable</span>
    </summary>
    <div class="activity-content">
      <p>Saved movie/TV moves, running and paused first. Work continues when this page is closed.</p>
      <p role="status">
        {{ errorMessage || (isLoading || (!page && fetching) ? 'Loading saved batches…' : '') }}
      </p>
      <p v-if="page && !page.batches.length">
        No started batches on this page.
      </p>
      <ul
        v-if="page?.batches.length"
        aria-label="Saved reclassification batches"
      >
        <li
          v-for="batch in page.batches"
          :key="batch.id"
        >
          <div>
            <strong>Batch #{{ batch.id }} · {{ statusLabel(batch.status) }}</strong>
            <p>{{ batch.completed }} of {{ batch.total }} completed · {{ batch.failed }} failed · {{ batch.skipped }} skipped · {{ batch.cancelled }} cancelled</p>
            <p
              v-if="batch.recovering || batch.attention"
              class="recovery-note"
            >
              {{ batch.recovering }} awaiting move verification · {{ batch.attention }} need recovery attention
            </p>
          </div>
          <button
            type="button"
            :aria-label="`View batch ${batch.id}`"
            @click="openBatch(batch.id)"
          >
            View batch
          </button>
        </li>
      </ul>
      <div class="activity-controls">
        <button
          type="button"
          :disabled="fetching"
          @click="refresh"
        >
          Refresh / first page
        </button>
        <button
          type="button"
          :disabled="fetching || !page?.nextCursor"
          @click="nextPage"
        >
          Next batches
        </button>
      </div>
      <p class="activity-note">
        Pause or cancel stops remaining admissions, not a move already started. Its recovery can still finish.
      </p>
    </div>
    <BatchReclassifyModal
      v-if="selectedId !== null"
      :key="selectedId"
      :model-value="detailOpen"
      :existing-batch-id="selectedId"
      @update:model-value="closeBatch"
    />
  </details>
</template>

<script setup>
import { computed, ref } from 'vue'
import BatchReclassifyModal from '@/components/BatchReclassifyModal.vue'
import { useBatchActivity } from '@/composables/useBatchActivity'

const { page, available, fetching, isLoading, errorMessage, refresh, nextPage } = useBatchActivity()
const selectedId = ref(null)
const detailOpen = ref(false)
const activeCount = computed(() => page.value?.batches.filter(batch => ['executing', 'paused'].includes(batch.status)).length || 0)
const recoveryCount = computed(() => page.value?.batches.reduce((sum, batch) => sum + batch.recovering + batch.attention, 0) || 0)
const statusLabel = status => ({ executing: 'Running', paused: 'Paused', completed: 'Finished', cancelled: 'Cancelled', failed: 'Failed' })[status] || 'Status unknown'
function closeBatch(open) {
  if (open) return
  detailOpen.value = false
  void refresh()
}
function openBatch(id) {
  selectedId.value = id
  detailOpen.value = true
}
</script>

<style scoped>
.batch-activity { margin-bottom: 1.5rem; border: 1px solid #475569; border-radius: .75rem; color: #e2e8f0; background: #1f2937; }
summary { padding: 1rem; cursor: pointer; font-weight: 600; }
summary span, p { font-size: .875rem; font-weight: 400; }
.activity-content { padding: 0 1rem 1rem; }
ul { list-style: none; margin: .75rem 0; padding: 0; }
li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: .75rem 0; border-top: 1px solid #475569; }
p { margin: .35rem 0; }
.recovery-note { color: #fde68a; }
.activity-controls { display: flex; gap: .75rem; flex-wrap: wrap; }
button { padding: .5rem .75rem; border: 1px solid #64748b; border-radius: .375rem; color: #bfdbfe; }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
.activity-note { margin-top: .75rem; color: #cbd5e1; }
</style>

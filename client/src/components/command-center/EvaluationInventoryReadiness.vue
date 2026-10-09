<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div>
    <h3>Current inventory check</h3>
    <p
      role="status"
      aria-atomic="true"
    >
      {{ inventory ? inventoryReadinessText[inventory.status] : 'Inventory readiness details are unavailable.' }}
    </p>
    <details v-if="inventory">
      <summary>Backfill progress</summary>
      <p>
        Of {{ inventory.completedImports }} completed imports:
        {{ inventory.notStarted }} awaiting a backfill scan · {{ inventory.scanning }} scans in progress ·
        {{ inventory.completedHandoffs }} scans complete.
      </p>
      <p>{{ inventory.dueTasks }} due queued tasks · {{ inventory.processingTasks }} processing tasks (all task types).</p>
      <p v-if="inventory.latestCheckpointAt">
        Latest saved page among unfinished scans:
        <time :datetime="inventory.latestCheckpointAt">{{ new Date(inventory.latestCheckpointAt).toLocaleString() }}</time>.
        This does not show whether every library is advancing.
      </p>
      <p v-else-if="inventory.notStarted + inventory.scanning > 0">
        No page checkpoint is available for the unfinished scans.
      </p>
      <p>
        Backfill checks inventory in bounded batches on a five-minute schedule. An empty queue does not mean
        the scan is finished; a completed scan does not mean every metadata provider succeeded.
        If progress stops across repeated checks, review scheduler and backfill diagnostics. Do not reset imports.
      </p>
    </details>
  </div>
</template>

<script setup>
import { inventoryReadinessText } from '@/utils/evaluationInventoryReadiness'
defineProps({ inventory: { type: Object, default: null } })
</script>

<style scoped>
h3 { font-weight: 600; margin-top: .75rem; }
p { margin-top: .4rem; font-size: .875rem; line-height: 1.5; }
summary { color: #bfdbfe; cursor: pointer; min-height: 2rem; }
summary:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
</style>

<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="space-y-2 rounded border border-gray-600 p-3">
    <p class="font-medium">
      Automatic scan diagnostics
    </p>
    <p>Retained window: {{ time(diagnostics.windowStartAt) }} to {{ time(diagnostics.windowEndAt) }}.</p>
    <template v-if="diagnostics.catalog">
      <p>
        {{ diagnostics.catalog.withCompletedScans }} of {{ diagnostics.catalog.activeLibraryCount }} currently active libraries
        have a retained complete incremental measurement; {{ diagnostics.catalog.withoutCompletedScans }} have none in this window.
        {{ diagnostics.catalog.withoutIncrementalVisits }} have no incremental visits in this window.
      </p>
      <p v-if="unvisited.length">
        Active libraries without incremental visits (up to {{ diagnostics.catalog.unvisitedPreviewLimit }}):
        {{ unvisited.join('; ') }}.
        <span v-if="diagnostics.catalog.unvisitedOmittedCount">{{ diagnostics.catalog.unvisitedOmittedCount }} more are not listed.</span>
      </p>
    </template>
    <p v-else>
      Current catalog totals are unavailable.
    </p>
    <p class="text-sm text-gray-300">
      Missing retained completion does not mean a scan failed or has never completed.
      A complete measurement does not establish metadata completeness or classification readiness.
      Active libraries with repeated resets, expirations or no retained completion appear first below.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { observationHistoryTime as time } from '@/utils/observationHistoryDisplay'
const props = defineProps({ diagnostics: { type: Object, required: true }, libraries: { type: Array, default: () => [] } })
const unvisited = computed(() => {
  const names = new Map(props.libraries.map(library => [library.id, library.name]))
  return (props.diagnostics.catalog?.unvisitedLibraryIds ?? []).map(id => {
    const name = names.get(id)
    return name ? `${name} (library ${id})` : `Library ${id}`
  })
})
</script>

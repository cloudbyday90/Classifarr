<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div
    v-if="label"
    class="text-sm space-y-1"
  >
    <p class="font-medium">
      {{ label }}
    </p>
    <p v-if="!compact">
      {{ explanation }}
    </p>
    <details v-if="recovery?.operationId && !compact">
      <summary>Move recovery reference</summary>
      <p class="break-all">
        {{ recovery.operationId }}
      </p>
      <p v-if="recovery.reasonCode">
        Reason: {{ recovery.reasonCode }}
      </p>
    </details>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  recovery: { type: Object, default: null },
  reconciled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})
const state = computed(() => props.recovery?.state || (props.reconciled ? 'completed' : null))
const label = computed(() => ({
  moving: 'Move verification pending',
  files_verified: 'Finalizing verified move',
  needs_attention: 'Move needs attention',
  completed: 'Move completed and verified',
}[state.value] || ''))
const explanation = computed(() => state.value === 'completed'
  ? 'File placement and Radarr/Sonarr state were verified. This is not a new classification confidence score.'
  : state.value === 'needs_attention'
    ? 'Automatic recovery is stopped. Review the move error and library mappings, inspect both folders without deleting either, then retry the original destination after resolving the reported issue.'
    : 'Classifarr will retry verification automatically. Do not move or delete either folder while recovery is pending. No additional approval is needed.')
</script>

<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="border-l-2 border-blue-400 pl-3 space-y-1">
    <p class="font-semibold">
      {{ view.label }}
    </p>
    <template v-if="view.counts">
      <progress
        v-if="view.counts.total > 0"
        :value="view.counts.ready"
        :max="view.counts.total"
        aria-label="Verified metadata items"
        class="w-full accent-blue-400"
      />
      <p>{{ view.counts.ready }} / {{ view.counts.total }} metadata items ready</p>
      <p
        v-if="view.counts.pending || view.counts.blocked"
        class="text-gray-300"
      >
        {{ view.counts.pending }} waiting · {{ view.counts.blocked }} failed
      </p>
    </template>
    <p>{{ view.action }}</p>
    <p
      v-if="progress?.checkedAt"
      class="text-gray-300"
    >
      Checked <time :datetime="progress.checkedAt">{{ progress.checkedAt }}</time>
    </p>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { recoveryProgressView } from '@/utils/ingestionRecoveryProgress'
const props = defineProps({ progress: { type: Object, default: null } })
const view = computed(() => recoveryProgressView(props.progress))
</script>

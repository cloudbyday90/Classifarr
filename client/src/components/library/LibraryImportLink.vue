<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <RouterLink
    v-if="label"
    :to="`/libraries/${library.id}`"
    class="inline-block text-sm text-blue-300 underline focus-visible:outline focus-visible:outline-2"
    :aria-label="`${label}: ${library.name}`"
    @click.stop
  >
    {{ label }} →
  </RouterLink>
</template>

<script setup>
import { computed } from 'vue'
import { libraryIngestionState, LIBRARY_INGESTION_COPY } from '@/utils/libraryIngestionStatus'
const props = defineProps({ library: { type: Object, required: true } })
const label = computed(() => LIBRARY_INGESTION_COPY[libraryIngestionState(props.library)]?.[0])
</script>

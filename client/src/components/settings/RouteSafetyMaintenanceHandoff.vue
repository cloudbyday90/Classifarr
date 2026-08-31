<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="presentation.isRecommended"
    class="mt-4 rounded-lg border border-amber-700/70 bg-amber-950/10 p-4"
    aria-labelledby="route-safety-maintenance-handoff-heading"
  >
    <p class="text-xs font-medium uppercase tracking-wide text-amber-200">
      Policy maintenance
    </p>
    <h3
      id="route-safety-maintenance-handoff-heading"
      class="mt-1 font-semibold text-gray-100"
    >
      {{ presentation.heading }}
    </h3>
    <p class="mt-3 text-sm text-gray-200">
      {{ presentation.message }}
    </p>
    <p class="mt-3 text-xs text-gray-400">
      This is an advisory link. It does not select a policy, change configuration, call AI or RAG, retry work, or route media.
    </p>
    <RouterLink
      :to="{ name: 'Policies' }"
      class="mt-4 inline-flex rounded border border-amber-500/80 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/30 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-gray-950"
    >
      {{ presentation.actionLabel }}
    </RouterLink>
  </section>

  <p
    class="sr-only"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {{ statusAnnouncement }}
  </p>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { buildRouteSafetyMaintenanceHandoffPresentation } from '@/utils/routeSafetyMaintenanceHandoffPresentation'

const props = defineProps({
  report: {
    type: Object,
    default: () => null,
  },
})

const presentation = computed(() => buildRouteSafetyMaintenanceHandoffPresentation(props.report))
const statusAnnouncement = ref('')
let initialStatusId = null

watch(
  () => presentation.value.statusId,
  (nextStatusId) => {
    if (initialStatusId === null) {
      initialStatusId = nextStatusId
      return
    }

    if (nextStatusId !== initialStatusId) {
      statusAnnouncement.value = nextStatusId === 'review_recommended'
        ? 'Policy maintenance review is recommended.'
        : 'Policy maintenance review is no longer recommended.'
      initialStatusId = nextStatusId
    }
  },
  { immediate: true },
)
</script>

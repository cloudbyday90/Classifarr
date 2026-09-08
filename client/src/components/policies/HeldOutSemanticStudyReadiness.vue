<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="readiness"
    class="overflow-hidden rounded-lg border border-gray-700 bg-background-light"
    aria-labelledby="held-out-semantic-study-readiness-heading"
  >
    <div class="border-b border-gray-700 p-5">
      <p
        id="held-out-semantic-study-readiness-heading"
        class="text-sm font-semibold"
        :class="statusClass(readiness.statusId)"
        role="status"
        aria-atomic="true"
      >
        Held-out semantic study: {{ formatId(readiness.statusId) }}
      </p>
      <p class="mt-1 max-w-3xl text-sm leading-6 text-gray-300">
        {{ description(readiness.statusId) }}
      </p>
    </div>

    <dl class="grid gap-4 p-5 text-sm sm:grid-cols-2">
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Normal lifecycle receipts
        </dt>
        <dd class="mt-1 font-semibold text-white">
          {{ readiness.normalLifecycleReceiptCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Complete declared-purpose evidence
        </dt>
        <dd class="mt-1 font-semibold text-white">
          {{ readiness.completePolicyEvidenceCount }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  normalizeHeldOutSemanticStudyReadiness,
} from '@/utils/heldOutSemanticStudyReadiness'

const props = defineProps({
  readiness: {
    type: Object,
    default: null,
  },
})

const readiness = computed(() => normalizeHeldOutSemanticStudyReadiness(props.readiness))

function formatId(value) {
  return typeof value === 'string'
    ? value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
    : 'Unavailable'
}

function statusClass(statusId) {
  return statusId === 'eligibility_audit_available' ? 'text-green-200' : 'text-amber-200'
}

function description(statusId) {
  if (statusId === 'eligibility_audit_available') {
    return 'The private eligibility audit may run when its normal lifecycle receipt changes. This is only a source prerequisite; it does not create a cohort, labels, a measured error profile, semantic selection, or routing.'
  }
  if (statusId === 'complete_declared_purpose_evidence_required') {
    return 'Normal lifecycle history exists, but no current policy has complete retained declared-purpose evidence. The platform will reassess automatically after ordinary authoring without using library profiles as a substitute.'
  }
  if (statusId === 'normal_lifecycle_receipt_required') {
    return 'No normal lifecycle receipt is available yet. The platform will reassess automatically after ordinary native authoring; it will not manufacture historical evidence or ask for a study action.'
  }
  return 'Classifarr cannot currently confirm the aggregate study prerequisite. It will remain deferred without selecting media, calling AI, or changing routing.'
}
</script>

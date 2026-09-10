<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
-->

<template>
  <section
    v-if="readiness"
    id="held-out-semantic-study-readiness"
    tabindex="-1"
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
      <div class="sm:col-span-2">
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Current measured condition
        </dt>
        <dd class="mt-1 font-semibold text-white">
          {{ formatId(readiness.measuredBlockerId) }}
        </dd>
        <p class="mt-1 max-w-3xl font-normal leading-6 text-gray-300">
          {{ measuredBlockerDescription(readiness.measuredBlockerId) }}
        </p>
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

function measuredBlockerDescription(blockerId) {
  if (blockerId === 'private_cohort_capture_ready') {
    return 'The automatic aggregate audit found enough balanced, policy-eligible cases for the existing controlled private-capture workflow. It has not selected media, retained a packet, called AI/RAG, created labels, or changed routing.'
  }
  if (blockerId === 'governed_declared_purpose_evidence_required') {
    return 'The current aggregate audit found that profile-derived purpose observations were excluded before policy-only comparison. A separately governed declared-purpose revision is required; the scheduler will reassess it without selecting media or changing routing.'
  }
  if (blockerId === 'await_qualifying_policy_evaluations') {
    return 'The current aggregate audit has no policy-only comparison yet. The platform remains deferred and will not choose cases, call semantic retrieval, or treat profile observations as policy authority.'
  }
  if (blockerId === 'await_balanced_eligible_cohort') {
    return 'The current aggregate audit has policy-only comparisons. A future balanced cohort check is still required before any capture, independent labels, frozen-study preflight, or semantic evaluation.'
  }
  if (blockerId === 'await_passive_eligibility_audit') {
    return 'Source prerequisites are present, but a current aggregate audit receipt is not available yet. The passive lifecycle scheduler owns the next check; this view will not start study work.'
  }
  if (blockerId === 'complete_declared_purpose_evidence_required') {
    return 'No current policy has complete retained declared-purpose evidence. Profile observations remain descriptive and cannot satisfy this prerequisite.'
  }
  if (blockerId === 'normal_lifecycle_receipt_required') {
    return 'A normal lifecycle receipt is still required. Classifarr will not manufacture historical policy evidence or ask this view to start a study.'
  }
  return 'Classifarr cannot currently confirm an aggregate next prerequisite. It will remain deferred without selecting media, calling AI, or changing routing.'
}
</script>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="receipt"
    class="border-b border-gray-700 bg-background/50 p-5"
    aria-labelledby="policy-purpose-lifecycle-receipt-heading"
  >
    <h3
      id="policy-purpose-lifecycle-receipt-heading"
      class="text-sm font-semibold"
      :class="statusClass(receipt.statusId)"
    >
      Normal policy purpose lifecycle: {{ formatId(receipt.statusId) }}
    </h3>
    <p class="mt-1 max-w-3xl text-sm leading-6 text-gray-300">
      {{ statusDescription(receipt.statusId) }}
    </p>
    <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Initial establishments
        </dt>
        <dd class="mt-1 text-white">
          {{ receipt.summary.initialIntentEstablishmentCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Normal changes
        </dt>
        <dd class="mt-1 text-white">
          {{ receipt.summary.nativeIntentChangeCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Retained-purpose receipts
        </dt>
        <dd class="mt-1 text-white">
          {{ receipt.summary.retainedPurposeReceiptCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Review or unverifiable
        </dt>
        <dd class="mt-1 text-white">
          {{ reviewOrUnverifiableReceiptCount }}
        </dd>
      </div>
    </dl>
    <p
      v-if="receipt.scope.truncated"
      class="mt-3 text-sm text-amber-100"
    >
      This receipt is limited to the most recent {{ receipt.scope.observedReceiptCount }} normal lifecycle records. It cannot verify the omitted history.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  normalizePolicyPurposeLifecycleProvenanceReceipt,
} from '@/utils/policyPurposeLifecycleProvenanceReceipt'

const props = defineProps({
  receipt: {
    type: Object,
    default: null,
  },
})

const receipt = computed(() => (
  normalizePolicyPurposeLifecycleProvenanceReceipt(props.receipt)
))
const reviewOrUnverifiableReceiptCount = computed(() => {
  if (!receipt.value) return 0

  return receipt.value.summary.profileOnlyPurposeReceiptCount +
    receipt.value.summary.noSpecializedPurposeReceiptCount +
    receipt.value.summary.unverifiableReceiptCount
})

function formatId(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function statusClass(statusId) {
  return statusId === 'declared_purpose_retained_for_observed_lifecycle_receipts' ||
    statusId === 'declared_purpose_retained_for_observed_initial_establishments'
    ? 'text-green-200'
    : 'text-amber-200'
}

function statusDescription(statusId) {
  if (statusId === 'declared_purpose_retained_for_observed_lifecycle_receipts') {
    return 'Every verifiable normal creation or change receipt in the complete observed history retained specialized declared purpose outside inferred library-profile evidence. This is provenance evidence only; it does not create a cohort, labels, semantic selection, or routing authority.'
  }
  if (statusId === 'declared_purpose_retained_for_observed_initial_establishments') {
    return 'Observed initial declared-intent establishments retained specialized purpose, but no normal policy change receipt is available yet. This does not create a cohort, labels, semantic selection, or routing authority.'
  }
  if (statusId === 'normal_lifecycle_receipt_verification_required') {
    return 'At least one receipt cannot be matched to its declared native-intent revision. Keep this provenance observation out of semantic study eligibility until the retained record can be verified.'
  }
  if (statusId === 'normal_lifecycle_history_truncated') {
    return 'The receipt window excludes older normal lifecycle records. Its aggregate counts may be useful context, but they cannot verify retention across the omitted history.'
  }
  if (statusId === 'purpose_retention_review_required') {
    return 'At least one verifiable normal lifecycle receipt is profile-only or has no specialized purpose. The result requests review only and cannot change a policy, classify media, or route an item.'
  }
  return 'No durable normal policy establishment or change receipt is available yet. This does not request an operator action or create semantic-study eligibility.'
}
</script>

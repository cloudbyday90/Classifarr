<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border border-blue-800/70 bg-blue-950/30 p-4 text-blue-100"
    aria-labelledby="policy-native-summary-title"
  >
    <p
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      Policy readiness: {{ readiness.label }}.
    </p>
    <h4
      id="policy-native-summary-title"
      class="font-semibold"
    >
      Native policy summary
    </h4>
    <p class="mt-1 text-sm text-blue-50">
      This destination uses stored native intent. Classifarr shows its declared purpose and current policy readiness without reopening policy setup.
    </p>

    <dl class="mt-4 grid gap-3 text-sm md:grid-cols-3">
      <div class="rounded border border-blue-800/70 bg-gray-900/30 p-3">
        <dt class="font-medium text-blue-200">
          Declared purpose
        </dt>
        <dd class="mt-2 text-blue-50">
          <ul
            v-if="purposeLines.length > 0"
            class="space-y-1"
          >
            <li
              v-for="purposeLine in purposeLines"
              :key="purposeLine"
            >
              {{ purposeLine }}
            </li>
          </ul>
          <span v-else>
            No display-safe declared purpose is available.
          </span>
        </dd>
      </div>

      <div class="rounded border border-blue-800/70 bg-gray-900/30 p-3">
        <dt class="font-medium text-blue-200">
          Current policy readiness
        </dt>
        <dd class="mt-2 text-blue-50">
          <p class="font-medium">
            {{ readiness.label }}
          </p>
          <p class="mt-1">
            {{ readiness.message }}
          </p>
        </dd>
      </div>

      <div class="rounded border border-blue-800/70 bg-gray-900/30 p-3">
        <dt class="font-medium text-blue-200">
          Next action
        </dt>
        <dd class="mt-2 text-blue-50">
          {{ readiness.nextActionLabel || 'No action is currently required.' }}
        </dd>
      </div>
    </dl>

    <PolicyNativeProfileRecoveryStatus :recovery="readiness.profileRecovery" />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  buildNativePolicyReadinessSummary,
  buildNativePurposeSummary,
} from '@/utils/policyNativePolicySummary'
import PolicyNativeProfileRecoveryStatus from '@/components/policies/PolicyNativeProfileRecoveryStatus.vue'

defineOptions({
  name: 'PolicyNativePolicySummary',
})

const props = defineProps({
  policy: {
    type: Object,
    required: true,
  },
  purposeChangeCommand: {
    type: Object,
    default: null,
  },
  readinessSummary: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

const purposeLines = computed(() => buildNativePurposeSummary(
  props.policy,
  props.purposeChangeCommand,
))
const readiness = computed(() => buildNativePolicyReadinessSummary({
  readinessSummary: props.readinessSummary,
  loading: props.loading,
  error: props.error,
}))
</script>

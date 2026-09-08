<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    v-if="inventory"
    class="border-b border-gray-700 bg-background/50 p-5"
    aria-labelledby="policy-purpose-evidence-inventory-heading"
  >
    <p
      id="policy-purpose-evidence-inventory-heading"
      class="text-sm font-semibold"
      :class="statusClass(inventory.statusId)"
      role="status"
      aria-live="polite"
    >
      Library-agnostic policy evidence: {{ formatId(inventory.statusId) }}
    </p>
    <p class="mt-1 max-w-3xl text-sm leading-6 text-gray-300">
      {{ description(inventory.statusId) }}
    </p>
    <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Active authoritative policies
        </dt>
        <dd class="mt-1 text-white">
          {{ inventory.authoritativeActiveNativePolicyCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Current intent versions
        </dt>
        <dd class="mt-1 text-white">
          {{ inventory.currentIntentVersionPolicyCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Current intent schemas
        </dt>
        <dd class="mt-1 text-white">
          {{ inventory.currentIntentSchemaVersionPolicyCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Retained declared purposes
        </dt>
        <dd class="mt-1 text-white">
          {{ inventory.retainedDeclaredPurposePolicyCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Verifiable lifecycle records
        </dt>
        <dd class="mt-1 text-white">
          {{ inventory.verifiableLifecycleReceiptPolicyCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Current-intent lifecycle records
        </dt>
        <dd class="mt-1 text-white">
          {{ inventory.currentIntentLifecycleReceiptPolicyCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Complete evidence records
        </dt>
        <dd class="mt-1 text-white">
          {{ inventory.completePolicyEvidenceCount }}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-gray-400">
          Incomplete evidence records
        </dt>
        <dd class="mt-1 text-white">
          {{ inventory.incompletePolicyEvidenceCount }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  normalizePolicyPurposeEvidenceInventory,
} from '@/utils/policyPurposeEvidenceInventory'

const props = defineProps({
  inventory: {
    type: Object,
    default: null,
  },
})

const inventory = computed(() => normalizePolicyPurposeEvidenceInventory(props.inventory))

function formatId(value) {
  return typeof value === 'string'
    ? value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
    : 'Unavailable'
}

function statusClass(statusId) {
  return statusId === 'complete_policy_evidence_available'
    ? 'text-green-200'
    : 'text-amber-200'
}

function description(statusId) {
  if (statusId === 'complete_policy_evidence_available') {
    return 'At least one active authoritative native policy has a current intent and schema, a retained declared purpose, and a matching normal lifecycle record. This inventory does not establish semantic correctness, select a study cohort, label media, or change routing.'
  }
  if (statusId === 'policy_evidence_incomplete') {
    return 'Current policy evidence is incomplete. The platform will reassess passively after normal authoring. This inventory uses no library identity, configuration, rule values, media, profiles, history, AI, or routing data.'
  }
  return 'No active authoritative native policy is available for the inventory. This read-only view does not inspect library configuration, select media, or change routing.'
}
</script>

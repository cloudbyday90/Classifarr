<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          Library Policies
        </h1>
        <p class="text-gray-400 text-sm mt-1">
          Configure policies with presets to classify your media
        </p>
      </div>
      <RouterLink
        to="/policies/native-intent-reconciliation"
        class="rounded border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:border-primary hover:text-white"
      >
        Native intent status
      </RouterLink>
    </div>

    <div
      v-if="policyIntentWritePreflightNotice"
      :class="[
        'rounded-lg border p-4 text-sm',
        policyIntentWritePreflightNotice.tone === 'error'
          ? 'border-red-500/40 bg-red-900/20 text-red-100'
          : policyIntentWritePreflightNotice.tone === 'success'
            ? 'border-green-500/40 bg-green-900/20 text-green-100'
            : 'border-blue-500/40 bg-blue-900/20 text-blue-100'
      ]"
      role="status"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="font-semibold">
            {{ policyIntentWritePreflightNotice.title }}
          </div>
          <p class="mt-1 text-gray-200">
            {{ policyIntentWritePreflightNotice.message }}
          </p>
        </div>
        <button
          type="button"
          class="text-xs text-gray-300 hover:text-white"
          @click="clearPolicyIntentWritePreflightNotice"
        >
          Dismiss
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="text-center py-12 text-gray-400"
    >
      Loading policies...
    </div>

    <div
      v-else-if="Object.keys(librariesWithPolicies).length === 0"
      class="text-center py-12"
    >
      <div class="text-gray-400 mb-4">
        No policies found. Create one to get started.
      </div>
    </div>

    <div
      v-else
      class="space-y-8"
    >
      <div
        v-for="(library, libraryId) in librariesWithPolicies"
        :key="libraryId"
        class="space-y-4"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">
            {{ library.name }}
          </h2>
        </div>
        
        <div class="grid grid-cols-1 gap-4">
          <PolicyCard 
            v-for="policy in library.policies" 
            :key="policy.id"
            :policy="policy"
            @configure="editPolicy"
            @delete="confirmReset"
          />
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <PolicyBuilderModal 
      v-if="showCreateModal || editingPolicy"
      v-model="showModal"
      :policy="editingPolicy"
      :library-id="selectedLibraryId"
      :submit-policy="savePolicy"
      @close="closeModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import PolicyCard from '@/components/policies/PolicyCard.vue'
import PolicyBuilderModal from '@/components/policies/PolicyBuilderModal.vue'
import {
  buildPolicyIntentWritePreflightNotice,
  normalizePolicyIntentWritePreflight,
} from '@/utils/policyIntentWritePreflight'

const loading = ref(false)
const policies = ref([])
const libraries = ref([])
const showCreateModal = ref(false)
const editingPolicy = ref(null)
const selectedLibraryId = ref(null)
const lastPolicyIntentWritePreflight = ref(null)

const policyIntentWritePreflightNotice = computed(() => (
  buildPolicyIntentWritePreflightNotice(lastPolicyIntentWritePreflight.value)
))

const showModal = computed({
  get: () => showCreateModal.value || !!editingPolicy.value,
  set: (val) => {
    if (!val) {
      closeModal()
    }
  }
})

const librariesWithPolicies = computed(() => {
  const grouped = {}
  
  policies.value.forEach(policy => {
    const library = libraries.value.find(l => l.id === policy.library_id) || { name: policy.library_name || 'Unknown' }
    
    if (!grouped[policy.library_id]) {
      grouped[policy.library_id] = {
        name: library.name,
        policies: []
      }
    }
    grouped[policy.library_id].policies.push(policy)
  })
  
  return grouped
})

onMounted(async () => {
  await Promise.all([
    fetchLibraries(),
    fetchPolicies()
  ])
})

const fetchPolicies = async () => {
  loading.value = true
  try {
    policies.value = await api.getPolicies()
  } catch (error) {
    console.error('Failed to fetch policies:', error)
    alert('Failed to load policies: ' + error.message)
  } finally {
    loading.value = false
  }
}

const fetchLibraries = async () => {
  try {
    libraries.value = await api.getLibraries()
  } catch (error) {
    console.error('Failed to fetch libraries:', error)
  }
}

const editPolicy = async (policy) => {
  try {
    // Fetch full policy details with presets
    editingPolicy.value = await api.getPolicy(policy.id)
    selectedLibraryId.value = policy.library_id
    showCreateModal.value = false
  } catch (error) {
    console.error('Failed to fetch policy details:', error)
    alert('Failed to load policy details: ' + error.message)
  }
}

const savePolicy = async (policyData, writeOptions) => {
  let response
  const nativeCreate = !editingPolicy.value && policyData?.native_intent_establishment !== undefined

  if (editingPolicy.value) {
    response = await api.updatePolicy(editingPolicy.value.id, policyData)
  } else {
    response = await api.createPolicy(policyData, writeOptions)
  }

  lastPolicyIntentWritePreflight.value = normalizePolicyIntentWritePreflight(
    response?.data?.policy_intent_write_preflight
  )

  await fetchPolicies()
  if (!nativeCreate) {
    closeModal()
  }

  return response
}

const confirmReset = async (policy) => {
  if (!confirm(`Are you sure you want to RESET the policy for "${policy.library_name || 'this library'}"?\n\nThis will remove all presets and restore default configuration.`)) {
    return
  }
  
  try {
    // Delete effectively resets it now due to backend logic
    await api.deletePolicy(policy.id)
    await fetchPolicies()
  } catch (error) {
    console.error('Failed to reset policy:', error)
    alert('Failed to reset policy: ' + error.message)
  }
}

const closeModal = () => {
  showCreateModal.value = false
  editingPolicy.value = null
  selectedLibraryId.value = null
}

const clearPolicyIntentWritePreflightNotice = () => {
  lastPolicyIntentWritePreflight.value = null
}
</script>

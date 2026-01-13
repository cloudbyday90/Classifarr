<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Library Policies</h1>
      <p class="text-gray-400 text-sm mt-1">
        Configure policies with presets to classify your media
      </p>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">
      Loading policies...
    </div>

    <div v-else-if="Object.keys(librariesWithPolicies).length === 0" class="text-center py-12">
      <div class="text-gray-400 mb-4">No policies found. Create one to get started.</div>
    </div>

    <div v-else class="space-y-8">
      <div v-for="(library, libraryId) in librariesWithPolicies" :key="libraryId" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">{{ library.name }}</h2>
        </div>
        
        <div class="grid grid-cols-1 gap-4">
          <PolicyCard 
            v-for="policy in library.policies" 
            :key="policy.id"
            :policy="policy"
            @edit="editPolicy"
            @delete="confirmReset"
            @add-presets="openPresetSelector"
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
      @save="savePolicy"
      @close="closeModal"
    />

    <!-- Preset Selection Modal -->
    <PresetSelectionModal
      v-if="showPresetSelector"
      v-model="showPresetSelector"
      :library="selectorLibrary"
      :existing-preset-ids="existingPresetSelectorIds"
      @confirm="addPresetsToPolicy"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import Button from '@/components/common/Button.vue'
import PolicyCard from '@/components/policies/PolicyCard.vue'
import PolicyBuilderModal from '@/components/policies/PolicyBuilderModal.vue'
import PresetSelectionModal from '@/components/policies/PresetSelectionModal.vue'

const loading = ref(false)
const policies = ref([])
const libraries = ref([])
const showCreateModal = ref(false)
const editingPolicy = ref(null)
const selectedLibraryId = ref(null)

// Preset Selector State
const showPresetSelector = ref(false)
const selectorPolicy = ref(null)
const selectorLibrary = ref(null)
const existingPresetSelectorIds = computed(() => {
  if (!selectorPolicy.value?.presets) return []
  return selectorPolicy.value.presets.map(p => p.id || p.preset_id)
})

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
    const response = await api.get('/policies')
    policies.value = response.data
  } catch (error) {
    console.error('Failed to fetch policies:', error)
    alert('Failed to load policies: ' + error.message)
  } finally {
    loading.value = false
  }
}

const fetchLibraries = async () => {
  try {
    const response = await api.get('/libraries')
    libraries.value = response.data
  } catch (error) {
    console.error('Failed to fetch libraries:', error)
  }
}

const createPolicyForLibrary = (libraryId) => {
  selectedLibraryId.value = libraryId
  editingPolicy.value = null
  showCreateModal.value = true
}

const editPolicy = async (policy) => {
  try {
    // Fetch full policy details with presets
    const response = await api.get(`/policies/${policy.id}`)
    editingPolicy.value = response.data
    selectedLibraryId.value = policy.library_id
    showCreateModal.value = false
  } catch (error) {
    console.error('Failed to fetch policy details:', error)
    alert('Failed to load policy details: ' + error.message)
  }
}

const savePolicy = async (policyData) => {
  try {
    if (editingPolicy.value) {
      // Update existing policy
      await api.put(`/policies/${editingPolicy.value.id}`, policyData)
    } else {
      // Create new policy
      await api.post('/policies', policyData)
    }
    
    await fetchPolicies()
    closeModal()
  } catch (error) {
    console.error('Failed to save policy:', error)
    throw error
  }
}

const confirmReset = async (policy) => {
  if (!confirm(`Are you sure you want to RESET the policy for "${policy.library_name || 'this library'}"?\n\nThis will remove all presets and restore default configuration.`)) {
    return
  }
  
  try {
    // Delete effectively resets it now due to backend logic
    await api.delete(`/policies/${policy.id}`)
    await fetchPolicies()
  } catch (error) {
    console.error('Failed to reset policy:', error)
    alert('Failed to reset policy: ' + error.message)
  }
}

const openPresetSelector = async (policy) => {
  try {
    // Fetch full policy to get current presets list for exclusion/checking
    const response = await api.get(`/policies/${policy.id}`)
    selectorPolicy.value = response.data
    selectorLibrary.value = libraries.value.find(l => l.id === policy.library_id) || { id: policy.library_id, name: policy.library_name }
    showPresetSelector.value = true
  } catch (error) {
    console.error('Failed to open preset selector:', error)
    alert('Failed to load policy details: ' + error.message)
  }
}

const addPresetsToPolicy = async (selectedPresets) => {
  if (!selectorPolicy.value || !selectedPresets.length) return
  
  try {
    // We need to add these presets to the policy. 
    // Since we don't have a direct "add presets" endpoint for bulk add without fetching full policy,
    // we should iterate and add them, OR reuse the update policy logic.
    // The cleanest way is to use POST /api/policies/:id/presets for each.
    
    // However, sending multiple requests might be slow.
    // But typically user selects < 10.
    
    const promises = selectedPresets.map(preset => 
      api.post(`/policies/${selectorPolicy.value.id}/presets`, {
        preset_id: preset.id,
        weight: 1.0 // Default weight
      })
    )
    
    await Promise.all(promises)
    await fetchPolicies()
    showPresetSelector.value = false
  } catch (error) {
    console.error('Failed to add presets:', error)
    alert('Failed to add presets: ' + error.message)
  }
}

const closeModal = () => {
  showCreateModal.value = false
  editingPolicy.value = null
  selectedLibraryId.value = null
}
</script>

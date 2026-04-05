<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Library Policies</h1>
        <p class="text-gray-400 text-sm mt-1">
          Configure policies with presets to classify your media
        </p>
      </div>
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
      @save="savePolicy"
      @close="closeModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import PolicyCard from '@/components/policies/PolicyCard.vue'
import PolicyBuilderModal from '@/components/policies/PolicyBuilderModal.vue'

const loading = ref(false)
const policies = ref([])
const libraries = ref([])
const showCreateModal = ref(false)
const editingPolicy = ref(null)
const selectedLibraryId = ref(null)

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
    policies.value = await api.getData('/policies')
  } catch (error) {
    console.error('Failed to fetch policies:', error)
    alert('Failed to load policies: ' + error.message)
  } finally {
    loading.value = false
  }
}

const fetchLibraries = async () => {
  try {
    libraries.value = await api.getData('/libraries')
  } catch (error) {
    console.error('Failed to fetch libraries:', error)
  }
}

const editPolicy = async (policy) => {
  try {
    // Fetch full policy details with presets
    editingPolicy.value = await api.getData(`/policies/${policy.id}`)
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

const closeModal = () => {
  showCreateModal.value = false
  editingPolicy.value = null
  selectedLibraryId.value = null
}
</script>

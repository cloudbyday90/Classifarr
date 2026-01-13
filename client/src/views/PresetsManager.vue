<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold mb-2">Presets Manager</h1>
      <p class="text-gray-400">
        Browse system presets or create your own custom classification presets
      </p>
    </div>

    <!-- Search and Filter Bar -->
    <div class="flex gap-4">
      <div class="flex-1">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search presets..."
          class="w-full px-4 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none text-white placeholder-gray-500"
        />
      </div>
      <select
        v-model="categoryFilter"
        class="px-4 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none text-white"
      >
        <option value="">All Categories</option>
        <option v-for="category in categories" :key="category" :value="category">
          {{ formatCategory(category) }}
        </option>
      </select>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab" :tabs="tabs">
      <!-- System Presets Tab -->
      <template #system>
        <div v-if="loadingSystem" class="flex justify-center py-12">
          <Spinner />
        </div>
        <div v-else-if="errorSystem" class="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400">
          {{ errorSystem }}
        </div>
        <div v-else-if="filteredSystemPresets.length === 0" class="text-center py-12 text-gray-400">
          No system presets found matching your criteria
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PresetCard
            v-for="preset in filteredSystemPresets"
            :key="preset.id"
            :preset="preset"
            :readonly="true"
          />
        </div>
      </template>

      <!-- Custom Presets Tab -->
      <template #custom>
        <div class="mb-4">
          <Button variant="primary" @click="openCreateModal">
            <PlusCircleIcon class="w-5 h-5 mr-2" />
            Create New Preset
          </Button>
        </div>

        <div v-if="loadingCustom" class="flex justify-center py-12">
          <Spinner />
        </div>
        <div v-else-if="errorCustom" class="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400">
          {{ errorCustom }}
        </div>
        <div v-else-if="filteredCustomPresets.length === 0" class="text-center py-12 text-gray-400">
          <div class="mb-4">
            {{ searchQuery || categoryFilter ? 'No custom presets found matching your criteria' : 'No custom presets yet' }}
          </div>
          <div v-if="!searchQuery && !categoryFilter" class="text-sm">
            Create your first custom preset to get started
          </div>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PresetCard
            v-for="preset in filteredCustomPresets"
            :key="preset.id"
            :preset="preset"
            :readonly="false"
            @edit="openEditModal"
            @delete="confirmDelete"
          />
        </div>
      </template>
    </Tabs>

    <!-- Custom Preset Form Modal -->
    <CustomPresetForm
      v-model="showPresetForm"
      :preset="editingPreset"
      @save="handleSavePreset"
    />

    <!-- Delete Confirmation Modal -->
    <Modal v-model="showDeleteConfirm" title="Delete Custom Preset">
      <p class="text-gray-300">
        Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>?
        This action cannot be undone.
      </p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="ghost" @click="showDeleteConfirm = false">Cancel</Button>
          <Button variant="error" @click="handleDelete" :loading="deleting">Delete</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { PlusCircleIcon } from '@heroicons/vue/24/outline'
import Tabs from '@/components/common/Tabs.vue'
import Button from '@/components/common/Button.vue'
import Spinner from '@/components/common/Spinner.vue'
import Modal from '@/components/common/Modal.vue'
import CustomPresetForm from '@/components/presets/CustomPresetForm.vue'
import PresetCard from '@/components/presets/PresetCard.vue'

const activeTab = ref('system')
const searchQuery = ref('')
const categoryFilter = ref('')

const tabs = [
  { id: 'system', label: 'System Presets', icon: '📋' },
  { id: 'custom', label: 'Custom Presets', icon: '⚙️' }
]

// System Presets State
const systemPresets = ref([])
const loadingSystem = ref(false)
const errorSystem = ref('')

// Custom Presets State
const customPresets = ref([])
const loadingCustom = ref(false)
const errorCustom = ref('')

// Modal State
const showPresetForm = ref(false)
const editingPreset = ref(null)
const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

// Categories
const categories = computed(() => {
  const allPresets = activeTab.value === 'system' ? systemPresets.value : customPresets.value
  const cats = new Set(allPresets.map(p => p.category).filter(Boolean))
  return Array.from(cats).sort()
})

// Filtered Presets
const filteredSystemPresets = computed(() => {
  return filterPresets(systemPresets.value)
})

const filteredCustomPresets = computed(() => {
  return filterPresets(customPresets.value)
})

function filterPresets(presets) {
  let filtered = presets

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    )
  }

  if (categoryFilter.value) {
    filtered = filtered.filter(p => p.category === categoryFilter.value)
  }

  return filtered
}

function formatCategory(category) {
  if (!category) return 'Unknown'
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Fetch System Presets
async function fetchSystemPresets() {
  loadingSystem.value = true
  errorSystem.value = ''
  try {
    const response = await fetch('/api/policies/presets/all')
    if (!response.ok) throw new Error('Failed to fetch system presets')
    systemPresets.value = await response.json()
  } catch (error) {
    console.error('Error fetching system presets:', error)
    errorSystem.value = error.message
  } finally {
    loadingSystem.value = false
  }
}

// Fetch Custom Presets
async function fetchCustomPresets() {
  loadingCustom.value = true
  errorCustom.value = ''
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch('/api/presets/custom', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    if (!response.ok) throw new Error('Failed to fetch custom presets')
    customPresets.value = await response.json()
  } catch (error) {
    console.error('Error fetching custom presets:', error)
    errorCustom.value = error.message
  } finally {
    loadingCustom.value = false
  }
}

// Modal Handlers
function openCreateModal() {
  editingPreset.value = null
  showPresetForm.value = true
}

function openEditModal(preset) {
  editingPreset.value = preset
  showPresetForm.value = true
}

function confirmDelete(preset) {
  deleteTarget.value = preset
  showDeleteConfirm.value = true
}

async function handleSavePreset(presetData) {
  try {
    const token = localStorage.getItem('auth_token')
    const isEditing = !!editingPreset.value?.id
    
    const url = isEditing 
      ? `/api/presets/custom/${editingPreset.value.id}`
      : '/api/presets/custom'
    
    const method = isEditing ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(presetData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save preset')
    }

    // Refresh custom presets list
    await fetchCustomPresets()
    
    // Close modal
    showPresetForm.value = false
    editingPreset.value = null
  } catch (error) {
    console.error('Error saving preset:', error)
    throw error // Let the form handle the error display
  }
}

async function handleDelete() {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`/api/presets/custom/${deleteTarget.value.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete preset')
    }

    // Refresh custom presets list
    await fetchCustomPresets()
    
    // Close modal
    showDeleteConfirm.value = false
    deleteTarget.value = null
  } catch (error) {
    console.error('Error deleting preset:', error)
    errorCustom.value = error.message
  } finally {
    deleting.value = false
  }
}

// Load data on mount
onMounted(() => {
  fetchSystemPresets()
  fetchCustomPresets()
})
</script>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold mb-2">
        Presets Manager
      </h1>
      <p class="text-gray-400">
        Browse built-in presets or create your own reusable presets for policy attachment
      </p>
    </div>

    <div
      v-if="presetSaveNeedsReview && !showPresetForm"
      class="rounded-lg border border-amber-600 p-4 space-y-3"
    >
      <p role="status">
        {{ presetSaveError }}
      </p>
      <Button
        :loading="savingPreset"
        @click="reviewSavedPresets"
      >
        Check save status
      </Button>
    </div>
    <p
      v-if="presetSaveNotice && !showPresetForm"
      role="status"
    >
      {{ presetSaveNotice }}
    </p>
    <p
      v-if="savingPreset && !showPresetForm"
      role="status"
    >
      Checking save status…
    </p>

    <!-- Search and Filter Bar -->
    <div class="flex gap-4">
      <div class="flex-1">
        <label
          for="preset-search"
          class="sr-only"
        >Search presets</label>
        <input
          id="preset-search"
          ref="presetSearchRef"
          v-model="searchQuery"
          type="text"
          placeholder="Search presets..."
          class="w-full px-4 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-hidden text-white placeholder-gray-500"
        >
      </div>
      <div>
        <label
          for="category-filter"
          class="sr-only"
        >Filter by category</label>
        <select
          id="category-filter"
          v-model="categoryFilter"
          class="px-4 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-hidden text-white"
        >
          <option value="">
            All Categories
          </option>
          <option
            v-for="category in categories"
            :key="category"
            :value="category"
          >
            {{ formatCategory(category) }}
          </option>
        </select>
      </div>
    </div>

    <!-- Tabs -->
    <Tabs
      v-model="activeTab"
      :tabs="tabs"
      label="Preset types"
    >
      <!-- Built-in Presets Tab -->
      <template #system>
        <div
          v-if="loadingSystem"
          class="flex justify-center py-12"
        >
          <Spinner />
        </div>
        <div
          v-else-if="errorSystem"
          class="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400"
        >
          {{ errorSystem }}
        </div>
        <div
          v-else-if="filteredSystemPresets.length === 0"
          class="text-center py-12 text-gray-400"
        >
          No built-in presets found matching your criteria
        </div>
        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <PresetCard
            v-for="preset in filteredSystemPresets"
            :key="preset.id"
            :preset="preset"
            :readonly="true"
            @view="openViewModal"
          />
        </div>
      </template>

      <!-- My Presets Tab -->
      <template #custom>
        <div class="mb-4">
          <Button
            variant="primary"
            :disabled="savingPreset"
            @click="openCreateModal"
          >
            <PlusCircleIcon class="w-5 h-5 mr-2" />
            Create New Preset
          </Button>
        </div>

        <div
          v-if="loadingCustom"
          class="flex justify-center py-12"
        >
          <Spinner />
        </div>
        <div
          v-else-if="errorCustom"
          class="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400"
        >
          {{ errorCustom }}
        </div>
        <div
          v-else-if="filteredCustomPresets.length === 0"
          class="text-center py-12 text-gray-400"
        >
          <div class="mb-4">
            {{ searchQuery || categoryFilter ? 'No saved presets found matching your criteria' : 'No saved presets yet' }}
          </div>
          <div
            v-if="!searchQuery && !categoryFilter"
            class="text-sm"
          >
            Create your first preset to get started
          </div>
        </div>
        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
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
      v-model="presetFormOpen"
      :preset="editingPreset"
      :source-preset="customizingPreset"
      :readonly="isFormReadonly"
      :saving="savingPreset"
      :save-error="presetSaveError"
      :save-notice="presetSaveNotice"
      :save-needs-review="presetSaveNeedsReview"
      :review-label="isCreationReview() ? 'Check save status' : 'Check saved presets'"
      :busy-label="isCreationReview() ? 'Checking save status…' : 'Saving preset…'"
      :fallback-focus-target="() => presetSearchRef"
      @save="handleSavePreset"
      @review-saved="reviewSavedPresets"
    />

    <!-- Preset Summary Modal (for system presets) -->
    <PresetSummaryModal
      v-model="showSummaryModal"
      :preset="viewingPreset"
      :fallback-focus-target="() => presetSearchRef"
      @customize="handleCustomize"
    />

    <!-- Delete Confirmation Modal -->
    <Modal
      v-model="showDeleteConfirm"
      title="Delete Custom Preset"
      :close-disabled="deleting"
      :fallback-focus-target="() => presetSearchRef"
    >
      <p class="text-gray-300">
        Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>?
        This action cannot be undone.
      </p>
      <p
        v-if="deleteError"
        role="alert"
        class="mt-4 rounded-lg border border-red-700 bg-red-900/20 p-3 text-sm text-red-400"
      >
        {{ deleteError }}
      </p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button
            variant="ghost"
            :disabled="deleting"
            @click="showDeleteConfirm = false"
          >
            Cancel
          </Button>
          <Button
            variant="error"
            :loading="deleting"
            @click="handleDelete"
          >
            Delete
          </Button>
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
import PresetSummaryModal from '@/components/presets/PresetSummaryModal.vue'
import PresetCard from '@/components/presets/PresetCard.vue'
import presetsApi from '@/api/presets'
import { useToast } from '@/stores/toast'
import { usePresetSave } from '@/composables/usePresetSave'

const toast = useToast()
const presetSearchRef = ref(null)

const activeTab = ref('system')
const searchQuery = ref('')
const categoryFilter = ref('')

const tabs = [
  { id: 'system', label: 'Built-in Presets', icon: '📋' },
  { id: 'custom', label: 'My Presets', icon: '⚙️' }
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
const showSummaryModal = ref(false)
const viewingPreset = ref(null)
const customizingPreset = ref(null)
const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const deleteError = ref('')
const { pending: savingPreset, error: presetSaveError, needsReview: presetSaveNeedsReview,
  notice: presetSaveNotice, reset: resetPresetSave, save: savePreset, initialize: initializePresetSave,
  reviewCreation, isCreationReview } = usePresetSave(presetsApi)
const presetFormOpen = computed({
  get: () => showPresetForm.value,
  set: value => { if (!savingPreset.value) showPresetForm.value = value },
})

// Categories - combined from both system and custom presets
const categories = computed(() => {
  const allPresets = [...systemPresets.value, ...customPresets.value]
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
  if (!category) return 'General'
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
    systemPresets.value = await presetsApi.getSystemPresets()
  } catch (error) {
    console.error('Error fetching system presets:', error)
    errorSystem.value = error.response?.data?.error || error.message
  } finally {
    loadingSystem.value = false
  }
}

// Fetch Custom Presets
async function fetchCustomPresets() {
  loadingCustom.value = true
  errorCustom.value = ''
  try {
    customPresets.value = await presetsApi.getCustomPresets()
    return true
  } catch {
    errorCustom.value = 'Could not load saved presets. Try again.'
    return false
  } finally {
    loadingCustom.value = false
  }
}

const isFormReadonly = ref(false)

// Modal Handlers
function openCreateModal() {
  if (savingPreset.value) return
  resetPresetSave()
  editingPreset.value = null
  customizingPreset.value = null
  isFormReadonly.value = false
  showPresetForm.value = true
}

function openEditModal(preset) {
  if (savingPreset.value) return
  resetPresetSave()
  editingPreset.value = preset
  customizingPreset.value = null
  isFormReadonly.value = false
  showPresetForm.value = true
}

function openViewModal(preset) {
  viewingPreset.value = preset
  showSummaryModal.value = true
}

function handleCustomize(preset) {
  if (savingPreset.value) return
  resetPresetSave()
  // Close summary modal
  showSummaryModal.value = false
  viewingPreset.value = null
  
  // Open form with sourcePreset for customization
  editingPreset.value = null
  customizingPreset.value = preset
  isFormReadonly.value = false
  showPresetForm.value = true
}

function confirmDelete(preset) {
  if (deleting.value) return
  deleteError.value = ''
  deleteTarget.value = preset
  showDeleteConfirm.value = true
}

async function handleSavePreset(presetData) {
  if (!showPresetForm.value || isFormReadonly.value) return
  const isCustomizing = !!customizingPreset.value
  if (!await savePreset(presetData, editingPreset.value?.id)) return
  showPresetForm.value = false
  editingPreset.value = null
  customizingPreset.value = null
  activeTab.value = 'custom'
  if (isCustomizing) toast.success(`Custom preset '${presetData.name}' created!`)
  // An acknowledged save stays successful even if this separate read fails.
  await fetchCustomPresets()
}

async function reviewSavedPresets() {
  if (savingPreset.value) return
  if (isCreationReview()) {
    const outcome = await reviewCreation()
    if (!outcome) return
    if (outcome === 'saved') showPresetForm.value = false
    activeTab.value = 'custom'
    searchQuery.value = ''
    categoryFilter.value = ''
    await fetchCustomPresets()
    return
  }
  showPresetForm.value = false
  activeTab.value = 'custom'
  searchQuery.value = ''
  categoryFilter.value = ''
  if (await fetchCustomPresets()) resetPresetSave({ reviewed: true })
}

async function handleDelete() {
  if (!deleteTarget.value || deleting.value) return
  
  deleting.value = true
  deleteError.value = ''
  try {
    await presetsApi.deleteCustomPreset(deleteTarget.value.id)

    // Refresh custom presets list
    await fetchCustomPresets()
    
    // Close modal
    showDeleteConfirm.value = false
    deleteTarget.value = null
  } catch {
    deleteError.value = 'Could not delete this preset. Try again.'
  } finally {
    deleting.value = false
  }
}

// Load data on mount
onMounted(() => {
  initializePresetSave()
  fetchSystemPresets()
  fetchCustomPresets()
})
</script>

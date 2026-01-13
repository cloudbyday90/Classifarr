<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Presets Manager</h1>
        <p class="text-gray-400 text-sm mt-1">
          Manage content classification presets for your policies
        </p>
      </div>
      <Button 
        v-if="activeTab === 'custom'"
        variant="primary" 
        icon="+"
        @click="openCreateModal"
      >
        Create Custom Preset
      </Button>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab" :tabs="tabs">
      <!-- System Presets Tab -->
      <template #system>
        <div v-if="loadingSystem" class="text-center py-12 text-gray-400">
          Loading system presets...
        </div>
        
        <div v-else>
          <!-- Search -->
          <div class="mb-4">
            <input
              v-model="systemSearch"
              type="search"
              placeholder="Search system presets..."
              class="w-full max-w-md px-4 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
            />
          </div>

          <!-- Category Filter -->
          <div class="flex flex-wrap gap-2 mb-6">
            <button
              v-for="cat in systemCategories"
              :key="cat"
              @click="systemCategoryFilter = cat"
              class="px-3 py-1.5 text-sm rounded-lg transition-colors"
              :class="systemCategoryFilter === cat 
                ? 'bg-primary text-white' 
                : 'bg-background-light text-gray-300 hover:bg-gray-700'"
            >
              {{ cat }}
            </button>
          </div>

          <!-- System Presets Grid -->
          <div v-if="filteredSystemPresets.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="preset in filteredSystemPresets"
              :key="preset.id"
              class="preset-card border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-all bg-background-light"
            >
              <div class="flex items-start gap-3">
                <div class="text-3xl">{{ preset.icon || '📦' }}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold truncate">{{ preset.name }}</h3>
                    <Badge v-if="preset.category" variant="default" size="sm">
                      {{ preset.category }}
                    </Badge>
                  </div>
                  <p class="text-sm text-gray-400 line-clamp-2">{{ preset.description }}</p>
                  
                  <!-- Signal Summary -->
                  <div class="mt-3 text-xs text-gray-500 space-y-1">
                    <div v-if="preset.signals?.certifications">
                      🔞 {{ formatCertifications(preset.signals.certifications) }}
                    </div>
                    <div v-if="preset.signals?.genres">
                      🎭 {{ formatGenres(preset.signals.genres) }}
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="mt-3 pt-3 border-t border-gray-700">
                <div class="text-xs text-gray-500">
                  <span class="font-medium">Read-only</span> · System preset
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-12 text-gray-400">
            No system presets found matching your search
          </div>
        </div>
      </template>

      <!-- Custom Presets Tab -->
      <template #custom>
        <div v-if="loadingCustom" class="text-center py-12 text-gray-400">
          Loading custom presets...
        </div>
        
        <div v-else>
          <!-- Search -->
          <div class="mb-4">
            <input
              v-model="customSearch"
              type="search"
              placeholder="Search custom presets..."
              class="w-full max-w-md px-4 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
            />
          </div>

          <!-- Custom Presets Grid -->
          <div v-if="filteredCustomPresets.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="preset in filteredCustomPresets"
              :key="preset.id"
              class="preset-card border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-all bg-background-light"
            >
              <div class="flex items-start gap-3">
                <div class="text-3xl">{{ preset.icon || '📦' }}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold truncate">{{ preset.name }}</h3>
                    <Badge v-if="preset.category" variant="default" size="sm">
                      {{ preset.category }}
                    </Badge>
                  </div>
                  <p class="text-sm text-gray-400 line-clamp-2">{{ preset.description || 'No description' }}</p>
                  
                  <!-- Signal Summary -->
                  <div class="mt-3 text-xs text-gray-500 space-y-1">
                    <div v-if="preset.signals?.certifications">
                      🔞 {{ formatCertifications(preset.signals.certifications) }}
                    </div>
                    <div v-if="preset.signals?.genres">
                      🎭 {{ formatGenres(preset.signals.genres) }}
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                <div class="text-xs text-gray-500">
                  Created {{ formatDate(preset.created_at) }}
                </div>
                <div class="flex gap-2">
                  <button
                    @click="editPreset(preset)"
                    class="px-3 py-1.5 text-sm bg-primary hover:bg-primary-dark text-white rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    @click="confirmDelete(preset)"
                    class="px-3 py-1.5 text-sm bg-red-900/50 hover:bg-red-900 text-red-200 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-12 text-gray-400">
            <div class="mb-4">
              {{ customSearch ? 'No custom presets found matching your search' : 'No custom presets yet' }}
            </div>
            <Button v-if="!customSearch" variant="primary" @click="openCreateModal">
              Create Your First Custom Preset
            </Button>
          </div>
        </div>
      </template>
    </Tabs>

    <!-- Custom Preset Form Modal -->
    <CustomPresetForm
      v-model="showPresetForm"
      :preset="editingPreset"
      @save="savePreset"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import Tabs from '@/components/common/Tabs.vue'
import CustomPresetForm from '@/components/presets/CustomPresetForm.vue'

const activeTab = ref('system')
const loadingSystem = ref(false)
const loadingCustom = ref(false)
const systemPresets = ref([])
const customPresets = ref([])
const systemSearch = ref('')
const customSearch = ref('')
const systemCategoryFilter = ref('all')
const showPresetForm = ref(false)
const editingPreset = ref(null)

const tabs = computed(() => [
  { 
    id: 'system', 
    label: 'System Presets', 
    icon: '📋',
    badge: systemPresets.value.length 
  },
  { 
    id: 'custom', 
    label: 'Custom Presets', 
    icon: '✨',
    badge: customPresets.value.length 
  }
])

const systemCategories = computed(() => {
  const cats = new Set(['all'])
  systemPresets.value.forEach(p => {
    if (p.category) cats.add(p.category)
  })
  return Array.from(cats)
})

const filteredSystemPresets = computed(() => {
  let presets = systemPresets.value

  // Filter by category
  if (systemCategoryFilter.value !== 'all') {
    presets = presets.filter(p => p.category === systemCategoryFilter.value)
  }

  // Filter by search
  if (systemSearch.value) {
    const query = systemSearch.value.toLowerCase()
    presets = presets.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    )
  }

  return presets
})

const filteredCustomPresets = computed(() => {
  let presets = customPresets.value

  // Filter by search
  if (customSearch.value) {
    const query = customSearch.value.toLowerCase()
    presets = presets.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    )
  }

  return presets
})

onMounted(() => {
  loadSystemPresets()
  loadCustomPresets()
})

async function loadSystemPresets() {
  loadingSystem.value = true
  try {
    const response = await api.get('/presets/all')
    systemPresets.value = response.data.filter(p => p.source !== 'custom')
  } catch (error) {
    console.error('Failed to load system presets:', error)
    alert('Failed to load system presets: ' + error.message)
  } finally {
    loadingSystem.value = false
  }
}

async function loadCustomPresets() {
  loadingCustom.value = true
  try {
    const response = await api.get('/presets/custom')
    customPresets.value = response.data
  } catch (error) {
    console.error('Failed to load custom presets:', error)
    alert('Failed to load custom presets: ' + error.message)
  } finally {
    loadingCustom.value = false
  }
}

function openCreateModal() {
  editingPreset.value = null
  showPresetForm.value = true
}

function editPreset(preset) {
  editingPreset.value = preset
  showPresetForm.value = true
}

async function savePreset(presetData) {
  try {
    if (editingPreset.value?.id) {
      // Update existing preset
      await api.put(`/presets/custom/${editingPreset.value.id}`, presetData)
    } else {
      // Create new preset
      await api.post('/presets/custom', presetData)
    }
    
    await loadCustomPresets()
    showPresetForm.value = false
    editingPreset.value = null
  } catch (error) {
    console.error('Failed to save preset:', error)
    alert('Failed to save preset: ' + error.message)
  }
}

async function confirmDelete(preset) {
  if (!confirm(`Are you sure you want to delete "${preset.name}"?\n\nThis action cannot be undone.`)) {
    return
  }
  
  try {
    await api.delete(`/presets/custom/${preset.id}`)
    await loadCustomPresets()
  } catch (error) {
    console.error('Failed to delete preset:', error)
    alert('Failed to delete preset: ' + error.message)
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleDateString()
}

function formatCertifications(config) {
  if (!config) return ''
  if (config.mode === 'include' && config.include?.length) {
    return config.include.join(', ')
  }
  if (config.mode === 'exclude' && config.exclude?.length) {
    return 'Exclude: ' + config.exclude.join(', ')
  }
  if (config.mode === 'max' && config.max) {
    return 'Max: ' + config.max
  }
  return ''
}

function formatGenres(config) {
  if (!config) return ''
  const parts = []
  if (config.prefer?.length) parts.push('Prefer: ' + config.prefer.slice(0, 3).join(', '))
  if (config.exclude?.length) parts.push('Exclude: ' + config.exclude.slice(0, 3).join(', '))
  return parts.join(' | ')
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

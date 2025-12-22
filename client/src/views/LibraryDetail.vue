<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <Button @click="$router.back()" variant="secondary">← Back</Button>
      <h1 class="text-2xl font-bold">{{ library?.name || 'Library' }}</h1>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">
      Loading library...
    </div>

    <div v-else-if="library" class="space-y-6">
      <Card title="Library Configuration">
        <div class="grid grid-cols-2 gap-4">
          <Input v-model="library.name" label="Name" disabled />
          <Input v-model.number="library.priority" label="Priority" type="number" />
          <Select
            v-model="library.arr_type"
            label="ARR Type"
            :options="[
              { label: 'Radarr', value: 'radarr' },
              { label: 'Sonarr', value: 'sonarr' },
            ]"
            placeholder="Select ARR type"
          />
          <div class="flex items-end">
            <Button @click="saveLibrary" :loading="saving">Save Changes</Button>
          </div>
        </div>
      </Card>

      <!-- Sync Status / Empty State -->
      <div v-if="library.item_count === 0 && !isSyncing" class="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="p-2 bg-yellow-900/40 rounded-full">
            <svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 class="font-medium text-yellow-400">Sync Required</h3>
            <p class="text-sm text-yellow-200/70">
              This library has 0 synced items. Classification rules will not work until content is synced.
            </p>
          </div>
        </div>
        <Button @click="handleSync" variant="primary">
          Sync Now
        </Button>
      </div>

      <!-- Active Sync Progress -->
      <div v-if="isSyncing" class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-3">
             <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
             <h3 class="font-medium text-blue-400">Syncing Library...</h3>
          </div>
          <span class="text-xs text-blue-300">
            {{ activeSyncStatus?.items_processed || 0 }} / {{ activeSyncStatus?.items_total || '?' }} items
          </span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div 
            class="bg-blue-500 h-2 rounded-full transition-all duration-500"
            :style="{ width: `${syncPercentage}%` }"
          ></div>
        </div>
      </div>

      <!-- Radarr Settings for Movie Libraries -->
      <Card v-if="library.media_type === 'movie' && library.arr_id" title="Radarr Settings">
        <div v-if="loadingArrOptions" class="text-center py-4 text-gray-400">
          Loading Radarr options...
        </div>
        <div v-else class="space-y-4">
          <Select
            v-model="radarrSettings.root_folder_path"
            label="Root Folder"
            :options="rootFolderOptions"
            placeholder="Select root folder"
          />
          
          <Select
            v-model="radarrSettings.quality_profile_id"
            label="Quality Profile"
            :options="qualityProfileOptions"
            placeholder="Select quality profile"
          />
          
          <Select
            v-model="radarrSettings.minimum_availability"
            label="Minimum Availability"
            :options="minimumAvailabilityOptions"
            placeholder="Select minimum availability"
          />
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Tags</label>
            <div class="space-y-2">
              <div v-for="tag in tagOptions" :key="tag.id" class="flex items-center">
                <input
                  type="checkbox"
                  :id="`tag-${tag.id}`"
                  :value="tag.id"
                  v-model="radarrSettings.tags"
                  class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label :for="`tag-${tag.id}`" class="ml-2 text-sm text-gray-300">
                  {{ tag.label }}
                </label>
              </div>
              <p v-if="tagOptions.length === 0" class="text-sm text-gray-500">No tags available</p>
            </div>
          </div>
          
          <Toggle
            v-model="radarrSettings.search_on_add"
            label="Search on Add"
            description="Automatically search for movie when added"
          />
          
          <Toggle
            v-model="radarrSettings.monitor"
            label="Monitor"
            description="Monitor this movie for upgrades"
          />
          
          <div class="flex justify-end pt-4">
            <Button @click="saveArrSettings" :loading="savingArrSettings">
              Save Settings
            </Button>
          </div>
        </div>
      </Card>

      <!-- Sonarr Settings for TV Libraries -->
      <Card v-if="library.media_type === 'tv' && library.arr_id" title="Sonarr Settings">
        <div v-if="loadingArrOptions" class="text-center py-4 text-gray-400">
          Loading Sonarr options...
        </div>
        <div v-else class="space-y-4">
          <Select
            v-model="sonarrSettings.root_folder_path"
            label="Root Folder"
            :options="rootFolderOptions"
            placeholder="Select root folder"
          />
          
          <Select
            v-model="sonarrSettings.quality_profile_id"
            label="Quality Profile"
            :options="qualityProfileOptions"
            placeholder="Select quality profile"
          />
          
          <Select
            v-model="sonarrSettings.series_type"
            label="Series Type"
            :options="seriesTypeOptions"
            placeholder="Select series type"
          />
          
          <Select
            v-model="sonarrSettings.season_monitoring"
            label="Season Monitoring"
            :options="seasonMonitoringOptions"
            placeholder="Select monitoring option"
          />
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Tags</label>
            <div class="space-y-2">
              <div v-for="tag in tagOptions" :key="tag.id" class="flex items-center">
                <input
                  type="checkbox"
                  :id="`tag-${tag.id}`"
                  :value="tag.id"
                  v-model="sonarrSettings.tags"
                  class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label :for="`tag-${tag.id}`" class="ml-2 text-sm text-gray-300">
                  {{ tag.label }}
                </label>
              </div>
              <p v-if="tagOptions.length === 0" class="text-sm text-gray-500">No tags available</p>
            </div>
          </div>
          
          <Toggle
            v-model="sonarrSettings.search_on_add"
            label="Search on Add"
            description="Automatically search for episodes when added"
          />
          
          <Select
            v-model="sonarrSettings.monitor_new_items"
            label="Monitor New Items"
            :options="[
              { label: 'All', value: 'all' },
              { label: 'None', value: 'none' }
            ]"
            placeholder="Select monitor option"
          />
          
          <Toggle
            v-model="sonarrSettings.season_folder"
            label="Season Folder"
            description="Create season folders for episodes"
          />
          
          <div class="flex justify-end pt-4">
            <Button @click="saveArrSettings" :loading="savingArrSettings">
              Save Settings
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Classification Rules">
        <div class="space-y-6">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-medium mb-1">Label-based Rules</h4>
              <p class="text-sm text-gray-400">
                Configure which content should be included or excluded from this library.
              </p>
            </div>
            <Button @click="$router.push(`/rule-builder/${library.id}`)">
              + New Rule
            </Button>
          </div>

          <div v-if="rules.length > 0" class="border border-gray-700 rounded-lg overflow-hidden">
            <table class="w-full text-left">
              <thead class="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>
                  <th class="px-4 py-3">Rule Name</th>
                  <th class="px-4 py-3">Conditions</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-700">
                <tr v-for="rule in rules" :key="rule.id" class="hover:bg-gray-800/50">
                  <td class="px-4 py-3 font-medium">{{ rule.name }}</td>
                  <td class="px-4 py-3 text-sm text-gray-400">{{ formatConditions(rule.rule_json) }}</td>
                  <td class="px-4 py-3">
                    <span 
                      class="px-2 py-1 text-xs rounded-full"
                      :class="rule.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-700/50 text-gray-400'"
                    >
                      {{ rule.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      @click="$router.push(`/rule-builder/${library.id}?ruleId=${rule.id}`)"
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center py-8 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
            No classification rules configured yet.
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/stores/toast'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const library = ref(null)
const loading = ref(true)
const saving = ref(false)
const loadingArrOptions = ref(false)
const savingArrSettings = ref(false)

// ARR Options
const arrOptions = ref({})
const radarrSettings = ref({
  root_folder_path: '',
  quality_profile_id: null,
  minimum_availability: 'released',
  tags: [],
  search_on_add: true,
  monitor: true
})
const sonarrSettings = ref({
  root_folder_path: '',
  quality_profile_id: null,
  series_type: 'standard',
  season_monitoring: 'all',
  tags: [],
  search_on_add: true,
  monitor_new_items: 'all',
  season_folder: true
})

// Computed options for dropdowns
const rootFolderOptions = computed(() => {
  if (!arrOptions.value.rootFolders) return []
  return arrOptions.value.rootFolders.map(rf => ({
    label: `${rf.path} (${formatBytes(rf.freeSpace)} free)`,
    value: rf.path
  }))
})

const qualityProfileOptions = computed(() => {
  if (!arrOptions.value.qualityProfiles) return []
  return arrOptions.value.qualityProfiles.map(qp => ({
    label: qp.name,
    value: qp.id
  }))
})

const tagOptions = computed(() => {
  return arrOptions.value.tags || []
})

const minimumAvailabilityOptions = computed(() => {
  if (!arrOptions.value.minimumAvailabilityOptions) return []
  return arrOptions.value.minimumAvailabilityOptions.map(opt => ({
    label: `${opt.label} - ${opt.description}`,
    value: opt.value
  }))
})

const seriesTypeOptions = computed(() => {
  if (!arrOptions.value.seriesTypeOptions) return []
  return arrOptions.value.seriesTypeOptions.map(opt => ({
    label: `${opt.label} - ${opt.description}`,
    value: opt.value
  }))
})

const seasonMonitoringOptions = computed(() => {
  if (!arrOptions.value.seasonMonitoringOptions) return []
  return arrOptions.value.seasonMonitoringOptions.map(opt => ({
    label: `${opt.label} - ${opt.description}`,
    value: opt.value
  }))
})

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const rules = ref([])

onMounted(async () => {
  try {
    const response = await api.getLibrary(route.params.id)
    library.value = response.data
    
    // Load existing settings
    if (library.value.media_type === 'movie' && library.value.radarr_settings) {
      radarrSettings.value = {
        ...radarrSettings.value,
        ...library.value.radarr_settings
      }
    } else if (library.value.media_type === 'tv' && library.value.sonarr_settings) {
      sonarrSettings.value = {
        ...sonarrSettings.value,
        ...library.value.sonarr_settings
      }
    }
    
    // Load rules
    const rulesResponse = await api.getLibraryRules(route.params.id)
    rules.value = rulesResponse.data

    // Load ARR options if arr_id is set
    if (library.value.arr_id) {
      await loadArrOptions()
    }
  } catch (error) {
    console.error('Failed to load library:', error)
    toast.error('Failed to load library')
    router.push('/libraries')
  } finally {
    loading.value = false
  }
})

const formatConditions = (conditions) => {
  if (!conditions) return 'No conditions'
  // Handle both array and single object (legacy)
  const list = Array.isArray(conditions) ? conditions : [conditions]
  return list.map(c => {
    // Format operator text
    const op = c.operator === 'equals' ? 'is' : 
               c.operator === 'not_equals' ? 'is not' : 
               c.operator.replace('_', ' ')
    return `${c.field} ${op} "${c.value}"`
  }).join(', ')
}

const loadArrOptions = async () => {
  loadingArrOptions.value = true
  try {
    const response = await api.getLibraryArrOptions(library.value.id)
    arrOptions.value = response.data
  } catch (error) {
    console.error('Failed to load ARR options:', error)
    toast.error('Failed to load ARR options')
  } finally {
    loadingArrOptions.value = false
  }
}

const saveLibrary = async () => {
  saving.value = true
  try {
    await api.updateLibrary(library.value.id, {
      priority: library.value.priority,
      arr_type: library.value.arr_type,
    })
    toast.success('Library updated successfully')
  } catch (error) {
    console.error('Failed to save library:', error)
    toast.error('Failed to save library: ' + error.message)
  } finally {
    saving.value = false
  }
}

const saveArrSettings = async () => {
  savingArrSettings.value = true
  try {
    const settings = library.value.media_type === 'movie' ? radarrSettings.value : sonarrSettings.value
    await api.updateLibraryArrSettings(library.value.id, settings)
    toast.success('*arr settings saved successfully')
  } catch (error) {
    console.error('Failed to save *arr settings:', error)
    toast.error('Failed to save *arr settings: ' + error.message)
  } finally {
    savingArrSettings.value = false
  }
}

const syncing = ref(false)

const activeSyncStatus = computed(() => {
  return library.value?.sync_status
})

const isSyncing = computed(() => {
  return syncing.value || activeSyncStatus.value?.status === 'running'
})

const syncPercentage = computed(() => {
  if (!activeSyncStatus.value || !activeSyncStatus.value.items_total) return 0
  return Math.round((activeSyncStatus.value.items_processed / activeSyncStatus.value.items_total) * 100)
})

const pollSyncStatus = async () => {
  if (!library.value) return
  
  if (isSyncing.value) {
    try {
      const res = await api.getLibrary(library.value.id)
      library.value = res.data
      
      // Continue polling if still running
      if (res.data.sync_status?.status === 'running') {
        setTimeout(pollSyncStatus, 2000)
      } else {
        syncing.value = false // Reset manual flag
        if (res.data.item_count > 0) {
           toast.success('Library sync complete')
        }
      }
    } catch (e) {
      console.error('Polling error', e)
    }
  }
}

const handleSync = async () => {
  syncing.value = true
  try {
    toast.add({ title: 'Sync Started', message: 'Library synchronization started in background...' })
    await api.syncLibrary(library.value.id)
    
    // Start polling immediately
    setTimeout(pollSyncStatus, 1000)
    
  } catch (error) {
    console.error('Sync failed:', error)
    toast.error('Sync failed: ' + (error.response?.data?.error || error.message))
    syncing.value = false
  }
}

// Watch for initial sync state on load
onMounted(() => {
  if (library.value?.sync_status?.status === 'running') {
    pollSyncStatus()
  }
})

</script>

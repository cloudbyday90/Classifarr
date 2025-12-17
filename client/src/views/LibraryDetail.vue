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

      <!-- Radarr Settings for Movie Libraries -->
      <Card v-if="library.media_type === 'movie'" title="Radarr Settings">
        <div v-if="loadingArrOptions" class="text-center py-4 text-gray-400">
          Loading Radarr options...
        </div>
        <div v-else-if="arrOptionsError" class="text-red-500">
          {{ arrOptionsError }}
        </div>
        <div v-else-if="arrOptions" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Root Folder</label>
              <select 
                v-model="radarrSettings.root_folder_path" 
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="">Select root folder</option>
                <option 
                  v-for="rf in arrOptions.rootFolders" 
                  :key="rf.id" 
                  :value="rf.path"
                >
                  {{ rf.path }} ({{ formatBytes(rf.freeSpace) }} free)
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Quality Profile</label>
              <select 
                v-model="radarrSettings.quality_profile_id" 
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option :value="null">Select quality profile</option>
                <option 
                  v-for="qp in arrOptions.qualityProfiles" 
                  :key="qp.id" 
                  :value="qp.id"
                >
                  {{ qp.name }}
                </option>
              </select>
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium mb-2">Minimum Availability</label>
              <select 
                v-model="radarrSettings.minimum_availability" 
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option 
                  v-for="opt in arrOptions.availabilityOptions" 
                  :key="opt.value" 
                  :value="opt.value"
                >
                  {{ opt.label }} - {{ opt.description }}
                </option>
              </select>
              <small class="text-gray-400">When should Radarr start searching for this movie?</small>
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium mb-2">Tags</label>
              <div class="space-y-2">
                <label 
                  v-for="tag in arrOptions.tags" 
                  :key="tag.id"
                  class="flex items-center gap-2 text-sm"
                >
                  <input 
                    type="checkbox" 
                    :value="tag.id" 
                    v-model="radarrSettings.tags"
                    class="rounded"
                  >
                  {{ tag.label }}
                </label>
              </div>
            </div>

            <div>
              <label class="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  v-model="radarrSettings.search_on_add"
                  class="rounded"
                >
                Search on Add
              </label>
              <small class="text-gray-400">Start searching for movie immediately when added</small>
            </div>

            <div>
              <label class="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  v-model="radarrSettings.monitor"
                  class="rounded"
                >
                Monitor
              </label>
              <small class="text-gray-400">Monitor this movie for upgrades and missing files</small>
            </div>
          </div>

          <Button @click="saveArrSettings" :loading="savingArr">Save Radarr Settings</Button>
        </div>
      </Card>

      <!-- Sonarr Settings for TV Libraries -->
      <Card v-if="library.media_type === 'tv'" title="Sonarr Settings">
        <div v-if="loadingArrOptions" class="text-center py-4 text-gray-400">
          Loading Sonarr options...
        </div>
        <div v-else-if="arrOptionsError" class="text-red-500">
          {{ arrOptionsError }}
        </div>
        <div v-else-if="arrOptions" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Root Folder</label>
              <select 
                v-model="sonarrSettings.root_folder_path" 
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="">Select root folder</option>
                <option 
                  v-for="rf in arrOptions.rootFolders" 
                  :key="rf.id" 
                  :value="rf.path"
                >
                  {{ rf.path }} ({{ formatBytes(rf.freeSpace) }} free)
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Quality Profile</label>
              <select 
                v-model="sonarrSettings.quality_profile_id" 
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option :value="null">Select quality profile</option>
                <option 
                  v-for="qp in arrOptions.qualityProfiles" 
                  :key="qp.id" 
                  :value="qp.id"
                >
                  {{ qp.name }}
                </option>
              </select>
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium mb-2">Series Type</label>
              <select 
                v-model="sonarrSettings.series_type" 
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option 
                  v-for="opt in arrOptions.seriesTypeOptions" 
                  :key="opt.value" 
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
              <small class="text-gray-400">{{ getSeriesTypeDescription(sonarrSettings.series_type) }}</small>
              
              <div v-if="suggestedSeriesType && suggestedSeriesType !== sonarrSettings.series_type" 
                   class="mt-2 p-2 bg-blue-900/30 border border-blue-700 rounded text-sm">
                💡 Based on this library's labels, we suggest: <strong>{{ suggestedSeriesType }}</strong>
                <button 
                  @click="sonarrSettings.series_type = suggestedSeriesType" 
                  class="ml-2 text-blue-400 hover:text-blue-300 underline"
                >
                  Apply
                </button>
              </div>
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium mb-2">Season Monitoring</label>
              <select 
                v-model="sonarrSettings.season_monitoring" 
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option 
                  v-for="opt in arrOptions.seasonMonitoringOptions" 
                  :key="opt.value" 
                  :value="opt.value"
                >
                  {{ opt.label }} - {{ opt.description }}
                </option>
              </select>
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium mb-2">Tags</label>
              <div class="space-y-2">
                <label 
                  v-for="tag in arrOptions.tags" 
                  :key="tag.id"
                  class="flex items-center gap-2 text-sm"
                >
                  <input 
                    type="checkbox" 
                    :value="tag.id" 
                    v-model="sonarrSettings.tags"
                    class="rounded"
                  >
                  {{ tag.label }}
                </label>
              </div>
            </div>

            <div>
              <label class="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  v-model="sonarrSettings.search_on_add"
                  class="rounded"
                >
                Search on Add
              </label>
              <small class="text-gray-400">Start searching for episodes immediately when series is added</small>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Monitor New Items</label>
              <select 
                v-model="sonarrSettings.monitor_new_items" 
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="all">All - Monitor all new seasons/episodes</option>
                <option value="none">None - Don't auto-monitor new content</option>
              </select>
            </div>

            <div>
              <label class="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  v-model="sonarrSettings.season_folder"
                  class="rounded"
                >
                Use Season Folders
              </label>
              <small class="text-gray-400">Organize episodes into season subfolders</small>
            </div>
          </div>

          <Button @click="saveArrSettings" :loading="savingArr">Save Sonarr Settings</Button>
        </div>
      </Card>

      <Card title="Classification Rules">
        <div class="space-y-4">
          <div>
            <h4 class="font-medium mb-2">Label-based Rules</h4>
            <p class="text-sm text-gray-400 mb-4">
              Configure which content should be included or excluded from this library
            </p>
            <Button @click="$router.push(`/rule-builder/${library.id}`)">
              ✨ AI Rule Builder
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'

const route = useRoute()
const router = useRouter()

const library = ref(null)
const loading = ref(true)
const saving = ref(false)
const loadingArrOptions = ref(false)
const savingArr = ref(false)
const arrOptions = ref(null)
const arrOptionsError = ref(null)

// Radarr settings with defaults
const radarrSettings = ref({
  root_folder_path: '',
  quality_profile_id: null,
  minimum_availability: 'released',
  tags: [],
  search_on_add: true,
  monitor: true
})

// Sonarr settings with defaults
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

const suggestedSeriesType = computed(() => {
  // This would ideally come from the backend based on library labels
  // For now, we'll return null
  return null
})

const formatBytes = (bytes) => {
  if (!bytes) return 'N/A'
  const gb = bytes / (1024 * 1024 * 1024)
  return gb.toFixed(2) + ' GB'
}

const getSeriesTypeDescription = (type) => {
  const descriptions = {
    standard: 'Episodes with S##E## numbering (most shows)',
    anime: 'Absolute episode numbering (anime shows)',
    daily: 'Date-based episodes (talk shows, news, etc.)'
  }
  return descriptions[type] || ''
}

onMounted(async () => {
  try {
    const response = await api.getLibrary(route.params.id)
    library.value = response.data
    
    // Load existing arr settings
    if (library.value.media_type === 'movie' && library.value.radarr_settings) {
      radarrSettings.value = { ...radarrSettings.value, ...library.value.radarr_settings }
    } else if (library.value.media_type === 'tv' && library.value.sonarr_settings) {
      sonarrSettings.value = { ...sonarrSettings.value, ...library.value.sonarr_settings }
    }
    
    // Load arr options
    await loadArrOptions()
  } catch (error) {
    console.error('Failed to load library:', error)
    alert('Failed to load library')
    router.push('/libraries')
  } finally {
    loading.value = false
  }
})

const loadArrOptions = async () => {
  loadingArrOptions.value = true
  arrOptionsError.value = null
  try {
    const response = await api.getLibraryArrOptions(route.params.id)
    arrOptions.value = response.data
  } catch (error) {
    console.error('Failed to load arr options:', error)
    arrOptionsError.value = error.response?.data?.error || 'Failed to load *arr options. Make sure Radarr/Sonarr is configured.'
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
    alert('Library updated successfully')
  } catch (error) {
    console.error('Failed to save library:', error)
    alert('Failed to save library: ' + error.message)
  } finally {
    saving.value = false
  }
}

const saveArrSettings = async () => {
  savingArr.value = true
  try {
    const settings = library.value.media_type === 'movie' ? radarrSettings.value : sonarrSettings.value
    await api.updateLibraryArrSettings(library.value.id, settings)
    alert('*arr settings saved successfully')
  } catch (error) {
    console.error('Failed to save arr settings:', error)
    alert('Failed to save *arr settings: ' + error.message)
  } finally {
    savingArr.value = false
  }
}
</script>

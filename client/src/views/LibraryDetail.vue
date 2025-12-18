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
              Save Radarr Settings
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
              Save Sonarr Settings
            </Button>
          </div>
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
</script>

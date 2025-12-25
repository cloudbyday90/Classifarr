<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">
        <span>🔗</span>
        <span>Library Mappings</span>
      </h2>
      <p class="text-gray-400 text-sm">Map Plex libraries to Radarr/Sonarr root folders for re-classification</p>
    </div>

    <!-- Media Server Selector -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <label class="block text-sm font-medium mb-2">Select Media Server</label>
      <select 
        v-model="selectedMediaServerId" 
        @change="loadMappings"
        class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg"
      >
        <option :value="null">Select a media server...</option>
        <option v-for="server in mediaServers" :key="server.id" :value="server.id">
          {{ server.name }} ({{ server.type }})
        </option>
      </select>
    </div>

    <!-- No Media Server Selected -->
    <div v-if="!selectedMediaServerId" class="text-center py-8 text-gray-400">
      <p>Select a media server to view and configure library mappings</p>
    </div>

    <!-- Mappings List -->
    <div v-else class="space-y-4">
      <!-- Auto-Detect Button -->
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium">Library → Root Folder Mappings</h3>
        <button 
          @click="autoDetect" 
          :disabled="autoDetecting"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-sm font-medium"
        >
          {{ autoDetecting ? 'Detecting...' : '🔍 Auto-Detect Mappings' }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-8 text-gray-400">
        Loading mappings...
      </div>

      <!-- Unmapped Libraries Warning -->
      <div v-if="unmappedLibraries.length > 0" class="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
        <h4 class="text-yellow-400 font-medium mb-2">⚠️ Unmapped Libraries</h4>
        <p class="text-sm text-gray-400 mb-3">The following libraries need to be mapped to enable re-classification:</p>
        <div class="space-y-2">
          <div 
            v-for="lib in unmappedLibraries" 
            :key="lib.id"
            class="flex items-center justify-between bg-gray-800/50 rounded p-3"
          >
            <div>
              <span class="font-medium">{{ lib.name }}</span>
              <span class="text-xs text-gray-500 ml-2">({{ lib.media_type }})</span>
            </div>
            <button 
              @click="openMappingModal(lib)"
              class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      <!-- Mapped Libraries -->
      <div v-if="mappings.length > 0" class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="border-b border-gray-700">
            <tr class="text-left text-sm text-gray-400">
              <th class="p-3">Library</th>
              <th class="p-3">*arr Instance</th>
              <th class="p-3">Root Folder</th>
              <th class="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="mapping in mappings" 
              :key="mapping.id"
              class="border-b border-gray-700/50 hover:bg-gray-700/30"
            >
              <td class="p-3">
                <span class="font-medium">{{ mapping.library_name }}</span>
                <span class="text-xs text-gray-500 ml-2">({{ mapping.media_type }})</span>
              </td>
              <td class="p-3">
                <span class="text-sm">{{ mapping.arr_type === 'radarr' ? '🎬' : '📺' }} {{ mapping.arr_type }}</span>
              </td>
              <td class="p-3">
                <code class="text-xs bg-gray-900 px-2 py-1 rounded">{{ mapping.arr_root_folder_path }}</code>
              </td>
              <td class="p-3">
                <button 
                  @click="deleteMapping(mapping.library_id)"
                  class="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- No Mappings -->
      <div v-if="!loading && mappings.length === 0 && unmappedLibraries.length === 0" class="text-center py-8 text-gray-400">
        <p>No libraries found for this media server</p>
      </div>
    </div>

    <!-- Mapping Modal -->
    <div v-if="showMappingModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="closeMappingModal">
      <div class="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full mx-4">
        <div class="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 class="text-lg font-medium">Configure Mapping</h3>
          <button @click="closeMappingModal" class="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Library</label>
            <div class="font-medium">{{ mappingForm.library_name }}</div>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">*arr Instance</label>
            <select 
              v-model="mappingForm.arr_selection"
              @change="loadRootFolders"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg"
            >
              <option value="">Select instance...</option>
              <optgroup v-if="mappingForm.media_type === 'movie'" label="Radarr">
                <option v-for="r in arrInstances.radarr" :key="'radarr-'+r.id" :value="'radarr:'+r.id">
                  {{ r.name }}
                </option>
              </optgroup>
              <optgroup v-if="mappingForm.media_type === 'tv'" label="Sonarr">
                <option v-for="s in arrInstances.sonarr" :key="'sonarr-'+s.id" :value="'sonarr:'+s.id">
                  {{ s.name }}
                </option>
              </optgroup>
            </select>
          </div>

          <div v-if="rootFolders.length > 0">
            <label class="block text-sm font-medium mb-2">Root Folder</label>
            <select 
              v-model="mappingForm.root_folder"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg"
            >
              <option value="">Select root folder...</option>
              <option v-for="folder in rootFolders" :key="folder.id" :value="folder.id + ':' + folder.path">
                {{ folder.path }}
              </option>
            </select>
          </div>

          <div class="flex gap-3 pt-4 border-t border-gray-700">
            <button 
              @click="saveMapping" 
              :disabled="!mappingForm.root_folder || savingMapping"
              class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium"
            >
              {{ savingMapping ? 'Saving...' : 'Save Mapping' }}
            </button>
            <button 
              @click="closeMappingModal"
              class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const toast = useToast()

const mediaServers = ref([])
const selectedMediaServerId = ref(null)
const mappings = ref([])
const unmappedLibraries = ref([])
const arrInstances = ref({ radarr: [], sonarr: [] })
const rootFolders = ref([])
const loading = ref(false)
const autoDetecting = ref(false)
const showMappingModal = ref(false)
const savingMapping = ref(false)

const mappingForm = ref({
  library_id: null,
  library_name: '',
  media_type: '',
  arr_selection: '',
  root_folder: ''
})

onMounted(async () => {
  await loadMediaServers()
})

const loadMediaServers = async () => {
  try {
    const response = await api.getMediaServers()
    mediaServers.value = response.data || []
    
    // Auto-select if only one
    if (mediaServers.value.length === 1) {
      selectedMediaServerId.value = mediaServers.value[0].id
      await loadMappings()
    }
  } catch (error) {
    console.error('Failed to load media servers:', error)
  }
}

const loadMappings = async () => {
  if (!selectedMediaServerId.value) return
  
  loading.value = true
  try {
    const [mappingsRes, unmappedRes, instancesRes] = await Promise.all([
      api.get(`/mappings/${selectedMediaServerId.value}`),
      api.get(`/mappings/${selectedMediaServerId.value}/unmapped`),
      api.get(`/mappings/${selectedMediaServerId.value}/arr-instances`)
    ])
    
    mappings.value = mappingsRes.data || []
    unmappedLibraries.value = unmappedRes.data || []
    arrInstances.value = instancesRes.data || { radarr: [], sonarr: [] }
  } catch (error) {
    console.error('Failed to load mappings:', error)
    toast.error('Failed to load library mappings')
  } finally {
    loading.value = false
  }
}

const autoDetect = async () => {
  if (!selectedMediaServerId.value) return
  
  autoDetecting.value = true
  try {
    const response = await api.post(`/mappings/${selectedMediaServerId.value}/auto-detect`)
    const result = response.data
    
    if (result.applied?.length > 0) {
      toast.success(`Auto-applied ${result.applied.length} mapping(s)`)
    }
    if (result.suggestions?.length > 0) {
      toast.info(`${result.suggestions.length} suggestion(s) need review`)
    }
    
    await loadMappings()
  } catch (error) {
    console.error('Auto-detect failed:', error)
    toast.error('Auto-detect failed')
  } finally {
    autoDetecting.value = false
  }
}

const openMappingModal = async (library) => {
  mappingForm.value = {
    library_id: library.id,
    library_name: library.name,
    media_type: library.media_type,
    arr_selection: '',
    root_folder: ''
  }
  rootFolders.value = []
  showMappingModal.value = true
}

const closeMappingModal = () => {
  showMappingModal.value = false
  mappingForm.value = { library_id: null, library_name: '', media_type: '', arr_selection: '', root_folder: '' }
}

const loadRootFolders = async () => {
  if (!mappingForm.value.arr_selection) {
    rootFolders.value = []
    return
  }
  
  const [arrType, arrId] = mappingForm.value.arr_selection.split(':')
  try {
    const response = await api.get(`/mappings/root-folders/${arrType}/${arrId}`)
    rootFolders.value = response.data || []
  } catch (error) {
    console.error('Failed to load root folders:', error)
    toast.error('Failed to load root folders')
  }
}

const saveMapping = async () => {
  if (!mappingForm.value.root_folder) return
  
  savingMapping.value = true
  const [arrType, arrId] = mappingForm.value.arr_selection.split(':')
  const [folderId, folderPath] = mappingForm.value.root_folder.split(':')
  
  try {
    await api.post('/mappings', {
      library_id: mappingForm.value.library_id,
      arr_type: arrType,
      arr_config_id: parseInt(arrId),
      arr_root_folder_id: parseInt(folderId),
      arr_root_folder_path: folderPath
    })
    
    toast.success('Mapping saved successfully')
    closeMappingModal()
    await loadMappings()
  } catch (error) {
    console.error('Failed to save mapping:', error)
    toast.error('Failed to save mapping')
  } finally {
    savingMapping.value = false
  }
}

const deleteMapping = async (libraryId) => {
  if (!confirm('Are you sure you want to remove this mapping?')) return
  
  try {
    await api.delete(`/mappings/library/${libraryId}`)
    toast.success('Mapping removed')
    await loadMappings()
  } catch (error) {
    console.error('Failed to delete mapping:', error)
    toast.error('Failed to remove mapping')
  }
}
</script>

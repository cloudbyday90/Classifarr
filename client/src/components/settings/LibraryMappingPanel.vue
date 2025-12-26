<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-4">
    <!-- Section Header - only show in edit mode -->
    <div v-if="!readonly" class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-medium">Library Mappings</h3>
        <p class="text-sm text-gray-400">Map Plex libraries to {{ arrType === 'radarr' ? 'Radarr' : 'Sonarr' }} root folders</p>
      </div>
      <button 
        v-if="mappings.length > 0 || unmappedLibraries.length > 0"
        @click="autoDetect" 
        :disabled="autoDetecting || !mediaServerId"
        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium transition-colors"
      >
        {{ autoDetecting ? 'Detecting...' : '🔍 Auto-Detect' }}
      </button>
    </div>

    <!-- No Media Server Warning -->
    <div v-if="!mediaServerId" class="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
      <p class="text-yellow-400 text-sm">
        ⚠️ No media server associated. Link a media server above to configure library mappings.
      </p>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="text-center py-6 text-gray-400">
      <span class="animate-pulse">Loading mappings...</span>
    </div>

    <!-- Content when media server is configured -->
    <template v-else>
      <!-- Unmapped Libraries Warning -->
      <div v-if="!readonly && unmappedLibraries.length > 0" class="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
        <h4 class="text-yellow-400 font-medium mb-2">⚠️ Unmapped Libraries ({{ unmappedLibraries.length }})</h4>
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

      <!-- Mapped Libraries Table -->
      <div v-if="mappings.length > 0" class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="border-b border-gray-700">
            <tr class="text-left text-sm text-gray-400">
              <th class="p-3">Library</th>
              <th class="p-3">Root Folder</th>
              <th v-if="!readonly" class="p-3 text-right">Actions</th>
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
              </td>
              <td class="p-3">
                <code class="text-xs bg-gray-900 px-2 py-1 rounded">{{ mapping.arr_root_folder_path }}</code>
              </td>
              <td v-if="!readonly" class="p-3 text-right">
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

      <!-- No Mappings Configured -->
      <div v-if="!loading && mappings.length === 0 && unmappedLibraries.length === 0" class="text-center py-6 text-gray-400 border border-gray-700 border-dashed rounded-lg">
        <p v-if="readonly">No library mappings configured for this {{ arrType === 'radarr' ? 'Radarr' : 'Sonarr' }} instance</p>
        <p v-else>No {{ arrType === 'radarr' ? 'movie' : 'TV' }} libraries found on the associated media server</p>
      </div>
    </template>

    <!-- Path Configuration Guide (Collapsible) - only in edit mode -->
    <details v-if="!readonly && mediaServerId" class="bg-gray-800/30 border border-gray-700 rounded-lg">
      <summary class="px-4 py-3 cursor-pointer text-sm font-medium text-gray-300 hover:text-white">
        📖 Path Configuration Guide
      </summary>
      <div class="px-4 pb-4 text-sm text-gray-400 space-y-3">
        <p>
          Library mappings connect your Plex libraries to {{ arrType === 'radarr' ? 'Radarr' : 'Sonarr' }} root folders.
          This enables Classifarr to move media files during re-classification.
        </p>
        <div class="bg-gray-900/50 p-3 rounded">
          <h5 class="font-medium text-gray-300 mb-2">Docker Path Mapping</h5>
          <p class="text-xs">
            Ensure Plex, {{ arrType === 'radarr' ? 'Radarr' : 'Sonarr' }}, and Classifarr all mount the same media paths.
            The paths seen by each container must be consistent.
          </p>
          <div class="mt-2 text-xs font-mono bg-gray-800 p-2 rounded">
            <div>Plex: /media/movies → /movies</div>
            <div>{{ arrType === 'radarr' ? 'Radarr' : 'Sonarr' }}: /media/movies → /movies</div>
            <div>Classifarr: /media/movies → /movies</div>
          </div>
        </div>
      </div>
    </details>

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
import { ref, watch, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const props = defineProps({
  arrType: {
    type: String,
    required: true,
    validator: (value) => ['radarr', 'sonarr'].includes(value)
  },
  arrConfigId: {
    type: Number,
    default: null
  },
  mediaServerId: {
    type: Number,
    default: null
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const toast = useToast()

const mappings = ref([])
const unmappedLibraries = ref([])
const rootFolders = ref([])
const loading = ref(false)
const autoDetecting = ref(false)
const showMappingModal = ref(false)
const savingMapping = ref(false)

const mappingForm = ref({
  library_id: null,
  library_name: '',
  root_folder: ''
})

// Define functions BEFORE watchers that use them (arrow functions aren't hoisted)
const loadMappings = async () => {
  if (!props.mediaServerId) return
  
  loading.value = true
  try {
    // Get mappings for this specific arr instance
    const [mappingsRes, unmappedRes] = await Promise.all([
      api.get(`/mappings/${props.mediaServerId}`),
      api.get(`/mappings/${props.mediaServerId}/unmapped`)
    ])
    
    // Filter to only show mappings for this arr type and instance
    const allMappings = mappingsRes.data || []
    mappings.value = allMappings.filter(m => 
      m.arr_type === props.arrType && 
      (!props.arrConfigId || m.arr_config_id === props.arrConfigId)
    )
    
    // Filter unmapped libraries to only show relevant media type
    const allUnmapped = unmappedRes.data || []
    const mediaType = props.arrType === 'radarr' ? 'movie' : 'tv'
    unmappedLibraries.value = allUnmapped.filter(lib => lib.media_type === mediaType)
  } catch (error) {
    console.error('Failed to load mappings:', error)
  } finally {
    loading.value = false
  }
}

const loadRootFolders = async () => {
  if (!props.arrConfigId) return
  
  try {
    const response = await api.get(`/mappings/root-folders/${props.arrType}/${props.arrConfigId}`)
    rootFolders.value = response.data || []
  } catch (error) {
    console.error('Failed to load root folders:', error)
  }
}

// Watch for changes in mediaServerId and reload mappings
watch(() => props.mediaServerId, async (newId) => {
  if (newId) {
    await loadMappings()
    await loadRootFolders()
  } else {
    mappings.value = []
    unmappedLibraries.value = []
  }
}, { immediate: true })

// Also reload root folders when arrConfigId changes
watch(() => props.arrConfigId, async (newId) => {
  if (newId && props.mediaServerId) {
    await loadRootFolders()
  }
})

const autoDetect = async () => {
  if (!props.mediaServerId) return
  
  autoDetecting.value = true
  try {
    const response = await api.post(`/mappings/${props.mediaServerId}/auto-detect`)
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
    root_folder: ''
  }
  
  // Ensure root folders are loaded
  if (rootFolders.value.length === 0 && props.arrConfigId) {
    await loadRootFolders()
  }
  
  showMappingModal.value = true
}

const closeMappingModal = () => {
  showMappingModal.value = false
  mappingForm.value = { library_id: null, library_name: '', root_folder: '' }
}

const saveMapping = async () => {
  if (!mappingForm.value.root_folder || !props.arrConfigId) return
  
  savingMapping.value = true
  const [folderId, folderPath] = mappingForm.value.root_folder.split(':')
  
  try {
    await api.post('/mappings', {
      library_id: mappingForm.value.library_id,
      arr_type: props.arrType,
      arr_config_id: props.arrConfigId,
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

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">
          <span>📺</span>
          <span>Sonarr Configuration</span>
        </h2>
        <p class="text-gray-400 text-sm">Configure your Sonarr TV series manager connections</p>
      </div>
      
      <!-- Add Instance Button -->
      <button 
        v-if="configs.length > 0 && !isAddingNew"
        @click="startAddingNew"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
      >
        <span>➕</span>
        <span>Add Sonarr Instance</span>
      </button>
    </div>

    <!-- List of Configured Instances -->
    <div v-for="(instance, index) in configs" :key="instance.id" class="space-y-4">
      <!-- Instance Header with Edit/Delete -->
      <div v-if="!isEditing || editingId !== instance.id" class="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium flex items-center gap-2">
            <span class="text-green-400">✅</span>
            {{ instance.name || `Sonarr ${index + 1}` }}
          </h3>
          <div class="flex gap-2">
            <button 
              @click="startEditing(instance)"
              class="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
            >
              Change Settings
            </button>
            <button 
              v-if="configs.length > 1"
              @click="deleteConfig(instance.id)"
              class="text-sm px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-400 rounded-md transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
            <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Host</div>
            <div class="font-medium truncate">{{ instance.host }}</div>
          </div>
          <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
            <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Port</div>
            <div class="font-medium">{{ instance.port }}</div>
          </div>
          <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
            <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Base Path</div>
            <div class="font-medium truncate">{{ instance.base_path || '/' }}</div>
          </div>
          <div class="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
            <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Media Server</div>
            <div class="font-medium truncate">{{ getMediaServerName(instance.media_server_id) }}</div>
          </div>
        </div>

        <div class="mt-4 flex justify-end border-t border-gray-700 pt-4">
          <button
            @click="testConnectionFor(instance)"
            :disabled="loading"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span>{{ loading ? 'Testing...' : 'Test Connection' }}</span>
            <span v-if="!loading">🔄</span>
          </button>
        </div>

        <!-- Read-only Library Mappings Summary -->
        <div v-if="instance.media_server_id" class="mt-4 border-t border-gray-700 pt-4">
          <h4 class="text-sm font-medium text-gray-400 mb-2">📚 Library Mappings</h4>
          <LibraryMappingPanel
            arrType="sonarr"
            :arrConfigId="instance.id"
            :mediaServerId="instance.media_server_id"
            :readonly="true"
          />
        </div>
      </div>

      <!-- Edit Form for this instance -->
      <div v-if="isEditing && editingId === instance.id" class="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-medium">Editing: {{ instance.name || `Sonarr ${index + 1}` }}</h3>
          <button 
            @click="cancelEdit"
            class="text-sm text-gray-400 hover:text-white"
          >
            Cancel Editing
          </button>
        </div>
        
        <!-- Form fields -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Name</label>
            <input v-model="editForm.name" type="text" placeholder="Sonarr 4K" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Protocol</label>
            <select v-model="editForm.protocol" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Host</label>
            <input v-model="editForm.host" type="text" placeholder="localhost" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Port</label>
            <input v-model.number="editForm.port" type="number" placeholder="8989" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Base Path</label>
            <input v-model="editForm.base_path" type="text" placeholder="/sonarr" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <PasswordInput v-model="editForm.api_key" placeholder="Your Sonarr API key" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">Associated Media Server</label>
            <select v-model="editForm.media_server_id" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg">
              <option :value="null">None (Not linked)</option>
              <option v-for="server in mediaServers" :key="server.id" :value="server.id">
                {{ server.name }} ({{ server.type }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Timeout (seconds)</label>
            <input v-model.number="editForm.timeout" type="number" min="5" max="120" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
          </div>
        </div>

        <!-- Library Mappings (when media server is selected) -->
        <div v-if="editForm.media_server_id && editingId" class="border-t border-gray-700 pt-4">
          <LibraryMappingPanel
            arrType="sonarr"
            :arrConfigId="editingId"
            :mediaServerId="editForm.media_server_id"
          />
        </div>

        <div class="flex gap-3 pt-4 border-t border-gray-700">
          <button
            @click="testConnection"
            :disabled="loading"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            {{ loading ? 'Testing...' : 'Test Connection' }}
          </button>
          <button
            @click="saveConfig"
            :disabled="saving"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
        </div>
      </div>
    </div>

    <!-- New Instance Form -->
    <div v-if="isAddingNew || configs.length === 0" class="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium">{{ configs.length === 0 ? 'Configure Sonarr' : 'Add New Sonarr Instance' }}</h3>
        <button 
          v-if="configs.length > 0"
          @click="isAddingNew = false"
          class="text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Name</label>
          <input v-model="editForm.name" type="text" placeholder="Sonarr 4K" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Protocol</label>
          <select v-model="editForm.protocol" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg">
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Host</label>
          <input v-model="editForm.host" type="text" placeholder="localhost" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Port</label>
          <input v-model.number="editForm.port" type="number" placeholder="8989" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Base Path</label>
          <input v-model="editForm.base_path" type="text" placeholder="/sonarr" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">API Key</label>
          <PasswordInput v-model="editForm.api_key" placeholder="Your Sonarr API key" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Associated Media Server</label>
          <select v-model="editForm.media_server_id" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg">
            <option :value="null">None (Not linked)</option>
            <option v-for="server in mediaServers" :key="server.id" :value="server.id">
              {{ server.name }} ({{ server.type }})
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Timeout (seconds)</label>
          <input v-model.number="editForm.timeout" type="number" min="5" max="120" class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg" />
        </div>
      </div>

      <div class="flex gap-3 pt-4 border-t border-gray-700">
        <button
          @click="testConnection"
          :disabled="loading"
          class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Connection' }}
        </button>
        <button
          @click="saveNewConfig"
          :disabled="saving"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import PasswordInput from '@/components/common/PasswordInput.vue'
import LibraryMappingPanel from '@/components/settings/LibraryMappingPanel.vue'

const toast = useToast()

const configs = ref([])
const mediaServers = ref([])
const loading = ref(false)
const saving = ref(false)
const isEditing = ref(false)
const isAddingNew = ref(false)
const editingId = ref(null)

const editForm = ref({
  name: 'Sonarr',
  protocol: 'http',
  host: 'localhost',
  port: 8989,
  base_path: '',
  api_key: '',
  verify_ssl: true,
  timeout: 30,
  media_server_id: null
})

const resetForm = () => {
  editForm.value = {
    name: 'Sonarr',
    protocol: 'http',
    host: 'localhost',
    port: 8989,
    base_path: '',
    api_key: '',
    verify_ssl: true,
    timeout: 30,
    media_server_id: null
  }
}

onMounted(async () => {
  await loadMediaServers()
  await loadConfigs()
})

const loadMediaServers = async () => {
  try {
    const response = await api.getMediaServers()
    mediaServers.value = response.data || []
  } catch (error) {
    console.error('Failed to load media servers:', error)
  }
}

const loadConfigs = async () => {
  try {
    const response = await api.getSonarrConfig()
    configs.value = response.data || []
  } catch (error) {
    console.error('Failed to load Sonarr configs:', error)
    toast.error('Failed to load configurations')
  }
}

const getMediaServerName = (id) => {
  if (!id) return 'Not linked'
  const server = mediaServers.value.find(s => s.id === id)
  return server ? server.name : 'Unknown'
}

const startEditing = (instance) => {
  editingId.value = instance.id
  isEditing.value = true
  isAddingNew.value = false
  editForm.value = { ...instance }
}

const startAddingNew = () => {
  resetForm()
  isAddingNew.value = true
  isEditing.value = false
  editingId.value = null
}

const cancelEdit = () => {
  isEditing.value = false
  editingId.value = null
  resetForm()
}

const testConnection = async () => {
  loading.value = true
  try {
    const response = await api.testSonarrConnection(editForm.value)
    if (response.data.success) {
      toast.success('Connection successful!')
    } else {
      toast.error(response.data.error || 'Connection failed')
    }
  } catch (error) {
    toast.error(error.response?.data?.error || 'Connection test failed')
  } finally {
    loading.value = false
  }
}

const testConnectionFor = async (instance) => {
  loading.value = true
  try {
    const response = await api.testSonarrConnection(instance)
    if (response.data.success) {
      toast.success(`${instance.name || 'Sonarr'}: Connection successful!`)
    } else {
      toast.error(response.data.error || 'Connection failed')
    }
  } catch (error) {
    toast.error(error.response?.data?.error || 'Connection test failed')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    await api.updateSonarrConfig(editingId.value, editForm.value)
    toast.success('Settings saved!')
    isEditing.value = false
    editingId.value = null
    await loadConfigs()
  } catch (error) {
    toast.error(error.response?.data?.error || 'Failed to save settings')
  } finally {
    saving.value = false
  }
}

const saveNewConfig = async () => {
  saving.value = true
  try {
    await api.addSonarrConfig(editForm.value)
    toast.success('Sonarr instance added!')
    isAddingNew.value = false
    resetForm()
    await loadConfigs()
  } catch (error) {
    toast.error(error.response?.data?.error || 'Failed to add instance')
  } finally {
    saving.value = false
  }
}

const deleteConfig = async (id) => {
  if (!confirm('Are you sure you want to delete this Sonarr instance?')) return
  
  try {
    await api.deleteSonarrConfig(id)
    toast.success('Instance deleted')
    await loadConfigs()
  } catch (error) {
    toast.error(error.response?.data?.error || 'Failed to delete')
  }
}
</script>

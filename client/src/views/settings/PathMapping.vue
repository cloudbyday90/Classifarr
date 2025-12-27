<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
-->

<template>
  <div class="space-y-6">
    <Card title="Path Mappings">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold">📁 Path Mappings</h2>
            <p class="text-gray-400 text-sm mt-1">
              Map paths between Radarr/Sonarr and Classifarr containers for reclassification
            </p>
          </div>
          <div class="flex gap-2">
            <Button 
              @click="verifyAll" 
              :loading="verifyingAll" 
              variant="secondary"
              size="sm"
            >
              Verify All
            </Button>
            <Button @click="showAddModal = true" size="sm">
              + Add Mapping
            </Button>
          </div>
        </div>
      </template>

      <!-- Loading state -->
      <div v-if="loading" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p class="text-gray-400 mt-4">Loading path mappings...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="mappings.length === 0" class="text-center py-12">
        <div class="text-4xl mb-4">📂</div>
        <h3 class="text-lg font-medium mb-2">No Path Mappings Configured</h3>
        <p class="text-gray-400 mb-4">
          Add mappings to translate Radarr/Sonarr paths to Classifarr container paths
        </p>
        <Button @click="showAddModal = true">Add Your First Mapping</Button>
      </div>

      <!-- Mappings table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-gray-400 text-sm border-b border-gray-700">
              <th class="pb-3 pr-4">*arr Path</th>
              <th class="pb-3 pr-4">Classifarr Path</th>
              <th class="pb-3 pr-4">Status</th>
              <th class="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="mapping in mappings" 
              :key="mapping.id"
              class="border-b border-gray-800 hover:bg-gray-800/50"
            >
              <td class="py-3 pr-4">
                <code class="text-blue-400 bg-gray-800 px-2 py-1 rounded text-sm">
                  {{ mapping.arr_path }}
                </code>
              </td>
              <td class="py-3 pr-4">
                <code class="text-green-400 bg-gray-800 px-2 py-1 rounded text-sm">
                  {{ mapping.local_path }}
                </code>
              </td>
              <td class="py-3 pr-4">
                <span 
                  v-if="mapping.verified" 
                  class="inline-flex items-center gap-1 text-green-400 text-sm"
                >
                  <span>✅</span> Verified
                </span>
                <span 
                  v-else-if="mapping.last_verified_at" 
                  class="inline-flex items-center gap-1 text-red-400 text-sm"
                >
                  <span>❌</span> Failed
                </span>
                <span v-else class="text-gray-500 text-sm">
                  Not verified
                </span>
              </td>
              <td class="py-3 text-right">
                <div class="flex gap-2 justify-end">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    @click="verifyMapping(mapping)"
                    :loading="verifyingId === mapping.id"
                  >
                    Test
                  </Button>
                  <Button 
                    size="sm" 
                    variant="danger" 
                    @click="deleteMapping(mapping)"
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Add/Edit Modal -->
    <Modal v-model="showAddModal" title="Add Path Mapping">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">*arr Path (Radarr/Sonarr)</label>
          <input 
            v-model="newMapping.arr_path"
            type="text"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="/movies"
          />
          <p class="text-gray-500 text-xs mt-1">Path as seen by Radarr/Sonarr</p>
        </div>

        <div class="flex items-center justify-center text-gray-500">
          <span class="text-2xl">↓</span>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Classifarr Path (Container)</label>
          <input 
            v-model="newMapping.local_path"
            type="text"
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="/data/movies"
          />
          <p class="text-gray-500 text-xs mt-1">Path as mounted in Classifarr container</p>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="secondary" @click="showAddModal = false">Cancel</Button>
          <Button 
            @click="saveMapping" 
            :loading="saving"
            :disabled="!newMapping.arr_path || !newMapping.local_path"
          >
            Save Mapping
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useToast } from '@/stores/toast'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Modal from '@/components/common/Modal.vue'

const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const mappings = ref([])
const showAddModal = ref(false)
const verifyingId = ref(null)
const verifyingAll = ref(false)

const newMapping = ref({
  arr_path: '',
  local_path: ''
})

onMounted(async () => {
  await loadMappings()
})

const loadMappings = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/settings/path-mappings')
    mappings.value = response.data
  } catch (error) {
    console.error('Failed to load path mappings:', error)
    toast.error('Failed to load path mappings')
  } finally {
    loading.value = false
  }
}

const saveMapping = async () => {
  saving.value = true
  try {
    await axios.post('/api/settings/path-mappings', newMapping.value)
    toast.success('Path mapping added')
    showAddModal.value = false
    newMapping.value = { arr_path: '', local_path: '' }
    await loadMappings()
  } catch (error) {
    console.error('Failed to save path mapping:', error)
    toast.error('Failed to save path mapping: ' + error.message)
  } finally {
    saving.value = false
  }
}

const deleteMapping = async (mapping) => {
  if (!confirm(`Delete mapping from "${mapping.arr_path}" to "${mapping.local_path}"?`)) {
    return
  }

  try {
    await axios.delete(`/api/settings/path-mappings/${mapping.id}`)
    toast.success('Path mapping deleted')
    await loadMappings()
  } catch (error) {
    console.error('Failed to delete path mapping:', error)
    toast.error('Failed to delete path mapping')
  }
}

const verifyMapping = async (mapping) => {
  verifyingId.value = mapping.id
  try {
    const response = await axios.post(`/api/settings/path-mappings/${mapping.id}/verify`)
    if (response.data.verified) {
      toast.success(`Path "${mapping.local_path}" is accessible`)
    } else {
      toast.error(response.data.error || 'Path verification failed')
    }
    await loadMappings()
  } catch (error) {
    console.error('Failed to verify path mapping:', error)
    toast.error('Failed to verify path mapping')
  } finally {
    verifyingId.value = null
  }
}

const verifyAll = async () => {
  verifyingAll.value = true
  try {
    const response = await axios.post('/api/settings/path-mappings/verify-all')
    const { verified, failed } = response.data.summary
    if (failed === 0) {
      toast.success(`All ${verified} path mappings verified successfully`)
    } else {
      toast.warning(`${verified} verified, ${failed} failed`)
    }
    await loadMappings()
  } catch (error) {
    console.error('Failed to verify all path mappings:', error)
    toast.error('Failed to verify path mappings')
  } finally {
    verifyingAll.value = false
  }
}
</script>

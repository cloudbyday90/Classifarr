<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Backup & Restore</h2>
      <p class="text-gray-400 text-sm">Protect your configuration with encrypted backups</p>
    </div>

    <!-- Export Section -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4 flex items-center gap-2">
        📤 Create Backup
      </h3>
      
      <div class="space-y-4">
        <!-- Backup Type -->
        <div>
          <label class="block text-sm font-medium mb-2">Backup Type</label>
          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                v-model="exportType" 
                value="encrypted"
                class="text-blue-600 focus:ring-blue-500"
              />
              <span>🔒 Encrypted (Recommended)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                v-model="exportType" 
                value="plaintext"
                class="text-blue-600 focus:ring-blue-500"
              />
              <span>⚠️ Plaintext (Not Recommended)</span>
            </label>
          </div>
        </div>

        <!-- Password Fields (for encrypted) -->
        <div v-if="exportType === 'encrypted'" class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              v-model="exportPassword"
              placeholder="Enter password (min 8 characters)"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Confirm Password</label>
            <input
              type="password"
              v-model="exportPasswordConfirm"
              placeholder="Confirm password"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p v-if="exportPassword && exportPassword !== exportPasswordConfirm" class="text-red-400 text-sm">
            Passwords do not match
          </p>
        </div>

        <!-- Plaintext Warning -->
        <div v-if="exportType === 'plaintext'" class="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <div class="flex gap-3">
            <span class="text-2xl">⚠️</span>
            <div>
              <h4 class="font-medium text-yellow-400 mb-1">Security Warning</h4>
              <p class="text-sm text-yellow-200">
                Plaintext backups store all configuration including API keys and service credentials in plain text. 
                Anyone with access to the file can read sensitive information.
              </p>
            </div>
          </div>
        </div>

        <!-- Options -->
        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="includePatterns"
              class="rounded text-blue-600 focus:ring-blue-500"
            />
            <span class="text-sm">Include discovered patterns (auto-learning data)</span>
          </label>
        </div>

        <!-- Create Button -->
        <button
          @click="createBackup"
          :disabled="exporting || !canExport"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ exporting ? 'Creating Backup...' : '💾 Create Backup' }}
        </button>
      </div>
    </div>

    <!-- Import Section -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4 flex items-center gap-2">
        📥 Restore Backup
      </h3>

      <div class="space-y-4">
        <!-- File Selection -->
        <div>
          <label class="block text-sm font-medium mb-2">Select Backup</label>
          <select
            v-model="selectedBackup"
            @change="onBackupSelect"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option :value="null">Choose a backup file...</option>
            <option v-for="backup in backups" :key="backup.filename" :value="backup">
              {{ backup.filename }} ({{ formatSize(backup.size) }}, {{ formatDate(backup.createdAt) }})
            </option>
          </select>
        </div>

        <!-- Password (for encrypted backups) -->
        <div v-if="selectedBackup?.type === 'encrypted'">
          <label class="block text-sm font-medium mb-2">Backup Password</label>
          <input
            type="password"
            v-model="importPassword"
            placeholder="Enter backup password"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Preview Button -->
        <button
          v-if="selectedBackup"
          @click="previewBackup"
          :disabled="previewing"
          class="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {{ previewing ? 'Loading Preview...' : '👁️ Preview Backup' }}
        </button>

        <!-- Preview Display -->
        <div v-if="preview" class="bg-gray-900 rounded-lg p-4 space-y-3">
          <h4 class="font-medium text-green-400 flex items-center gap-2">
            ✅ Backup Preview
          </h4>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div class="text-gray-400">Version:</div>
            <div>{{ preview.version }}</div>
            
            <div class="text-gray-400">Exported:</div>
            <div>{{ formatDate(preview.exportedAt) }}</div>
            
            <div class="text-gray-400">Users:</div>
            <div class="text-blue-400">{{ preview.itemCounts.users }}</div>
            
            <div class="text-gray-400">Media Servers:</div>
            <div class="text-blue-400">{{ preview.itemCounts.mediaServers }}</div>
            
            <div class="text-gray-400">Libraries:</div>
            <div class="text-blue-400">{{ preview.itemCounts.libraries }}</div>
            
            <div class="text-gray-400">Policies:</div>
            <div class="text-blue-400">{{ preview.itemCounts.policies }}</div>
            
            <div class="text-gray-400">Custom Rules:</div>
            <div class="text-green-400">{{ preview.itemCounts.customRules }}</div>
            
            <div class="text-gray-400">Learning Patterns:</div>
            <div class="text-purple-400">{{ preview.itemCounts.learningPatterns }}</div>
            
            <div class="text-gray-400">Auto-Learned:</div>
            <div class="text-yellow-400">{{ preview.itemCounts.autoLearnedPreferences }}</div>
          </div>
        </div>

        <!-- Restore Mode -->
        <div v-if="preview">
          <label class="block text-sm font-medium mb-2">Restore Mode</label>
          <select
            v-model="restoreMode"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="replace">Replace (Clear existing configuration first)</option>
            <option value="merge">Merge (Keep existing, add new items)</option>
          </select>
          <p class="text-xs text-gray-400 mt-1">
            Replace mode: Wipes current config and restores from backup<br/>
            Merge mode: Keeps existing data and adds items from backup
          </p>
        </div>

        <!-- Warning -->
        <div v-if="preview" class="bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div class="flex gap-3">
            <span class="text-2xl">⚠️</span>
            <div>
              <h4 class="font-medium text-red-400 mb-1">Warning</h4>
              <p class="text-sm text-red-200">
                <span v-if="restoreMode === 'replace'">
                  This will DELETE all existing configuration and replace it with the backup. This action cannot be undone.
                </span>
                <span v-else>
                  This will add data from the backup to your existing configuration. Conflicts may occur.
                </span>
              </p>
            </div>
          </div>
        </div>

        <!-- Restore Button -->
        <button
          v-if="preview"
          @click="performRestore"
          :disabled="importing"
          class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {{ importing ? 'Restoring...' : '♻️ Restore Backup' }}
        </button>

        <!-- Restore Result -->
        <div v-if="restoreResult" class="bg-gray-900 rounded-lg p-4 space-y-3">
          <h4 class="font-medium text-green-400 flex items-center gap-2">
            ✅ Restore Complete
          </h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-gray-400">Libraries Restored:</div>
            <div>{{ restoreResult.stats.librariesRestored }}</div>
            
            <div class="text-gray-400">Policies Restored:</div>
            <div>{{ restoreResult.stats.policiesRestored }}</div>
            
            <div class="text-gray-400">Rules Restored:</div>
            <div>{{ restoreResult.stats.rulesRestored }}</div>
            
            <div class="text-gray-400">Patterns Restored:</div>
            <div>{{ restoreResult.stats.patternsRestored }}</div>
          </div>
          
          <div v-if="restoreResult.newApiKey" class="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mt-3">
            <h5 class="font-medium text-yellow-400 text-sm mb-2">🔑 New API Key Generated</h5>
            <p class="text-xs text-yellow-200 mb-2">
              For security, a new API key has been generated. Update any external integrations with this key:
            </p>
            <code class="block bg-gray-900 p-2 rounded text-xs break-all">{{ restoreResult.newApiKey }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Backup List -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium">📁 Available Backups</h3>
        <button
          @click="loadBackups"
          :disabled="loadingBackups"
          class="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
        >
          {{ loadingBackups ? '⟳' : '🔄' }} Refresh
        </button>
      </div>

      <div v-if="loadingBackups" class="text-center py-8 text-gray-400">
        Loading backups...
      </div>

      <div v-else-if="backups.length === 0" class="text-center py-8 text-gray-400">
        No backups found. Create your first backup above.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-gray-700">
            <tr class="text-left text-gray-400">
              <th class="pb-2">Filename</th>
              <th class="pb-2">Type</th>
              <th class="pb-2">Size</th>
              <th class="pb-2">Created</th>
              <th class="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr v-for="backup in backups" :key="backup.filename">
              <td class="py-3 font-mono text-xs">{{ backup.filename }}</td>
              <td class="py-3">
                <span v-if="backup.type === 'encrypted'" class="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">
                  🔒 Encrypted
                </span>
                <span v-else class="px-2 py-1 bg-yellow-900 text-yellow-300 rounded text-xs">
                  📄 Plaintext
                </span>
              </td>
              <td class="py-3">{{ formatSize(backup.size) }}</td>
              <td class="py-3">{{ formatDate(backup.createdAt) }}</td>
              <td class="py-3 space-x-2">
                <button
                  @click="downloadBackup(backup.filename)"
                  class="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs transition-colors"
                  title="Download"
                >
                  ⬇️
                </button>
                <button
                  @click="confirmDelete(backup.filename)"
                  class="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs transition-colors"
                  title="Delete"
                >
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Info -->
    <div class="text-xs text-gray-500 space-y-1 bg-gray-900 rounded-lg p-4">
      <p class="font-medium text-gray-400 mb-2">ℹ️ What's Backed Up:</p>
      <ul class="list-disc list-inside space-y-1">
        <li>Service connections (Plex, Emby, Jellyfin, Radarr, Sonarr with API keys)</li>
        <li>Libraries, policies, custom rules, presets, and library labels</li>
        <li>Confidence settings and auto-learned preferences</li>
        <li>Scheduled tasks and path mappings</li>
        <li>All service configurations (Ollama, TMDB, OMDb, AI, Webhooks)</li>
        <li>General system settings</li>
        <li>Discovered patterns (optional)</li>
      </ul>
      <p class="font-medium text-gray-400 mt-3 mb-2">🚫 What's NOT Backed Up or Restored:</p>
      <ul class="list-disc list-inside space-y-1">
        <li>User accounts (must be manually recreated for security)</li>
        <li>Classification history and statistics</li>
        <li>Embeddings and queue state</li>
        <li>User passwords</li>
      </ul>
      <p class="font-medium text-gray-400 mt-3 mb-2">🔑 After Restore:</p>
      <ul class="list-disc list-inside space-y-1">
        <li>A new API key is generated and displayed - save it immediately</li>
        <li>Update any external integrations with the new API key</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const toast = useToast()

// Export state
const exportType = ref('encrypted')
const exportPassword = ref('')
const exportPasswordConfirm = ref('')
const includePatterns = ref(true)
const exporting = ref(false)

// Import state
const selectedBackup = ref(null)
const importPassword = ref('')
const previewing = ref(false)
const preview = ref(null)
const restoreMode = ref('replace')
const importing = ref(false)
const restoreResult = ref(null)

// Backups list
const backups = ref([])
const loadingBackups = ref(false)

// Computed
const canExport = computed(() => {
  if (exportType.value === 'encrypted') {
    return exportPassword.value.length >= 8 && exportPassword.value === exportPasswordConfirm.value
  }
  return true
})

// Methods
const createBackup = async () => {
  exporting.value = true
  restoreResult.value = null
  
  try {
    const options = {
      encrypted: exportType.value === 'encrypted',
      password: exportType.value === 'encrypted' ? exportPassword.value : undefined,
      includePatterns: includePatterns.value
    }

    const response = await api.createBackup(options)
    
    toast.success(`Backup created: ${response.data.filename}`)
    
    // Reset form
    exportPassword.value = ''
    exportPasswordConfirm.value = ''
    
    // Reload backups list
    await loadBackups()
  } catch (error) {
    toast.error('Backup creation failed: ' + (error.response?.data?.error || error.message))
  } finally {
    exporting.value = false
  }
}

const loadBackups = async () => {
  loadingBackups.value = true
  try {
    const response = await api.listBackups()
    backups.value = response.data.backups
  } catch (error) {
    toast.error('Failed to load backups: ' + (error.response?.data?.error || error.message))
  } finally {
    loadingBackups.value = false
  }
}

const onBackupSelect = () => {
  preview.value = null
  importPassword.value = ''
  restoreResult.value = null
}

const previewBackup = async () => {
  if (!selectedBackup.value) return
  
  previewing.value = true
  preview.value = null
  
  try {
    const response = await api.previewBackupFile(
      selectedBackup.value.filename,
      selectedBackup.value.type === 'encrypted' ? importPassword.value : undefined
    )
    preview.value = response.data
    toast.success('Preview loaded')
  } catch (error) {
    toast.error('Preview failed: ' + (error.response?.data?.error || error.message))
  } finally {
    previewing.value = false
  }
}

const performRestore = async () => {
  if (!selectedBackup.value || !preview.value) return
  
  if (!confirm(`Are you sure you want to ${restoreMode.value === 'replace' ? 'REPLACE' : 'MERGE'} your configuration? This action cannot be undone.`)) {
    return
  }
  
  importing.value = true
  restoreResult.value = null
  
  try {
    const response = await api.restoreBackup(
      selectedBackup.value.filename,
      selectedBackup.value.type === 'encrypted' ? importPassword.value : undefined,
      restoreMode.value
    )
    
    restoreResult.value = response.data
    toast.success('Backup restored successfully!')
    
    // Clear preview
    preview.value = null
    selectedBackup.value = null
    importPassword.value = ''
  } catch (error) {
    toast.error('Restore failed: ' + (error.response?.data?.error || error.message))
  } finally {
    importing.value = false
  }
}

const downloadBackup = async (filename) => {
  try {
    const response = await api.downloadBackup(filename)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    toast.success('Backup downloaded')
  } catch (error) {
    toast.error('Download failed: ' + (error.response?.data?.error || error.message))
  }
}

const confirmDelete = async (filename) => {
  if (!confirm(`Are you sure you want to delete ${filename}? This action cannot be undone.`)) {
    return
  }
  
  try {
    await api.deleteBackup(filename)
    toast.success('Backup deleted')
    await loadBackups()
  } catch (error) {
    toast.error('Delete failed: ' + (error.response?.data?.error || error.message))
  }
}

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

// Load backups on mount
onMounted(() => {
  loadBackups()
})
</script>

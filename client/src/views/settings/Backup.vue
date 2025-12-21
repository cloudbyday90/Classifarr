<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Backup & Restore</h2>
      <p class="text-gray-400 text-sm">Export and import rules, schedules, and learned patterns</p>
    </div>

    <!-- Export Section -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4">📤 Export</h3>
      <p class="text-gray-400 text-sm mb-4">
        Download a backup of your rules, schedules, and learned patterns.
      </p>
      <button
        @click="exportData"
        :disabled="exporting"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        {{ exporting ? 'Exporting...' : '⬇️ Download Backup' }}
      </button>
    </div>

    <!-- Import Section -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-medium mb-4">📥 Import</h3>
      <p class="text-gray-400 text-sm mb-4">
        Restore rules from a backup file.
      </p>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">Select Backup File</label>
          <input
            type="file"
            accept=".json"
            @change="handleFileSelect"
            class="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600"
          />
        </div>

        <div v-if="preview" class="bg-gray-900 rounded-lg p-4">
          <h4 class="font-medium mb-2">Preview</h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>Custom Rules:</div>
            <div class="text-blue-400">{{ preview.customRules }}</div>
            <div>Learning Patterns:</div>
            <div class="text-green-400">{{ preview.learningPatterns }}</div>
            <div>Scheduled Tasks:</div>
            <div class="text-purple-400">{{ preview.scheduledTasks }}</div>
            <div>Libraries:</div>
            <div class="text-gray-400">{{ preview.libraries }}</div>
          </div>
        </div>

        <div v-if="importData">
          <label class="block text-sm font-medium mb-2">Merge Mode</label>
          <select
            v-model="mergeMode"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="skip">Skip existing (don't overwrite)</option>
            <option value="overwrite">Overwrite existing</option>
          </select>
        </div>

        <button
          v-if="importData"
          @click="performImport"
          :disabled="importing"
          class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {{ importing ? 'Importing...' : '⬆️ Import Backup' }}
        </button>
      </div>

      <div v-if="importResult" class="mt-4 bg-gray-900 rounded-lg p-4">
        <h4 class="font-medium mb-2 text-green-400">✅ Import Complete</h4>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>Custom Rules:</div>
          <div>{{ importResult.customRules.imported }} imported, {{ importResult.customRules.skipped }} skipped</div>
          <div>Learning Patterns:</div>
          <div>{{ importResult.learningPatterns.imported }} imported, {{ importResult.learningPatterns.skipped }} skipped</div>
          <div>Scheduled Tasks:</div>
          <div>{{ importResult.scheduledTasks.imported }} imported, {{ importResult.scheduledTasks.skipped }} skipped</div>
        </div>
      </div>
    </div>

    <!-- Info -->
    <div class="text-xs text-gray-500 space-y-1">
      <p>• Backups include: custom rules, learned patterns, scheduled tasks</p>
      <p>• Library configurations are included for reference but not restored</p>
      <p>• Use "Skip existing" to avoid overwriting your current rules</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const toast = useToast()

const exporting = ref(false)
const importing = ref(false)
const importData = ref(null)
const preview = ref(null)
const mergeMode = ref('skip')
const importResult = ref(null)

const exportData = async () => {
  exporting.value = true
  try {
    const response = await api.exportBackup()
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `classifarr-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup downloaded')
  } catch (error) {
    toast.error('Export failed: ' + (error.response?.data?.error || error.message))
  } finally {
    exporting.value = false
  }
}

const handleFileSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    
    if (!data.data) {
      toast.error('Invalid backup file format')
      return
    }

    importData.value = data.data
    
    const previewRes = await api.previewBackup(data.data)
    preview.value = previewRes.data
  } catch (error) {
    toast.error('Failed to read backup file')
  }
}

const performImport = async () => {
  importing.value = true
  importResult.value = null
  
  try {
    const response = await api.importBackup(importData.value, { mergeMode: mergeMode.value })
    importResult.value = response.data.results
    toast.success('Import completed')
  } catch (error) {
    toast.error('Import failed: ' + (error.response?.data?.error || error.message))
  } finally {
    importing.value = false
  }
}
</script>

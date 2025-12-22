<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="rounded-lg border p-4" :class="statusClasses">
    <!-- Idle -->
    <div v-if="status === 'idle'" class="flex items-center gap-3 text-gray-400">
      <span class="text-2xl">○</span>
      <div>
        <div class="font-medium">Not Connected</div>
        <div class="text-sm">Click "Test Connection" to verify your settings</div>
      </div>
    </div>
    
    <!-- Testing -->
    <div v-else-if="status === 'testing'" class="flex items-center gap-3 text-blue-400">
      <Spinner size="md" color="primary" />
      <div class="flex-1">
        <div class="font-medium">Testing Connection...</div>
        <div class="text-sm">Connecting to {{ serviceName }}</div>
        <div class="mt-2 h-1 bg-gray-700 rounded overflow-hidden">
          <div class="h-full bg-blue-500 animate-pulse" style="width: 60%"></div>
        </div>
      </div>
    </div>
    
    <!-- Success -->
    <div v-else-if="status === 'success'">
      <div class="flex items-center gap-3 text-green-400 mb-3">
        <span class="text-2xl">✅</span>
        <div class="font-medium">Connected Successfully</div>
      </div>
      <div v-if="details" class="space-y-2 text-sm border-t border-gray-700 pt-3">
        <div v-if="details.serverName" class="flex justify-between">
          <span class="text-gray-400">Server:</span>
          <span>{{ details.serverName }}</span>
        </div>
        <div v-if="details.version" class="flex justify-between">
          <span class="text-gray-400">Version:</span>
          <span>{{ details.version }}</span>
        </div>
        <div v-for="(value, key) in details.additionalInfo" :key="key" class="flex justify-between">
          <span class="text-gray-400">{{ key }}:</span>
          <span>{{ value }}</span>
        </div>
      </div>
      <div v-if="lastChecked" class="text-xs text-gray-500 mt-2">
        Last checked: {{ formatTime(lastChecked) }}
      </div>
    </div>
    
    <!-- Error -->
    <div v-else-if="status === 'error'">
      <div class="flex items-center gap-3 text-red-400 mb-3">
        <span class="text-2xl">❌</span>
        <div class="font-medium">Connection Failed</div>
      </div>
      <div v-if="error" class="space-y-3 text-sm border-t border-gray-700 pt-3">
        <div class="text-red-300">
          {{ error.code ? `${error.code}: ` : '' }}{{ error.message }}
        </div>
        <div v-if="error.troubleshooting?.length" class="space-y-1">
          <div class="text-gray-400 flex items-center gap-2">
            <span>💡</span> Troubleshooting:
          </div>
          <ul class="list-disc list-inside text-gray-300 space-y-1 ml-6">
            <li v-for="tip in error.troubleshooting" :key="tip">{{ tip }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Unknown (Saved but not tested) -->
    <div v-else-if="status === 'unknown'" class="flex items-center gap-3 text-gray-400">
      <span class="text-2xl">💾</span>
      <div>
        <div class="font-medium">Configuration Saved</div>
        <div class="text-sm">Click "Test Connection" to check connectivity</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Spinner from './Spinner.vue'

const props = defineProps({
  status: { type: String, default: 'idle' }, // idle, testing, success, error
  serviceName: { type: String, default: 'service' },
  details: { type: Object, default: null },
  error: { type: Object, default: null },
  lastChecked: { type: Date, default: null }
})

const statusClasses = computed(() => ({
  'idle': 'border-gray-700 bg-gray-800/50',
  'testing': 'border-blue-700 bg-blue-900/20',
  'success': 'border-green-700 bg-green-900/20',
  'error': 'border-red-700 bg-red-900/20',
  'unknown': 'border-gray-600 bg-gray-800/80'
}[props.status]))

const formatTime = (date) => {
  if (!date) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`
  return date.toLocaleTimeString()
}
</script>

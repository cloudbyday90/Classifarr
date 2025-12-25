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
        <span>🔧</span>
        <span>Path Testing</span>
      </h2>
      <p class="text-gray-400 text-sm">Test path accessibility and translation for re-classification</p>
    </div>

    <!-- Health Check Summary -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-medium">Re-Classification Health</h3>
        <button 
          @click="runHealthCheck" 
          :disabled="healthLoading"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-sm"
        >
          {{ healthLoading ? 'Checking...' : '🔄 Refresh' }}
        </button>
      </div>
      
      <div v-if="health" class="space-y-3">
        <div class="flex items-center gap-2">
          <span :class="health.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'">
            {{ health.status === 'healthy' ? '✅' : '⚠️' }}
          </span>
          <span class="font-medium">Status: {{ health.status }}</span>
        </div>
        
        <div v-if="health.checks" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <!-- Media Path -->
          <div class="bg-gray-900 rounded-lg p-3">
            <div class="text-sm text-gray-400 mb-1">Media Path</div>
            <div class="flex items-center gap-2">
              <span :class="health.checks.mediaPath?.accessible ? 'text-green-400' : 'text-red-400'">
                {{ health.checks.mediaPath?.accessible ? '✅' : '❌' }}
              </span>
              <span>{{ health.checks.mediaPath?.accessible ? 'Accessible' : 'Not Configured' }}</span>
            </div>
            <div v-if="health.checks.mediaPath?.path" class="text-xs text-gray-500 mt-1 truncate">
              {{ health.checks.mediaPath.path }}
            </div>
          </div>
          
          <!-- Mappings -->
          <div class="bg-gray-900 rounded-lg p-3">
            <div class="text-sm text-gray-400 mb-1">Library Mappings</div>
            <div class="flex items-center gap-2">
              <span :class="health.checks.mappings?.configured ? 'text-green-400' : 'text-yellow-400'">
                {{ health.checks.mappings?.configured ? '✅' : '⚠️' }}
              </span>
              <span>{{ health.checks.mappings?.count || 0 }} configured</span>
            </div>
          </div>
          
          <!-- *arr Instances -->
          <div class="bg-gray-900 rounded-lg p-3">
            <div class="text-sm text-gray-400 mb-1">Linked *arr Instances</div>
            <div class="flex items-center gap-2" v-if="health.checks.arrInstances">
              <span class="text-blue-400">🎬</span>
              <span>{{ health.checks.arrInstances.radarrLinked || 0 }} Radarr</span>
              <span class="text-blue-400">📺</span>
              <span>{{ health.checks.arrInstances.sonarrLinked || 0 }} Sonarr</span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else-if="healthLoading" class="text-gray-400 text-center py-4">
        Loading health status...
      </div>
    </div>

    <!-- Path Tester -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 class="text-lg font-medium mb-4">Path Accessibility Test</h3>
      <p class="text-sm text-gray-400 mb-4">Test if a path is accessible from the Classifarr container</p>
      
      <div class="flex gap-3">
        <input 
          v-model="testPath"
          type="text"
          placeholder="/data/media/movies (as seen from Classifarr)"
          class="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg"
        />
        <button 
          @click="testPathAccessibility"
          :disabled="!testPath || pathTesting"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg"
        >
          {{ pathTesting ? 'Testing...' : 'Test Path' }}
        </button>
      </div>
      
      <!-- Test Result -->
      <div v-if="pathResult" class="mt-4 bg-gray-900 rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <span :class="pathResult.accessible ? 'text-green-400' : 'text-red-400'">
            {{ pathResult.accessible ? '✅ Accessible' : '❌ Not Accessible' }}
          </span>
        </div>
        
        <div v-if="pathResult.accessible" class="text-sm space-y-1">
          <div><span class="text-gray-400">Type:</span> {{ pathResult.isDirectory ? 'Directory' : 'File' }}</div>
          <div><span class="text-gray-400">Readable:</span> {{ pathResult.readable ? 'Yes' : 'No' }}</div>
          <div><span class="text-gray-400">Writable:</span> {{ pathResult.writable ? 'Yes' : 'No' }}</div>
          <div v-if="pathResult.contents">
            <span class="text-gray-400">Contents (first 10):</span>
            <ul class="ml-4 mt-1 text-xs text-gray-500">
              <li v-for="item in pathResult.contents" :key="item.name">
                {{ item.isDirectory ? '📁' : '📄' }} {{ item.name }}
              </li>
            </ul>
          </div>
        </div>
        
        <div v-else-if="pathResult.error" class="text-sm">
          <div class="text-red-400">{{ pathResult.error.message }}</div>
          <div v-if="pathResult.error.suggestion" class="text-yellow-400 mt-1">
            💡 {{ pathResult.error.suggestion }}
          </div>
        </div>
      </div>
    </div>

    <!-- Common Paths Guide -->
    <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <h3 class="text-lg font-medium mb-3">📖 Path Configuration Guide</h3>
      <div class="text-sm text-gray-400 space-y-2">
        <p><strong>Docker environments</strong> use different paths for the same files:</p>
        <ul class="list-disc ml-6 space-y-1">
          <li><strong>Plex path:</strong> e.g., <code class="bg-gray-900 px-1 rounded">/media/movies</code></li>
          <li><strong>Radarr path:</strong> e.g., <code class="bg-gray-900 px-1 rounded">/movies</code></li>
          <li><strong>Classifarr path:</strong> e.g., <code class="bg-gray-900 px-1 rounded">/data/movies</code></li>
        </ul>
        <p class="mt-4">Configure in <code class="bg-gray-900 px-1 rounded">docker-compose.yml</code>:</p>
        <pre class="bg-gray-900 p-2 rounded mt-2 text-xs overflow-x-auto">volumes:
  - /your/host/media:/data/media:ro</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const toast = useToast()

const health = ref(null)
const healthLoading = ref(false)
const testPath = ref('')
const pathTesting = ref(false)
const pathResult = ref(null)

onMounted(async () => {
  await runHealthCheck()
})

const runHealthCheck = async () => {
  healthLoading.value = true
  try {
    const response = await api.get('/settings/path-test/health')
    health.value = response.data
  } catch (error) {
    console.error('Health check failed:', error)
    toast.error('Health check failed')
  } finally {
    healthLoading.value = false
  }
}

const testPathAccessibility = async () => {
  if (!testPath.value) return
  
  pathTesting.value = true
  pathResult.value = null
  
  try {
    const response = await api.post('/settings/path-test', { path: testPath.value })
    pathResult.value = response.data
  } catch (error) {
    console.error('Path test failed:', error)
    pathResult.value = { 
      accessible: false, 
      error: { message: error.message || 'Test failed' } 
    }
  } finally {
    pathTesting.value = false
  }
}
</script>

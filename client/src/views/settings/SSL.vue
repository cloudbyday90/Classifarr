<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-white mb-2">SSL/TLS Configuration</h2>
      <p class="text-gray-400">Configure HTTPS and SSL certificates for secure connections</p>
    </div>

    <div v-if="loading" class="bg-gray-800 rounded-lg p-8 text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      <p class="text-gray-400 mt-4">Loading SSL configuration...</p>
    </div>

    <div v-else class="space-y-6">
      <!-- SSL Status Card -->
      <div class="bg-gray-800 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-white">HTTPS Status</h3>
            <p class="text-gray-400 text-sm">Enable or disable HTTPS connections</p>
          </div>
          <button
            @click="toggleSSL"
            :class="config.enabled ? 'bg-green-600' : 'bg-gray-600'"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            :disabled="saving"
          >
            <span
              :class="config.enabled ? 'translate-x-6' : 'translate-x-1'"
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            />
          </button>
        </div>

        <div v-if="config.enabled" class="flex items-center gap-2 text-green-400 text-sm">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          HTTPS is enabled
        </div>
        <div v-else class="flex items-center gap-2 text-gray-400 text-sm">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          HTTPS is disabled
        </div>
      </div>

      <!-- Certificate Paths -->
      <div class="bg-gray-800 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-white mb-4">Certificate Configuration</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Certificate Path
            </label>
            <input
              v-model="config.cert_path"
              type="text"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="/app/certs/cert.pem"
              :disabled="saving"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Private Key Path
            </label>
            <input
              v-model="config.key_path"
              type="text"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="/app/certs/key.pem"
              :disabled="saving"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              CA Certificate Path (Optional)
            </label>
            <input
              v-model="config.ca_path"
              type="text"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="/app/certs/ca.pem"
              :disabled="saving"
            />
            <p class="text-gray-500 text-sm mt-1">Required for client certificate verification (mTLS)</p>
          </div>

          <button
            @click="testCertificates"
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
            :disabled="testing || !config.cert_path || !config.key_path"
          >
            {{ testing ? 'Testing...' : 'Test Certificates' }}
          </button>

          <div v-if="testResult" class="mt-4">
            <div
              :class="testResult.valid ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-red-500/10 border-red-500 text-red-400'"
              class="border rounded-lg p-4"
            >
              <p class="font-medium">{{ testResult.message || testResult.error }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- HTTPS Options -->
      <div class="bg-gray-800 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-white mb-4">HTTPS Options</h3>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-white font-medium">Force HTTPS Redirect</p>
              <p class="text-gray-400 text-sm">Automatically redirect HTTP to HTTPS</p>
            </div>
            <button
              @click="config.force_https = !config.force_https"
              :class="config.force_https ? 'bg-blue-600' : 'bg-gray-600'"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :disabled="saving"
            >
              <span
                :class="config.force_https ? 'translate-x-6' : 'translate-x-1'"
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              />
            </button>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <p class="text-white font-medium">Enable HSTS</p>
              <p class="text-gray-400 text-sm">HTTP Strict Transport Security headers</p>
            </div>
            <button
              @click="config.hsts_enabled = !config.hsts_enabled"
              :class="config.hsts_enabled ? 'bg-blue-600' : 'bg-gray-600'"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :disabled="saving"
            >
              <span
                :class="config.hsts_enabled ? 'translate-x-6' : 'translate-x-1'"
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              />
            </button>
          </div>

          <div v-if="config.hsts_enabled">
            <label class="block text-sm font-medium text-gray-300 mb-2">
              HSTS Max Age (seconds)
            </label>
            <input
              v-model.number="config.hsts_max_age"
              type="number"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              :disabled="saving"
            />
            <p class="text-gray-500 text-sm mt-1">Default: 31536000 (1 year)</p>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <p class="text-white font-medium">Require Client Certificates (mTLS)</p>
              <p class="text-gray-400 text-sm">Mutual TLS authentication</p>
            </div>
            <button
              @click="config.client_cert_required = !config.client_cert_required"
              :class="config.client_cert_required ? 'bg-blue-600' : 'bg-gray-600'"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :disabled="saving"
            >
              <span
                :class="config.client_cert_required ? 'translate-x-6' : 'translate-x-1'"
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end gap-4">
        <button
          @click="loadConfig"
          class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          :disabled="saving"
        >
          Reset
        </button>
        <button
          @click="saveConfig"
          class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          :disabled="saving"
        >
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
      </div>

      <!-- Warning -->
      <div class="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p class="text-yellow-400 font-medium">Important Notes</p>
            <ul class="text-yellow-300 text-sm mt-2 space-y-1 list-disc list-inside">
              <li>Server restart is required for SSL changes to take effect</li>
              <li>Mount certificates to <code class="bg-gray-900 px-1 rounded">/app/certs</code> in docker-compose.yml</li>
              <li>Ensure certificate files have proper permissions (readable by application)</li>
              <li>Client certificates are only required if mTLS is enabled</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const config = ref({
  enabled: false,
  cert_path: '/app/certs/cert.pem',
  key_path: '/app/certs/key.pem',
  ca_path: '',
  force_https: true,
  hsts_enabled: true,
  hsts_max_age: 31536000,
  client_cert_required: false
})

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

async function loadConfig() {
  loading.value = true

  try {
    const { data } = await axios.get('/api/settings/ssl')
    if (data) {
      config.value = data
    }
  } catch (error) {
    console.error('Failed to load SSL config:', error)
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true

  try {
    const { data } = await axios.put('/api/settings/ssl', config.value)
    alert(data.message || 'SSL configuration saved successfully')
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to save SSL configuration')
  } finally {
    saving.value = false
  }
}

async function toggleSSL() {
  config.value.enabled = !config.value.enabled
}

async function testCertificates() {
  testing.value = true
  testResult.value = null

  try {
    const { data } = await axios.post('/api/settings/ssl/test', {
      cert_path: config.value.cert_path,
      key_path: config.value.key_path
    })
    testResult.value = data
  } catch (error) {
    testResult.value = {
      valid: false,
      error: error.response?.data?.error || 'Certificate test failed'
    }
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

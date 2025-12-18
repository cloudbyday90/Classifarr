<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">SSL/HTTPS Configuration</h2>

    <!-- Information Banner -->
    <div class="bg-blue-900/30 border border-blue-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold mb-3 flex items-center">
        <span class="mr-2">🔒</span>
        HTTPS Configuration Options
      </h3>
      <p class="text-gray-300 mb-4">Choose how you want to secure your Classifarr instance:</p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div :class="['p-4 rounded-lg border-2 transition-colors', !config.enabled ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800']">
          <h4 class="font-semibold mb-2 flex items-center">
            <span class="mr-2">🌐</span>
            Reverse Proxy (Recommended)
          </h4>
          <p class="text-sm text-gray-400 mb-2">Use Nginx Proxy Manager, Traefik, Caddy, or similar to handle HTTPS.</p>
          <ul class="text-sm text-gray-400 space-y-1">
            <li>✓ Automatic certificate management (Let's Encrypt)</li>
            <li>✓ Centralized SSL for all services</li>
            <li>✓ No certificate files needed in Classifarr</li>
          </ul>
          <p class="text-xs text-gray-500 mt-2">Leave HTTPS disabled below if using a reverse proxy.</p>
        </div>
        
        <div :class="['p-4 rounded-lg border-2 transition-colors', config.enabled ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800']">
          <h4 class="font-semibold mb-2 flex items-center">
            <span class="mr-2">🔐</span>
            Direct HTTPS
          </h4>
          <p class="text-sm text-gray-400 mb-2">Have Classifarr serve HTTPS directly on port 21325.</p>
          <ul class="text-sm text-gray-400 space-y-1">
            <li>✓ No additional software needed</li>
            <li>✓ Good for standalone deployments</li>
            <li>⚠️ Requires manual certificate management</li>
          </ul>
          <p class="text-xs text-gray-500 mt-2">Enable HTTPS below and provide certificate paths.</p>
        </div>
      </div>
    </div>

    <!-- Direct HTTPS Settings -->
    <div class="bg-gray-800 rounded-lg p-6">
      <h3 class="text-xl font-semibold mb-4">Direct HTTPS Settings</h3>
      
      <div class="space-y-4">
        <div class="flex items-start">
          <input
            type="checkbox"
            v-model="config.enabled"
            id="ssl-enabled"
            class="mt-1 mr-3 w-4 h-4"
          />
          <div class="flex-1">
            <label for="ssl-enabled" class="font-medium cursor-pointer">
              Enable direct HTTPS on port 21325
            </label>
            <p class="text-sm text-gray-400 mt-1">
              Only enable if NOT using a reverse proxy. Your reverse proxy should handle TLS termination.
            </p>
          </div>
        </div>

        <div v-if="config.enabled" class="space-y-4 mt-6">
          <div>
            <label class="block text-sm font-medium mb-2">Certificate Path</label>
            <input
              v-model="config.cert_path"
              type="text"
              placeholder="/app/certs/cert.pem"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Private Key Path</label>
            <input
              v-model="config.key_path"
              type="text"
              placeholder="/app/certs/key.pem"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">CA Certificate Path (Optional - for mTLS)</label>
            <input
              v-model="config.ca_path"
              type="text"
              placeholder="/app/certs/ca.pem"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div class="flex items-start">
            <input
              type="checkbox"
              v-model="config.force_https"
              id="force-https"
              class="mt-1 mr-3 w-4 h-4"
            />
            <label for="force-https" class="font-medium cursor-pointer">
              Redirect HTTP to HTTPS
            </label>
          </div>

          <div class="flex items-start">
            <input
              type="checkbox"
              v-model="config.hsts_enabled"
              id="hsts-enabled"
              class="mt-1 mr-3 w-4 h-4"
            />
            <div class="flex-1">
              <label for="hsts-enabled" class="font-medium cursor-pointer">
                Enable HSTS (HTTP Strict Transport Security)
              </label>
              <p class="text-xs text-gray-500 mt-1">Forces browsers to always use HTTPS</p>
            </div>
          </div>

          <div class="flex items-start">
            <input
              type="checkbox"
              v-model="config.client_cert_required"
              id="client-cert"
              class="mt-1 mr-3 w-4 h-4"
            />
            <div class="flex-1">
              <label for="client-cert" class="font-medium cursor-pointer">
                Require Client Certificate (Mutual TLS)
              </label>
              <p class="text-xs text-gray-500 mt-1">For high-security environments. Clients must present a valid certificate.</p>
            </div>
          </div>

          <div class="flex gap-3">
            <button
              @click="testCertificates"
              :disabled="testing || !config.cert_path || !config.key_path"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {{ testing ? 'Testing...' : 'Test Certificates' }}
            </button>
          </div>

          <div v-if="testResult" :class="['p-3 rounded-lg', testResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
            {{ testResult.message }}
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            @click="saveConfig"
            :disabled="saving"
            class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {{ saving ? 'Saving...' : 'Save Configuration' }}
          </button>
        </div>

        <div v-if="saveMessage" :class="['p-3 rounded-lg', saveSuccess ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
          {{ saveMessage }}
        </div>
      </div>
    </div>

    <!-- Docker Compose Example -->
    <div v-if="config.enabled" class="bg-gray-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold mb-3">Docker Compose Example</h3>
      <p class="text-sm text-gray-400 mb-3">Update your docker-compose.yml to mount certificate files:</p>
      <pre class="bg-gray-900 p-4 rounded-lg text-xs overflow-x-auto"><code>services:
  classifarr:
    ports:
      - "21324:21324"   # HTTP
      - "21325:21325"   # HTTPS
    volumes:
      - classifarr_data:/app/data
      - ./certs:/app/certs:ro  # Mount your certificate directory</code></pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const config = ref({
  enabled: false,
  cert_path: '',
  key_path: '',
  ca_path: '',
  force_https: false,
  hsts_enabled: false,
  hsts_max_age: 31536000,
  client_cert_required: false
})

const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)
const saveMessage = ref('')
const saveSuccess = ref(false)

onMounted(async () => {
  await loadConfig()
})

const loadConfig = async () => {
  try {
    const response = await axios.get('/api/settings/ssl')
    if (response.data) {
      config.value = { ...config.value, ...response.data }
    }
  } catch (error) {
    console.error('Failed to load SSL config:', error)
  }
}

const testCertificates = async () => {
  testing.value = true
  testResult.value = null

  try {
    const response = await axios.post('/api/settings/ssl/test', {
      cert_path: config.value.cert_path,
      key_path: config.value.key_path,
      ca_path: config.value.ca_path
    })

    if (response.data.valid) {
      testResult.value = {
        success: true,
        message: response.data.message || 'SSL certificates are valid'
      }
    } else {
      testResult.value = {
        success: false,
        message: response.data.error || 'Certificate validation failed'
      }
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: error.response?.data?.error || 'Failed to test certificates'
    }
  } finally {
    testing.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  saveMessage.value = ''

  try {
    const response = await axios.put('/api/settings/ssl', config.value)
    saveSuccess.value = true
    saveMessage.value = response.data.message || 'SSL configuration saved successfully. Restart required for changes to take effect.'
  } catch (error) {
    saveSuccess.value = false
    saveMessage.value = error.response?.data?.error || 'Failed to save SSL configuration'
  } finally {
    saving.value = false
  }
}
</script>

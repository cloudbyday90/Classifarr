<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">General Settings</h2>
      <p class="text-gray-400 text-sm">General application configuration</p>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Application Name</label>
        <input
          v-model="settings.app_name"
          type="text"
          placeholder="Classifarr"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Theme</label>
        <select
          v-model="settings.theme"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>

      <div v-if="status" :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
        {{ status.message }}
      </div>

      <div>
        <button
          @click="saveSettings"
          :disabled="saving"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const settings = ref({
  app_name: 'Classifarr',
  theme: 'dark',
})

const saving = ref(false)
const status = ref(null)

onMounted(async () => {
  try {
    const response = await axios.get('/api/settings')
    if (response.data) {
      settings.value = {
        app_name: response.data.app_name || 'Classifarr',
        theme: response.data.theme || 'dark',
      }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
})

const saveSettings = async () => {
  saving.value = true
  status.value = null
  try {
    await axios.put('/api/settings', settings.value)
    status.value = { type: 'success', message: 'Settings saved successfully!' }
  } catch (error) {
    status.value = { type: 'error', message: `Failed to save: ${error.message}` }
  } finally {
    saving.value = false
  }
}
</script>

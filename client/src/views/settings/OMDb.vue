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
        <span>🎬</span>
        <span>OMDb Configuration</span>
      </h2>
      <p class="text-gray-400 text-sm">
        Connect to OMDb (Open Movie Database) API for movie and TV show metadata.
        Free tier includes 1,000 requests per day.
      </p>
    </div>

    <Card title="OMDb API Settings">
      <div v-if="loading" class="text-center py-4 text-gray-400">
        Loading configuration...
      </div>
      <div v-else class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
          <PasswordInput 
            v-model="config.api_key" 
            placeholder="Enter your OMDb API key" 
          />
          <p class="text-xs text-gray-500 mt-1">
            Get your free key from <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" class="text-blue-400 hover:underline">omdbapi.com</a>
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Daily Request Limit</label>
          <Input 
            v-model="config.daily_limit" 
            type="number"
            placeholder="1000"
            min="1"
          />
          <p class="text-xs text-gray-500 mt-1">
            Analysis pauses when limit is reached. Free tier: 1,000 requests/day.
          </p>
        </div>

        <div v-if="usage" class="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-gray-300">Daily Usage</span>
            <span class="text-sm" :class="usagePercentage >= 90 ? 'text-red-400' : 'text-gray-400'">
              {{ usage.requests_today }} / {{ config.daily_limit || 1000 }}
            </span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div 
              class="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
              :class="usagePercentage >= 90 ? 'bg-red-500' : 'bg-blue-600'"
              :style="{ width: `${usagePercentage}%` }"
            ></div>
          </div>
          <p class="text-xs text-gray-500 mt-2 flex justify-between">
            <span>Resets strictly at implementation logic reset time (UTC/Local)</span>
            <span v-if="usage.last_reset_date">Last reset: {{ new Date(usage.last_reset_date).toLocaleDateString() }}</span>
          </p>
        </div>

        <Toggle 
          v-model="config.is_active" 
          label="Enable OMDb Enrichment" 
          description="Use OMDb for movie/TV data (rating, genre, plot, content rating)"
        />

        <div class="flex justify-between pt-4 border-t border-gray-700">
          <Button 
            @click="testConnection" 
            variant="secondary"
            :loading="testing"
            :disabled="!config.api_key"
          >
            Test Connection
          </Button>

          <Button 
            @click="saveConfig" 
            :loading="saving"
            :disabled="!config.api_key"
          >
            Save Changes
          </Button>
        </div>

        <div v-if="testResult" class="mt-4 p-3 rounded-lg text-sm" :class="testResult.success ? 'bg-green-900/20 text-green-400 border border-green-800' : 'bg-red-900/20 text-red-400 border border-red-800'">
          <div class="font-medium flex items-center gap-2">
            <span>{{ testResult.success ? '✓' : '✗' }}</span>
            <span>{{ testResult.success ? 'Connection Successful' : 'Connection Failed' }}</span>
          </div>
          <div v-if="testResult.data" class="mt-2 text-xs opacity-80">
            Test: "The Matrix (1999)" → {{ testResult.data.Rated }} | {{ testResult.data.Genre }}
          </div>
          <p v-if="testResult.error" class="mt-1 opacity-90">{{ testResult.error }}</p>
        </div>

      </div>
    </Card>

    <Card title="Data Retrieved from OMDb" v-if="config.is_active">
      <div class="text-sm text-gray-400 space-y-2">
        <p>OMDb provides the following classification-relevant data:</p>
        <ul class="list-disc list-inside space-y-1 ml-2">
          <li><strong>Content Rating:</strong> G, PG, PG-13, R, NC-17, TV-MA, etc.</li>
          <li><strong>Genre:</strong> Action, Comedy, Documentary, Animation, etc.</li>
          <li><strong>IMDB Rating:</strong> Numeric score (used for quality filtering)</li>
          <li><strong>Awards:</strong> Oscar nominations, awards info</li>
          <li><strong>Plot:</strong> Synopsis for AI context</li>
        </ul>
        <p class="mt-3 text-xs text-gray-500">
          For TV shows, only the main series is queried (not individual episodes) to conserve API calls.
        </p>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Toggle from '@/components/common/Toggle.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import Input from '@/components/common/Input.vue'

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

const config = ref({
  api_key: '',
  is_active: false,
  daily_limit: 1000
})

const usage = ref({
  requests_today: 0,
  last_reset_date: null
})

const usagePercentage = computed(() => {
  const limit = config.value.daily_limit || 1000
  const used = usage.value.requests_today || 0
  return Math.min(100, (used / limit) * 100)
})

onMounted(async () => {
  try {
    const response = await api.getOMDbConfig()
    if (response.data) {
      config.value = {
        api_key: response.data.api_key || '',
        is_active: response.data.is_active,
        daily_limit: response.data.daily_limit || 1000
      }
      usage.value = {
        requests_today: response.data.requests_today || 0,
        last_reset_date: response.data.last_reset_date
      }
    }
  } catch (error) {
    console.error('Failed to load OMDb config:', error)
    // Table might not exist yet, that's ok
  } finally {
    loading.value = false
  }
})

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    const response = await api.testOMDb({ api_key: config.value.api_key })
    testResult.value = response.data
    if (response.data.success) {
      toast.success('OMDb connection verified')
    } else {
      toast.error('Connection test failed')
    }
  } catch (error) {
    testResult.value = { success: false, error: error.response?.data?.error || error.message }
    toast.error('Connection test failed')
  } finally {
    testing.value = false
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    await api.updateOMDbConfig(config.value)
    toast.success('OMDb settings saved')
  } catch (error) {
    console.error('Failed to save settings:', error)
    toast.error('Failed to save settings: ' + error.message)
  } finally {
    saving.value = false
  }
}
</script>

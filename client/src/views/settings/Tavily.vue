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
        <span>🌐</span>
        <span>Tavily Search Configuration</span>
      </h2>
      <p class="text-gray-400 text-sm">
        Connect to Tavily Search API to enhance classification with real-time web results.
        Ideal for correctly classifying anime, obscure titles, and new releases.
      </p>
    </div>

    <Card title="Tavily API Settings">
      <div v-if="loading" class="text-center py-4 text-gray-400">
        Loading configuration...
      </div>
      <div v-else class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
          <PasswordInput 
            v-model="config.api_key" 
            placeholder="tvly-..." 
          />
          <p class="text-xs text-gray-500 mt-1">
             Get your key from <a href="https://tavily.com" target="_blank" class="text-blue-400 hover:underline">tavily.com</a>
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            v-model="config.search_depth"
            label="Search Depth"
            :options="[
              { label: 'Basic (Fastest)', value: 'basic' },
              { label: 'Advanced (More Detailed)', value: 'advanced' }
            ]"
            description="Controls the depth of the search. Advanced provides more context but is slower."
          />
          
          <Input 
            v-model.number="config.max_results" 
            label="Max Results" 
            type="number"
            min="1"
            max="10" 
            description="Number of search results to retrieve (1-10)"
          />
        </div>

        <Toggle 
          v-model="config.is_active" 
          label="Enable Web Search" 
          description="Allow Classifarr to search the web when confidence is low"
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
            @click="saveconfig" 
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
            <p v-if="testResult.message" class="mt-1 opacity-90">{{ testResult.message }}</p>
        </div>

      </div>
    </Card>

    <Card title="Advanced Domain Filtering" v-if="config.is_active">
        <div class="space-y-4">
            <p class="text-sm text-gray-400">Control which sites are prioritized or ignored during research.</p>
            
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Include Domains (Prioritized)</label>
                <TagInput v-model="config.include_domains" placeholder="example.com" />
                <p class="text-xs text-gray-500 mt-1">Sites like imdb.com, myanimelist.net are good defaults.</p>
            </div>

             <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Exclude Domains</label>
                <TagInput v-model="config.exclude_domains" placeholder="example.com" />
                <p class="text-xs text-gray-500 mt-1">Sites to strictly ignore to prevent bad data.</p>
            </div>
            <div class="flex justify-end pt-2">
                <Button @click="saveconfig" :loading="saving" size="sm" variant="secondary">Update Filters</Button>
            </div>
        </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import TagInput from '@/components/common/TagInput.vue'

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

const config = ref({
  api_key: '',
  search_depth: 'basic',
  max_results: 5,
  include_domains: ['imdb.com', 'rottentomatoes.com', 'myanimelist.net'],
  exclude_domains: [],
  is_active: false
})

onMounted(async () => {
  try {
    const response = await api.getTavilyConfig()
    if (response.data) {
      config.value = {
        api_key: response.data.api_key || '',
        search_depth: response.data.search_depth || 'basic',
        max_results: response.data.max_results || 5,
        include_domains: response.data.include_domains || ['imdb.com', 'rottentomatoes.com', 'myanimelist.net'],
        exclude_domains: response.data.exclude_domains || [],
        is_active: response.data.is_active
      }
    }
  } catch (error) {
    console.error('Failed to load Tavily config:', error)
    toast.error('Failed to load configuration')
  } finally {
    loading.value = false
  }
})

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    const response = await api.testTavily({ api_key: config.value.api_key })
    testResult.value = response.data
    if (response.data.success) {
        toast.success('Connection verified')
    } else {
        toast.error('Connection test failed')
    }
  } catch (error) {
    testResult.value = { success: false, message: error.response?.data?.error || error.message }
    toast.error('Connection test failed')
  } finally {
    testing.value = false
  }
}

const saveconfig = async () => {
    saving.value = true
    try {
        await api.updateTavilyConfig(config.value)
        toast.success('Tavily settings saved')
    } catch (error) {
        console.error('Failed to save settings:', error)
        toast.error('Failed to save settings: ' + error.message)
    } finally {
        saving.value = false
    }
}
</script>

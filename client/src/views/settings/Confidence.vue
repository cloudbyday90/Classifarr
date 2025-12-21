<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Classification Settings</h2>
      <p class="text-gray-400 text-sm">Configure how media is classified and when to ask for help</p>
    </div>

    <!-- AI Clarification Toggle -->
    <div class="bg-gray-800 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex-1">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            🤖 AI Clarification via Discord
          </h3>
          <p class="text-gray-400 text-sm mt-2">
            When the AI is uncertain about a classification, it will ask a targeted question in Discord.
            This helps improve accuracy for edge cases like biographical music films, anime vs. western animation, etc.
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer ml-4">
          <input
            type="checkbox"
            v-model="enableClarification"
            @change="saveEnableClarification"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      <!-- Clarification Threshold -->
      <div v-if="enableClarification" class="mt-4 pt-4 border-t border-gray-700">
        <label class="block text-sm font-medium mb-2">
          Ask for help when confidence is below: <span class="text-blue-400 font-bold">{{ clarificationThreshold }}%</span>
        </label>
        <input
          v-model.number="clarificationThreshold"
          type="range"
          min="50"
          max="95"
          step="5"
          class="w-full"
          @change="saveClarificationThreshold"
        />
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>50% (Ask more often)</span>
          <span>95% (Rarely ask)</span>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          📊 Above this threshold, the AI auto-routes without asking. Below it, Discord questions are sent.
        </p>
      </div>
    </div>

    <!-- How It Works -->
    <div class="bg-gray-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
        💡 How AI Clarification Works
      </h3>
      
      <div class="space-y-4 text-sm">
        <div class="flex gap-3">
          <div class="text-2xl">1️⃣</div>
          <div>
            <div class="font-medium">AI Analyzes from TMDB</div>
            <div class="text-gray-400">Genres, keywords, ratings, language, and other metadata are examined</div>
          </div>
        </div>
        
        <div class="flex gap-3">
          <div class="text-2xl">2️⃣</div>
          <div>
            <div class="font-medium">Detects Ambiguity</div>
            <div class="text-gray-400">When signals conflict (e.g., Drama + Music + Biography), AI identifies the uncertainty</div>
          </div>
        </div>
        
        <div class="flex gap-3">
          <div class="text-2xl">3️⃣</div>
          <div>
            <div class="font-medium">Asks Targeted Question</div>
            <div class="text-gray-400">Discord notification with specific options: "Is 'Elvis' a biographical drama or music film?"</div>
          </div>
        </div>
        
        <div class="flex gap-3">
          <div class="text-2xl">4️⃣</div>
          <div>
            <div class="font-medium">You Answer, AI Learns</div>
            <div class="text-gray-400">Click a button, and the media is routed. Future requests for the same title skip this step.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual Confirmation Mode -->
    <div class="bg-gray-800 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold flex items-center gap-2">
            🔒 Manual Confirmation Mode
          </h3>
          <p class="text-gray-400 text-sm mt-2">
            When enabled, <strong>all</strong> classifications require your confirmation before being sent to Radarr/Sonarr,
            even when confidence is 90% or higher.
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            v-model="requireAllConfirmations"
            @change="saveRequireAllConfirmations"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
    </div>

    <!-- Confidence Thresholds (Visual Only) -->
    <div class="bg-gray-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold mb-4">Confidence Levels</h3>
      <p class="text-gray-400 text-sm mb-4">
        How the AI handles classifications at different confidence levels
      </p>

      <div class="space-y-4">
        <!-- High Confidence -->
        <div class="border-l-4 border-green-500 pl-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-green-400">HIGH: 90-100%</h4>
              <p class="text-sm text-gray-400">Auto-routes to library without asking</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
              AUTO-ROUTE
            </span>
          </div>
        </div>

        <!-- Medium Confidence -->
        <div class="border-l-4 border-yellow-500 pl-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-yellow-400">MEDIUM: {{ clarificationThreshold }}-89%</h4>
              <p class="text-sm text-gray-400">May ask clarifying question if ambiguity detected</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
              MAY ASK
            </span>
          </div>
        </div>

        <!-- Low Confidence -->
        <div class="border-l-4 border-blue-500 pl-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-blue-400">LOW: 50-{{ clarificationThreshold - 1 }}%</h4>
              <p class="text-sm text-gray-400">Asks clarifying question via Discord</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
              ASK DISCORD
            </span>
          </div>
        </div>

        <!-- Very Low Confidence -->
        <div class="border-l-4 border-red-500 pl-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-red-400">VERY LOW: 0-49%</h4>
              <p class="text-sm text-gray-400">Requires manual review - AI cannot determine</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
              MANUAL REVIEW
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Statistics -->
    <div class="bg-gray-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold mb-4">Classification Statistics</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gray-700 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-green-400">{{ stats.auto || 0 }}</div>
          <div class="text-xs text-gray-400">Auto-Routed</div>
        </div>
        <div class="bg-gray-700 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-yellow-400">{{ stats.clarified || 0 }}</div>
          <div class="text-xs text-gray-400">Clarified</div>
        </div>
        <div class="bg-gray-700 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-blue-400">{{ stats.manual || 0 }}</div>
          <div class="text-xs text-gray-400">Manual Review</div>
        </div>
        <div class="bg-gray-700 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-gray-400">{{ stats.total || 0 }}</div>
          <div class="text-xs text-gray-400">Total</div>
        </div>
      </div>
    </div>

    <!-- Status Message -->
    <div v-if="status" :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']">
      {{ status.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const enableClarification = ref(true)
const clarificationThreshold = ref(75)
const requireAllConfirmations = ref(false)
const status = ref(null)
const stats = ref({
  auto: 0,
  clarified: 0,
  manual: 0,
  total: 0
})

onMounted(async () => {
  await loadSettings()
  await loadStats()
})

const loadSettings = async () => {
  try {
    const response = await axios.get('/api/settings')
    enableClarification.value = response.data.enable_clarification !== 'false'
    clarificationThreshold.value = parseInt(response.data.clarification_threshold) || 75
    requireAllConfirmations.value = response.data.require_all_confirmations === 'true'
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

const loadStats = async () => {
  try {
    const response = await axios.get('/api/classification/stats')
    if (response.data) {
      stats.value = {
        auto: response.data.auto || response.data.highConfidence || 0,
        clarified: response.data.clarified || response.data.mediumConfidence || 0,
        manual: response.data.manual || response.data.lowConfidence || 0,
        total: response.data.total || 0
      }
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const saveEnableClarification = async () => {
  try {
    await axios.put('/api/settings', {
      enable_clarification: enableClarification.value ? 'true' : 'false'
    })
    showStatus('Setting saved', 'success')
  } catch (error) {
    showStatus('Failed to save setting', 'error')
  }
}

const saveClarificationThreshold = async () => {
  try {
    await axios.put('/api/settings', {
      clarification_threshold: clarificationThreshold.value.toString()
    })
    showStatus('Threshold saved', 'success')
  } catch (error) {
    showStatus('Failed to save threshold', 'error')
  }
}

const saveRequireAllConfirmations = async () => {
  try {
    await axios.put('/api/settings', {
      require_all_confirmations: requireAllConfirmations.value ? 'true' : 'false'
    })
    showStatus('Setting saved', 'success')
  } catch (error) {
    showStatus('Failed to save setting', 'error')
  }
}

const showStatus = (message, type) => {
  status.value = { message, type }
  setTimeout(() => {
    status.value = null
  }, 3000)
}
</script>

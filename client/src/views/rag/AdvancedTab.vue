<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Retry Configuration -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Retry Settings</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Max Retries</label>
          <input
            v-model.number="config.max_retries"
            type="number"
            min="0"
            max="10"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Number of retry attempts on failure (default: 3)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Retry Delay (ms)</label>
          <input
            v-model.number="config.retry_delay"
            type="number"
            min="100"
            max="10000"
            step="100"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Delay between retries (default: 1000)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Request Timeout (ms)</label>
          <input
            v-model.number="config.request_timeout"
            type="number"
            min="5000"
            max="120000"
            step="1000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Timeout for embedding requests (default: 30000)</p>
        </div>
      </div>
    </div>

    <!-- Enhanced Retry Configuration -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Advanced Retry Configuration</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Warmup Timeout (ms)</label>
          <input
            v-model.number="retryConfig.warmup_timeout"
            type="number"
            min="10000"
            max="600000"
            step="1000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Extended timeout for cold model (default: 120000ms / 120s)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Request Timeout (ms)</label>
          <input
            v-model.number="retryConfig.request_timeout"
            type="number"
            min="5000"
            max="300000"
            step="1000"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Normal timeout for warm model (default: 30000ms / 30s)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Backoff Multiplier</label>
          <input
            v-model.number="retryConfig.retry_backoff_multiplier"
            type="number"
            min="1"
            max="5"
            step="0.1"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Exponential backoff multiplier (default: 2.0)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Jitter Factor</label>
          <input
            v-model.number="retryConfig.jitter_factor"
            type="number"
            min="0"
            max="1"
            step="0.01"
            class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500">Randomization factor (0-1, default: 0.3 for ±30%)</p>
        </div>
      </div>

      <!-- Backoff Example Display -->
      <div class="bg-gray-900 rounded-lg p-4 mb-4">
        <h4 class="text-sm font-medium text-gray-300 mb-3">Example Backoff Sequence</h4>
        <div class="space-y-2">
          <div v-for="(delay, i) in exampleBackoffSequence" :key="i" class="flex items-center gap-2 text-sm">
            <span class="text-gray-500 w-20">Attempt {{ i + 1 }}:</span>
            <div class="flex-1 bg-gray-700 rounded-sm h-2 relative overflow-hidden">
              <div 
                class="bg-blue-500 h-full rounded-sm"
                :style="{ width: (delay / maxExampleDelay * 100) + '%' }"
              ></div>
            </div>
            <span class="text-gray-300 w-24 text-right">{{ delay }}ms</span>
          </div>
          <p class="text-xs text-gray-500 mt-3">
            With base delay of {{ retryConfig.retry_delay || 1000 }}ms, multiplier {{ retryConfig.retry_backoff_multiplier || 2 }}, 
            and jitter {{ retryConfig.jitter_factor || 0.3 }}. Actual delays will vary due to jitter.
          </p>
        </div>
      </div>

      <button
        @click="saveRetryConfig"
        :disabled="saving"
        class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
      >
        {{ saving ? 'Saving...' : 'Save Retry Configuration' }}
      </button>
    </div>

    <!-- Second-pass Retrieval Loop (Issue 275) -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 class="text-lg font-semibold text-white mb-1">Second-pass Retrieval Loop</h3>
          <p class="text-sm text-gray-400">
            Controls targeted re-check behavior for low-confidence or ambiguous classifications.
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="secondPassConfig.rag_retrieval_loop_enabled"
            type="checkbox"
            class="sr-only peer"
            :disabled="!secondPassConfigAvailable"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer disabled:opacity-50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div v-if="!secondPassConfigAvailable" class="bg-yellow-900/20 border border-yellow-500/40 rounded-lg p-3 text-sm text-yellow-300">
        Second-pass controls are unavailable from this backend response. Baseline RAG advanced settings remain editable.
      </div>

      <div v-else class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Rollout Mode</label>
            <select
              v-model="secondPassConfig.rag_loop_rollout_mode"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="shadow">shadow</option>
              <option value="apply">apply</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Low-confidence Threshold (%)</label>
            <input
              v-model.number="secondPassConfig.rag_loop_low_confidence_threshold"
              type="number"
              min="0"
              max="100"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Retry Strategy</label>
            <select
              v-model="secondPassConfig.rag_retry_strategy"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="auto">auto</option>
              <option value="hybrid">hybrid</option>
              <option value="semantic">semantic</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Candidate Limit</label>
            <input
              v-model.number="secondPassConfig.rag_loop_candidate_limit"
              type="number"
              min="1"
              max="100"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Policy Re-check Attempts</label>
            <input
              v-model.number="secondPassConfig.policy_recheck_max_attempts"
              type="number"
              min="0"
              max="5"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Min Confidence Gain (%)</label>
            <input
              v-model.number="secondPassConfig.policy_recheck_min_confidence_gain"
              type="number"
              min="0"
              max="100"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
          <div>
            <p class="font-medium text-white">Policy prompt-threshold re-check</p>
            <p class="text-sm text-gray-400">Enable targeted policy re-check when prompt-threshold confidence is not met</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="secondPassConfig.policy_recheck_below_prompt_threshold_enabled"
              type="checkbox"
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Shadow Min Samples</label>
            <input
              v-model.number="secondPassConfig.rag_loop_shadow_min_samples"
              type="number"
              min="1"
              max="1000000"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Max Error Delta</label>
            <input
              v-model.number="secondPassConfig.rag_loop_shadow_max_error_rate_delta"
              type="number"
              min="0"
              max="1"
              step="0.001"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Max P95 Latency Delta (ms)</label>
            <input
              v-model.number="secondPassConfig.rag_loop_shadow_max_p95_latency_delta_ms"
              type="number"
              min="0"
              max="600000"
              step="10"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="rounded-lg border p-3 text-sm" :class="secondPassConfig.rag_loop_rollout_mode === 'apply' ? 'border-yellow-500/40 bg-yellow-900/20 text-yellow-200' : 'border-blue-500/40 bg-blue-900/20 text-blue-200'">
          <p class="font-medium mb-1">Rollout guardrail</p>
          <p v-if="secondPassConfig.rag_loop_rollout_mode === 'shadow'">
            `shadow` evaluates second-pass candidates for diagnostics only. Final classification behavior is unchanged.
          </p>
          <p v-else>
            `apply` may change final decisions when comparator gates pass. Promote from shadow only after metrics meet thresholds.
          </p>
        </div>

        <div class="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-medium text-gray-200">Shadow Promotion Metrics (Read-only)</h4>
            <button
              @click="loadPromotionMetrics"
              :disabled="loadingPromotionMetrics"
              class="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors disabled:opacity-50"
            >
              {{ loadingPromotionMetrics ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>

          <div v-if="promotionMetricsAvailable" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div class="bg-gray-800/70 rounded p-2 border border-gray-700">
                <p class="text-gray-400">Shadow Samples</p>
                <p class="text-white font-medium">{{ promotionMetrics.metrics.shadow_sample_count }}</p>
              </div>
              <div class="bg-gray-800/70 rounded p-2 border border-gray-700">
                <p class="text-gray-400">Correction Delta</p>
                <p class="text-white font-medium">{{ formatMetricPercent(promotionMetrics.metrics.correction_delta) }}</p>
              </div>
              <div class="bg-gray-800/70 rounded p-2 border border-gray-700">
                <p class="text-gray-400">Error Delta</p>
                <p class="text-white font-medium">{{ formatMetricPercent(promotionMetrics.metrics.error_rate_delta) }}</p>
              </div>
              <div class="bg-gray-800/70 rounded p-2 border border-gray-700">
                <p class="text-gray-400">P95 Latency Delta</p>
                <p class="text-white font-medium">{{ formatMs(promotionMetrics.metrics.p95_latency_delta_ms) }}</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div class="rounded p-2 border" :class="promotionMetrics.metrics.shadow_sample_count >= promotionMetrics.gates.min_samples ? 'bg-green-900/20 border-green-500/40 text-green-300' : 'bg-gray-800 border-gray-700 text-gray-300'">
                Sample gate: {{ promotionMetrics.metrics.shadow_sample_count }} / {{ promotionMetrics.gates.min_samples }}
              </div>
              <div class="rounded p-2 border" :class="promotionMetrics.metrics.error_rate_delta <= promotionMetrics.gates.max_error_rate_delta ? 'bg-green-900/20 border-green-500/40 text-green-300' : 'bg-gray-800 border-gray-700 text-gray-300'">
                Error gate: ≤ {{ formatMetricPercent(promotionMetrics.gates.max_error_rate_delta) }}
              </div>
              <div class="rounded p-2 border" :class="promotionMetrics.metrics.p95_latency_delta_ms <= promotionMetrics.gates.max_p95_latency_delta_ms ? 'bg-green-900/20 border-green-500/40 text-green-300' : 'bg-gray-800 border-gray-700 text-gray-300'">
                Latency gate: ≤ {{ formatMs(promotionMetrics.gates.max_p95_latency_delta_ms) }}
              </div>
            </div>

            <p :class="promotionMetrics.ready ? 'text-green-300 text-sm' : 'text-gray-300 text-sm'">
              {{ promotionMetrics.ready ? 'Promotion readiness: gates currently satisfied.' : 'Promotion readiness: one or more gates are not yet satisfied.' }}
            </p>
            <p class="text-xs text-gray-500">Last check: {{ formatCheckedAt }}</p>
          </div>

          <p v-else class="text-sm text-gray-400">
            Promotion metrics endpoint unavailable. Configure and run in `shadow` mode to gather readiness data.
          </p>
        </div>
      </div>
    </div>

    <!-- Caching -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-white mb-1">Caching</h3>
          <p class="text-sm text-gray-400">Enable embedding cache to reduce duplicate requests</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="config.cache_enabled"
            type="checkbox"
            class="sr-only peer"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div v-if="config.cache_enabled">
        <label class="block text-sm font-medium text-gray-300 mb-2">Cache TTL (hours)</label>
        <input
          v-model.number="config.cache_ttl"
          type="number"
          min="1"
          max="168"
          class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-gray-500">How long to cache embeddings (default: 24 hours)</p>
      </div>
    </div>

    <!-- Debug Options -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-white mb-4">Debug Options</h3>
      <div class="space-y-3">
        <div class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
          <div>
            <p class="font-medium text-white">Verbose Logging</p>
            <p class="text-sm text-gray-400">Enable detailed logging for debugging</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="config.verbose_logging"
              type="checkbox"
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
          <div>
            <p class="font-medium text-white">Log Embedding Content</p>
            <p class="text-sm text-gray-400">Warning: Significantly increases log size</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="config.log_embedding_content"
              type="checkbox"
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="bg-red-900/20 border-2 border-red-500/50 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
        ⚠️ Danger Zone
      </h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div class="flex-1">
            <p class="font-medium text-white mb-1">Clear All Embeddings</p>
            <p class="text-sm text-gray-400">Remove all generated embeddings. They will need to be regenerated.</p>
          </div>
          <button
            @click="confirmClearEmbeddings"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Clear Embeddings
          </button>
        </div>

        <div class="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div class="flex-1">
            <p class="font-medium text-white mb-1">Reset RAG Configuration</p>
            <p class="text-sm text-gray-400">Reset all RAG settings to defaults.</p>
          </div>
          <button
            @click="confirmResetConfig"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex items-center gap-3">
      <button
        @click="saveAdvancedConfig"
        :disabled="saving"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ saving ? 'Saving...' : 'Save Advanced Settings' }}
      </button>
    </div>

    <div v-if="saveMessage" :class="[
      'p-4 rounded-lg',
      saveSuccess ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
    ]">
      {{ saveMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'

const SECOND_PASS_DEFAULTS = Object.freeze({
  rag_retrieval_loop_enabled: true,
  rag_loop_rollout_mode: 'apply',
  rag_loop_low_confidence_threshold: 70,
  rag_retry_strategy: 'auto',
  rag_loop_candidate_limit: 25,
  policy_recheck_below_prompt_threshold_enabled: true,
  policy_recheck_max_attempts: 1,
  policy_recheck_min_confidence_gain: 5,
  rag_loop_shadow_min_samples: 200,
  rag_loop_shadow_max_error_rate_delta: 0.01,
  rag_loop_shadow_max_p95_latency_delta_ms: 250
})

const createPromotionMetricsState = () => ({
  ready: false,
  metrics: {
    shadow_sample_count: 0,
    correction_delta: 0,
    error_rate_delta: 0,
    p95_latency_delta_ms: 0
  },
  gates: {
    min_samples: 200,
    max_error_rate_delta: 0.01,
    max_p95_latency_delta_ms: 250
  },
  checked_at: null
})

const config = ref({
  max_retries: 3,
  retry_delay: 1000,
  request_timeout: 30000,
  cache_enabled: false,
  cache_ttl: 24,
  verbose_logging: false,
  log_embedding_content: false
})

const retryConfig = ref({
  request_timeout: 30000,
  warmup_timeout: 120000,
  max_retries: 3,
  retry_delay: 1000,
  retry_backoff_multiplier: 2.0,
  jitter_factor: 0.3
})
const secondPassConfig = ref({ ...SECOND_PASS_DEFAULTS })
const secondPassConfigAvailable = ref(true)
const promotionMetrics = ref(createPromotionMetricsState())
const promotionMetricsAvailable = ref(false)
const loadingPromotionMetrics = ref(false)

const saving = ref(false)
const saveMessage = ref('')
const saveSuccess = ref(false)

// Calculate example backoff sequence
const exampleBackoffSequence = computed(() => {
  const baseDelay = retryConfig.value.retry_delay || 1000
  const multiplier = retryConfig.value.retry_backoff_multiplier || 2
  const maxRetries = retryConfig.value.max_retries || 3
  
  const sequence = []
  for (let i = 0; i < maxRetries; i++) {
    const delay = baseDelay * Math.pow(multiplier, i)
    sequence.push(Math.round(delay))
  }
  return sequence
})

const maxExampleDelay = computed(() => {
  if (exampleBackoffSequence.value.length === 0) return 1
  return Math.max(...exampleBackoffSequence.value)
})

const formatMetricPercent = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0.00%'
  return `${(numeric * 100).toFixed(2)}%`
}

const formatMs = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${Math.round(numeric)}ms` : '0ms'
}

const formatCheckedAt = computed(() => {
  if (!promotionMetrics.value.checked_at) return 'n/a'
  return new Date(promotionMetrics.value.checked_at).toLocaleString()
})

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key)

const hasIssue275ConfigKeys = (settings = {}) => {
  return hasOwn(settings, 'rag_retrieval_loop_enabled') ||
    hasOwn(settings, 'rag_loop_rollout_mode') ||
    hasOwn(settings, 'rag_loop_low_confidence_threshold')
}

const clamp = (value, min, max, fallback) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, numeric))
}

const normalizeSecondPassConfigForSave = (rawConfig = {}) => ({
  rag_retrieval_loop_enabled: rawConfig.rag_retrieval_loop_enabled === true,
  rag_loop_rollout_mode: rawConfig.rag_loop_rollout_mode === 'apply' ? 'apply' : 'shadow',
  rag_loop_low_confidence_threshold: Math.round(clamp(rawConfig.rag_loop_low_confidence_threshold, 0, 100, 70)),
  rag_retry_strategy: ['auto', 'hybrid', 'semantic'].includes(rawConfig.rag_retry_strategy)
    ? rawConfig.rag_retry_strategy
    : 'auto',
  rag_loop_candidate_limit: Math.round(clamp(rawConfig.rag_loop_candidate_limit, 1, 100, 25)),
  policy_recheck_below_prompt_threshold_enabled: rawConfig.policy_recheck_below_prompt_threshold_enabled === true,
  policy_recheck_max_attempts: Math.round(clamp(rawConfig.policy_recheck_max_attempts, 0, 5, 1)),
  policy_recheck_min_confidence_gain: clamp(rawConfig.policy_recheck_min_confidence_gain, 0, 100, 5),
  rag_loop_shadow_min_samples: Math.round(clamp(rawConfig.rag_loop_shadow_min_samples, 1, 1000000, 200)),
  rag_loop_shadow_max_error_rate_delta: clamp(rawConfig.rag_loop_shadow_max_error_rate_delta, 0, 1, 0.01),
  rag_loop_shadow_max_p95_latency_delta_ms: Math.round(clamp(rawConfig.rag_loop_shadow_max_p95_latency_delta_ms, 0, 600000, 250))
})

const applySecondPassConfig = (settings = {}) => {
  secondPassConfig.value = normalizeSecondPassConfigForSave({
    ...SECOND_PASS_DEFAULTS,
    ...settings
  })
}

const applyPromotionMetrics = (payload = {}) => {
  const metrics = payload?.metrics || {}
  const gates = payload?.gates || {}
  promotionMetrics.value = {
    ready: payload?.ready === true,
    metrics: {
      shadow_sample_count: Number(metrics.shadow_sample_count) || 0,
      correction_delta: Number(metrics.correction_delta) || 0,
      error_rate_delta: Number(metrics.error_rate_delta) || 0,
      p95_latency_delta_ms: Number(metrics.p95_latency_delta_ms) || 0
    },
    gates: {
      min_samples: Number(gates.min_samples) || 200,
      max_error_rate_delta: Number(gates.max_error_rate_delta) || 0.01,
      max_p95_latency_delta_ms: Number(gates.max_p95_latency_delta_ms) || 250
    },
    checked_at: payload?.checked_at || null
  }
}

const loadPromotionMetrics = async () => {
  loadingPromotionMetrics.value = true
  try {
    const response = await api.get('/rag/loop/promotion-readiness')
    applyPromotionMetrics(response.data || {})
    promotionMetricsAvailable.value = true
  } catch (error) {
    promotionMetricsAvailable.value = false
    promotionMetrics.value = createPromotionMetricsState()
    console.warn('Promotion metrics endpoint unavailable:', error?.message || error)
  } finally {
    loadingPromotionMetrics.value = false
  }
}

const loadConfig = async () => {
  const [advancedRes, retryRes, aiRes] = await Promise.allSettled([
    api.get('/rag/advanced'),
    api.get('/settings/embedding/retry'),
    api.get('/settings/ai')
  ])

  try {
    if (advancedRes.status === 'fulfilled') {
      const data = advancedRes.value.data || {}
      config.value = {
        max_retries: data.max_retries ?? 3,
        retry_delay: data.retry_delay ?? 1000,
        request_timeout: data.request_timeout ?? 30000,
        cache_enabled: data.cache_enabled ?? false,
        cache_ttl: data.cache_ttl ?? 24,
        verbose_logging: data.verbose_logging ?? false,
        log_embedding_content: data.log_embedding_content ?? false
      }
    }

    if (retryRes.status === 'fulfilled') {
      const data = retryRes.value.data || {}
      retryConfig.value = {
        request_timeout: data.request_timeout ?? 30000,
        warmup_timeout: data.warmup_timeout ?? 120000,
        max_retries: data.max_retries ?? 3,
        retry_delay: data.retry_delay ?? 1000,
        retry_backoff_multiplier: data.retry_backoff_multiplier ?? 2.0,
        jitter_factor: data.jitter_factor ?? 0.3
      }
    }

    if (aiRes.status === 'fulfilled') {
      const aiSettings = aiRes.value.data || {}
      secondPassConfigAvailable.value = hasIssue275ConfigKeys(aiSettings)
      if (secondPassConfigAvailable.value) {
        applySecondPassConfig(aiSettings)
      } else {
        secondPassConfig.value = { ...SECOND_PASS_DEFAULTS }
      }
    } else {
      secondPassConfigAvailable.value = false
      secondPassConfig.value = { ...SECOND_PASS_DEFAULTS }
    }
  } catch (error) {
    console.error('Failed to load advanced config:', error)
  } finally {
    await loadPromotionMetrics()
  }
}

const saveRetryConfig = async () => {
  saving.value = true
  saveMessage.value = ''

  try {
    await api.put('/settings/embedding/retry', retryConfig.value)

    saveSuccess.value = true
    saveMessage.value = 'Retry configuration saved successfully'
  } catch (error) {
    saveSuccess.value = false
    saveMessage.value = error.response?.data?.error || error.message
  } finally {
    saving.value = false
    setTimeout(() => {
      saveMessage.value = ''
    }, 5000)
  }
}

const saveAdvancedConfig = async () => {
  saving.value = true
  saveMessage.value = ''

  try {
    await api.put('/rag/advanced', config.value)
    if (secondPassConfigAvailable.value) {
      await api.put('/settings/ai', normalizeSecondPassConfigForSave(secondPassConfig.value))
    }
    await loadPromotionMetrics()

    saveSuccess.value = true
    saveMessage.value = secondPassConfigAvailable.value
      ? 'Advanced and second-pass settings saved successfully'
      : 'Advanced settings saved successfully (second-pass controls unavailable)'
  } catch (error) {
    saveSuccess.value = false
    saveMessage.value = error.response?.data?.error || error.message
  } finally {
    saving.value = false
    setTimeout(() => {
      saveMessage.value = ''
    }, 5000)
  }
}

const confirmClearEmbeddings = async () => {
  if (!confirm('Are you sure you want to clear all embeddings? This action cannot be undone.')) {
    return
  }

  try {
    await api.post('/rag/clear-embeddings')
    alert('All embeddings have been cleared')
  } catch (error) {
    alert('Failed to clear embeddings: ' + (error.response?.data?.error || error.message))
  }
}

const confirmResetConfig = async () => {
  if (!confirm('Are you sure you want to reset all RAG configuration to defaults? This action cannot be undone.')) {
    return
  }

  try {
    await api.post('/rag/reset-config')
    await loadConfig()
    alert('Configuration has been reset to defaults')
  } catch (error) {
    alert('Failed to reset configuration: ' + (error.response?.data?.error || error.message))
  }
}

onMounted(() => {
  loadConfig()
})
</script>

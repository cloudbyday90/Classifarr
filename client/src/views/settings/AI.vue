<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- 1. AI Provider Section -->
    <Card title="🤖 AI Provider">
      <div
        v-if="loading"
        class="text-center py-8"
      >
        <Spinner />
        <p class="text-gray-400 mt-2">
          Loading AI configuration...
        </p>
      </div>

      <div
        v-else
        class="space-y-6"
      >
        <!-- Provider Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Classification Provider</label>
          <select 
            v-model="config.primary_provider" 
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            @change="onProviderChange"
          >
            <option value="none">
              No Provider (AI Disabled)
            </option>
            <option value="ollama">
              Ollama (Local)
            </option>
            <option value="openai">
              OpenAI
            </option>
            <option value="gemini">
              Google Gemini
            </option>
            <option value="openrouter">
              OpenRouter
            </option>
            <option value="litellm">
              LiteLLM
            </option>
            <option value="custom">
              Custom OpenAI-Compatible
            </option>
          </select>
          <p class="text-xs text-gray-500 mt-1">
            <span v-if="config.primary_provider === 'none'">AI classification is disabled. Enable a provider to use AI features.</span>
            <span v-else-if="config.primary_provider === 'ollama'">Using local Ollama instance - no API costs.</span>
            <span v-else-if="config.primary_provider === 'openai'">Using OpenAI API (GPT-5, o3, etc) - costs per token.</span>
            <span v-else-if="config.primary_provider === 'gemini'">Using Google Gemini API (Gemini 2.0) - costs per token.</span>
            <span v-else-if="config.primary_provider === 'openrouter'">Access 100+ models via OpenRouter - costs vary by model.</span>
            <span v-else-if="config.primary_provider === 'litellm'">LiteLLM proxy for multiple LLM providers.</span>
            <span v-else>Custom OpenAI-compatible endpoint.</span>
          </p>
        </div>

        <!-- Cloud Provider Settings (not shown for Ollama or None) -->
        <div
          v-if="isApiProvider"
          class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700"
        >
          <h3 class="font-medium text-gray-200">
            Cloud Provider Settings
          </h3>
          
          <!-- API Endpoint (Custom only) -->
          <div v-if="config.primary_provider === 'custom' || config.primary_provider === 'litellm'">
            <label class="block text-sm font-medium text-gray-300 mb-2">API Endpoint</label>
            <input 
              v-model="config.api_endpoint"
              type="url"
              placeholder="https://your-api-endpoint.com/v1"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
          </div>

          <!-- API Key -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
            <PasswordInput 
              v-model="config.api_key" 
              placeholder="Enter your API key"
            />
            <p class="text-xs text-gray-500 mt-1">
              <template v-if="config.primary_provider === 'openai'">
                Get your key from <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  class="text-blue-400 hover:underline"
                >platform.openai.com</a>
              </template>
              <template v-else-if="config.primary_provider === 'gemini'">
                Get your key from <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  class="text-blue-400 hover:underline"
                >aistudio.google.com</a>
              </template>
              <template v-else-if="config.primary_provider === 'openrouter'">
                Get your key from <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  class="text-blue-400 hover:underline"
                >openrouter.ai</a>
              </template>
            </p>
          </div>

          <!-- Model Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <div class="flex gap-2">
              <select 
                v-model="config.model"
                class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">
                  Select a model...
                </option>
                <option
                  v-for="model in availableModels"
                  :key="model.id"
                  :value="model.id"
                >
                  {{ model.name }}
                </option>
              </select>
              <Button 
                variant="secondary" 
                size="sm" 
                :disabled="loadingModels || !config.api_key"
                @click="fetchModels"
              >
                <span v-if="loadingModels">Loading...</span>
                <span v-else>🔄 Fetch</span>
              </Button>
            </div>
          </div>

          <!-- Test Connection -->
          <div class="flex items-center gap-4">
            <Button 
              variant="secondary" 
              :disabled="testing || !config.api_key"
              @click="testConnection"
            >
              <span v-if="testing">Testing...</span>
              <span v-else>🔌 Test Connection</span>
            </Button>
            <span
              v-if="testResult"
              :class="testResult.success ? 'text-green-400' : 'text-red-400'"
            >
              {{ testResult.message || testResult.error }}
            </span>
          </div>
        </div>

        <!-- Ollama Primary Settings (shown when Ollama is primary) -->
        <div
          v-if="config.primary_provider === 'ollama'"
          class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700"
        >
          <h3 class="font-medium text-gray-200">
            Ollama Settings
          </h3>
          
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Ollama Host</label>
              <input 
                v-model="config.ollama_host"
                type="text"
                placeholder="192.168.1.100"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
              <input 
                v-model.number="config.ollama_port"
                type="number"
                placeholder="11434"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
              <div class="flex gap-2">
                <select 
                  v-model="config.ollama_model"
                  class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option
                    v-if="ollamaModels.length === 0"
                    value=""
                  >
                    -- Select model --
                  </option>
                  <option
                    v-for="model in ollamaModels"
                    :key="model.name"
                    :value="model.name"
                  >
                    {{ model.name }}
                  </option>
                </select>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  :disabled="loadingOllamaModels"
                  @click="fetchOllamaModels"
                >
                  <span v-if="loadingOllamaModels">...</span>
                  <span v-else>🔄</span>
                </Button>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <Button
              variant="secondary"
              :disabled="testingOllama"
              @click="testOllamaConnection"
            >
              <span v-if="testingOllama">Testing...</span>
              <span v-else>🔌 Test Connection</span>
            </Button>
            <span
              v-if="ollamaTestResult"
              :class="ollamaTestResult.success ? 'text-green-400' : 'text-red-400'"
            >
              {{ ollamaTestResult.message || ollamaTestResult.error }}
            </span>
          </div>
        </div>

        <!-- Advanced Settings -->
        <div
          v-if="config.primary_provider !== 'none'"
          class="space-y-4"
        >
          <button 
            class="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            @click="showAdvanced = !showAdvanced"
          >
            <span>{{ showAdvanced ? '▼' : '▶' }}</span>
            Advanced Settings
          </button>
          
          <div
            v-if="showAdvanced"
            class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700"
          >
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Temperature</label>
                <input 
                  v-model.number="config.temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                <p class="text-xs text-gray-500 mt-1">
                  0 = deterministic, 1 = creative
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Max Tokens</label>
                <input 
                  v-model.number="config.max_tokens"
                  type="number"
                  min="100"
                  max="16000"
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <section
      v-if="hasUnsavedOllamaVerificationTargetChange"
      class="space-y-2 rounded-lg border border-blue-700/70 bg-blue-950/20 p-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby="unsaved-ollama-verification-change-heading"
    >
      <h2
        id="unsaved-ollama-verification-change-heading"
        class="font-medium text-blue-100"
      >
        Unsaved Ollama change
      </h2>
      <p class="text-sm text-blue-100/90">
        Save Changes will save the selected Ollama configuration and immediately test its strict-verification contract. The test is media-free and never routes an item.
      </p>
    </section>

    <section
      v-if="verificationSaveStatus"
      class="space-y-2 rounded-lg border p-4"
      :class="verificationSaveStatus.className"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby="verification-save-status-heading"
    >
      <h2
        id="verification-save-status-heading"
        class="font-medium"
      >
        {{ verificationSaveStatus.heading }}
      </h2>
      <p class="text-sm">
        {{ verificationSaveStatus.message }}
      </p>
    </section>

    <!-- Pattern-Based Classification Settings -->
    <!-- Pattern-Based Classification Section -->
    <Card
      v-if="config.primary_provider !== 'none'"
      title="🧩 Pattern-Based Classification"
    >
      <div class="space-y-6">
        <!-- Enable Pattern Mining -->
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-medium text-gray-200">
                Enable Pattern Mining
              </h3>
              <span class="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-sm">Standard</span>
            </div>
            <div class="text-sm text-gray-400">
              Automatically discover patterns from classification history (studios, genres, franchises) to predict library routing. Now enabled by default as part of the v0.37.0 formula engine.
            </div>
          </div>
          <Toggle v-model="patternConfig.pattern_mining_enabled" />
        </div>

        <!-- Pattern Settings (when enabled) -->
        <div
          v-if="patternConfig.pattern_mining_enabled"
          class="space-y-4"
        >
          <!-- Pattern vs Rules Priority -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Pattern vs Rule Priority</label>
            <select 
              v-model="patternConfig.pattern_rule_priority"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="rules_first">
                Rules First (Default)
              </option>
              <option value="patterns_first">
                Patterns First
              </option>
            </select>
            <p class="text-xs text-gray-500 mt-1">
              <template v-if="patternConfig.pattern_rule_priority === 'rules_first'">
                Custom rules take precedence over discovered patterns
              </template>
              <template v-else>
                Discovered patterns take precedence over custom rules
              </template>
            </p>
          </div>

          <!-- Pattern Management Link -->
          <div class="flex items-center justify-between bg-gray-800/50 rounded-lg p-4">
            <div class="flex-1">
              <h4 class="font-medium text-gray-200 mb-1">
                Manage Patterns
              </h4>
              <p class="text-sm text-gray-400">
                View and manage discovered patterns, approve suggestions, and resolve conflicts
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              @click="$router.push('/patterns')"
            >
              Manage Patterns →
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- API Cost Management Section (ONLY for API providers) -->
    <Card
      v-if="isApiProvider"
      title="💰 API Cost Management"
    >
      <div class="space-y-6">
        <!-- AI Skip Threshold -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            AI Skip Threshold
          </label>
          <div class="flex items-center gap-4">
            <input 
              v-model.number="patternConfig.pattern_ai_skip_threshold"
              type="range"
              min="70"
              max="100"
              step="5"
              class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
            >
            <span class="text-white w-12 text-right">{{ patternConfig.pattern_ai_skip_threshold }}%</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Skip AI calls when pattern confidence is at or above this threshold (saves costs)
          </p>
        </div>

        <!-- Monthly Budget Alert -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Monthly Budget Alert ($)</label>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">$</span>
            <input 
              v-model.number="config.monthly_budget_usd"
              type="number"
              step="1"
              min="0"
              placeholder="No limit"
              class="w-32 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            >
            <span class="text-sm text-gray-400">Notify when spending exceeds this amount</span>
          </div>
        </div>

        <!-- Usage Progress Bar -->
        <div v-if="config.monthly_budget_usd">
          <div class="flex justify-between text-sm mb-2">
            <span class="text-gray-400">Current Usage</span>
            <span :class="budgetPercentUsed > 80 ? 'text-red-400' : 'text-green-400'">
              ${{ (config.current_month_usage_usd || 0).toFixed(2) }} / ${{ config.monthly_budget_usd.toFixed(2) }}
            </span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              class="h-3 rounded-full transition-all duration-500"
              :class="budgetPercentUsed > 80 ? 'bg-red-500' : budgetPercentUsed > 50 ? 'bg-yellow-500' : 'bg-green-500'"
              :style="{ width: `${Math.min(budgetPercentUsed, 100)}%` }"
            />
          </div>
          <div class="text-sm text-gray-500 mt-1">
            {{ budgetPercentUsed }}% used
          </div>
        </div>

        <!-- Cost Summary Widget -->
        <div class="cost-summary">
          <h4 class="text-sm font-medium text-gray-300 mb-4">
            📊 This Month
          </h4>
          <div
            v-if="costSummary?.callsMade > 0"
            class="grid grid-cols-4 gap-4"
          >
            <div class="bg-gray-800/50 p-4 rounded-lg text-center">
              <div class="text-2xl font-bold text-blue-400">
                {{ costSummary.callsMade }}
              </div>
              <div class="text-xs text-gray-400 mt-1">
                AI Calls Made
              </div>
            </div>
            <div class="bg-gray-800/50 p-4 rounded-lg text-center">
              <div class="text-2xl font-bold text-green-500">
                {{ costSummary.callsAvoided }}
              </div>
              <div class="text-xs text-gray-400 mt-1">
                Calls Avoided
              </div>
            </div>
            <div class="bg-gray-800/50 p-4 rounded-lg text-center">
              <div class="text-2xl font-bold text-green-500">
                {{ costSummary.savingsPercent }}%
              </div>
              <div class="text-xs text-gray-400 mt-1">
                Savings
              </div>
            </div>
            <div class="bg-gray-800/50 p-4 rounded-lg text-center">
              <div class="text-2xl font-bold text-yellow-400">
                ${{ costSummary.estimatedCost?.toFixed(2) || '0.00' }}
              </div>
              <div class="text-xs text-gray-400 mt-1">
                Estimated Cost
              </div>
            </div>
          </div>
          <div
            v-else
            class="text-sm text-gray-400 text-center py-4"
          >
            No classifications this month yet
          </div>
        </div>

        <!-- Additional Budget Controls -->
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Alert Threshold</label>
            <div class="flex items-center gap-2">
              <input 
                v-model.number="config.budget_alert_threshold"
                type="range"
                min="50"
                max="100"
                class="flex-1"
              >
              <span class="text-sm text-gray-400 w-12">{{ config.budget_alert_threshold }}%</span>
            </div>
          </div>

          <Toggle 
            v-model="config.pause_on_budget_exhausted" 
            label="Pause AI when budget exhausted (fallback to Ollama if enabled)"
          />
        </div>
      </div>
    </Card>

    <!-- Ollama Fallback Settings -->
    <Card
      v-if="config.primary_provider !== 'ollama' && config.primary_provider !== 'none'"
      title="🦙 Ollama Fallback"
    >
      <div class="space-y-4">
        <p class="text-sm text-gray-400">
          Ollama can be used as a fallback for basic tasks or when cloud budget is exhausted.
        </p>

        <Toggle 
          v-model="config.ollama_fallback_enabled" 
          label="Enable Ollama as fallback"
        />

        <div
          v-if="config.ollama_fallback_enabled"
          class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700"
        >
          <h4 class="font-medium text-gray-300">
            Use Ollama for:
          </h4>
          
          <div class="space-y-2">
            <Toggle 
              v-model="config.ollama_for_basic_tasks" 
              label="Basic classification tasks (save cloud costs)"
            />
            <Toggle 
              v-model="config.ollama_for_budget_exhausted" 
              label="When cloud budget is exhausted"
            />
          </div>

          <div class="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Ollama Host</label>
              <input 
                v-model="config.ollama_host"
                type="text"
                placeholder="http://ollama:11434"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Ollama Model</label>
              <input 
                v-model="config.ollama_model"
                type="text"
                placeholder="llama3.2"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card
      v-if="!loading"
      title="AI Readiness"
    >
      <AiReadinessController
        :capability="verificationCapability"
        :loading="loadingVerificationCapability"
        :testing="testingVerificationCapability"
        :refreshing="isRefreshingAiReadiness"
        :last-updated-at="aiReadinessLastUpdatedAt"
        :auto-refresh-enabled="aiReadinessAutoRefreshEnabled"
        @diagnostics-toggle="handleAiReadinessDiagnosticsToggle"
        @refresh="refreshVerificationCapability"
        @test="testVerificationCapability"
        @toggle-auto-refresh="toggleAiReadinessAutoRefresh"
      >
        <template #diagnostics>
          <div
            v-if="aiReadinessDiagnosticsExpanded"
            class="space-y-6"
          >
            <OllamaVerificationRuntimeMismatchSummary
              :report="ollamaVerificationRuntimeMismatchSummary"
              :loading="loadingOllamaVerificationRuntimeMismatchSummary"
              :show-refresh="false"
            />

            <OllamaVerificationCapabilityOutcomeHistory
              :report="ollamaVerificationCapabilityOutcomeHistory"
              :loading="loadingOllamaVerificationCapabilityOutcomeHistory"
              :show-refresh="false"
            />

            <OllamaVerificationCompatibilityMatrix
              v-if="config.primary_provider === 'ollama'"
              :report="ollamaVerificationCompatibilityMatrix"
              :running="runningOllamaVerificationCompatibilityMatrix"
              @run="runOllamaVerificationCompatibilityMatrix"
            />

            <VerificationCapabilityChangeReceiptList
              :report="verificationCapabilityChangeReceipts"
              :loading="loadingVerificationCapabilityChangeReceipts"
              :show-refresh="false"
            />

            <OllamaScheduledPreflightSummary
              v-if="showOllamaPreflightPanel"
              :report="ollamaPreflightState"
              :loading="loadingOllamaPreflight"
            />
          </div>
        </template>
      </AiReadinessController>

      <RouteSafetyReadinessSummary
        class="mt-4"
        :report="routeSafetyReadiness"
        :loading="loadingRouteSafetyReadiness"
        :last-updated-at="aiReadinessLastUpdatedAt"
        :auto-refresh-enabled="aiReadinessAutoRefreshEnabled"
      />
      <AiProviderCapabilityMetricsHealthSummary
        class="mt-4"
        :report="capabilityMetricsHealth"
        :loading="loadingCapabilityMetricsHealth"
        :trend-report="capabilityMetricsHealthTrend"
        :trend-loading="loadingCapabilityMetricsHealthTrend"
        :failure-breakdown="capabilityMetricsFailureBreakdown"
        :failure-breakdown-loading="loadingCapabilityMetricsFailureBreakdown"
        :failure-category-coverage="capabilityMetricsFailureCategoryCoverage"
        :failure-category-coverage-loading="loadingCapabilityMetricsFailureCategoryCoverage"
        :failure-recency="capabilityMetricsFailureRecency"
        :failure-recency-loading="loadingCapabilityMetricsFailureRecency"
        :last-updated-at="capabilityMetricsHealthLastUpdatedAt"
        :auto-refresh-enabled="aiReadinessAutoRefreshEnabled"
      />
      <RouteSafetyMaintenanceHandoff
        :report="routeSafetyMaintenanceHandoff"
      />
    </Card>

    <!-- Save Button -->
    <div class="flex justify-end">
      <Button
        :disabled="saving"
        @click="saveConfig"
      >
        <span v-if="saving && verificationSaveStatus?.state === 'testing'">Saving and testing strict verification...</span>
        <span v-else-if="saving">Saving...</span>
        <span v-else-if="hasUnsavedOllamaVerificationTargetChange">💾 Save Changes and Test Strict Verification</span>
        <span v-else>💾 Save Changes</span>
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Toggle from '@/components/common/Toggle.vue'
import Spinner from '@/components/common/Spinner.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import AiReadinessController from '@/components/settings/AiReadinessController.vue'
import AiProviderCapabilityMetricsHealthSummary from '@/components/settings/AiProviderCapabilityMetricsHealthSummary.vue'
import RouteSafetyMaintenanceHandoff from '@/components/settings/RouteSafetyMaintenanceHandoff.vue'
import RouteSafetyReadinessSummary from '@/components/settings/RouteSafetyReadinessSummary.vue'
import VerificationCapabilityChangeReceiptList from '@/components/settings/VerificationCapabilityChangeReceiptList.vue'
import OllamaVerificationCapabilityOutcomeHistory from '@/components/settings/OllamaVerificationCapabilityOutcomeHistory.vue'
import OllamaVerificationCompatibilityMatrix from '@/components/settings/OllamaVerificationCompatibilityMatrix.vue'
import OllamaVerificationRuntimeMismatchSummary from '@/components/settings/OllamaVerificationRuntimeMismatchSummary.vue'
import OllamaScheduledPreflightSummary from '@/components/settings/OllamaScheduledPreflightSummary.vue'
import api from '@/api'
import {
  AI_SETTINGS_STALE_WRITE_RECOVERY_MESSAGE,
  getAiSettingsWritePreconditionFromResponse,
  isAiSettingsStaleWriteError,
} from '@/api/aiSettingsWritePrecondition'
import { getAiVerificationCapabilityTestFeedback } from '@/utils/aiVerificationCapabilityTestFeedback'
import { useToast } from '@/stores/toast'
import { useAiReadinessAutoRefresh } from '@/composables/useAiReadinessAutoRefresh'

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const testingOllama = ref(false)
const loadingModels = ref(false)
const loadingOllamaModels = ref(false)
const loadingOllamaPreflight = ref(false)
const loadingVerificationCapability = ref(false)
const loadingRouteSafetyReadiness = ref(false)
const loadingCapabilityMetricsHealth = ref(false)
const loadingCapabilityMetricsHealthTrend = ref(false)
const loadingCapabilityMetricsFailureBreakdown = ref(false)
const loadingCapabilityMetricsFailureCategoryCoverage = ref(false)
const loadingCapabilityMetricsFailureRecency = ref(false)
const loadingRouteSafetyMaintenanceHandoff = ref(false)
const testingVerificationCapability = ref(false)
const loadingVerificationCapabilityChangeReceipts = ref(false)
const loadingOllamaVerificationRuntimeMismatchSummary = ref(false)
const loadingOllamaVerificationCapabilityOutcomeHistory = ref(false)
const runningOllamaVerificationCompatibilityMatrix = ref(false)
const showAdvanced = ref(false)
const testResult = ref(null)
const ollamaTestResult = ref(null)
const availableModels = ref([])
const ollamaModels = ref([])
const ollamaPreflightState = ref({ ai: null, embedding: null })
const usageStats = ref(null)
const verificationCapability = ref(null)
const routeSafetyReadiness = ref(null)
const capabilityMetricsHealth = ref(null)
const capabilityMetricsHealthTrend = ref(null)
const capabilityMetricsFailureBreakdown = ref(null)
const capabilityMetricsFailureCategoryCoverage = ref(null)
const capabilityMetricsFailureRecency = ref(null)
const capabilityMetricsHealthLastUpdatedAt = ref(null)
const routeSafetyMaintenanceHandoff = ref(null)
const verificationCapabilityChangeReceipts = ref(null)
const ollamaVerificationRuntimeMismatchSummary = ref(null)
const ollamaVerificationCapabilityOutcomeHistory = ref(null)
const ollamaVerificationCompatibilityMatrix = ref(null)
const aiSettingsWritePrecondition = ref(null)
const savedOllamaVerificationTargetFingerprint = ref(null)
const verificationSaveStatus = ref(null)
const aiReadinessAutoRefreshEnabled = ref(true)
const aiReadinessDiagnosticsExpanded = ref(false)
let verificationCapabilityRequestId = 0
let routeSafetyReadinessRequestId = 0
let capabilityMetricsHealthRequestId = 0
let capabilityMetricsHealthTrendRequestId = 0
let capabilityMetricsFailureBreakdownRequestId = 0
let capabilityMetricsFailureCategoryCoverageRequestId = 0
let capabilityMetricsFailureRecencyRequestId = 0
let routeSafetyMaintenanceHandoffRequestId = 0
let verificationCapabilityChangeReceiptsRequestId = 0
let ollamaVerificationRuntimeMismatchSummaryRequestId = 0
let ollamaVerificationCapabilityOutcomeHistoryRequestId = 0
let ollamaPreflightRequestId = 0

const config = ref({
  primary_provider: 'none',
  api_endpoint: '',
  api_key: '',
  model: '',
  temperature: 0.7,
  max_tokens: 2000,
  monthly_budget_usd: null,
  current_month_usage_usd: 0,
  budget_alert_threshold: 80,
  pause_on_budget_exhausted: true,
  ollama_fallback_enabled: false,
  ollama_for_basic_tasks: false,
  ollama_for_budget_exhausted: true,
  ollama_host: 'localhost',
  ollama_port: 11434,
  ollama_model: 'llama3.2',
  // RAG settings
  rag_enabled: false,
  embedding_provider: 'auto',
  rag_similarity_threshold: 0.70,
  rag_min_history_count: 50,
  rag_backfill_budget_type: 'percentage',
  rag_backfill_budget_value: 25
})

// API providers are cloud-based services that charge per API call
// (as opposed to local providers like Ollama which are free)
const isApiProvider = computed(() => {
  return ['openai', 'gemini', 'openrouter', 'litellm', 'custom'].includes(config.value.primary_provider)
})

const showOllamaPreflightPanel = computed(() => {
  return config.value.primary_provider === 'ollama' ||
    (config.value.primary_provider !== 'none' && config.value.ollama_fallback_enabled)
})

const hasUnsavedOllamaVerificationTargetChange = computed(() => {
  const selectedFingerprint = getOllamaVerificationTargetFingerprint()
  return Boolean(
    selectedFingerprint &&
    savedOllamaVerificationTargetFingerprint.value &&
    selectedFingerprint !== savedOllamaVerificationTargetFingerprint.value
  )
})

const budgetPercentUsed = computed(() => {
  if (!config.value.monthly_budget_usd) return 0
  return Math.round((config.value.current_month_usage_usd / config.value.monthly_budget_usd) * 100)
})

// Cost summary
const costSummary = ref(null)

// Pattern configuration
const patternConfig = ref({
  pattern_mining_enabled: false,
  pattern_rule_priority: 'rules_first',
  pattern_ai_skip_threshold: 90,
  pattern_notification_dismissed: false
})

// Helper to parse a URL string and extract host and port
const parseOllamaHost = (hostValue) => {
  if (!hostValue) return { host: 'localhost', port: 11434 }
  
  // If it's already just a hostname/IP, return as-is
  if (!hostValue.includes('://') && !hostValue.includes(':')) {
    return { host: hostValue, port: 11434 }
  }
  
  try {
    // Handle full URL like http://192.168.50.95:11434
    let url = hostValue
    if (!url.includes('://')) {
      url = 'http://' + url
    }
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 11434
    }
  } catch {
    // If parsing fails, just strip protocol and port manually
    let host = hostValue.replace(/^https?:\/\//, '')
    const portMatch = host.match(/:(\d+)/)
    if (portMatch) {
      return { host: host.split(':')[0], port: parseInt(portMatch[1]) }
    }
    return { host: host, port: 11434 }
  }
}

const loadOllamaPreflightStatus = async () => {
  const requestId = ++ollamaPreflightRequestId
  loadingOllamaPreflight.value = true

  try {
    const response = await api.getLastOllamaPreflight()
    if (requestId === ollamaPreflightRequestId) {
      ollamaPreflightState.value = response || { ai: null, embedding: null }
    }
    return response || null
  } catch {
    if (requestId === ollamaPreflightRequestId) {
      ollamaPreflightState.value = { ai: null, embedding: null }
    }
    return null
  } finally {
    if (requestId === ollamaPreflightRequestId) {
      loadingOllamaPreflight.value = false
    }
  }
}

const loadVerificationCapability = async () => {
  const requestId = ++verificationCapabilityRequestId
  loadingVerificationCapability.value = true
  try {
    const capability = await api.getAIVerificationCapability()
    if (requestId === verificationCapabilityRequestId) {
      verificationCapability.value = capability
    }
    return capability
  } catch (_error) {
    if (requestId === verificationCapabilityRequestId) {
      verificationCapability.value = null
    }
    return null
  } finally {
    if (requestId === verificationCapabilityRequestId) {
      loadingVerificationCapability.value = false
    }
  }
}

// This read is intentionally paired with saved-capability refreshes: both are
// bounded, read-only, and server-owned. It does not test a provider or change
// a policy, retry, route, or media record.
const loadRouteSafetyReadiness = async () => {
  const requestId = ++routeSafetyReadinessRequestId
  loadingRouteSafetyReadiness.value = true
  try {
    const report = await api.getRouteSafetyReadiness()
    if (requestId === routeSafetyReadinessRequestId) {
      routeSafetyReadiness.value = report
    }
    return report
  } catch (_error) {
    if (requestId === routeSafetyReadinessRequestId) {
      routeSafetyReadiness.value = null
    }
    return null
  } finally {
    if (requestId === routeSafetyReadinessRequestId) {
      loadingRouteSafetyReadiness.value = false
    }
  }
}

// This server-owned aggregate is deliberately paired with AI readiness
// refreshes. It reads only fixed counts and timestamps and cannot test a
// provider, mutate telemetry, or influence provider/policy/routing authority.
const loadCapabilityMetricsHealth = async () => {
  const requestId = ++capabilityMetricsHealthRequestId
  loadingCapabilityMetricsHealth.value = true
  try {
    const report = await api.getAiProviderCapabilityMetricsHealth()
    if (requestId === capabilityMetricsHealthRequestId) {
      capabilityMetricsHealth.value = report
      capabilityMetricsHealthLastUpdatedAt.value = new Date().toISOString()
    }
    return report
  } catch (_error) {
    if (requestId === capabilityMetricsHealthRequestId) {
      capabilityMetricsHealth.value = null
    }
    return null
  } finally {
    if (requestId === capabilityMetricsHealthRequestId) {
      loadingCapabilityMetricsHealth.value = false
    }
  }
}

// This companion read uses three completed UTC-day windows. It remains
// aggregate-only and advisory, and shares the same visible-page lifecycle as
// the timely health status without creating another polling mechanism.
const loadCapabilityMetricsHealthTrend = async () => {
  const requestId = ++capabilityMetricsHealthTrendRequestId
  loadingCapabilityMetricsHealthTrend.value = true
  try {
    const report = await api.getAiProviderCapabilityMetricsHealthTrend()
    if (requestId === capabilityMetricsHealthTrendRequestId) {
      capabilityMetricsHealthTrend.value = report
    }
    return report
  } catch (_error) {
    if (requestId === capabilityMetricsHealthTrendRequestId) {
      capabilityMetricsHealthTrend.value = null
    }
    return null
  } finally {
    if (requestId === capabilityMetricsHealthTrendRequestId) {
      loadingCapabilityMetricsHealthTrend.value = false
    }
  }
}

function hasCapabilityMetricsPersistenceFailures(report) {
  return report?.version === 'ai.provider_capability_metrics_health.v1'
    && report?.status?.id === 'persistence_failures_detected'
    && /^0*[1-9]\d*$/.test(String(report?.persistenceFailureCount ?? ''))
}

// This diagnostic is requested only after the already-loaded, read-only
// health aggregate confirms an active warning. It is fixed-window, aggregate
// only, and cannot call a provider, retry a write, or affect routing.
const loadCapabilityMetricsFailureBreakdown = async () => {
  const requestId = ++capabilityMetricsFailureBreakdownRequestId
  loadingCapabilityMetricsFailureBreakdown.value = true
  try {
    const report = await api.getAiProviderCapabilityMetricsFailureBreakdown()
    if (requestId === capabilityMetricsFailureBreakdownRequestId) {
      capabilityMetricsFailureBreakdown.value = report
    }
    return report
  } catch (_error) {
    if (requestId === capabilityMetricsFailureBreakdownRequestId) {
      capabilityMetricsFailureBreakdown.value = null
    }
    return null
  } finally {
    if (requestId === capabilityMetricsFailureBreakdownRequestId) {
      loadingCapabilityMetricsFailureBreakdown.value = false
    }
  }
}

function clearCapabilityMetricsFailureBreakdown() {
  capabilityMetricsFailureBreakdownRequestId += 1
  capabilityMetricsFailureBreakdown.value = null
  loadingCapabilityMetricsFailureBreakdown.value = false
}

// This adoption report uses three completed UTC days rather than the rolling
// health window. It is loaded only after an active warning is already known,
// returns fixed aggregates, and cannot change provider, policy, or routing
// behavior.
const loadCapabilityMetricsFailureCategoryCoverage = async () => {
  const requestId = ++capabilityMetricsFailureCategoryCoverageRequestId
  loadingCapabilityMetricsFailureCategoryCoverage.value = true
  try {
    const report = await api.getAiProviderCapabilityMetricsFailureCategoryCoverage()
    if (requestId === capabilityMetricsFailureCategoryCoverageRequestId) {
      capabilityMetricsFailureCategoryCoverage.value = report
    }
    return report
  } catch (_error) {
    if (requestId === capabilityMetricsFailureCategoryCoverageRequestId) {
      capabilityMetricsFailureCategoryCoverage.value = null
    }
    return null
  } finally {
    if (requestId === capabilityMetricsFailureCategoryCoverageRequestId) {
      loadingCapabilityMetricsFailureCategoryCoverage.value = false
    }
  }
}

function clearCapabilityMetricsFailureCategoryCoverage() {
  capabilityMetricsFailureCategoryCoverageRequestId += 1
  capabilityMetricsFailureCategoryCoverage.value = null
  loadingCapabilityMetricsFailureCategoryCoverage.value = false
}

// This companion aggregate translates the same three completed UTC days into
// a fixed current/newly-cleared/older-only band. It remains separate from the
// rolling health status and cannot affect any runtime decision.
const loadCapabilityMetricsFailureRecency = async () => {
  const requestId = ++capabilityMetricsFailureRecencyRequestId
  loadingCapabilityMetricsFailureRecency.value = true
  try {
    const report = await api.getAiProviderCapabilityMetricsFailureRecency()
    if (requestId === capabilityMetricsFailureRecencyRequestId) {
      capabilityMetricsFailureRecency.value = report
    }
    return report
  } catch (_error) {
    if (requestId === capabilityMetricsFailureRecencyRequestId) {
      capabilityMetricsFailureRecency.value = null
    }
    return null
  } finally {
    if (requestId === capabilityMetricsFailureRecencyRequestId) {
      loadingCapabilityMetricsFailureRecency.value = false
    }
  }
}

function clearCapabilityMetricsFailureRecency() {
  capabilityMetricsFailureRecencyRequestId += 1
  capabilityMetricsFailureRecency.value = null
  loadingCapabilityMetricsFailureRecency.value = false
}

// The maintenance handoff is a separate aggregate-only read. It deliberately
// becomes eligible only after route-safety observations exist, and it cannot
// select a policy, test a provider, mutate configuration, retry, or route.
const loadRouteSafetyMaintenanceHandoff = async () => {
  const requestId = ++routeSafetyMaintenanceHandoffRequestId
  loadingRouteSafetyMaintenanceHandoff.value = true
  try {
    const report = await api.getRouteSafetyMaintenanceHandoff()
    if (requestId === routeSafetyMaintenanceHandoffRequestId) {
      routeSafetyMaintenanceHandoff.value = report
    }
    return report
  } catch (_error) {
    if (requestId === routeSafetyMaintenanceHandoffRequestId) {
      routeSafetyMaintenanceHandoff.value = null
    }
    return null
  } finally {
    if (requestId === routeSafetyMaintenanceHandoffRequestId) {
      loadingRouteSafetyMaintenanceHandoff.value = false
    }
  }
}

const loadAiReadiness = async () => {
  const [capability, routeSafety, capabilityMetrics, capabilityMetricsTrend] = await Promise.all([
    loadVerificationCapability(),
    loadRouteSafetyReadiness(),
    loadCapabilityMetricsHealth(),
    loadCapabilityMetricsHealthTrend(),
  ])
  const routeSafetyObservationCount = Number(routeSafety?.observationCount)
  const maintenanceHandoff = Number.isSafeInteger(routeSafetyObservationCount) && routeSafetyObservationCount > 0
    ? await loadRouteSafetyMaintenanceHandoff()
    : (routeSafetyMaintenanceHandoff.value = null)
  const hasPersistenceFailures = hasCapabilityMetricsPersistenceFailures(capabilityMetrics)
  const [failureBreakdown, failureCategoryCoverage, failureRecency] = hasPersistenceFailures
    ? await Promise.all([
      loadCapabilityMetricsFailureBreakdown(),
      loadCapabilityMetricsFailureCategoryCoverage(),
      loadCapabilityMetricsFailureRecency(),
    ])
    : (clearCapabilityMetricsFailureBreakdown(), clearCapabilityMetricsFailureCategoryCoverage(), clearCapabilityMetricsFailureRecency(), [null, null, null])

  return capability || routeSafety || capabilityMetrics || capabilityMetricsTrend || maintenanceHandoff || failureBreakdown || failureCategoryCoverage || failureRecency
}

const {
  isRefreshing: isRefreshingAiReadiness,
  lastUpdatedAt: aiReadinessLastUpdatedAt,
  markReadinessUpdated,
  refreshReadiness: refreshAiReadiness,
} = useAiReadinessAutoRefresh({
  autoRefreshEnabled: aiReadinessAutoRefreshEnabled,
  refresh: loadAiReadiness,
})

const refreshVerificationCapability = async () => {
  const refreshed = await refreshAiReadiness()
  if (!refreshed) {
    toast.warning('Current AI and route-safety readiness could not be refreshed.')
  }
}

const testVerificationCapability = async ({ automatic = false } = {}) => {
  testingVerificationCapability.value = true
  if (automatic) {
    verificationSaveStatus.value = {
      state: 'testing',
      className: 'border-blue-700/70 bg-blue-950/20 text-blue-100',
      heading: 'Saved Ollama configuration — testing strict verification',
      message: 'Classifarr is running one fixed, media-free structured-output test. No media will be routed.',
    }
  }

  try {
    const response = await api.testAIVerificationCapability()
    verificationCapability.value = response?.data || response
    markReadinessUpdated()
    // Trend refresh is advisory and must not delay the authoritative saved
    // capability result or its operator feedback.
    if (aiReadinessDiagnosticsExpanded.value) {
      void loadOllamaVerificationCapabilityOutcomeHistory()
    }
    const feedback = getAiVerificationCapabilityTestFeedback(verificationCapability.value)
    if (automatic) {
      verificationSaveStatus.value = {
        state: 'completed',
        className: feedback.level === 'success'
          ? 'border-green-700/70 bg-green-950/20 text-green-100'
          : 'border-amber-700/70 bg-amber-950/20 text-amber-100',
        heading: 'Strict-verification test completed',
        message: feedback.message,
      }
    }
    toast[feedback.level](feedback.message)
  } catch (error) {
    const message = error.response?.status === 409
      ? 'AI settings changed while Ollama was being tested. Reload the saved settings and test again.'
      : 'Ollama verification could not be tested. Confirm the saved endpoint and model, then try again.'

    if (automatic) {
      verificationSaveStatus.value = {
        state: 'failed',
        className: 'border-amber-700/70 bg-amber-950/20 text-amber-100',
        heading: 'Ollama configuration saved — strict verification was not completed',
        message,
      }
    }
    if (error.response?.status === 409) {
      toast.warning(message)
    } else {
      toast.warning(message)
    }
  } finally {
    testingVerificationCapability.value = false
  }
}

const runOllamaVerificationCompatibilityMatrix = async () => {
  runningOllamaVerificationCompatibilityMatrix.value = true
  try {
    const response = await api.runOllamaVerificationCompatibilityMatrix()
    ollamaVerificationCompatibilityMatrix.value = response?.data || response
    toast.success('Ollama compatibility check completed.')
  } catch (error) {
    if (error.response?.status === 409) {
      toast.warning('An Ollama compatibility check is already running. Wait for it to finish before trying again.')
    } else if (error.response?.status === 429) {
      toast.warning('The Ollama compatibility check is limited to two runs per hour. Try again later.')
    } else {
      toast.warning('Ollama compatibility could not be checked. Confirm the saved local service, then try again.')
    }
  } finally {
    runningOllamaVerificationCompatibilityMatrix.value = false
  }
}

const loadVerificationCapabilityChangeReceipts = async () => {
  const requestId = ++verificationCapabilityChangeReceiptsRequestId
  loadingVerificationCapabilityChangeReceipts.value = true
  try {
    const receipts = await api.getAIVerificationCapabilityChangeReceipts({ limit: 5 })
    if (requestId === verificationCapabilityChangeReceiptsRequestId) {
      verificationCapabilityChangeReceipts.value = receipts
    }
    return receipts
  } catch (_error) {
    if (requestId === verificationCapabilityChangeReceiptsRequestId) {
      verificationCapabilityChangeReceipts.value = null
    }
    return null
  } finally {
    if (requestId === verificationCapabilityChangeReceiptsRequestId) {
      loadingVerificationCapabilityChangeReceipts.value = false
    }
  }
}

const loadOllamaVerificationRuntimeMismatchSummary = async () => {
  const requestId = ++ollamaVerificationRuntimeMismatchSummaryRequestId
  loadingOllamaVerificationRuntimeMismatchSummary.value = true
  try {
    const summary = await api.getOllamaVerificationRuntimeMismatchSummary()
    if (requestId === ollamaVerificationRuntimeMismatchSummaryRequestId) {
      ollamaVerificationRuntimeMismatchSummary.value = summary
    }
    return summary
  } catch (_error) {
    if (requestId === ollamaVerificationRuntimeMismatchSummaryRequestId) {
      ollamaVerificationRuntimeMismatchSummary.value = null
    }
    return null
  } finally {
    if (requestId === ollamaVerificationRuntimeMismatchSummaryRequestId) {
      loadingOllamaVerificationRuntimeMismatchSummary.value = false
    }
  }
}

const loadOllamaVerificationCapabilityOutcomeHistory = async () => {
  const requestId = ++ollamaVerificationCapabilityOutcomeHistoryRequestId
  loadingOllamaVerificationCapabilityOutcomeHistory.value = true
  try {
    const history = await api.getOllamaVerificationCapabilityOutcomeHistory()
    if (requestId === ollamaVerificationCapabilityOutcomeHistoryRequestId) {
      ollamaVerificationCapabilityOutcomeHistory.value = history
    }
    return history
  } catch (_error) {
    if (requestId === ollamaVerificationCapabilityOutcomeHistoryRequestId) {
      ollamaVerificationCapabilityOutcomeHistory.value = null
    }
    return null
  } finally {
    if (requestId === ollamaVerificationCapabilityOutcomeHistoryRequestId) {
      loadingOllamaVerificationCapabilityOutcomeHistory.value = false
    }
  }
}

const loadAiReadinessDiagnostics = async () => {
  const diagnostics = [
    loadVerificationCapabilityChangeReceipts(),
    loadOllamaVerificationRuntimeMismatchSummary(),
    loadOllamaVerificationCapabilityOutcomeHistory(),
  ]

  if (showOllamaPreflightPanel.value) {
    diagnostics.push(loadOllamaPreflightStatus())
  }

  await Promise.all(diagnostics)
}

const handleAiReadinessDiagnosticsToggle = (expanded) => {
  const nextExpandedState = expanded === true
  if (aiReadinessDiagnosticsExpanded.value === nextExpandedState) return

  aiReadinessDiagnosticsExpanded.value = nextExpandedState
  if (nextExpandedState) {
    void loadAiReadinessDiagnostics()
  }
}

const toggleAiReadinessAutoRefresh = () => {
  aiReadinessAutoRefreshEnabled.value = !aiReadinessAutoRefreshEnabled.value
}

const applyEditableAiConfig = (response) => {
  const configResponse = response?.config || {}
  aiSettingsWritePrecondition.value = response?.writePrecondition || null
  const loadedConfig = { ...config.value, ...configResponse }

  // Parse ollama_host if it contains a full URL (legacy format)
  if (loadedConfig.ollama_host && (loadedConfig.ollama_host.includes('://') || loadedConfig.ollama_host.includes(':'))) {
    const parsed = parseOllamaHost(loadedConfig.ollama_host)
    loadedConfig.ollama_host = parsed.host
    loadedConfig.ollama_port = parsed.port
  }

  config.value = loadedConfig
  savedOllamaVerificationTargetFingerprint.value = getOllamaVerificationTargetFingerprint(loadedConfig)

  if (loadedConfig.ollama_model) {
    ollamaModels.value = [{ name: loadedConfig.ollama_model }]
  }

  const cloudProviders = ['openai', 'gemini', 'openrouter', 'litellm', 'custom']
  if (loadedConfig.model && cloudProviders.includes(loadedConfig.primary_provider)) {
    availableModels.value = [{ id: loadedConfig.model, name: loadedConfig.model }]
  }
}

const reloadEditableAiConfig = async () => {
  applyEditableAiConfig(await api.getAIConfigForUpdate())
}

onMounted(async () => {
  try {
    const [configResponse, usageResponse, patternConfigResponse, costSummaryResponse] = await Promise.all([
      api.getAIConfigForUpdate(),
      api.getAIUsage().catch(() => null),
      api.getPatternConfig().catch(() => null),
      api.getCostSummary().catch(() => null),
    ])
    
    applyEditableAiConfig(configResponse)
    
    if (usageResponse) {
      usageStats.value = usageResponse
    }
    if (patternConfigResponse) {
      patternConfig.value = { ...patternConfig.value, ...patternConfigResponse }
    }
    if (costSummaryResponse) {
      costSummary.value = costSummaryResponse
    }
  } catch (error) {
    console.error('Failed to load AI config:', error)
    toast.error('Failed to load AI configuration')
  } finally {
    loading.value = false
  }
})

const onProviderChange = () => {
  testResult.value = null
  availableModels.value = []
  config.value.api_endpoint = ''
  config.value.api_key = ''
  config.value.model = ''
}

const fetchModels = async () => {
  loadingModels.value = true
  try {
    const response = await api.getAIModels({
      primary_provider: config.value.primary_provider,
      api_endpoint: config.value.api_endpoint,
      api_key: config.value.api_key
    })
    if (response.data?.success === false) {
      availableModels.value = []
      toast.error(response.data.error || 'Failed to fetch models')
      return
    }
    availableModels.value = response.data.models || []
    const selectedModelStillAvailable = availableModels.value.some(model => (
      (model.id || model.name) === config.value.model
    ))
    if (config.value.model && !selectedModelStillAvailable) {
      config.value.model = ''
    }
    if (availableModels.value.length > 0) {
      toast.success(`Found ${availableModels.value.length} models`)
    } else {
      toast.warning('No models found')
    }
  } catch (error) {
    toast.error(error.response?.data?.error || 'Failed to fetch models')
  } finally {
    loadingModels.value = false
  }
}

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    const response = await api.testAIConnection({
      primary_provider: config.value.primary_provider,
      api_endpoint: config.value.api_endpoint,
      api_key: config.value.api_key
    })
    testResult.value = response.data
    if (response.data.success) {
      toast.success('Connection successful!')
      // Auto-fetch models on success
      fetchModels()
    } else if (response.data.error) {
      toast.error(response.data.error)
    }
  } catch (error) {
    testResult.value = { success: false, error: error.response?.data?.error || error.message }
  } finally {
    testing.value = false
  }
}

const testOllamaConnection = async () => {
  testingOllama.value = true
  ollamaTestResult.value = null
  try {
    // Pass the current form values, not saved DB values
    const response = await api.testOllama({ host: config.value.ollama_host, port: config.value.ollama_port })
    ollamaTestResult.value = response.data
    if (response.data.success) {
      toast.success('Ollama connected!')
      // Auto-fetch models on success
      fetchOllamaModels()
    }
  } catch (error) {
    ollamaTestResult.value = { success: false, error: error.message }
  } finally {
    testingOllama.value = false
  }
}

const fetchOllamaModels = async () => {
  loadingOllamaModels.value = true
  try {
    const response = await api.getOllamaModels(config.value.ollama_host, config.value.ollama_port)
    const allModels = response || []
    
    // Filter out embedding models from the generation dropdown
    // Users should select generation models here, and embedding models in the RAG section
    ollamaModels.value = allModels.filter(m => {
      const name = m.name.toLowerCase()
      return !name.includes('embed') && 
             !name.includes('minilm') && 
             !name.includes('bert') && 
             !name.includes('bge')
    })

    // Add current model if not in list (even if it looks like an embedding model, to avoid confusion)
    if (config.value.ollama_model && !ollamaModels.value.find(m => m.name === config.value.ollama_model)) {
      ollamaModels.value.unshift({ name: config.value.ollama_model })
    }
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error)
    toast.error(`Failed to fetch models: ${error.message}`)
    // Keep current model
    if (config.value.ollama_model) {
      ollamaModels.value = [{ name: config.value.ollama_model }]
    }
  } finally {
    loadingOllamaModels.value = false
  }
}

const buildAIProviderPayload = () => ({
  primary_provider: config.value.primary_provider,
  api_endpoint: config.value.api_endpoint,
  api_key: config.value.api_key,
  model: config.value.model,
  temperature: config.value.temperature,
  max_tokens: config.value.max_tokens,
  monthly_budget_usd: config.value.monthly_budget_usd,
  budget_alert_threshold: config.value.budget_alert_threshold,
  pause_on_budget_exhausted: config.value.pause_on_budget_exhausted,
  ollama_fallback_enabled: config.value.ollama_fallback_enabled,
  ollama_for_basic_tasks: config.value.ollama_for_basic_tasks,
  ollama_for_budget_exhausted: config.value.ollama_for_budget_exhausted,
  ollama_host: config.value.ollama_host,
  ollama_port: config.value.ollama_port,
  ollama_model: config.value.ollama_model
})

const getOllamaVerificationTargetFingerprint = (candidateConfig = config.value) => {
  if (candidateConfig?.primary_provider !== 'ollama') return null

  const model = typeof candidateConfig.ollama_model === 'string'
    ? candidateConfig.ollama_model.trim()
    : ''
  if (!model) return null

  return JSON.stringify({
    primaryProvider: 'ollama',
    host: typeof candidateConfig.ollama_host === 'string'
      ? candidateConfig.ollama_host.trim()
      : '',
    port: Number(candidateConfig.ollama_port) || 11434,
    model,
  })
}

const persistConfig = async (providerPayload) => {
  saving.value = true
  let aiConfigSaved = false
  const selectedOllamaTargetFingerprint = getOllamaVerificationTargetFingerprint()
  const shouldAutoTestOllama = Boolean(
    selectedOllamaTargetFingerprint &&
    selectedOllamaTargetFingerprint !== savedOllamaVerificationTargetFingerprint.value
  )
  try {
    const response = await api.updateAIConfig(providerPayload, aiSettingsWritePrecondition.value)
    aiSettingsWritePrecondition.value = getAiSettingsWritePreconditionFromResponse(response)
    aiConfigSaved = true
    savedOllamaVerificationTargetFingerprint.value = selectedOllamaTargetFingerprint
    await refreshAiReadiness()
    if (aiReadinessDiagnosticsExpanded.value) {
      void loadVerificationCapabilityChangeReceipts()
    }
    if (shouldAutoTestOllama) {
      await testVerificationCapability({ automatic: true })
    }
    await api.updatePatternConfig(patternConfig.value)
    if (!shouldAutoTestOllama) {
      toast.success('AI configuration saved!')
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || 'Failed to save configuration'

    if (isAiSettingsStaleWriteError(error)) {
      try {
        await reloadEditableAiConfig()
        await refreshAiReadiness()
        if (aiReadinessDiagnosticsExpanded.value) {
          void loadVerificationCapabilityChangeReceipts()
        }
        toast.warning(AI_SETTINGS_STALE_WRITE_RECOVERY_MESSAGE)
      } catch (reloadError) {
        console.error('Failed to reload AI configuration after a stale save:', reloadError)
        toast.error(errorMessage)
      }
      return
    }

    if (aiConfigSaved) {
      toast.warning(`AI provider settings were saved, but pattern settings failed: ${errorMessage}`)
    } else {
      toast.error(errorMessage)
    }
  } finally {
    saving.value = false
  }
}

const saveConfig = async () => {
  await persistConfig(buildAIProviderPayload())
}

</script>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- 1. AI Provider Section -->
    <Card title="🤖 AI Provider">
      <div v-if="loading" class="text-center py-8">
        <Spinner />
        <p class="text-gray-400 mt-2">Loading AI configuration...</p>
      </div>

      <div v-else class="space-y-6">
        <!-- Provider Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Classification Provider</label>
          <select 
            v-model="config.primary_provider" 
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            @change="onProviderChange"
          >
            <option value="none">No Provider (AI Disabled)</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="litellm">LiteLLM</option>
            <option value="custom">Custom OpenAI-Compatible</option>
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
        <div v-if="isApiProvider" class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h3 class="font-medium text-gray-200">Cloud Provider Settings</h3>
          
          <!-- API Endpoint (Custom only) -->
          <div v-if="config.primary_provider === 'custom' || config.primary_provider === 'litellm'">
            <label class="block text-sm font-medium text-gray-300 mb-2">API Endpoint</label>
            <input 
              v-model="config.api_endpoint"
              type="url"
              placeholder="https://your-api-endpoint.com/v1"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
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
                Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-400 hover:underline">platform.openai.com</a>
              </template>
              <template v-else-if="config.primary_provider === 'gemini'">
                Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" class="text-blue-400 hover:underline">aistudio.google.com</a>
              </template>
              <template v-else-if="config.primary_provider === 'openrouter'">
                Get your key from <a href="https://openrouter.ai/keys" target="_blank" class="text-blue-400 hover:underline">openrouter.ai</a>
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
                <option value="">Select a model...</option>
                <option v-for="model in availableModels" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
              <Button 
                variant="secondary" 
                size="sm" 
                @click="fetchModels"
                :disabled="loadingModels || !config.api_key"
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
              @click="testConnection"
              :disabled="testing || !config.api_key"
            >
              <span v-if="testing">Testing...</span>
              <span v-else>🔌 Test Connection</span>
            </Button>
            <span v-if="testResult" :class="testResult.success ? 'text-green-400' : 'text-red-400'">
              {{ testResult.message || testResult.error }}
            </span>
          </div>
        </div>

        <!-- Ollama Primary Settings (shown when Ollama is primary) -->
        <div v-if="config.primary_provider === 'ollama'" class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h3 class="font-medium text-gray-200">Ollama Settings</h3>
          
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Ollama Host</label>
              <input 
                v-model="config.ollama_host"
                type="text"
                placeholder="192.168.1.100"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
              <input 
                v-model.number="config.ollama_port"
                type="number"
                placeholder="11434"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Model</label>
              <div class="flex gap-2">
                <select 
                  v-model="config.ollama_model"
                  class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option v-if="ollamaModels.length === 0" value="">-- Select model --</option>
                  <option v-for="model in ollamaModels" :key="model.name" :value="model.name">
                    {{ model.name }}
                  </option>
                </select>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  @click="fetchOllamaModels"
                  :disabled="loadingOllamaModels"
                >
                  <span v-if="loadingOllamaModels">...</span>
                  <span v-else>🔄</span>
                </Button>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <Button variant="secondary" @click="testOllamaConnection" :disabled="testingOllama">
              <span v-if="testingOllama">Testing...</span>
              <span v-else>🔌 Test Connection</span>
            </Button>
            <span v-if="ollamaTestResult" :class="ollamaTestResult.success ? 'text-green-400' : 'text-red-400'">
              {{ ollamaTestResult.message || ollamaTestResult.error }}
            </span>
          </div>
        </div>

        <!-- Embedding Provider -->
        <div v-if="config.primary_provider !== 'none'" class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Embedding Provider</label>
            <select 
              v-model="config.embedding_provider"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            >
              <option value="auto">Auto (use primary AI provider)</option>
              <option value="ollama">Ollama (Local, Free)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Embedding Model</label>
            <select 
              v-model="config.embedding_model"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            >
              <option value="">Default for provider</option>
              <!-- Ollama models -->
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="nomic-embed-text">⭐ nomic-embed-text (768d) - Recommended</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="mxbai-embed-large">⭐ mxbai-embed-large (1024d) - High Quality</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="bge-m3">bge-m3 (1024d) - Multilingual</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="all-minilm">all-minilm (384d) - Fast/Lightweight</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="snowflake-arctic-embed">snowflake-arctic-embed (1024d)</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="snowflake-arctic-embed2">snowflake-arctic-embed2 (1024d)</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="nomic-embed-text-v2-moe">nomic-embed-text-v2-moe (768d)</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="bge-large">bge-large (1024d)</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="qwen3-embedding">qwen3-embedding (1024d)</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="granite-embedding">granite-embedding (768d)</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="embeddinggemma">embeddinggemma (768d)</option>
              <option v-if="effectiveEmbeddingProvider === 'ollama'" value="paraphrase-multilingual">paraphrase-multilingual (768d)</option>
              <!-- OpenAI models -->
              <option v-if="effectiveEmbeddingProvider === 'openai'" value="text-embedding-3-small">⭐ text-embedding-3-small (1536d) - Best Value</option>
              <option v-if="effectiveEmbeddingProvider === 'openai'" value="text-embedding-3-large">text-embedding-3-large (3072d) - Highest Quality</option>
              <option v-if="effectiveEmbeddingProvider === 'openai'" value="text-embedding-ada-002">text-embedding-ada-002 (1536d) - Legacy</option>
              <!-- Gemini models -->
              <option v-if="effectiveEmbeddingProvider === 'gemini'" value="text-embedding-005">⭐ text-embedding-005 (768d) - Latest</option>
              <option v-if="effectiveEmbeddingProvider === 'gemini'" value="text-embedding-004">text-embedding-004 (768d)</option>
            </select>
          </div>
        </div>

        <!-- Advanced Settings -->
        <div v-if="config.primary_provider !== 'none'" class="space-y-4">
          <button 
            @click="showAdvanced = !showAdvanced"
            class="text-sm text-gray-400 hover:text-white flex items-center gap-1"
          >
            <span>{{ showAdvanced ? '▼' : '▶' }}</span>
            Advanced Settings
          </button>
          
          <div v-if="showAdvanced" class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
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
                />
                <p class="text-xs text-gray-500 mt-1">0 = deterministic, 1 = creative</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Max Tokens</label>
                <input 
                  v-model.number="config.max_tokens"
                  type="number"
                  min="100"
                  max="16000"
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- RAG (Semantic Search) Settings -->
    <Card v-if="config.primary_provider !== 'none'" title="🔍 Semantic Search (RAG)">
      <div class="space-y-4">
        <!-- Enable Toggle -->
        <div class="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div>
            <div class="font-medium text-gray-200">Enable Semantic Search</div>
            <div class="text-sm text-gray-400">Learn from past classifications to improve future suggestions</div>
          </div>
          <Toggle v-model="config.rag_enabled" />
        </div>

        <div v-if="config.rag_enabled" class="space-y-4">
          <!-- Thresholds -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Similarity Threshold</label>
              <div class="flex items-center gap-2">
                <input 
                  v-model.number="config.rag_similarity_threshold"
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  class="flex-1"
                />
                <span class="text-white w-12 text-right">{{ (config.rag_similarity_threshold * 100).toFixed(0) }}%</span>
              </div>
              <p class="text-xs text-gray-500 mt-1">Minimum similarity to consider a match</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Min History Count</label>
              <input 
                v-model.number="config.rag_min_history_count"
                type="number"
                min="10"
                max="500"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              />
              <p class="text-xs text-gray-500 mt-1">RAG activates after this many classifications</p>
            </div>
          </div>

          <!-- Backfill Budget (Cloud only) -->
          <div v-if="effectiveEmbeddingProvider !== 'ollama'" class="p-4 bg-gray-800/50 rounded-lg">
            <div class="font-medium text-gray-200 mb-3">Backfill Budget</div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Budget Type</label>
                <select 
                  v-model="config.rag_backfill_budget_type"
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="percentage">% of daily AI budget</option>
                  <option value="fixed">Fixed $ amount</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">
                  {{ config.rag_backfill_budget_type === 'percentage' ? 'Percentage' : 'Amount ($)' }}
                </label>
                <input 
                  v-model.number="config.rag_backfill_budget_value"
                  type="number"
                  :min="config.rag_backfill_budget_type === 'percentage' ? 1 : 0.01"
                  :max="config.rag_backfill_budget_type === 'percentage' ? 100 : 10"
                  :step="config.rag_backfill_budget_type === 'percentage' ? 5 : 0.1"
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2">Budget for embedding existing classifications in the background</p>
          </div>

          <!-- RAG Status -->
          <div v-if="ragStats" class="flex items-center gap-4 text-sm text-gray-400">
            <span>📊 {{ ragStats.total }} embeddings</span>
            <span v-if="ragStats.stale > 0" class="text-yellow-400">⚠️ {{ ragStats.stale }} stale</span>
            <span v-if="ragStats.pendingRetries > 0" class="text-orange-400">🔄 {{ ragStats.pendingRetries }} pending retry</span>
          </div>
        </div>
      </div>
    </Card>

    <!-- Pattern-Based Classification Settings -->
    <!-- Pattern-Based Classification Section -->
    <Card v-if="config.primary_provider !== 'none'" title="🧩 Pattern-Based Classification">
      <div class="space-y-6">
        <!-- Enable Pattern Mining -->
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-medium text-gray-200">Enable Pattern Mining</h3>
              <span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">v0.36.0</span>
            </div>
            <div class="text-sm text-gray-400">
              Learn from classification history to discover patterns (studios, genres, franchises) that predict library routing
            </div>
          </div>
          <Toggle v-model="patternConfig.pattern_mining_enabled" />
        </div>

        <!-- Pattern Settings (when enabled) -->
        <div v-if="patternConfig.pattern_mining_enabled" class="space-y-4">
          <!-- Pattern vs Rules Priority -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Pattern vs Rule Priority</label>
            <select 
              v-model="patternConfig.pattern_rule_priority"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="rules_first">Rules First (Default)</option>
              <option value="patterns_first">Patterns First</option>
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
              <h4 class="font-medium text-gray-200 mb-1">Manage Patterns</h4>
              <p class="text-sm text-gray-400">
                View and manage discovered patterns, approve suggestions, and resolve conflicts
              </p>
            </div>
            <Button @click="$router.push('/patterns')" variant="secondary" size="sm">
              Manage Patterns →
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- API Cost Management Section (ONLY for API providers) -->
    <Card v-if="isApiProvider" title="💰 API Cost Management">
      <div class="space-y-6">
        <!-- AI Skip Threshold -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            AI Skip Threshold
          </label>
          <div class="flex items-center gap-4">
            <input 
              type="range"
              v-model.number="patternConfig.pattern_ai_skip_threshold"
              min="70"
              max="100"
              step="5"
              class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
            />
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
              step="0.01"
              min="0"
              placeholder="No limit"
              class="w-32 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
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
            ></div>
          </div>
          <div class="text-sm text-gray-500 mt-1">{{ budgetPercentUsed }}% used</div>
        </div>

        <!-- Cost Summary Widget -->
        <div class="cost-summary">
          <h4 class="text-sm font-medium text-gray-300 mb-4">📊 This Month</h4>
          <div v-if="costSummary?.callsMade > 0" class="stats-grid grid grid-cols-4 gap-4">
            <div class="stat bg-gray-800/50 p-4 rounded-lg text-center">
              <div class="value text-2xl font-bold text-blue-400">{{ costSummary.callsMade }}</div>
              <div class="label text-xs text-gray-400 mt-1">AI Calls Made</div>
            </div>
            <div class="stat bg-gray-800/50 p-4 rounded-lg text-center">
              <div class="value text-2xl font-bold text-green-500">{{ costSummary.callsAvoided }}</div>
              <div class="label text-xs text-gray-400 mt-1">Calls Avoided</div>
            </div>
            <div class="stat bg-gray-800/50 p-4 rounded-lg text-center">
              <div class="value text-2xl font-bold text-green-500">{{ costSummary.savingsPercent }}%</div>
              <div class="label text-xs text-gray-400 mt-1">Savings</div>
            </div>
            <div class="stat bg-gray-800/50 p-4 rounded-lg text-center">
              <div class="value text-2xl font-bold text-yellow-400">${{ costSummary.estimatedCost?.toFixed(2) || '0.00' }}</div>
              <div class="label text-xs text-gray-400 mt-1">Estimated Cost</div>
            </div>
          </div>
          <div v-else class="text-sm text-gray-400 text-center py-4">
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
              />
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
    <Card v-if="config.primary_provider !== 'ollama' && config.primary_provider !== 'none'" title="🦙 Ollama Fallback">
      <div class="space-y-4">
        <p class="text-sm text-gray-400">
          Ollama can be used as a fallback for basic tasks or when cloud budget is exhausted.
        </p>

        <Toggle 
          v-model="config.ollama_fallback_enabled" 
          label="Enable Ollama as fallback"
        />

        <div v-if="config.ollama_fallback_enabled" class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h4 class="font-medium text-gray-300">Use Ollama for:</h4>
          
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
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Ollama Model</label>
              <input 
                v-model="config.ollama_model"
                type="text"
                placeholder="llama3.2"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Save Button -->
    <div class="flex justify-end">
      <Button @click="saveConfig" :disabled="saving">
        <span v-if="saving">Saving...</span>
        <span v-else>💾 Save Changes</span>
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Toggle from '@/components/common/Toggle.vue'
import Spinner from '@/components/common/Spinner.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const testingOllama = ref(false)
const loadingModels = ref(false)
const loadingOllamaModels = ref(false)
const showAdvanced = ref(false)
const testResult = ref(null)
const ollamaTestResult = ref(null)
const availableModels = ref([])
const ollamaModels = ref([])
const usageStats = ref(null)

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
  embedding_model: '',
  rag_similarity_threshold: 0.70,
  rag_min_history_count: 50,
  rag_backfill_budget_type: 'percentage',
  rag_backfill_budget_value: 25
})

const isApiProvider = computed(() => {
  return ['openai', 'gemini', 'openrouter', 'litellm', 'custom'].includes(config.value.primary_provider)
})

const budgetPercentUsed = computed(() => {
  if (!config.value.monthly_budget_usd) return 0
  return Math.round((config.value.current_month_usage_usd / config.value.monthly_budget_usd) * 100)
})

// Effective embedding provider (auto = same as primary)
const effectiveEmbeddingProvider = computed(() => {
  if (config.value.embedding_provider === 'auto') {
    return config.value.primary_provider
  }
  return config.value.embedding_provider
})

// RAG statistics
const ragStats = ref(null)

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
  } catch (e) {
    // If parsing fails, just strip protocol and port manually
    let host = hostValue.replace(/^https?:\/\//, '')
    const portMatch = host.match(/:(\d+)/)
    if (portMatch) {
      return { host: host.split(':')[0], port: parseInt(portMatch[1]) }
    }
    return { host: host, port: 11434 }
  }
}

onMounted(async () => {
  try {
    const [configResponse, usageResponse, patternConfigResponse, costSummaryResponse] = await Promise.all([
      api.getAIConfig(),
      api.getAIUsage().catch(() => null),
      api.getPatternConfig().catch(() => null),
      api.getCostSummary().catch(() => null)
    ])
    
    if (configResponse.data) {
      const loadedConfig = { ...config.value, ...configResponse.data }
      
      // Parse ollama_host if it contains a full URL (legacy format)
      if (loadedConfig.ollama_host && (loadedConfig.ollama_host.includes('://') || loadedConfig.ollama_host.includes(':'))) {
        const parsed = parseOllamaHost(loadedConfig.ollama_host)
        loadedConfig.ollama_host = parsed.host
        loadedConfig.ollama_port = parsed.port
      }
      
      config.value = loadedConfig
      
      // Seed Ollama models with current selection so it's visible
      if (loadedConfig.ollama_model) {
        ollamaModels.value = [{ name: loadedConfig.ollama_model }]
      }
      
      // Seed cloud provider model if one is saved (so it's visible in dropdown)
      const cloudProviders = ['openai', 'gemini', 'openrouter', 'litellm', 'custom']
      if (loadedConfig.model && cloudProviders.includes(loadedConfig.primary_provider)) {
        availableModels.value = [{ id: loadedConfig.model, name: loadedConfig.model }]
      }
    }
    if (usageResponse?.data) {
      usageStats.value = usageResponse.data
    }
    if (patternConfigResponse?.data) {
      patternConfig.value = { ...patternConfig.value, ...patternConfigResponse.data }
    }
    if (costSummaryResponse?.data) {
      costSummary.value = costSummaryResponse.data
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
    availableModels.value = response.data.models || []
    if (availableModels.value.length > 0) {
      toast.success(`Found ${availableModels.value.length} models`)
    } else {
      toast.warning('No models found')
    }
  } catch (error) {
    toast.error('Failed to fetch models')
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
    }
  } catch (error) {
    testResult.value = { success: false, error: error.message }
  } finally {
    testing.value = false
  }
}

const testOllamaConnection = async () => {
  testingOllama.value = true
  ollamaTestResult.value = null
  try {
    // Pass the current form values, not saved DB values
    const response = await api.testOllama(config.value.ollama_host, config.value.ollama_port)
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
    const allModels = response.data || []
    
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

const saveConfig = async () => {
  saving.value = true
  try {
    await Promise.all([
      api.updateAIConfig(config.value),
      api.updatePatternConfig(patternConfig.value)
    ])
    toast.success('AI configuration saved!')
  } catch (error) {
    toast.error('Failed to save configuration')
  } finally {
    saving.value = false
  }
}

const formatTokens = (tokens) => {
  if (!tokens) return '0'
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M'
  if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'K'
  return tokens.toString()
}
</script>

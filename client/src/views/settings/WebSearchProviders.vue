<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2 flex items-center gap-2">
        <span>🌐</span>
        <span>Web Search Providers</span>
      </h2>
      <p class="text-gray-400 text-sm">
        Configure web search providers for enrichment and classification evidence. Routing selects the
        first eligible configured provider by priority, subject to cooldown and soft quota limits.
      </p>
    </div>

    <Card
      title="Route Diagnostics"
      description="Shows the deterministic order for the next provider-backed cache miss. It does not expose API keys, search queries, or cached response data."
    >
      <div class="flex justify-end mb-3">
        <Button
          variant="secondary"
          :loading="diagnosticsLoading"
          @click="loadRouteDiagnostics"
        >
          Refresh diagnostics
        </Button>
      </div>

      <div
        v-if="diagnosticsLoading && !routeDiagnostics"
        class="text-center py-4 text-gray-400"
      >
        Loading route diagnostics...
      </div>

      <div
        v-else-if="diagnosticsError"
        role="alert"
        class="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300"
      >
        {{ diagnosticsError }}
      </div>

      <div
        v-else-if="routeDiagnostics"
        class="space-y-3"
      >
        <p
          class="text-sm text-gray-300"
          role="status"
          aria-live="polite"
        >
          <template v-if="routeDiagnostics.selectedProviderKey">
            Next eligible provider: <span class="font-medium text-green-300">{{ selectedProviderName }}</span>
          </template>
          <template v-else>
            <span class="text-yellow-300">No provider is currently eligible for routing.</span>
          </template>
        </p>

        <div
          v-for="candidate in routeDiagnostics.candidates"
          :key="candidate.providerKey"
          class="rounded-lg border border-gray-700 bg-background p-3"
        >
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-gray-100">{{ candidate.displayName }}</span>
              <span class="text-xs text-gray-400">Priority {{ candidate.priority }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-xs"
                :class="candidate.status === 'available' ? 'bg-green-900/30 text-green-300' : 'bg-gray-700 text-gray-300'"
              >
                {{ candidate.status === 'available' ? 'Eligible' : 'Skipped' }}
              </span>
            </div>
            <span
              v-if="candidate.skipReason"
              class="text-sm text-yellow-300"
            >
              {{ routeSkipReasonLabel(candidate.skipReason) }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2 mt-3 text-xs text-gray-400 md:grid-cols-3">
            <span>Today: {{ formatQuota(candidate.quota.dailyCostUnits, candidate.quota.dailyLimit) }}</span>
            <span>This month: {{ formatQuota(candidate.quota.monthlyCostUnits, candidate.quota.monthlyLimit) }}</span>
            <span>Requests: {{ candidate.usage.dailyRequestCount }} today, {{ candidate.usage.monthlyRequestCount }} this month</span>
            <span>Cache hits: {{ candidate.usage.dailyCacheHits }} today, {{ candidate.usage.monthlyCacheHits }} this month</span>
            <span v-if="candidate.cooldownUntil">Cooldown until: {{ formatTimestamp(candidate.cooldownUntil) }}</span>
            <span v-else>Cooldown: none</span>
          </div>
        </div>

        <div
          v-if="recentRouteDecisions.length"
          class="rounded-lg border border-gray-700 bg-background p-3"
        >
          <h4 class="text-sm font-semibold text-gray-100 mb-2">
            Recent route decisions
          </h4>
          <div class="space-y-2">
            <div
              v-for="decision in recentRouteDecisions"
              :key="decision.routeId || decision.id"
              class="flex flex-col gap-1 border-t border-gray-800 pt-2 first:border-t-0 first:pt-0 md:flex-row md:items-center md:justify-between"
            >
              <div class="text-sm text-gray-300">
                <span class="font-medium">{{ routeOutcomeLabel(decision.outcome) }}</span>
                <span class="text-gray-500"> · </span>
                <span>{{ routeProviderLabel(decision) }}</span>
                <span class="text-gray-500"> · </span>
                <span>{{ decision.purpose || 'classification' }}</span>
              </div>
              <div class="text-xs text-gray-500">
                {{ formatTimestamp(decision.completedAt || decision.createdAt) }}
                <span v-if="decision.attemptCount"> · {{ decision.attemptCount }} attempt{{ decision.attemptCount === 1 ? '' : 's' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card
      title="Provider Routing"
      description="Lower priority providers are considered first. Soft limits are advisory and prepare the provider for quota-aware routing."
    >
      <div
        v-if="loading"
        class="text-center py-4 text-gray-400"
      >
        Loading provider configuration...
      </div>

      <div
        v-else
        class="space-y-4"
      >
        <div
          v-for="provider in providerForms"
          :key="provider.providerKey"
          class="rounded-lg border border-gray-700 bg-background p-4 space-y-4"
        >
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-lg font-semibold">
                  {{ provider.displayName }}
                </h3>
                <span
                  class="px-2 py-0.5 rounded-full text-xs"
                  :class="provider.isEnabled ? 'bg-green-900/30 text-green-300' : 'bg-gray-700 text-gray-300'"
                >
                  {{ provider.isEnabled ? 'Enabled' : 'Disabled' }}
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-xs"
                  :class="provider.configured ? 'bg-blue-900/30 text-blue-300' : 'bg-yellow-900/30 text-yellow-300'"
                >
                  {{ provider.configured ? 'Key stored' : 'Missing key' }}
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-xs"
                  :class="provider.adapterAvailable ? 'bg-purple-900/30 text-purple-300' : 'bg-gray-700 text-gray-400'"
                >
                  {{ provider.adapterAvailable ? 'Adapter ready' : 'Adapter pending' }}
                </span>
              </div>
              <p class="text-sm text-gray-400 mt-1">
                {{ provider.description }}
              </p>
              <a
                v-if="provider.docsUrl"
                :href="provider.docsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block text-sm text-blue-400 hover:underline mt-2"
              >
                Provider documentation
              </a>
            </div>

            <Toggle
              v-model="provider.isEnabled"
              label="Enabled"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-300 mb-2">API Key</label>
              <PasswordInput
                v-model="provider.apiKey"
                :placeholder="provider.configured ? 'Stored key configured' : keyPlaceholder(provider.providerKey)"
              />
              <p class="text-xs text-gray-500 mt-1">
                Leave blank to keep the existing stored key.
              </p>
            </div>

            <Input
              v-model.number="provider.priority"
              label="Priority"
              type="number"
              min="1"
              max="1000"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              v-model.number="provider.softDailyLimit"
              label="Soft Daily Limit"
              type="number"
              min="1"
              placeholder="Optional"
            />
            <Input
              v-model.number="provider.softMonthlyLimit"
              label="Soft Monthly Limit"
              type="number"
              min="1"
              placeholder="Optional"
            />
          </div>

          <div
            v-if="provider.providerKey === 'tavily'"
            class="space-y-4 border-t border-gray-800 pt-4"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                v-model="provider.config.searchDepth"
                label="Search Depth"
                :options="[
                  { label: 'Basic', value: 'basic' },
                  { label: 'Advanced', value: 'advanced' }
                ]"
              />

              <Input
                v-model.number="provider.config.maxResults"
                label="Max Results"
                type="number"
                min="1"
                max="20"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Include Domains</label>
              <TagInput
                v-model="provider.config.includeDomains"
                placeholder="example.com"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Exclude Domains</label>
              <TagInput
                v-model="provider.config.excludeDomains"
                placeholder="example.com"
              />
            </div>
          </div>

          <div
            v-else-if="provider.providerKey === 'brave'"
            class="space-y-4 border-t border-gray-800 pt-4"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                v-model="provider.config.country"
                label="Country"
                :max-length="2"
                placeholder="US"
              />
              <Toggle
                v-model="provider.config.safeSearch"
                label="Strict Safe Search"
              />
            </div>
            <p class="text-xs text-gray-500">
              Country uses a two-letter country code. Strict Safe Search is enabled by default.
            </p>
          </div>

          <div
            v-else-if="provider.providerKey === 'serper'"
            class="space-y-4 border-t border-gray-800 pt-4"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                v-model="provider.config.gl"
                label="Country"
                :max-length="2"
                placeholder="us"
              />
              <Input
                v-model="provider.config.hl"
                label="Language"
                :max-length="5"
                placeholder="en"
              />
            </div>
            <p class="text-xs text-gray-500">
              Country and language are optional regional-result preferences. Serper does not expose a
              provider-level Safe Search control through this adapter.
            </p>
          </div>

          <div
            v-else
            class="rounded-lg border border-gray-800 bg-gray-900/30 p-3 text-sm text-gray-400"
          >
            This provider does not expose additional configuration fields.
          </div>

          <div
            v-if="provider.lastErrorMessage"
            class="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300"
          >
            Last error: {{ provider.lastErrorMessage }}
          </div>

          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2 border-t border-gray-800">
            <label class="flex items-center gap-2 text-sm text-gray-300">
              <input
                v-model="provider.clearApiKey"
                type="checkbox"
                class="rounded border-gray-700 bg-background"
              >
              Clear stored API key on save
            </label>

            <div class="flex gap-2 justify-end">
              <Button
                variant="secondary"
                :loading="testingProvider === provider.providerKey"
                :disabled="!canTest(provider)"
                @click="testProvider(provider)"
              >
                Test
              </Button>
              <Button
                :loading="savingProvider === provider.providerKey"
                @click="saveProvider(provider)"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import Input from '@/components/common/Input.vue'
import PasswordInput from '@/components/common/PasswordInput.vue'
import Select from '@/components/common/Select.vue'
import TagInput from '@/components/common/TagInput.vue'
import Toggle from '@/components/common/Toggle.vue'

const toast = useToast()
const loading = ref(true)
const providers = ref([])
const savingProvider = ref(null)
const testingProvider = ref(null)
const diagnosticsLoading = ref(true)
const diagnosticsError = ref('')
const routeDiagnostics = ref(null)

const providerForms = computed(() => providers.value)
const recentRouteDecisions = computed(() => routeDiagnostics.value?.recentDecisions || [])
const selectedProviderName = computed(() => (
  routeDiagnostics.value?.candidates?.find((candidate) => (
    candidate.providerKey === routeDiagnostics.value.selectedProviderKey
  ))?.displayName || routeDiagnostics.value?.selectedProviderKey
))

const ROUTE_SKIP_REASON_LABELS = Object.freeze({
  disabled: 'Disabled in settings',
  unconfigured: 'API key is not configured',
  adapter_unavailable: 'Provider adapter is not available',
  cooldown_active: 'Provider cooldown is active',
  daily_quota_exhausted: 'Soft daily limit reached',
  monthly_quota_exhausted: 'Soft monthly limit reached',
})

const ROUTE_OUTCOME_LABELS = Object.freeze({
  success: 'Success',
  no_provider: 'No provider',
  failed: 'All providers failed',
  error: 'Stopped on error',
})

function keyPlaceholder(providerKey) {
  return providerKey === 'tavily' ? 'tvly-...' : 'API key'
}

function normalizeProvider(provider) {
  const config = provider.config || {}
  return {
    providerKey: provider.providerKey,
    displayName: provider.displayName,
    description: provider.description,
    docsUrl: provider.docsUrl,
    adapterAvailable: Boolean(provider.adapterAvailable),
    configured: Boolean(provider.configured),
    isEnabled: Boolean(provider.isEnabled),
    priority: provider.priority || 100,
    apiKey: '',
    clearApiKey: false,
    softDailyLimit: provider.softDailyLimit || '',
    softMonthlyLimit: provider.softMonthlyLimit || '',
    lastErrorMessage: provider.lastErrorMessage || '',
    config: {
      searchDepth: config.searchDepth || 'advanced',
      maxResults: config.maxResults || 5,
      includeDomains: config.includeDomains || ['imdb.com', 'rottentomatoes.com', 'myanimelist.net', 'letterboxd.com'],
      excludeDomains: config.excludeDomains || [],
      projectId: config.projectId || '',
      country: config.country || '',
      safeSearch: config.safeSearch ?? true,
      gl: config.gl || '',
      hl: config.hl || '',
    },
  }
}

function buildProviderPayload(provider) {
  const payload = {
    providerKey: provider.providerKey,
    isEnabled: provider.isEnabled,
    priority: provider.priority,
    clearApiKey: provider.clearApiKey,
    config: provider.config,
    softDailyLimit: provider.softDailyLimit || null,
    softMonthlyLimit: provider.softMonthlyLimit || null,
  }

  if (provider.apiKey.trim()) {
    payload.apiKey = provider.apiKey.trim()
  }

  return payload
}

async function loadProviders() {
  loading.value = true
  try {
    const response = await api.getWebSearchProviderConfigs()
    providers.value = (response || []).map(normalizeProvider)
  } catch (error) {
    console.error('Failed to load web search providers:', error)
    toast.error('Failed to load web search providers')
  } finally {
    loading.value = false
  }
}

function routeSkipReasonLabel(reason) {
  return ROUTE_SKIP_REASON_LABELS[reason] || 'Unavailable'
}

function routeOutcomeLabel(outcome) {
  return ROUTE_OUTCOME_LABELS[outcome] || 'Unknown'
}

function routeProviderLabel(decision) {
  return decision.finalProviderKey || decision.selectedProviderKey || 'No provider selected'
}

function formatQuota(used, limit) {
  return limit == null ? `${used} used (unlimited)` : `${used} / ${limit}`
}

function formatTimestamp(value) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleString()
}

async function loadRouteDiagnostics() {
  diagnosticsLoading.value = true
  diagnosticsError.value = ''
  try {
    routeDiagnostics.value = await api.getWebSearchProviderRouteDiagnostics()
  } catch (error) {
    console.error('Failed to load web search provider route diagnostics:', error)
    diagnosticsError.value = 'Route diagnostics could not be loaded. Provider configuration remains available.'
  } finally {
    diagnosticsLoading.value = false
  }
}

function canTest(provider) {
  return provider.adapterAvailable && (provider.configured || provider.apiKey.trim()) && !provider.clearApiKey
}

async function testProvider(provider) {
  testingProvider.value = provider.providerKey
  try {
    const response = await api.testWebSearchProvider(provider.providerKey, buildProviderPayload(provider))
    const data = response.data || response
    if (data.success === false) {
      toast.error(data.message || `${provider.displayName} test failed`)
      return
    }
    toast.success(`${provider.displayName} connection verified`)
  } catch (error) {
    const message = error.response?.data?.error || error.response?.data?.message || error.message
    toast.error(`${provider.displayName} test failed: ${message}`)
  } finally {
    testingProvider.value = null
  }
}

async function saveProvider(provider) {
  savingProvider.value = provider.providerKey
  try {
    const response = await api.updateWebSearchProviderConfig(provider.providerKey, buildProviderPayload(provider))
    const updated = response.data || response
    const index = providers.value.findIndex((item) => item.providerKey === provider.providerKey)
    const normalized = normalizeProvider(updated)
    if (index >= 0) {
      providers.value.splice(index, 1, normalized)
    }
    await loadRouteDiagnostics()
    toast.success(`${provider.displayName} settings saved`)
  } catch (error) {
    const message = error.response?.data?.error || error.response?.data?.message || error.message
    toast.error(`Failed to save ${provider.displayName}: ${message}`)
  } finally {
    savingProvider.value = null
  }
}

onMounted(() => {
  loadProviders()
  loadRouteDiagnostics()
})
</script>

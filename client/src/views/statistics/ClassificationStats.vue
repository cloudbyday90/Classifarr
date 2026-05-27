<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Loading (only when no cached data) -->
    <div
      v-if="loading && !stats"
      class="text-center py-8 text-gray-400"
    >
      Loading statistics...
    </div>
    
    <!-- Updating indicator when showing stale data -->
    <div
      v-else-if="isStale"
      class="text-center py-2"
    >
      <span class="text-xs text-gray-400 animate-pulse">⏳ Updating...</span>
    </div>

    <div
      v-else
      class="space-y-6"
    >
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-primary">
            {{ stats.overall?.total || 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            Total
          </div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-green-400">
            {{ stats.overall?.avg_confidence || 0 }}%
          </div>
          <div class="text-xs text-gray-400 mt-1">
            Avg Confidence
          </div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-green-400">
            {{ stats.overall?.high_confidence || 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            High (90%+)
          </div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-red-400">
            {{ stats.overall?.low_confidence || 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            Low (&lt;50%)
          </div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-blue-400">
            {{ stats.overall?.last_24h || 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            Last 24h
          </div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 text-center">
          <div class="text-3xl font-bold text-purple-400">
            {{ stats.overall?.last_7d || 0 }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            Last 7 Days
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Daily Trend -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">
            Daily Classifications (30 days)
          </h3>
          <div class="h-48 flex items-end gap-1">
            <div
              v-for="(day, index) in stats.daily"
              :key="index"
              class="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-400"
              :style="{ height: getDayHeight(day.count) }"
              :title="`${day.date}: ${day.count} classifications, ${day.avg_confidence}% avg`"
            />
          </div>
          <div class="flex justify-between text-xs text-gray-500 mt-2">
            <span>{{ formatDate(stats.daily?.[0]?.date) }}</span>
            <span>{{ formatDate(stats.daily?.[stats.daily?.length - 1]?.date) }}</span>
          </div>
        </div>

        <!-- By Method -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">
            Classification Methods
          </h3>
          <div class="space-y-3">
            <div
              v-for="method in stats.byMethod"
              :key="method.method"
              class="space-y-1"
            >
              <div class="flex justify-between text-sm">
                <span>{{ getMethodDisplayName(method.method) }}</span>
                <span>{{ method.count }} ({{ method.avg_confidence }}%)</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="getMethodColor(method.method)"
                  :style="{ width: getMethodWidth(method.count) }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Secondary Stats -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- By Library -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">
            By Library
          </h3>
          <div class="space-y-3">
            <div
              v-for="lib in stats.byLibrary"
              :key="lib.id"
              class="flex items-center justify-between text-sm"
            >
              <span>{{ lib.name }}</span>
              <div class="text-right">
                <span class="font-medium">{{ lib.count }}</span>
                <span class="text-gray-500 ml-1">({{ lib.avg_confidence || 0 }}%)</span>
              </div>
            </div>
            <div
              v-if="stats.byLibrary?.length === 0"
              class="text-gray-500 text-center py-4"
            >
              No library data yet
            </div>
          </div>
        </div>

        <!-- Confidence Distribution -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">
            Confidence Distribution
          </h3>
          <div class="space-y-4">
            <div
              v-for="level in stats.confidenceDistribution"
              :key="level.level"
              class="space-y-1"
            >
              <div class="flex justify-between text-sm">
                <span class="flex items-center gap-2">
                  <span
                    :class="getConfidenceColor(level.level)"
                    class="w-3 h-3 rounded-full"
                  />
                  <span class="capitalize">{{ level.level }} ({{ getLevelRange(level.level) }})</span>
                </span>
                <span>{{ level.count }}</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="getConfidenceColor(level.level)"
                  :style="{ width: getConfidenceWidth(level.count) }"
                />
              </div>
            </div>
            <div
              v-if="!stats.confidenceDistribution?.length"
              class="text-gray-500 text-center py-4"
            >
              No classification data yet
            </div>
          </div>
        </div>

        <!-- Queue Health -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 class="text-lg font-medium mb-4">
            Queue Health
          </h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-yellow-400">⏳ Pending</span>
              <span class="font-medium">{{ stats.queueHealth?.pending || 0 }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-blue-400">⚙️ Processing</span>
              <span class="font-medium">{{ stats.queueHealth?.processing || 0 }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-green-400">✓ Completed (24h)</span>
              <span class="font-medium">{{ stats.queueHealth?.completed_today || 0 }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-red-400">✗ Failed</span>
              <span class="font-medium">{{ stats.queueHealth?.failed || 0 }}</span>
            </div>
            <div class="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
              <span class="text-gray-400">Success Rate</span>
              <span 
                class="font-bold"
                :class="stats.queueHealth?.success_rate >= 95 ? 'text-green-400' : stats.queueHealth?.success_rate >= 80 ? 'text-yellow-400' : 'text-red-400'"
              >
                {{ stats.queueHealth?.success_rate || 100 }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Second Pass Evaluation -->
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-5">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 class="text-lg font-medium">
              Second-Pass Evaluation
            </h3>
            <p class="text-sm text-gray-400 mt-1">
              Compare baseline classifications against pass2 cohorts using later human and retry outcomes.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs uppercase tracking-wide text-gray-500">Window</span>
            <div class="inline-flex rounded-lg border border-gray-700 bg-gray-900/60 p-1">
              <button
                v-for="option in secondPassDayOptions"
                :key="option"
                class="px-3 py-1.5 text-xs rounded-md transition-colors"
                :class="secondPassDays === option ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'"
                @click="secondPassDays = option"
              >
                {{ option }}d
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="secondPassLoading && !hasSecondPassData"
          class="text-sm text-gray-400"
        >
          Loading second-pass evaluation…
        </div>

        <div
          v-else-if="secondPassError"
          class="rounded-lg border border-red-800/60 bg-red-950/20 px-4 py-3 text-sm text-red-300"
        >
          {{ secondPassError }}
        </div>

        <template v-else>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
              <div class="text-xs uppercase tracking-wide text-gray-500">
                Evaluated Rows
              </div>
              <div class="mt-2 text-2xl font-bold text-white">
                {{ secondPassTotals.total }}
              </div>
              <div class="mt-1 text-xs text-gray-400">
                {{ secondPassTotals.linkedOutcomes }} linked human/retry outcomes
                · {{ formatPercent(secondPassTotals.perTotal?.linkedOutcomeRate || secondPassTotals.linkedOutcomeRate) }} matured
              </div>
              <div class="mt-1 text-xs text-gray-500">
                {{ secondPassTotals.multiStepOutcomes || 0 }} multi-step outcome paths
              </div>
            </div>
            <div class="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
              <div class="text-xs uppercase tracking-wide text-gray-500">
                Pass2 Adopted
              </div>
              <div class="mt-2 text-2xl font-bold text-blue-400">
                {{ pass2AdoptedTotal }}
              </div>
              <div class="mt-1 text-xs text-gray-400">
                {{ formatPercent(pass2AdoptedShare) }} of evaluated rows
              </div>
            </div>
            <div class="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
              <div class="text-xs uppercase tracking-wide text-gray-500">
                Correction Delta
              </div>
              <div
                class="mt-2 text-2xl font-bold"
                :class="correctionDelta <= 0 ? 'text-green-400' : 'text-red-400'"
              >
                {{ formatSignedPercent(correctionDelta) }}
              </div>
              <div class="mt-1 text-xs text-gray-400">
                per linked outcome vs baseline
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div
              v-for="cohort in secondPassCohorts"
              :key="cohort.cohort"
              class="rounded-lg border border-gray-700 bg-gray-900/50 p-5 space-y-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="text-sm font-semibold text-white">
                    {{ cohort.label }}
                  </div>
                  <p class="mt-1 text-xs text-gray-400">
                    {{ cohort.description }}
                  </p>
                </div>
                <span
                  class="rounded-full px-2.5 py-1 text-xs font-medium"
                  :class="cohort.badgeClass"
                >
                  {{ cohort.total }}
                </span>
              </div>

              <div class="rounded-md border border-gray-800 bg-gray-950/40 px-3 py-2 text-xs text-gray-400">
                Linked outcomes:
                <span class="font-medium text-gray-200">{{ cohort.linkedOutcomes }}</span>
                · maturity
                <span class="font-medium text-gray-200">{{ formatPercent(cohort.perTotal?.linkedOutcomeRate || cohort.linkedOutcomeRate) }}</span>
                <template v-if="cohort.multiStepOutcomes">
                  · multi-step
                  <span class="font-medium text-gray-200">{{ cohort.multiStepOutcomes }}</span>
                </template>
              </div>

              <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="rounded-md bg-gray-950/50 px-3 py-2">
                  <div class="text-xs text-gray-500">
                    Corrected
                  </div>
                  <div class="mt-1 font-semibold text-red-300">
                    {{ cohort.corrected }} · {{ formatPercent(cohort.perLinkedOutcome?.correctedRate || cohort.correctedRate) }}
                  </div>
                </div>
                <div class="rounded-md bg-gray-950/50 px-3 py-2">
                  <div class="text-xs text-gray-500">
                    Verified
                  </div>
                  <div class="mt-1 font-semibold text-green-300">
                    {{ cohort.verified }} · {{ formatPercent(cohort.perLinkedOutcome?.verifiedRate || cohort.verifiedRate) }}
                  </div>
                </div>
                <div class="rounded-md bg-gray-950/50 px-3 py-2">
                  <div class="text-xs text-gray-500">
                    Resolved
                  </div>
                  <div class="mt-1 font-semibold text-blue-300">
                    {{ cohort.resolved }} · {{ formatPercent(cohort.perLinkedOutcome?.resolvedRate || cohort.resolvedRate) }}
                  </div>
                </div>
                <div class="rounded-md bg-gray-950/50 px-3 py-2">
                  <div class="text-xs text-gray-500">
                    Retried
                  </div>
                  <div class="mt-1 font-semibold text-yellow-300">
                    {{ cohort.retried }} · {{ formatPercent(cohort.perLinkedOutcome?.retriedRate || cohort.retriedRate) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p class="text-xs text-gray-500">
            Compare corrected and retried rates on rows with linked outcomes, not just all rows in the cohort. The maturity line shows how much of each cohort has actually produced follow-up truth.
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useSWR } from '@/composables/useSWR'
import { CACHE_KEYS, CACHE_TTL } from '@/constants/cacheKeys'
import api from '@/api'

// SWR: Classification stats with 60s cache
const {
  data: statsData,
  isLoading,
  isStale
} = useSWR(
  CACHE_KEYS.STATS_CLASSIFICATION,
  async () => await api.getDetailedStats(),
  { ttl: CACHE_TTL.MEDIUM, initialData: {} }
)

// Computed for template compatibility
const loading = computed(() => isLoading.value && !statsData.value)
const stats = computed(() => statsData.value || {})

const maxDaily = computed(() => {
  if (!stats.value.daily?.length) return 1
  return Math.max(...stats.value.daily.map(d => d.count), 1)
})

const totalMethods = computed(() => {
  if (!stats.value.byMethod?.length) return 1
  return stats.value.byMethod.reduce((sum, m) => sum + parseInt(m.count), 0) || 1
})

const getDayHeight = (count) => {
  return `${Math.max(5, (count / maxDaily.value) * 100)}%`
}

const getMethodWidth = (count) => {
  return `${(count / totalMethods.value) * 100}%`
}

const getMethodDisplayName = (method) => {
  const names = {
    'exact_match': 'Exact Match',
    'learned_pattern': 'Learned Pattern',
    'policy_auto': 'Policy Engine',
    'policy_engine': 'Policy Engine',
    'policy_prompt': 'Policy Engine',
    'policy_confirm': 'Policy Confirmed',
    'policy_supported_by_related_evidence': 'Related Evidence',
    'custom_rule': 'Custom Rule',
    'ai_analysis': 'AI Analysis',
    'ai_fallback': 'AI Analysis',
    'ai_verified': 'AI Verified',
    'source_library': 'Source Library',
    'manual_correction': 'Manual Correction',
    'manual_classification': 'Manual',
    'existing_media': 'Existing Media',
    'reclassification': 'Reclassified',
    'rule_match': 'Rule Match',
    'library_rule': 'Library Rule',
    'learned_correction': 'Corrected',
  }
  return names[method] || method?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'
}

const getMethodColor = (method) => {
  const colors = {
    // New standardized names
    'exact_match': 'bg-green-500',
    'learned_pattern': 'bg-blue-500',
    'policy_auto': 'bg-indigo-500',
    'policy_confirm': 'bg-blue-400',
    'policy_supported_by_related_evidence': 'bg-sky-500',
    'custom_rule': 'bg-purple-500',
    'ai_analysis': 'bg-yellow-500',
    'source_library': 'bg-cyan-500',
    'manual_correction': 'bg-pink-500',
    'existing_media': 'bg-teal-500',
    'reclassification': 'bg-orange-500',
    // Legacy names (backwards compatibility)
    'rule_match': 'bg-purple-500',
    'library_rule': 'bg-purple-500',
    'ai_fallback': 'bg-yellow-500',
    'learned_correction': 'bg-pink-500',
    'unknown': 'bg-gray-500'
  }
  return colors[method] || colors.unknown
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const totalConfidence = computed(() => {
  if (!stats.value.confidenceDistribution?.length) return 1
  return stats.value.confidenceDistribution.reduce((sum, l) => sum + parseInt(l.count), 0) || 1
})

const getConfidenceColor = (level) => {
  const colors = {
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-red-500'
  }
  return colors[level] || 'bg-gray-500'
}

const getLevelRange = (level) => {
  const ranges = {
    high: '90%+',
    medium: '50-89%',
    low: '<50%'
  }
  return ranges[level] || ''
}

const getConfidenceWidth = (count) => {
  return `${(count / totalConfidence.value) * 100}%`
}

const secondPassDayOptions = [7, 30, 90]
const secondPassDays = ref(30)
const secondPassLoading = ref(false)
const secondPassError = ref('')
const secondPassEvaluation = ref(null)

function createDefaultSecondPassReport(windowDays = 30) {
  return {
    windowDays,
    totals: {
      total: 0,
      linkedOutcomes: 0,
      verified: 0,
      corrected: 0,
      resolved: 0,
      retried: 0,
      perTotal: {
        linkedOutcomeRate: 0,
        correctedRate: 0,
        verifiedRate: 0,
        resolvedRate: 0,
        retriedRate: 0
      },
      perLinkedOutcome: {
        correctedRate: 0,
        verifiedRate: 0,
        resolvedRate: 0,
        retriedRate: 0
      },
      linkedOutcomeRate: 0,
      correctedRate: 0,
      verifiedRate: 0,
      resolvedRate: 0,
      retriedRate: 0
    },
    cohorts: [
      {
        cohort: 'baseline',
        total: 0,
        linkedOutcomes: 0,
        verified: 0,
        corrected: 0,
        resolved: 0,
        retried: 0,
        perTotal: {
          linkedOutcomeRate: 0,
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        perLinkedOutcome: {
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        linkedOutcomeRate: 0,
        correctedRate: 0,
        verifiedRate: 0,
        resolvedRate: 0,
        retriedRate: 0
      },
      {
        cohort: 'pass2_not_adopted',
        total: 0,
        linkedOutcomes: 0,
        verified: 0,
        corrected: 0,
        resolved: 0,
        retried: 0,
        perTotal: {
          linkedOutcomeRate: 0,
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        perLinkedOutcome: {
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        linkedOutcomeRate: 0,
        correctedRate: 0,
        verifiedRate: 0,
        resolvedRate: 0,
        retriedRate: 0
      },
      {
        cohort: 'pass2_adopted',
        total: 0,
        linkedOutcomes: 0,
        verified: 0,
        corrected: 0,
        resolved: 0,
        retried: 0,
        perTotal: {
          linkedOutcomeRate: 0,
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        perLinkedOutcome: {
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        linkedOutcomeRate: 0,
        correctedRate: 0,
        verifiedRate: 0,
        resolvedRate: 0,
        retriedRate: 0
      }
    ]
  }
}

async function fetchSecondPassEvaluation() {
  secondPassLoading.value = true
  secondPassError.value = ''

  try {
    const response = await api.getSecondPassEvaluation(secondPassDays.value)
    secondPassEvaluation.value = response || createDefaultSecondPassReport(secondPassDays.value)
  } catch (err) {
    console.error('Failed to load second-pass evaluation:', err)
    secondPassError.value = 'Failed to load second-pass evaluation'
    secondPassEvaluation.value = createDefaultSecondPassReport(secondPassDays.value)
  } finally {
    secondPassLoading.value = false
  }
}

onMounted(fetchSecondPassEvaluation)
watch(secondPassDays, fetchSecondPassEvaluation)

const secondPassReport = computed(() => secondPassEvaluation.value || createDefaultSecondPassReport(secondPassDays.value))
const secondPassTotals = computed(() => secondPassReport.value.totals || createDefaultSecondPassReport(secondPassDays.value).totals)
const hasSecondPassData = computed(() => secondPassTotals.value.total > 0)

const secondPassCohorts = computed(() => {
  const labels = {
    baseline: {
      label: 'Baseline',
      description: 'No second pass ran for this row.',
      badgeClass: 'bg-gray-800 text-gray-200'
    },
    pass2_not_adopted: {
      label: 'Pass2 Ran, Baseline Kept',
      description: 'The second pass ran but did not replace the original result.',
      badgeClass: 'bg-yellow-900/40 text-yellow-300'
    },
    pass2_adopted: {
      label: 'Pass2 Adopted',
      description: 'The second pass materially changed the final classification.',
      badgeClass: 'bg-blue-900/40 text-blue-300'
    }
  }

  return (secondPassReport.value.cohorts || []).map((cohort) => ({
    ...cohort,
    ...labels[cohort.cohort]
  }))
})

const baselineCohort = computed(() => secondPassCohorts.value.find((cohort) => cohort.cohort === 'baseline') || createDefaultSecondPassReport().cohorts[0])
const pass2AdoptedCohort = computed(() => secondPassCohorts.value.find((cohort) => cohort.cohort === 'pass2_adopted') || createDefaultSecondPassReport().cohorts[2])
const pass2AdoptedTotal = computed(() => pass2AdoptedCohort.value.total || 0)
const pass2AdoptedShare = computed(() => {
  if (!secondPassTotals.value.total) return 0
  return pass2AdoptedTotal.value / secondPassTotals.value.total
})
const correctionDelta = computed(() => {
  return (pass2AdoptedCohort.value.perLinkedOutcome?.correctedRate || pass2AdoptedCohort.value.correctedRate || 0) - (baselineCohort.value.perLinkedOutcome?.correctedRate || baselineCohort.value.correctedRate || 0)
})

function formatPercent(value) {
  const numeric = Number(value || 0) * 100
  return `${numeric.toFixed(1)}%`
}

function formatSignedPercent(value) {
  const numeric = Number(value || 0) * 100
  const sign = numeric > 0 ? '+' : ''
  return `${sign}${numeric.toFixed(1)}%`
}
</script>

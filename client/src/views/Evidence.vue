<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.

  Evidence.vue — Phase 6 Layer 4 (Operator/Admin)
  Admin screen for the classification_evidence table.

  Layout:
    1. Summary row (total, by-scope, by-provenance, by-status)
    2. Filter bar (scope / provenance / status / mediaType) + Apply / Reset
    3. Evidence table with inline decay/promote per row
    4. Pagination
    5. Purge panel (requires active filters, confirmation required)
    6. Detail drawer — shows raw row + diagnosis report on row click
-->

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Classification Evidence
      </h1>
      <Button
        variant="ghost"
        size="sm"
        :loading="summaryLoading"
        @click="handleRefresh"
      >
        🔄 Refresh
      </Button>
    </div>

    <!-- Feedback banner -->
    <div
      v-if="actionSuccess"
      class="rounded-lg border border-green-700 bg-green-900/20 px-4 py-3 text-sm text-green-300 flex items-center justify-between"
    >
      <span>✅ {{ actionSuccess }}</span>
      <button
        class="text-green-400 hover:text-green-200 ml-4 text-lg leading-none"
        @click="clearFeedback"
      >
        &times;
      </button>
    </div>
    <div
      v-if="actionError"
      class="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3 text-sm text-red-300 flex items-center justify-between"
    >
      <span>❌ {{ actionError }}</span>
      <button
        class="text-red-400 hover:text-red-200 ml-4 text-lg leading-none"
        @click="clearFeedback"
      >
        &times;
      </button>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card class="text-center">
        <div class="text-3xl font-bold text-primary">
          {{ summary.total ?? '—' }}
        </div>
        <div class="mt-1 text-xs text-gray-400">
          Total Evidence
        </div>
      </Card>
      <Card class="text-center">
        <div class="text-3xl font-bold text-green-400">
          {{ summary.byStatus?.active ?? '—' }}
        </div>
        <div class="mt-1 text-xs text-gray-400">
          Active
        </div>
      </Card>
      <Card class="text-center">
        <div class="text-3xl font-bold text-yellow-400">
          {{ summary.byStatus?.candidate ?? '—' }}
        </div>
        <div class="mt-1 text-xs text-gray-400">
          Candidate
        </div>
      </Card>
      <Card class="text-center">
        <div class="text-3xl font-bold text-blue-400">
          {{ summary.byProvenance?.human_confirmed ?? '—' }}
        </div>
        <div class="mt-1 text-xs text-gray-400">
          Human Confirmed
        </div>
      </Card>
    </div>

    <!-- Scope breakdown -->
    <Card
      v-if="hasScopeData"
      title="By Scope"
    >
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(count, scope) in summary.byScope"
          :key="`scope-${scope}`"
          class="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300"
        >
          <span class="font-medium text-white">{{ count }}</span>
          {{ scope }}
        </span>
      </div>
    </Card>

    <!-- Filter bar -->
    <Card>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <select
          v-model="filters.scope"
          class="rounded-lg border border-gray-700 bg-background px-3 py-2 text-sm text-white"
        >
          <option value="">
            All scopes
          </option>
          <option
            v-for="s in VALID_SCOPES"
            :key="`scope-opt-${s}`"
            :value="s"
          >
            {{ s }}
          </option>
        </select>

        <select
          v-model="filters.provenance"
          class="rounded-lg border border-gray-700 bg-background px-3 py-2 text-sm text-white"
        >
          <option value="">
            All provenances
          </option>
          <option
            v-for="p in VALID_PROVENANCES"
            :key="`prov-opt-${p}`"
            :value="p"
          >
            {{ p }}
          </option>
        </select>

        <select
          v-model="filters.status"
          class="rounded-lg border border-gray-700 bg-background px-3 py-2 text-sm text-white"
        >
          <option value="">
            All statuses
          </option>
          <option
            v-for="st in VALID_STATUSES"
            :key="`status-opt-${st}`"
            :value="st"
          >
            {{ st }}
          </option>
        </select>

        <select
          v-model="filters.mediaType"
          class="rounded-lg border border-gray-700 bg-background px-3 py-2 text-sm text-white"
        >
          <option value="">
            All types
          </option>
          <option value="movie">
            Movie
          </option>
          <option value="tv">
            TV
          </option>
        </select>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg border border-blue-700/40 bg-blue-900/20 px-3 py-2 text-sm text-blue-200 hover:bg-blue-900/30"
            @click="applyFilters"
          >
            Apply
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            @click="handleReset"
          >
            Reset
          </button>
        </div>
      </div>
    </Card>

    <!-- Evidence table -->
    <Card>
      <div
        v-if="listLoading"
        class="py-12 text-center text-gray-400"
      >
        Loading evidence…
      </div>
      <div
        v-else-if="listError"
        class="py-12 text-center text-red-400"
      >
        {{ listError }}
      </div>
      <div
        v-else-if="rows.length === 0"
        class="py-12 text-center text-gray-400"
      >
        No evidence rows match the current filters.
      </div>
      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full">
          <thead class="border-b border-gray-800">
            <tr class="text-left text-xs text-gray-400">
              <th class="pb-3 pr-4">
                ID
              </th>
              <th class="pb-3 pr-4">
                Scope
              </th>
              <th class="pb-3 pr-4">
                Provenance
              </th>
              <th class="pb-3 pr-4">
                Status
              </th>
              <th class="pb-3 pr-4">
                Confidence
              </th>
              <th class="pb-3 pr-4">
                Uses
              </th>
              <th class="pb-3 pr-4">
                Type
              </th>
              <th class="pb-3 pr-4">
                Key
              </th>
              <th class="pb-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="`ev-${row.id}`"
              class="cursor-pointer border-b border-gray-800 transition-colors hover:bg-background"
              @click="openDetail(row)"
            >
              <td class="py-3 pr-4 text-sm text-gray-400">
                #{{ row.id }}
              </td>
              <td class="py-3 pr-4">
                <Badge :variant="scopeVariant(row.scope)">
                  {{ row.scope }}
                </Badge>
              </td>
              <td class="py-3 pr-4">
                <Badge :variant="provenanceVariant(row.provenance)">
                  {{ row.provenance }}
                </Badge>
              </td>
              <td class="py-3 pr-4">
                <Badge :variant="row.status === 'active' ? 'success' : 'warning'">
                  {{ row.status }}
                </Badge>
              </td>
              <td class="py-3 pr-4 text-sm">
                {{ row.confidence ?? '—' }}%
              </td>
              <td class="py-3 pr-4 text-sm text-gray-300">
                {{ row.usage_count ?? 0 }}
              </td>
              <td class="py-3 pr-4 text-sm text-gray-400">
                {{ row.media_type || '—' }}
              </td>
              <td
                class="py-3 pr-4 max-w-xs truncate text-xs text-gray-400"
                :title="row.evidence_key"
              >
                {{ row.evidence_key || (row.tmdb_id ? `tmdb:${row.tmdb_id}` : '—') }}
              </td>
              <td
                class="py-3"
                @click.stop
              >
                <div class="flex gap-2">
                  <button
                    v-if="row.status === 'active'"
                    :disabled="actionLoading"
                    class="rounded border border-yellow-700/50 bg-yellow-900/20 px-2 py-1 text-xs text-yellow-300 hover:bg-yellow-900/40 disabled:opacity-40"
                    title="Decay to candidate"
                    @click="handleDecay(row)"
                  >
                    ↓ Decay
                  </button>
                  <button
                    v-if="row.status === 'candidate'"
                    :disabled="actionLoading"
                    class="rounded border border-green-700/50 bg-green-900/20 px-2 py-1 text-xs text-green-300 hover:bg-green-900/40 disabled:opacity-40"
                    title="Promote to active"
                    @click="handlePromote(row)"
                  >
                    ↑ Promote
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="mt-6 flex items-center justify-between">
          <div class="text-sm text-gray-400">
            Showing {{ rows.length }} of {{ total }} rows
            <span v-if="pageCount > 1">(page {{ page + 1 }} / {{ pageCount }})</span>
          </div>
          <div class="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              :disabled="page <= 0"
              @click="handlePage(page - 1)"
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              :disabled="page >= pageCount - 1"
              @click="handlePage(page + 1)"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Purge panel -->
    <Card
      title="Bulk Purge"
      description="Permanently delete evidence rows matching the active filters. At least one filter must be selected."
    >
      <div
        v-if="!hasActiveFilters"
        class="text-sm text-gray-500"
      >
        Set one or more filters above to enable bulk purge.
      </div>
      <div
        v-else
        class="flex items-center gap-4"
      >
        <div class="grow text-sm text-gray-300">
          This will delete all evidence rows matching:
          <span
            v-for="(val, key) in activeFilters"
            :key="`purge-filter-${key}`"
            class="ml-1 inline-flex items-center rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-200"
          >
            {{ key }}=<span class="ml-1 font-semibold text-white">{{ val }}</span>
          </span>
        </div>
        <Button
          variant="error"
          size="sm"
          :loading="actionLoading"
          @click="showPurgeConfirm = true"
        >
          🗑 Purge
        </Button>
      </div>
    </Card>

    <!-- Purge confirmation modal -->
    <div
      v-if="showPurgeConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      @click.self="showPurgeConfirm = false"
    >
      <div class="relative w-full max-w-md rounded-lg border border-gray-800 bg-background-light">
        <div class="flex items-center justify-between border-b border-gray-800 p-6">
          <h3 class="text-xl font-semibold text-red-400">
            Confirm Purge
          </h3>
          <button
            class="text-2xl leading-none text-gray-400 hover:text-white"
            @click="showPurgeConfirm = false"
          >
            &times;
          </button>
        </div>
        <div class="p-6 space-y-3">
          <p class="text-sm text-gray-300">
            This will <span class="font-bold text-red-400">permanently delete</span> all evidence rows matching the current filters. This cannot be undone.
          </p>
          <div class="rounded-lg bg-gray-900 p-3 text-xs text-gray-400 space-y-1">
            <div
              v-for="(val, key) in activeFilters"
              :key="`confirm-filter-${key}`"
            >
              <span class="text-gray-500">{{ key }}:</span>
              <span class="ml-1 font-semibold text-white">{{ val }}</span>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 border-t border-gray-800 p-6">
          <Button
            variant="secondary"
            @click="showPurgeConfirm = false"
          >
            Cancel
          </Button>
          <Button
            variant="error"
            :loading="actionLoading"
            @click="handlePurge"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>

    <!-- Detail / Diagnose drawer -->
    <div
      v-if="detailRow"
      class="fixed inset-0 z-50 flex justify-end bg-black/60"
      @click.self="detailRow = null"
    >
      <div class="h-full w-full max-w-xl overflow-y-auto border-l border-gray-800 bg-background-light shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-800 p-6">
          <h2 class="text-lg font-bold">
            Evidence #{{ detailRow.id }}
          </h2>
          <button
            class="text-2xl leading-none text-gray-400 hover:text-white"
            @click="detailRow = null"
          >
            &times;
          </button>
        </div>

        <div class="p-6 space-y-5">
          <!-- Row fields -->
          <section>
            <h3 class="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Evidence Row
            </h3>
            <dl class="grid grid-cols-2 gap-2 text-sm">
              <dt class="text-gray-500">
                Scope
              </dt>
              <dd>
                <Badge :variant="scopeVariant(detailRow.scope)">
                  {{ detailRow.scope }}
                </Badge>
              </dd>

              <dt class="text-gray-500">
                Provenance
              </dt>
              <dd>
                <Badge :variant="provenanceVariant(detailRow.provenance)">
                  {{ detailRow.provenance }}
                </Badge>
              </dd>

              <dt class="text-gray-500">
                Status
              </dt>
              <dd>
                <Badge :variant="detailRow.status === 'active' ? 'success' : 'warning'">
                  {{ detailRow.status }}
                </Badge>
              </dd>

              <dt class="text-gray-500">
                Confidence
              </dt>
              <dd class="text-white">
                {{ detailRow.confidence ?? '—' }}%
              </dd>

              <dt class="text-gray-500">
                Usage Count
              </dt>
              <dd class="text-white">
                {{ detailRow.usage_count ?? 0 }}
              </dd>

              <dt class="text-gray-500">
                Success Rate
              </dt>
              <dd class="text-white">
                {{ detailRow.success_rate != null ? `${(detailRow.success_rate * 100).toFixed(1)}%` : '—' }}
              </dd>

              <dt class="text-gray-500">
                Media Type
              </dt>
              <dd class="text-white">
                {{ detailRow.media_type || '—' }}
              </dd>

              <dt class="text-gray-500">
                Library ID
              </dt>
              <dd class="text-white">
                {{ detailRow.library_id ?? '—' }}
              </dd>

              <dt class="text-gray-500">
                TMDB ID
              </dt>
              <dd class="text-white">
                {{ detailRow.tmdb_id ?? '—' }}
              </dd>

              <dt class="text-gray-500">
                Evidence Key
              </dt>
              <dd class="text-white break-all">
                {{ detailRow.evidence_key || '—' }}
              </dd>

              <dt class="text-gray-500">
                Source System
              </dt>
              <dd class="text-white">
                {{ detailRow.source_system || '—' }}
              </dd>

              <dt class="text-gray-500">
                Created By
              </dt>
              <dd class="text-white">
                {{ detailRow.created_by || '—' }}
              </dd>
            </dl>
          </section>

          <!-- Row actions -->
          <section class="flex gap-3">
            <Button
              v-if="detailRow.status === 'active'"
              variant="warning"
              size="sm"
              :loading="actionLoading"
              @click="handleDecayFromDetail"
            >
              ↓ Decay to candidate
            </Button>
            <Button
              v-if="detailRow.status === 'candidate'"
              variant="success"
              size="sm"
              :loading="actionLoading"
              @click="handlePromoteFromDetail"
            >
              ↑ Promote to active
            </Button>
            <Button
              variant="ghost"
              size="sm"
              :loading="diagnosisLoading"
              @click="loadDiagnosisForDetail"
            >
              🔬 Diagnose
            </Button>
          </section>

          <!-- Diagnosis report -->
          <section v-if="detailDiagnosis">
            <h3 class="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Diagnosis
            </h3>

            <!-- Agreement -->
            <div
              class="mb-3 rounded-lg border px-4 py-3 text-sm"
              :class="detailDiagnosis.agreement?.consistent === true
                ? 'border-green-700/50 bg-green-900/10 text-green-300'
                : detailDiagnosis.agreement?.consistent === false
                  ? 'border-yellow-700/50 bg-yellow-900/10 text-yellow-300'
                  : 'border-gray-700 bg-gray-900 text-gray-400'"
            >
              {{ detailDiagnosis.agreement?.message }}
            </div>

            <!-- History -->
            <div class="mb-3">
              <p class="mb-1 text-xs text-gray-500">
                Recent classification history ({{ detailDiagnosis.history?.recentCount ?? 0 }} rows)
              </p>
              <div
                v-if="detailDiagnosis.history?.rows?.length > 0"
                class="space-y-1"
              >
                <div
                  v-for="(h, i) in detailDiagnosis.history.rows.slice(0, 5)"
                  :key="`hist-${i}`"
                  class="flex items-center gap-2 rounded bg-gray-900 px-2 py-1 text-xs text-gray-300"
                >
                  <Badge variant="default">
                    {{ h.method }}
                  </Badge>
                  <span class="text-gray-400">{{ h.confidence }}%</span>
                  <span class="ml-auto text-gray-600">{{ formatDate(h.classified_at) }}</span>
                </div>
              </div>
              <p
                v-else
                class="text-xs text-gray-600"
              >
                No history found.
              </p>
            </div>

            <!-- Related evidence -->
            <div>
              <p class="mb-1 text-xs text-gray-500">
                Related evidence in library ({{ detailDiagnosis.related?.count ?? 0 }} rows)
              </p>
              <div
                v-if="Object.keys(detailDiagnosis.related?.scopes ?? {}).length > 0"
                class="flex flex-wrap gap-2"
              >
                <span
                  v-for="(count, scope) in detailDiagnosis.related.scopes"
                  :key="`related-scope-${scope}`"
                  class="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-300"
                >
                  {{ count }} {{ scope }}
                </span>
              </div>
              <p
                v-else
                class="text-xs text-gray-600"
              >
                No related evidence found.
              </p>
            </div>

            <!-- Compat payload -->
            <div
              v-if="detailDiagnosis.compat"
              class="mt-3"
            >
              <p class="mb-1 text-xs text-gray-500">
                Compatibility method
              </p>
              <Badge variant="info">
                {{ detailDiagnosis.compat.method }}
              </Badge>
              <span
                v-if="detailDiagnosis.compat.methodLabel"
                class="ml-2 text-xs text-gray-400"
              >{{ detailDiagnosis.compat.methodLabel }}</span>
            </div>
          </section>

          <div
            v-if="diagnosisError"
            class="text-sm text-red-400"
          >
            {{ diagnosisError }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Card   from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge  from '@/components/common/Badge.vue'

import { useEvidenceFilters, VALID_SCOPES, VALID_PROVENANCES, VALID_STATUSES } from '@/composables/useEvidenceFilters'
import { useEvidenceData }    from '@/composables/useEvidenceData'
import { useEvidenceActions } from '@/composables/useEvidenceActions'

// ── Composables ───────────────────────────────────────────────────────────────

const { filters, activeFilters, hasActiveFilters, resetFilters } = useEvidenceFilters()

const {
  summary, summaryLoading, refreshSummary,
  rows, total, page, pageCount, listLoading, listError,
  loadList, goToPage, resetPage,
  loadDiagnosis, diagnosisLoading, diagnosisError, evictDiagnosis
} = useEvidenceData()

const {
  actionLoading, actionError, actionSuccess, clearFeedback,
  decay, promote, purge
} = useEvidenceActions()

// ── Local state ───────────────────────────────────────────────────────────────

const showPurgeConfirm = ref(false)
const detailRow        = ref(null)
const detailDiagnosis  = ref(null)

// ── Computed ──────────────────────────────────────────────────────────────────

const hasScopeData = computed(() =>
  summary.value.byScope && Object.keys(summary.value.byScope).length > 0
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function scopeVariant(scope) {
  const map = {
    item_exact:    'success',
    genre:         'info',
    studio:        'default',
    franchise:     'default',
    certification: 'warning'
  }
  return map[scope] ?? 'default'
}

function provenanceVariant(prov) {
  const map = {
    human_confirmed:  'success',
    policy_confirmed: 'info',
    mined:            'warning'
  }
  return map[prov] ?? 'default'
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

function applyFilters() {
  resetPage()
  loadList(activeFilters.value)
}

function handleReset() {
  resetFilters()
  resetPage()
  loadList({})
}

function handleRefresh() {
  refreshSummary()
  loadList(activeFilters.value)
}

function handlePage(n) {
  goToPage(n, activeFilters.value)
}

async function handleDecay(row) {
  const result = await decay(row.id)
  if (result.ok && result.row) {
    const idx = rows.value.findIndex(r => r.id === row.id)
    if (idx !== -1) rows.value[idx] = result.row
    evictDiagnosis(row.id)
  }
}

async function handlePromote(row) {
  const result = await promote(row.id)
  if (result.ok && result.row) {
    const idx = rows.value.findIndex(r => r.id === row.id)
    if (idx !== -1) rows.value[idx] = result.row
    evictDiagnosis(row.id)
  }
}

async function handleDecayFromDetail() {
  const result = await decay(detailRow.value.id)
  if (result.ok && result.row) {
    // Reflect in the table row as well
    const idx = rows.value.findIndex(r => r.id === detailRow.value.id)
    if (idx !== -1) rows.value[idx] = result.row
    detailRow.value = result.row
    evictDiagnosis(detailRow.value.id)
    detailDiagnosis.value = null
  }
}

async function handlePromoteFromDetail() {
  const result = await promote(detailRow.value.id)
  if (result.ok && result.row) {
    const idx = rows.value.findIndex(r => r.id === detailRow.value.id)
    if (idx !== -1) rows.value[idx] = result.row
    detailRow.value = result.row
    evictDiagnosis(detailRow.value.id)
    detailDiagnosis.value = null
  }
}

async function handlePurge() {
  showPurgeConfirm.value = false
  const result = await purge(activeFilters.value)
  if (result.ok) {
    refreshSummary()
    resetPage()
    loadList(activeFilters.value)
  }
}

function openDetail(row) {
  detailRow.value       = row
  detailDiagnosis.value = null
}

async function loadDiagnosisForDetail() {
  if (!detailRow.value) return
  detailDiagnosis.value = await loadDiagnosis(detailRow.value.id)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  loadList({})
})
</script>

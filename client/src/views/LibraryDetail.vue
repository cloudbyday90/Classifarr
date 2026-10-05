<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <Button
        variant="secondary"
        @click="$router.back()"
      >
        ← Back
      </Button>
      <h1
        id="library-detail-title"
        class="rounded-sm text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-background"
        tabindex="-1"
      >
        {{ library?.name || 'Library' }}
      </h1>
    </div>

    <div
      v-if="loading"
      class="text-center py-12 text-gray-400"
    >
      Loading library...
    </div>

    <div
      v-else-if="library"
      class="space-y-6"
    >
      <Card title="Library Configuration">
        <div class="grid grid-cols-2 gap-4">
          <Input
            v-model="library.name"
            label="Name"
            disabled
          />
          <Input
            v-model.number="library.priority"
            label="Priority"
            type="number"
          />
          <Select
            v-model="library.arr_type"
            label="ARR Type"
            :options="[
              { label: 'Radarr', value: 'radarr' },
              { label: 'Sonarr', value: 'sonarr' },
            ]"
            placeholder="Select ARR type"
          />
          <label class="flex items-center gap-2">
            <input
              v-model="library.is_active"
              type="checkbox"
              :disabled="!!library.archived_at"
            >
            <span>Library enabled</span>
          </label>
          
          <div class="flex items-end">
            <Button
              :loading="saving"
              @click="saveLibrary"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      <LibraryEvidenceCoverage :library-id="library.id" />
      <p
        v-if="library.archived_at"
        role="status"
      >
        Archived — data is preserved. Restore below before enabling.
      </p>

      <!-- Sync Status / Empty State -->
      <div
        v-if="library.item_count === 0 && !isSyncing"
        class="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 flex items-center justify-between"
      >
        <div class="flex items-center gap-4">
          <div class="p-2 bg-yellow-900/40 rounded-full">
            <svg
              class="w-6 h-6 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 class="font-medium text-yellow-400">
              Sync Required
            </h3>
            <p class="text-sm text-yellow-200/70">
              This library has 0 synced items. Classification rules will not work until content is synced.
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          @click="handleSync"
        >
          Sync Now
        </Button>
      </div>

      <LibraryIngestionStatus
        :library="library"
        :requesting="syncing"
        :unavailable="syncReadFailed"
      />
      <LegacyIngestionReview
        v-if="showLegacyReview && library.ingestion_status?.recoveryMode !== 'deployment_required'"
        :library-id="library.id"
        @reconciled="refreshSyncStatus"
      />
      <IngestionSafeguardRepair
        :needed="library.ingestion_status?.recoveryMode === 'deployment_required'"
        @repaired="refreshSyncStatus"
      />
      <LibraryIngestionHistory :library-id="library.id" />
      <LibraryArchiveReview
        :library-id="library.id"
        @changed="refreshArchiveState"
      />
      <LegacyEnrichmentRetryReview :library-id="library.id" />

      <!-- Radarr Settings for Movie Libraries -->
      <Card
        v-if="library.media_type === 'movie' && library.arr_id"
        id="library-arr-mapping"
        title="Radarr Settings"
        tabindex="-1"
        class="focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-background"
      >
        <div
          v-if="loadingArrOptions"
          class="text-center py-4 text-gray-400"
        >
          Loading Radarr options...
        </div>
        <div
          v-else
          class="space-y-4"
        >
          <Select
            v-model="radarrSettings.root_folder_path"
            label="Root Folder"
            :options="rootFolderOptions"
            placeholder="Select root folder"
          />
          
          <Select
            v-model="radarrSettings.quality_profile_id"
            label="Quality Profile"
            :options="qualityProfileOptions"
            placeholder="Select quality profile"
          />
          
          <Select
            v-model="radarrSettings.minimum_availability"
            label="Minimum Availability"
            :options="minimumAvailabilityOptions"
            placeholder="Select minimum availability"
          />
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Tags</label>
            <div class="space-y-2">
              <div
                v-for="tag in tagOptions"
                :key="tag.id"
                class="flex items-center"
              >
                <input
                  :id="`tag-${tag.id}`"
                  v-model="radarrSettings.tags"
                  type="checkbox"
                  :value="tag.id"
                  class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded-sm focus:ring-blue-500"
                >
                <label
                  :for="`tag-${tag.id}`"
                  class="ml-2 text-sm text-gray-300"
                >
                  {{ tag.label }}
                </label>
              </div>
              <p
                v-if="tagOptions.length === 0"
                class="text-sm text-gray-500"
              >
                No tags available
              </p>
            </div>
          </div>
          
          <Toggle
            v-model="radarrSettings.search_on_add"
            label="Search on Add"
            description="Automatically search for movie when added"
          />
          
          <Toggle
            v-model="radarrSettings.monitor"
            label="Monitor"
            description="Monitor this movie for upgrades"
          />
          
          <div class="flex justify-end pt-4">
            <Button
              :loading="savingArrSettings"
              @click="saveArrSettings"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </Card>

      <!-- Sonarr Settings for TV Libraries -->
      <Card
        v-if="library.media_type === 'tv' && library.arr_id"
        id="library-arr-mapping"
        title="Sonarr Settings"
        tabindex="-1"
        class="focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-background"
      >
        <div
          v-if="loadingArrOptions"
          class="text-center py-4 text-gray-400"
        >
          Loading Sonarr options...
        </div>
        <div
          v-else
          class="space-y-4"
        >
          <Select
            v-model="sonarrSettings.root_folder_path"
            label="Root Folder"
            :options="rootFolderOptions"
            placeholder="Select root folder"
          />
          
          <Select
            v-model="sonarrSettings.quality_profile_id"
            label="Quality Profile"
            :options="qualityProfileOptions"
            placeholder="Select quality profile"
          />
          
          <Select
            v-model="sonarrSettings.series_type"
            label="Series Type"
            :options="seriesTypeOptions"
            placeholder="Select series type"
          />
          
          <Select
            v-model="sonarrSettings.season_monitoring"
            label="Season Monitoring"
            :options="seasonMonitoringOptions"
            placeholder="Select monitoring option"
          />
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Tags</label>
            <div class="space-y-2">
              <div
                v-for="tag in tagOptions"
                :key="tag.id"
                class="flex items-center"
              >
                <input
                  :id="`tag-${tag.id}`"
                  v-model="sonarrSettings.tags"
                  type="checkbox"
                  :value="tag.id"
                  class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded-sm focus:ring-blue-500"
                >
                <label
                  :for="`tag-${tag.id}`"
                  class="ml-2 text-sm text-gray-300"
                >
                  {{ tag.label }}
                </label>
              </div>
              <p
                v-if="tagOptions.length === 0"
                class="text-sm text-gray-500"
              >
                No tags available
              </p>
            </div>
          </div>
          
          <Toggle
            v-model="sonarrSettings.search_on_add"
            label="Search on Add"
            description="Automatically search for episodes when added"
          />
          
          <Select
            v-model="sonarrSettings.monitor_new_items"
            label="Monitor New Items"
            :options="[
              { label: 'All', value: 'all' },
              { label: 'None', value: 'none' }
            ]"
            placeholder="Select monitor option"
          />
          
          <Toggle
            v-model="sonarrSettings.season_folder"
            label="Season Folder"
            description="Create season folders for episodes"
          />
          
          <div class="flex justify-end pt-4">
            <Button
              :loading="savingArrSettings"
              @click="saveArrSettings"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </Card>

      <!-- Library Profile Section -->
      <LibraryProfile :library-id="library.id" />

      <Card title="Policy Guidance">
        <div class="space-y-6">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-medium mb-1">
                Policy Engine
              </h4>
              <p class="text-sm text-gray-400">
                Manage active behavior through Policies, Presets, and Tuning.
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                @click="$router.push('/policies')"
              >
                Policies
              </Button>
              <Button
                size="sm"
                variant="secondary"
                @click="$router.push('/presets')"
              >
                Presets
              </Button>
              <Button
                size="sm"
                variant="secondary"
                @click="$router.push('/tuning-suggestions')"
              >
                Tuning
              </Button>
            </div>
          </div>

          <!-- AI Suggestions Panel -->
          <div
            v-if="suggestions.length > 0"
            class="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4 space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-blue-400 font-medium">📊 Suggested Rules (based on {{ suggestionsItemCount }} items)</span>
              <button
                class="text-gray-400 hover:text-white text-sm"
                @click="suggestions = []"
              >
                ✕ Dismiss
              </button>
            </div>
            <div
              v-for="(suggestion, idx) in suggestions"
              :key="idx"
              class="flex items-center gap-3 bg-dark-600 rounded-sm p-3"
            >
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-200">
                  {{ suggestion.description }}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  {{ suggestion.rule_type }}: {{ suggestion.value }}
                </div>
              </div>
              <Button
                size="sm"
                :loading="applyingIdx === idx"
                @click="applySuggestion(suggestion)"
              >
                Apply
              </Button>
            </div>
          </div>

          <div
            v-if="rules.length > 0"
            class="border border-gray-700 rounded-lg overflow-hidden"
          >
            <table class="w-full text-left">
              <thead class="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>
                  <th class="px-4 py-3">
                    Rule Name
                  </th>
                  <th class="px-4 py-3">
                    Conditions
                  </th>
                  <th class="px-4 py-3">
                    Status
                  </th>
                  <th class="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-700">
                <tr
                  v-for="rule in rules"
                  :key="rule.id"
                  class="hover:bg-gray-800/50"
                >
                  <td class="px-4 py-3 font-medium">
                    {{ rule.name || rule.description || 'Rule' }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-400">
                    {{ formatConditions(rule.conditions) }}
                  </td>
                  <td class="px-4 py-3">
                    <span 
                      class="px-2 py-1 text-xs rounded-full"
                      :class="rule.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-700/50 text-gray-400'"
                    >
                      {{ rule.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      @click="deleteRule(rule)"
                    >
                      🗑️
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-else
            class="text-center py-8 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg"
          >
            No rule suggestions yet. Use Policies, Presets, and Tuning to shape routing behavior.
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/stores/toast'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import LibraryProfile from '@/components/library/LibraryProfile.vue'
import LibraryEvidenceCoverage from '@/components/library/LibraryEvidenceCoverage.vue'
import LibraryIngestionStatus from '@/components/library/LibraryIngestionStatus.vue'
import LegacyIngestionReview from '@/components/library/LegacyIngestionReview.vue'
import IngestionSafeguardRepair from '@/components/library/IngestionSafeguardRepair.vue'
import LibraryIngestionHistory from '@/components/library/LibraryIngestionHistory.vue'
import LegacyEnrichmentRetryReview from '@/components/library/LegacyEnrichmentRetryReview.vue'
import LibraryArchiveReview from '@/components/library/LibraryArchiveReview.vue'
import { useLibraryIngestionStatus } from '@/composables/useLibraryIngestionStatus'
import { librarySyncResultMessage } from '@/utils/libraryIngestionStatus'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import { consumeRouteFocusHandoff } from '@/utils/routeFocusHandoff'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const library = ref(null)
const loading = ref(true)
const saving = ref(false)
const loadingArrOptions = ref(false)
const routeFocusHandoff = consumeRouteFocusHandoff('LibraryDetail')

const focusRouteHandoff = async () => {
  if (!routeFocusHandoff) return

  await nextTick()
  const target = document.getElementById(routeFocusHandoff.targetId) ||
    document.getElementById(routeFocusHandoff.fallbackTargetId)
  target?.focus?.()
}
const savingArrSettings = ref(false)

// ARR Options
const arrOptions = ref({})
const radarrSettings = ref({
  root_folder_path: '',
  quality_profile_id: null,
  minimum_availability: 'released',
  tags: [],
  search_on_add: true,
  monitor: true
})
const sonarrSettings = ref({
  root_folder_path: '',
  quality_profile_id: null,
  series_type: 'standard',
  season_monitoring: 'all',
  tags: [],
  search_on_add: true,
  monitor_new_items: 'all',
  season_folder: true
})

// Computed options for dropdowns
const rootFolderOptions = computed(() => {
  if (!arrOptions.value.rootFolders) return []
  return arrOptions.value.rootFolders.map(rf => ({
    label: `${rf.path} (${formatBytes(rf.freeSpace)} free)`,
    value: rf.path
  }))
})

const qualityProfileOptions = computed(() => {
  if (!arrOptions.value.qualityProfiles) return []
  return arrOptions.value.qualityProfiles.map(qp => ({
    label: qp.name,
    value: qp.id
  }))
})

const tagOptions = computed(() => {
  return arrOptions.value.tags || []
})

const minimumAvailabilityOptions = computed(() => {
  if (!arrOptions.value.minimumAvailabilityOptions) return []
  return arrOptions.value.minimumAvailabilityOptions.map(opt => ({
    label: `${opt.label} - ${opt.description}`,
    value: opt.value
  }))
})

const seriesTypeOptions = computed(() => {
  if (!arrOptions.value.seriesTypeOptions) return []
  return arrOptions.value.seriesTypeOptions.map(opt => ({
    label: `${opt.label} - ${opt.description}`,
    value: opt.value
  }))
})

const seasonMonitoringOptions = computed(() => {
  if (!arrOptions.value.seasonMonitoringOptions) return []
  return arrOptions.value.seasonMonitoringOptions.map(opt => ({
    label: `${opt.label} - ${opt.description}`,
    value: opt.value
  }))
})

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const rules = ref([])

onMounted(async () => {
  try {
    library.value = await api.getLibrary(route.params.id)
    
    // Load existing settings
    if (library.value.media_type === 'movie' && library.value.radarr_settings) {
      radarrSettings.value = {
        ...radarrSettings.value,
        ...library.value.radarr_settings
      }
    } else if (library.value.media_type === 'tv' && library.value.sonarr_settings) {
      sonarrSettings.value = {
        ...sonarrSettings.value,
        ...library.value.sonarr_settings
      }
    }
    
    // Load rules
    rules.value = await api.getLibraryRules(route.params.id)

    // Load ARR options if arr_id is set
    if (library.value.arr_id) {
      await loadArrOptions()
    }
  } catch (error) {
    console.error('Failed to load library:', error)
    toast.error('Failed to load library')
    router.push('/libraries')
  } finally {
    loading.value = false
    await focusRouteHandoff()
  }
})

const formatConditions = (conditions) => {
  if (!conditions) return 'No conditions'
  // Handle string (from DB JSONB), array, or single object
  let list = conditions
  if (typeof conditions === 'string') {
    try { list = JSON.parse(conditions) } catch { return conditions }
  }
  if (!Array.isArray(list)) list = [list]
  if (list.length === 0) return 'No conditions'
  return list.map(c => {
    if (!c || !c.field) return ''
    const op = c.operator === 'equals' ? 'is' : 
               c.operator === 'not_equals' ? 'is not' : 
               c.operator?.replace('_', ' ') || ''
    return `${c.field} ${op} "${c.value}"`
  }).filter(Boolean).join(' AND ')
}

// Suggestions feature
const suggestions = ref([])
const suggestionsItemCount = ref(0)
const applyingIdx = ref(-1)

const applySuggestion = async (suggestion) => {
  const idx = suggestions.value.indexOf(suggestion)
  applyingIdx.value = idx
  try {
    await api.addLibraryRule(route.params.id, suggestion)
    // Reload rules and remove applied suggestion
    rules.value = await api.getLibraryRules(route.params.id)
    suggestions.value = suggestions.value.filter(s => s !== suggestion)
    toast.success('Rule applied')
  } catch (error) {
    console.error('Failed to apply suggestion:', error)
    toast.error('Failed to apply rule')
  } finally {
    applyingIdx.value = -1
  }
}

const deleteRule = async (rule) => {
  if (!confirm(`Delete this rule?`)) return
  try {
    await api.deleteLibraryRule(route.params.id, rule.id)
    rules.value = rules.value.filter(r => r.id !== rule.id)
    toast.success('Rule deleted')
  } catch (error) {
    console.error('Failed to delete rule:', error)
    toast.error('Failed to delete rule')
  }
}

const loadArrOptions = async () => {
  loadingArrOptions.value = true
  try {
    arrOptions.value = await api.getLibraryArrOptions(library.value.id)
  } catch (error) {
    console.error('Failed to load ARR options:', error)
    toast.error('Failed to load ARR options')
  } finally {
    loadingArrOptions.value = false
  }
}

const saveLibrary = async () => {
  saving.value = true
  try {
    await api.updateLibrary(library.value.id, {
      priority: library.value.priority,
      arr_type: library.value.arr_type,
      is_active: library.value.is_active,
    })
    toast.success('Library updated successfully')
  } catch (error) {
    console.error('Failed to save library:', error)
    toast.error('Failed to save library: ' + error.message)
  } finally {
    saving.value = false
  }
}

const saveArrSettings = async () => {
  savingArrSettings.value = true
  try {
    const settings = library.value.media_type === 'movie' ? radarrSettings.value : sonarrSettings.value
    await api.updateLibraryArrSettings(library.value.id, settings)
    toast.success('*arr settings saved successfully')
  } catch (error) {
    console.error('Failed to save *arr settings:', error)
    toast.error('Failed to save *arr settings: ' + error.message)
  } finally {
    savingArrSettings.value = false
  }
}

const syncing = ref(false)
const showLegacyReview = ref(false)
watch(() => library.value?.ingestion_status, status => {
  if (status?.needsReconciliation || status?.state === 'legacy_owner_unknown') showLegacyReview.value = true
}, { immediate: true })
const { isSyncing, unavailable: syncReadFailed, refresh: refreshSyncStatus } = useLibraryIngestionStatus(library, syncing)
const refreshArchiveState = async () => {
  const id = library.value.id
  const current = await api.getLibrary(id)
  if (library.value?.id !== id) return
  Object.assign(library.value, { archived_at: current.archived_at, is_active: current.is_active })
  await refreshSyncStatus()
}

const handleSync = async () => {
  syncing.value = true
  try {
    const response = await api.syncLibrary(library.value.id)
    if (response.data?.success && !response.data?.skipped) toast.success(librarySyncResultMessage(response.data))
    else toast.info(librarySyncResultMessage(response.data))
    
    // Start polling immediately
    await refreshSyncStatus()
    
  } catch (error) {
    console.error('Sync failed:', error)
    toast.error('Sync failed: ' + (error.response?.data?.error || error.message))
    syncing.value = false
  }
}

</script>

<style scoped>
.event-deprecation-notice {
  display: flex;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #fff3cd 0%, #ffe6a3 100%);
  border-left: 5px solid #ff9800;
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(255, 152, 0, 0.15);
}

.event-deprecation-notice .icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.event-deprecation-notice .content {
  flex: 1;
}

.event-deprecation-notice h3 {
  margin: 0 0 0.5rem 0;
  color: #856404;
  font-size: 1.1rem;
  font-weight: 700;
}

.event-deprecation-notice p {
  margin: 0.4rem 0;
  color: #856404;
  line-height: 1.5;
  font-size: 0.95rem;
}

.event-deprecation-notice code {
  background: rgba(133, 100, 4, 0.15);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  font-weight: 600;
}

.migration-info {
  margin-top: 0.75rem !important;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(133, 100, 4, 0.2);
}

.link-policies {
  color: #ff6f00;
  font-weight: 600;
  text-decoration: none;
  margin-left: 0.5rem;
  transition: color 0.2s ease;
}

.link-policies:hover {
  color: #e65100;
  text-decoration: underline;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .event-deprecation-notice {
    background: linear-gradient(135deg, #4a3800 0%, #5a4200 100%);
    border-left-color: #ff9800;
  }

  .event-deprecation-notice h3,
  .event-deprecation-notice p {
    color: #ffd54f;
  }

  .event-deprecation-notice code {
    background: rgba(255, 213, 79, 0.15);
  }

  .migration-info {
    border-top-color: rgba(255, 213, 79, 0.2);
  }

  .link-policies {
    color: #ffb74d;
  }

  .link-policies:hover {
    color: #ffa726;
  }
}
</style>

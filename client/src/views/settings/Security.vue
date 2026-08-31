<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">
        Security Settings
      </h2>
      <p class="text-gray-400 text-sm">
        Manage API keys for third-party integrations and automation
      </p>
    </div>

    <section
      class="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4"
      aria-labelledby="review-corpus-control-heading"
    >
      <div>
        <h3
          id="review-corpus-control-heading"
          class="text-lg font-medium"
        >
          Historic Review Corpus Safeguards
        </h3>
        <p class="mt-1 text-sm text-gray-400">
          This configures only the future review contract. It never exposes historic records or gives AI, RAG, or routing authority.
        </p>
      </div>

      <div
        class="rounded-md border border-gray-700 bg-gray-900/40 p-4"
        role="status"
        aria-live="polite"
      >
        <template v-if="reviewCorpusControlPresentation">
          <p
            class="font-medium"
            :class="reviewCorpusControlPresentation.statusClass"
          >
            {{ reviewCorpusControlPresentation.heading }}
          </p>
          <p class="mt-1 text-sm text-gray-300">
            {{ reviewCorpusControlPresentation.message }}
          </p>
          <p
            v-if="reviewCorpusActionStatus"
            class="mt-2 text-sm text-green-400"
          >
            {{ reviewCorpusActionStatus }}
          </p>
        </template>
        <p
          v-else-if="reviewCorpusLoading"
          class="text-sm text-gray-400"
        >
          Checking historic review-corpus safeguards…
        </p>
        <p
          v-else
          class="text-sm text-amber-300"
        >
          Historic review-corpus safeguards are temporarily unavailable.
        </p>
      </div>

      <p
        v-if="reviewCorpusError"
        class="rounded-md bg-red-900/30 p-3 text-sm text-red-300"
        role="alert"
      >
        {{ reviewCorpusError }}
      </p>

      <form
        v-if="reviewCorpusControl"
        class="space-y-4"
        @submit.prevent="acknowledgeReviewCorpusSafeguards"
      >
        <fieldset
          class="space-y-4"
          :disabled="reviewCorpusSaving"
        >
          <div>
            <label
              for="review-record-retention-days"
              class="block text-sm font-medium text-gray-200"
            >
              Future review-record retention limit (days)
            </label>
            <input
              id="review-record-retention-days"
              v-model.number="reviewRecordRetentionDays"
              type="number"
              min="7"
              max="90"
              step="1"
              class="mt-2 w-32 rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
            <p class="mt-1 text-xs text-gray-400">
              This is a retained future projection limit. No historic review record exists today.
            </p>
          </div>

          <div class="rounded-md border border-gray-700 p-4">
            <p class="text-sm font-medium text-gray-200">
              Required safeguards
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>Administrator authorization is required at the record boundary.</li>
              <li>Any future projection must be redacted server-side.</li>
              <li>Future review data must obey the selected retention limit.</li>
              <li>Configuration acknowledgements are recorded in an append-only audit trail.</li>
            </ul>
          </div>

          <label class="flex items-start gap-3 text-sm text-gray-200">
            <input
              v-model="reviewCorpusAcknowledged"
              type="checkbox"
              class="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
            >
            <span>I acknowledge these safeguards for representative historic correction review.</span>
          </label>

          <button
            type="submit"
            :disabled="!reviewCorpusAcknowledged || reviewCorpusSaving"
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
          >
            {{ reviewCorpusSaving ? 'Saving safeguards…' : 'Acknowledge safeguards' }}
          </button>
        </fieldset>
      </form>

      <details
        v-if="reviewCorpusAuditEvents.length > 0"
        class="rounded-md border border-gray-700 p-4"
      >
        <summary class="cursor-pointer text-sm font-medium text-blue-300">
          Review recent safeguard acknowledgements
        </summary>
        <ul class="mt-3 space-y-2 text-sm text-gray-300">
          <li
            v-for="event in reviewCorpusAuditEvents"
            :key="event.eventId"
          >
            Administrator #{{ event.actorId }} acknowledged a {{ event.reviewRecordRetentionDays }}-day future review-record limit on {{ formatDate(event.occurredAt) }}.
          </li>
        </ul>
      </details>
    </section>

    <!-- Create New API Key Button -->
    <div class="flex justify-between items-center">
      <h3 class="text-lg font-medium">
        API Keys
      </h3>
      <button
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
        @click="showCreateDialog = true"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Create New API Key
      </button>
    </div>

    <!-- API Keys Table -->
    <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-900">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Name
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Key Prefix
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Permissions
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Last Used
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700">
          <tr
            v-if="loading"
            class="bg-gray-800"
          >
            <td
              colspan="6"
              class="px-6 py-8 text-center text-gray-400"
            >
              Loading API keys...
            </td>
          </tr>
          <tr
            v-else-if="apiKeys.length === 0"
            class="bg-gray-800"
          >
            <td
              colspan="6"
              class="px-6 py-8 text-center text-gray-400"
            >
              No API keys found. Create one to get started.
            </td>
          </tr>
          <tr
            v-for="key in apiKeys"
            v-else
            :key="key.id"
            class="bg-gray-800 hover:bg-gray-750"
          >
            <td class="px-6 py-4 whitespace-nowrap">
              <input
                v-if="editingKey === key.id"
                v-model="editingName"
                class="px-2 py-1 bg-gray-700 border border-gray-600 rounded-sm focus:ring-2 focus:ring-blue-500"
                autofocus
                @keyup.enter="saveKeyName(key)"
                @keyup.esc="editingKey = null"
              >
              <span
                v-else
                class="cursor-pointer hover:text-blue-400"
                @dblclick="startEditName(key)"
              >
                {{ key.name }}
              </span>
            </td>
            <td class="px-6 py-4 font-mono text-sm">
              {{ key.key_prefix }}...
            </td>
            <td class="px-6 py-4">
              <span
                :class="permissionClass(key.permissions)"
                class="px-2 py-1 rounded-full text-xs font-medium"
              >
                {{ permissionLabel(key.permissions) }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-400">
              {{ key.last_used_at ? formatDate(key.last_used_at) : 'Never' }}
              <span
                v-if="key.last_used_ip"
                class="text-xs block"
              >{{ key.last_used_ip }}</span>
            </td>
            <td class="px-6 py-4">
              <button
                :class="key.is_active ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'"
                class="px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                @click="toggleKeyStatus(key)"
              >
                {{ key.is_active ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td class="px-6 py-4">
              <div class="flex gap-2">
                <button
                  class="text-blue-400 hover:text-blue-300 transition-colors"
                  title="View full API key"
                  @click="revealKey(key)"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
                <button
                  class="text-red-400 hover:text-red-300 transition-colors"
                  title="Revoke API key"
                  @click="confirmDelete(key)"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create API Key Dialog -->
    <div
      v-if="showCreateDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 class="text-xl font-semibold mb-4">
          Create New API Key
        </h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Name</label>
            <input
              v-model="newKey.name"
              type="text"
              placeholder="Integration Key"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Permission Level</label>
            <select
              v-model="newKey.permissions"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="read_write">
                Read-Write (Full Access)
              </option>
              <option value="read_only">
                Read-Only (GET endpoints only)
              </option>
              <option value="embed_service">
                Embedding Service (reserved sidecar credential)
              </option>
              <option value="admin">
                Admin (Full Access + Admin Routes)
              </option>
            </select>
            <p class="text-xs text-gray-400 mt-1">
              {{ permissionDescription(newKey.permissions) }}
            </p>
          </div>

          <div
            v-if="error"
            class="p-3 rounded-lg bg-red-900/30 text-red-400 text-sm"
          >
            {{ error }}
          </div>

          <div class="flex gap-3 mt-6">
            <button
              :disabled="creating || !newKey.name"
              class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              @click="createKey"
            >
              {{ creating ? 'Creating...' : 'Create Key' }}
            </button>
            <button
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              @click="showCreateDialog = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Show API Key Dialog (after creation or reveal) -->
    <!-- NOTE: Users can view full keys again - this is intentional for usability -->
    <!-- Keys are stored encrypted so they can be retrieved when needed -->
    <div
      v-if="showKeyDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 class="text-xl font-semibold mb-4">
          {{ revealedKey.justCreated ? 'API Key Created' : 'API Key' }}
        </h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Name</label>
            <p class="text-gray-300">
              {{ revealedKey.name }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <div class="flex gap-2">
              <input
                :value="revealedKey.key"
                readonly
                class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm"
              >
              <button
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                :title="copied ? 'Copied!' : 'Copy to clipboard'"
                @click="copyKey(revealedKey.key)"
              >
                <svg
                  v-if="!copied"
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div class="p-3 rounded-lg bg-yellow-900/30 text-yellow-400 text-sm">
            <svg
              class="w-5 h-5 inline mr-2"
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
            This key is stored encrypted and can be retrieved later when logged in. However, store it securely for convenience.
          </div>

          <div>
            <button
              class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              @click="showKeyDialog = false; revealedKey = null"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 class="text-xl font-semibold mb-4">
          Revoke API Key
        </h3>
        
        <p class="text-gray-300 mb-4">
          Are you sure you want to revoke the API key "{{ keyToDelete?.name }}"? This action cannot be undone and the key will stop working immediately.
        </p>

        <div class="flex gap-3">
          <button
            :disabled="deleting"
            class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            @click="deleteKey"
          >
            {{ deleting ? 'Revoking...' : 'Revoke Key' }}
          </button>
          <button
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            @click="showDeleteDialog = false; keyToDelete = null"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Status Message -->
    <div
      v-if="status"
      :class="['p-3 rounded-lg', status.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400']"
    >
      {{ status.message }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import api from '@/api'
import {
  getPolicyCandidateCorrectionRepresentativeReviewCorpusControlPresentation,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewCorpusControlPresentation'

const apiKeys = ref([])
const loading = ref(false)
const showCreateDialog = ref(false)
const showKeyDialog = ref(false)
const showDeleteDialog = ref(false)
const revealedKey = ref(null)
const keyToDelete = ref(null)
const creating = ref(false)
const deleting = ref(false)
const copied = ref(false)
const error = ref(null)
const status = ref(null)
const editingKey = ref(null)
const editingName = ref('')
const reviewCorpusControl = ref(null)
const reviewCorpusAuditEvents = ref([])
const reviewCorpusLoading = ref(false)
const reviewCorpusSaving = ref(false)
const reviewCorpusError = ref(null)
const reviewCorpusActionStatus = ref(null)
const reviewCorpusAcknowledged = ref(false)
const reviewRecordRetentionDays = ref(30)

const reviewCorpusControlPresentation = computed(() => (
  getPolicyCandidateCorrectionRepresentativeReviewCorpusControlPresentation(
    reviewCorpusControl.value?.statusId
  )
))

const newKey = ref({
  name: '',
  permissions: 'read_write'
})

onMounted(() => {
  loadApiKeys()
  loadReviewCorpusControl()
})

const loadReviewCorpusControl = async () => {
  reviewCorpusLoading.value = true
  reviewCorpusError.value = null
  try {
    const [controlResponse, auditResponse] = await Promise.all([
      api.getPolicyCandidateCorrectionReviewCorpusControlConfiguration(),
      api.getPolicyCandidateCorrectionReviewCorpusAuditEvents(),
    ])
    const control = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(controlResponse)
    const auditEvents = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents(auditResponse)
    if (!control || !auditEvents) {
      throw new Error('Historic review-corpus safeguards returned an unexpected response.')
    }

    reviewCorpusControl.value = control
    reviewCorpusAuditEvents.value = auditEvents
    reviewRecordRetentionDays.value = control.configuration?.reviewRecordRetentionDays || 30
  } catch (err) {
    console.error('Failed to load historic review-corpus safeguards:', err)
    reviewCorpusControl.value = null
    reviewCorpusAuditEvents.value = []
    reviewCorpusError.value = 'Unable to load historic review-corpus safeguards. No historic records are available.'
  } finally {
    reviewCorpusLoading.value = false
  }
}

const acknowledgeReviewCorpusSafeguards = async () => {
  if (!reviewCorpusControl.value || !reviewCorpusAcknowledged.value) return

  reviewCorpusSaving.value = true
  reviewCorpusError.value = null
  reviewCorpusActionStatus.value = null
  try {
    const response = await api.acknowledgePolicyCandidateCorrectionReviewCorpusControl({
      expected_revision: reviewCorpusControl.value.configuration?.revision || null,
      acknowledged_safeguard_ids: [
        'authorization',
        'redaction',
        'retention',
        'operator_audit',
      ],
      review_record_retention_days: reviewRecordRetentionDays.value,
    })
    const control = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(response.data)
    if (!control) {
      throw new Error('Historic review-corpus safeguards returned an unexpected response.')
    }

    reviewCorpusControl.value = control
    reviewCorpusAcknowledged.value = false
    reviewCorpusActionStatus.value = 'Safeguards acknowledged. Historic record access remains disabled.'
    const auditResponse = await api.getPolicyCandidateCorrectionReviewCorpusAuditEvents()
    const auditEvents = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents(auditResponse)
    if (!auditEvents) {
      throw new Error('Historic review-corpus audit events returned an unexpected response.')
    }
    reviewCorpusAuditEvents.value = auditEvents
  } catch (err) {
    console.error('Failed to acknowledge historic review-corpus safeguards:', err)
    reviewCorpusError.value = err.response?.data?.error ||
      'Unable to save safeguards. Refresh the page and try again.'
  } finally {
    reviewCorpusSaving.value = false
  }
}

const loadApiKeys = async () => {
  loading.value = true
  try {
    const response = await api.getApiKeys()
    apiKeys.value = response
  } catch (err) {
    console.error('Failed to load API keys:', err)
    error.value = 'Failed to load API keys'
  } finally {
    loading.value = false
  }
}

const createKey = async () => {
  creating.value = true
  error.value = null
  try {
    const response = await api.createApiKey(newKey.value)
    revealedKey.value = { ...response.data, justCreated: true }
    showCreateDialog.value = false
    showKeyDialog.value = true
    newKey.value = { name: '', permissions: 'read_write' }
    await loadApiKeys()
  } catch (err) {
    console.error('Failed to create API key:', err)
    error.value = err.response?.data?.error || 'Failed to create API key'
  } finally {
    creating.value = false
  }
}

const revealKey = async (key) => {
  try {
    const response = await api.revealApiKey(key.id)
    revealedKey.value = { ...response, justCreated: false }
    showKeyDialog.value = true
  } catch (err) {
    console.error('Failed to reveal API key:', err)
    status.value = { type: 'error', message: 'Failed to reveal API key' }
    setTimeout(() => status.value = null, 3000)
  }
}

const copyKey = async (key) => {
  try {
    await navigator.clipboard.writeText(key)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const confirmDelete = (key) => {
  keyToDelete.value = key
  showDeleteDialog.value = true
}

const deleteKey = async () => {
  deleting.value = true
  try {
    await api.deleteApiKey(keyToDelete.value.id)
    showDeleteDialog.value = false
    keyToDelete.value = null
    await loadApiKeys()
    status.value = { type: 'success', message: 'API key revoked successfully' }
    setTimeout(() => status.value = null, 3000)
  } catch (err) {
    console.error('Failed to delete API key:', err)
    status.value = { type: 'error', message: 'Failed to revoke API key' }
    setTimeout(() => status.value = null, 3000)
  } finally {
    deleting.value = false
  }
}

const toggleKeyStatus = async (key) => {
  try {
    await api.updateApiKey(key.id, { is_active: !key.is_active })
    await loadApiKeys()
    status.value = { type: 'success', message: `API key ${!key.is_active ? 'activated' : 'deactivated'}` }
    setTimeout(() => status.value = null, 3000)
  } catch (err) {
    console.error('Failed to update API key:', err)
    status.value = { type: 'error', message: 'Failed to update API key' }
    setTimeout(() => status.value = null, 3000)
  }
}

const startEditName = (key) => {
  editingKey.value = key.id
  editingName.value = key.name
}

const saveKeyName = async (key) => {
  try {
    await api.updateApiKey(key.id, { name: editingName.value })
    editingKey.value = null
    await loadApiKeys()
    status.value = { type: 'success', message: 'API key name updated' }
    setTimeout(() => status.value = null, 3000)
  } catch (err) {
    console.error('Failed to update API key name:', err)
    status.value = { type: 'error', message: 'Failed to update name' }
    setTimeout(() => status.value = null, 3000)
  }
}

const permissionClass = (permission) => {
  const classes = {
    'read_write': 'bg-blue-900/30 text-blue-400',
    'read_only': 'bg-purple-900/30 text-purple-400',
    'webhook_only': 'bg-green-900/30 text-green-400',
    'embed_service': 'bg-amber-900/30 text-amber-300',
    'admin': 'bg-red-900/30 text-red-400'
  }
  return classes[permission] || 'bg-gray-900/30 text-gray-400'
}

const permissionLabel = (permission) => {
  const labels = {
    'read_write': 'Read-Write',
    'read_only': 'Read-Only',
    'webhook_only': 'Webhook Only',
    'embed_service': 'Embedding Service',
    'admin': 'Admin'
  }
  return labels[permission] || permission
}

const permissionDescription = (permission) => {
  const descriptions = {
    'read_write': 'Can read and modify data (all endpoints)',
    'read_only': 'Can only read data (GET requests)',
    'webhook_only': 'Can only access webhook endpoints (for Overseerr/Seer)',
    'embed_service': 'Reserved for the image-embedding sidecar credential. Not accepted on normal Classifarr API routes.',
    'admin': 'Full access including admin-only endpoints'
  }
  return descriptions[permission] || ''
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}
</script>

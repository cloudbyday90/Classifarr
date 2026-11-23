<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="tuning-dashboard">
    <div class="header">
      <div>
        <h1
          ref="dashboardHeading"
          tabindex="-1"
          class="text-2xl font-bold"
        >
          Policy Tuning Suggestions
        </h1>
        <p class="text-gray-400 text-sm mt-1">
          Review AI-generated suggestions to improve your policies
        </p>
      </div>
      <div class="filters">
        <select
          v-model="statusFilter"
          aria-label="Suggestion status"
          class="filter-select"
        >
          <option value="pending">
            Pending
          </option>
          <option value="applied">
            Applied
          </option>
          <option value="rejected">
            Rejected
          </option>
          <option value="superseded">
            Superseded
          </option>
          <option value="">
            All
          </option>
        </select>
        <select
          v-model="policyFilter"
          aria-label="Policy"
          class="filter-select"
        >
          <option value="">
            All Policies
          </option>
          <option
            v-for="policy in policies"
            :key="policy.id"
            :value="policy.id"
          >
            {{ policy.name }}
          </option>
        </select>
      </div>
    </div>
    
    <!-- Summary cards -->
    <div class="summary-cards">
      <div class="summary-card pending">
        <span class="count">{{ summaryStats.pending }}</span>
        <span class="label">Pending</span>
      </div>
      <div class="summary-card applied">
        <span class="count">{{ summaryStats.applied }}</span>
        <span class="label">Applied</span>
      </div>
      <div class="summary-card rejected">
        <span class="count">{{ summaryStats.rejected }}</span>
        <span class="label">Rejected</span>
      </div>
    </div>
    
    <!-- Loading state -->
    <div
      v-if="loading"
      class="text-center py-12 text-gray-400"
    >
      Loading suggestions...
    </div>
    
    <!-- Suggestions list -->
    <div
      v-else-if="filteredSuggestions.length > 0"
      class="suggestions-list"
    >
      <SuggestionCard
        v-for="suggestion in filteredSuggestions"
        :key="suggestion.id"
        :suggestion="suggestion"
        @apply="applySuggestion"
        @reject="showRejectModal"
        @view-details="showDetails"
      />
    </div>
    
    <!-- Empty state -->
    <div
      v-else
      class="empty-state"
    >
      <p>No suggestions found</p>
    </div>
    
    <SuggestionDetailsDialog
      v-if="selectedSuggestion"
      :key="selectedSuggestion.id"
      :suggestion="selectedSuggestion"
      :fallback-focus-target="getDetailsFallbackFocus"
      @close="selectedSuggestion = null"
      @apply="applySuggestion"
      @reject="showRejectModal"
    />
    
    <!-- Reject modal -->
    <RejectModal
      v-if="rejectingSuggestion"
      :suggestion="rejectingSuggestion"
      @confirm="confirmReject"
      @cancel="rejectingSuggestion = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, useTemplateRef } from 'vue';
import api from '@/api';
import SuggestionCard from '@/components/suggestions/SuggestionCard.vue';
import SuggestionDetailsDialog from '@/components/suggestions/SuggestionDetailsDialog.vue';
import RejectModal from '@/components/suggestions/RejectModal.vue';
import { isSuggestionAdministratorRefusal, isSuggestionReviewConflict } from '@/utils/suggestionReviewErrors';

const suggestions = ref([]);
const policies = ref([]);
const loading = ref(true);
const statusFilter = ref('pending');
const policyFilter = ref('');
const selectedSuggestion = ref(null);
const rejectingSuggestion = ref(null);
const dashboardHeading = useTemplateRef('dashboardHeading');

// Note: Filtering is done server-side via loadSuggestions()
// This computed property is kept for potential client-side filtering in the future
const filteredSuggestions = computed(() => {
  return suggestions.value;
});

const summaryStats = computed(() => {
  return {
    pending: suggestions.value.filter(s => s.status === 'pending').length,
    applied: suggestions.value.filter(s => s.status === 'applied').length,
    rejected: suggestions.value.filter(s => s.status === 'rejected').length,
  };
});

async function loadSuggestions() {
  try {
    loading.value = true;
    const response = await api.getSuggestions(statusFilter.value, policyFilter.value);
    suggestions.value = response;
  } catch (error) {
    console.error('Failed to load suggestions:', error);
  } finally {
    loading.value = false;
  }
}

async function loadPolicies() {
  try {
    policies.value = await api.getPolicies();
  } catch (error) {
    console.error('Failed to load policies:', error);
  }
}

async function recoverReviewConflict(error) {
  if (!isSuggestionReviewConflict(error)) return false;
  selectedSuggestion.value = null;
  rejectingSuggestion.value = null;
  await loadSuggestions();
  const code = error.response?.data?.code;
  alert(code === 'SUGGESTION_EVIDENCE_BUSY'
    ? 'Suggestion evidence is being updated. Please try again later.'
    : code === 'SUGGESTION_EVIDENCE_STALE' || code === 'SUGGESTION_EVIDENCE_REQUIRED'
      ? 'Suggestion evidence needs refreshing. Run analysis before applying a new suggestion.'
      : 'This suggestion has changed and was not updated by this request.');
  return true;
}

async function applySuggestion(suggestion) {
  if (!confirm('Are you sure you want to apply this suggestion?')) {
    return;
  }
  
  try {
    await api.applySuggestion(suggestion.id);
    alert('Suggestion applied successfully!');
    selectedSuggestion.value = null;
    await loadSuggestions();
  } catch (error) {
    if (isSuggestionAdministratorRefusal(error)) {
      alert('Ask a Classifarr administrator to review and apply this suggestion.');
      return;
    }
    if (await recoverReviewConflict(error)) return;
    console.error('Failed to apply suggestion:', error);
    alert('Failed to apply suggestion: ' + error.message);
  }
}

function showRejectModal(suggestion) {
  selectedSuggestion.value = null;
  rejectingSuggestion.value = suggestion;
}

async function confirmReject(reason) {
  try {
    await api.rejectSuggestion(rejectingSuggestion.value.id, reason);
    alert('Suggestion rejected');
    rejectingSuggestion.value = null;
    await loadSuggestions();
  } catch (error) {
    if (isSuggestionAdministratorRefusal(error)) {
      alert('Ask a Classifarr administrator to review and reject this suggestion.');
      return;
    }
    if (await recoverReviewConflict(error)) return;
    console.error('Failed to reject suggestion:', error);
    alert('Failed to reject suggestion: ' + error.message);
  }
}

function showDetails(suggestion) {
  selectedSuggestion.value = suggestion;
}

function getDetailsFallbackFocus() {
  return dashboardHeading.value;
}

onMounted(async () => {
  await Promise.all([loadSuggestions(), loadPolicies()]);
});

// Watch filters
import { watch } from 'vue';
watch([statusFilter, policyFilter], () => {
  loadSuggestions();
});
</script>

<style scoped>
.tuning-dashboard {
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.filters {
  display: flex;
  gap: 1rem;
}

.filter-select {
  padding: 0.5rem 1rem;
  background: #2a2a3e;
  border: 1px solid #374151;
  border-radius: 4px;
  color: #e5e7eb;
  cursor: pointer;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: #2a2a3e;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.summary-card.pending {
  border-left: 4px solid #fbbf24;
}

.summary-card.applied {
  border-left: 4px solid #10b981;
}

.summary-card.rejected {
  border-left: 4px solid #ef4444;
}

.summary-card .count {
  display: block;
  font-size: 2rem;
  font-weight: bold;
  color: #e5e7eb;
  margin-bottom: 0.5rem;
}

.summary-card .label {
  color: #9ca3af;
  font-size: 0.875rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-size: 1.125rem;
}

</style>

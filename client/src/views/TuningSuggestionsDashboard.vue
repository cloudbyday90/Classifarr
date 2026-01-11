<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="tuning-dashboard">
    <div class="header">
      <div>
        <h1 class="text-2xl font-bold">Policy Tuning Suggestions</h1>
        <p class="text-gray-400 text-sm mt-1">
          Review AI-generated suggestions to improve your policies
        </p>
      </div>
      <div class="filters">
        <select v-model="statusFilter" class="filter-select">
          <option value="pending">Pending</option>
          <option value="applied">Applied</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
        <select v-model="policyFilter" class="filter-select">
          <option value="">All Policies</option>
          <option v-for="policy in policies" :key="policy.id" :value="policy.id">
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
    <div v-if="loading" class="text-center py-12 text-gray-400">
      Loading suggestions...
    </div>
    
    <!-- Suggestions list -->
    <div v-else-if="filteredSuggestions.length > 0" class="suggestions-list">
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
    <div v-else class="empty-state">
      <p>No suggestions found</p>
    </div>
    
    <!-- Detail modal (simplified) -->
    <div v-if="selectedSuggestion" class="modal-overlay" @click.self="selectedSuggestion = null">
      <div class="modal">
        <div class="modal-header">
          <h2>Suggestion Details</h2>
          <button @click="selectedSuggestion = null" class="btn-close">×</button>
        </div>
        
        <div class="modal-body">
          <div class="detail-section">
            <h3>{{ selectedSuggestion.suggestion_type }}</h3>
            <div class="config-detail">
              <h4>Proposed Change:</h4>
              <pre>{{ JSON.stringify(selectedSuggestion.suggestion_config, null, 2) }}</pre>
            </div>
            
            <div class="metrics">
              <div class="metric">
                <span class="label">Confidence</span>
                <span class="value">{{ selectedSuggestion.confidence }}%</span>
              </div>
              <div class="metric">
                <span class="label">Expected Impact</span>
                <span class="value">{{ selectedSuggestion.impact_estimate }}</span>
              </div>
              <div class="metric">
                <span class="label">Evidence</span>
                <span class="value">{{ selectedSuggestion.supporting_feedback?.length || 0 }} decisions</span>
              </div>
            </div>
          </div>
          
          <!-- Supporting evidence -->
          <div v-if="selectedSuggestion.supporting_feedback?.length > 0" class="detail-section">
            <h3>Supporting Evidence</h3>
            <p class="help-text">Recent classifications that support this suggestion</p>
            
            <div class="evidence-list">
              <div v-for="feedback in selectedSuggestion.supporting_feedback" :key="feedback.id" class="evidence-item">
                <div class="evidence-header">
                  <span class="title">{{ feedback.title }} ({{ feedback.item_metadata?.release_year }})</span>
                  <span class="badge" :class="feedback.was_correction ? 'correction' : 'confirmed'">
                    {{ feedback.was_correction ? 'Correction' : 'Confirmed' }}
                  </span>
                </div>
                <div class="evidence-details">
                  <span>Original: {{ feedback.original_library }}</span>
                  <span>→</span>
                  <span>Selected: {{ feedback.selected_library }}</span>
                </div>
                <div v-if="feedback.user_reason_text" class="user-reason">
                  "{{ feedback.user_reason_text }}"
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer" v-if="selectedSuggestion.status === 'pending'">
          <button @click="showRejectModal(selectedSuggestion)" class="btn btn-secondary">
            Reject
          </button>
          <button @click="applySuggestion(selectedSuggestion)" class="btn btn-success">
            Apply Suggestion
          </button>
        </div>
      </div>
    </div>
    
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
import { ref, computed, onMounted } from 'vue';
import api from '@/api';
import SuggestionCard from '@/components/suggestions/SuggestionCard.vue';
import RejectModal from '@/components/suggestions/RejectModal.vue';

const suggestions = ref([]);
const policies = ref([]);
const loading = ref(true);
const statusFilter = ref('pending');
const policyFilter = ref('');
const selectedSuggestion = ref(null);
const rejectingSuggestion = ref(null);

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
    suggestions.value = response.data;
  } catch (error) {
    console.error('Failed to load suggestions:', error);
  } finally {
    loading.value = false;
  }
}

async function loadPolicies() {
  try {
    const response = await api.get('/policies');
    policies.value = response.data;
  } catch (error) {
    console.error('Failed to load policies:', error);
  }
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
    console.error('Failed to reject suggestion:', error);
    alert('Failed to reject suggestion: ' + error.message);
  }
}

async function showDetails(suggestion) {
  try {
    const response = await api.getSuggestion(suggestion.id);
    selectedSuggestion.value = response.data;
  } catch (error) {
    console.error('Failed to load suggestion details:', error);
  }
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #2a2a3e;
  border-radius: 8px;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #374151;
}

.modal-header h2 {
  margin: 0;
  color: #e5e7eb;
}

.btn-close {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 2rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.btn-close:hover {
  color: #e5e7eb;
}

.modal-body {
  padding: 1.5rem;
}

.detail-section {
  margin-bottom: 2rem;
}

.detail-section h3 {
  color: #e5e7eb;
  margin-bottom: 1rem;
}

.detail-section h4 {
  color: #9ca3af;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.config-detail pre {
  background: #1a1a2e;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  color: #a5b4fc;
  font-size: 0.875rem;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.metric {
  background: #1a1a2e;
  padding: 1rem;
  border-radius: 4px;
  text-align: center;
}

.metric .label {
  display: block;
  color: #9ca3af;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
}

.metric .value {
  display: block;
  color: #e5e7eb;
  font-size: 1.25rem;
  font-weight: 600;
}

.help-text {
  color: #9ca3af;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.evidence-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.evidence-item {
  background: #1a1a2e;
  padding: 1rem;
  border-radius: 4px;
}

.evidence-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.evidence-header .title {
  color: #e5e7eb;
  font-weight: 500;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge.correction {
  background: #fbbf2450;
  color: #fbbf24;
}

.badge.confirmed {
  background: #10b98150;
  color: #10b981;
}

.evidence-details {
  color: #9ca3af;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.user-reason {
  color: #a5b4fc;
  font-style: italic;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1.5rem;
  border-top: 1px solid #374151;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn:hover {
  opacity: 0.8;
}

.btn-secondary {
  background: #4b5563;
  color: #e5e7eb;
}

.btn-success {
  background: #10b981;
  color: white;
}
</style>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modal-header">
        <h2>Reject Suggestion</h2>
        <button @click="$emit('cancel')" class="btn-close">×</button>
      </div>
      
      <div class="modal-body">
        <p>Are you sure you want to reject this suggestion?</p>
        <p class="suggestion-title">{{ suggestionTitle }}</p>
        
        <div class="form-group">
          <label for="reason">Reason for rejection:</label>
          <textarea 
            id="reason"
            v-model="reason"
            class="form-control"
            rows="3"
            placeholder="Optional: Explain why you're rejecting this suggestion"
          ></textarea>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="$emit('cancel')" class="btn btn-secondary">
          Cancel
        </button>
        <button @click="confirmReject" class="btn btn-danger">
          Reject Suggestion
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  suggestion: Object
});

const emit = defineEmits(['confirm', 'cancel']);

const reason = ref('');

const suggestionTitle = computed(() => {
  const config = props.suggestion.suggestion_config;
  switch (props.suggestion.suggestion_type) {
    case 'adjust_weight':
      return `Adjust ${config.signal} weight`;
    case 'adjust_threshold':
      return `Adjust ${config.threshold_type} threshold`;
    case 'create_pattern':
      return `Create pattern: ${config.pattern_value}`;
    default:
      return props.suggestion.suggestion_type;
  }
});

function confirmReject() {
  emit('confirm', reason.value || 'No reason provided');
}
</script>

<style scoped>
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
  max-width: 500px;
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

.modal-body p {
  color: #e5e7eb;
  margin-bottom: 1rem;
}

.suggestion-title {
  font-weight: 600;
  color: #fbbf24;
}

.form-group {
  margin-top: 1rem;
}

.form-group label {
  display: block;
  color: #e5e7eb;
  margin-bottom: 0.5rem;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  background: #1a1a2e;
  border: 1px solid #374151;
  border-radius: 4px;
  color: #e5e7eb;
  font-family: inherit;
}

.form-control:focus {
  outline: none;
  border-color: #6366f1;
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

.btn-danger {
  background: #ef4444;
  color: white;
}
</style>

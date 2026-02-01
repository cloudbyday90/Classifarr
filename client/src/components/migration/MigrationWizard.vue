<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
-->

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal migration-wizard">
      <!-- Notification toast -->
      <div v-if="notification" class="notification-toast" :class="notification.type">
        <span class="notification-message">{{ notification.message }}</span>
        <button @click="dismissNotification" class="notification-close">×</button>
      </div>

      <div class="modal-header">
        <h2>Migration Wizard - {{ library.library_name }}</h2>
        <button @click="$emit('close')" class="btn-close">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="loading" class="loading">Loading rules...</div>
        
        <!-- Rule list -->
        <div v-else class="rules-list">
          <div v-for="rule in rules" :key="rule.id" class="rule-item" :class="{ migrated: rule.migrated_at }">
            <div class="rule-header">
              <h4>{{ rule.name }}</h4>
              <span v-if="rule.migrated_at" class="migrated-badge">✓ Migrated</span>
            </div>
            
            <div v-if="rule.description" class="rule-description">
              {{ rule.description }}
            </div>
            
            <div v-if="!rule.migrated_at" class="rule-analysis">
              <!-- Loading state -->
              <div v-if="analyzing === rule.id" class="analyzing">
                <span class="spinner">⏳</span> Analyzing rule...
              </div>
              
              <!-- Suggestions -->
              <div v-else-if="analyses[rule.id]" class="suggestions">
                <h5>Suggested Migrations:</h5>
                <div 
                  v-for="(suggestion, idx) in analyses[rule.id].suggestions" 
                  :key="idx" 
                  class="suggestion" 
                  :class="{ selected: selectedSuggestions[rule.id] === idx }"
                  @click="selectSuggestion(rule.id, idx)"
                >
                  <div class="suggestion-header">
                    <span class="suggestion-type" :class="suggestion.type">
                      {{ suggestion.type === 'preset' ? '📦 Preset' : '⚙️ Override' }}
                    </span>
                    <span class="suggestion-name">
                      {{ suggestion.preset_name || 'Custom Policy Override' }}
                    </span>
                    <span class="confidence" :class="getConfidenceClass(suggestion.confidence)">
                      {{ suggestion.confidence.toFixed(0) }}% match
                    </span>
                  </div>
                  <p class="suggestion-reason">{{ suggestion.reason }}</p>
                  <button 
                    v-if="selectedSuggestions[rule.id] === idx" 
                    @click.stop="migrateRule(rule.id, suggestion)"
                    class="btn btn-migrate"
                    :disabled="migrating === rule.id"
                  >
                    {{ migrating === rule.id ? 'Migrating...' : 'Migrate with This' }}
                  </button>
                </div>
              </div>
              
              <!-- Analyze button -->
              <button v-else @click="analyzeRule(rule)" class="btn btn-analyze">
                Analyze Rule
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-secondary">Close</button>
        <button 
          @click="migrateSelected" 
          class="btn btn-primary" 
          :disabled="!hasSelections || migrating"
        >
          Migrate Selected ({{ selectedCount }})
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MigrationWizard',
  props: {
    library: {
      type: Object,
      required: true,
    },
  },
  emits: ['close', 'migrated'],
  data() {
    return {
      rules: [],
      analyses: {},
      selectedSuggestions: {},
      analyzing: null,
      migrating: null,
      loading: true,
      notification: null, // For displaying notifications
      notificationTimeout: null, // Store timeout ID to prevent race conditions
    };
  },
  computed: {
    hasSelections() {
      return Object.keys(this.selectedSuggestions).length > 0;
    },
    selectedCount() {
      return Object.keys(this.selectedSuggestions).length;
    },
  },
  async mounted() {
    await this.loadRules();
  },
  methods: {
    async loadRules() {
      this.loading = true;
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch(`/api/migration/libraries/${this.library.library_id}/rules`, { headers });
        
        if (!response.ok) {
          throw new Error(`Failed to load rules: ${response.status} ${response.statusText}`);
        }
        
        this.rules = await response.json();
      } catch (error) {
        console.error('Failed to load rules:', error);
        this.showNotification('error', 'Failed to load rules. Please try again.');
      } finally {
        this.loading = false;
      }
    },
    async analyzeRule(rule) {
      this.analyzing = rule.id;
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch(`/api/migration/rules/${rule.id}/analyze`, { headers });
        
        if (!response.ok) {
          throw new Error(`Failed to analyze rule: ${response.status} ${response.statusText}`);
        }
        
        const analysis = await response.json();
        
        this.analyses = { ...this.analyses, [rule.id]: analysis };
        
        // Auto-select first suggestion
        if (analysis.suggestions.length > 0) {
          this.selectedSuggestions = { ...this.selectedSuggestions, [rule.id]: 0 };
        }
      } catch (error) {
        console.error('Failed to analyze rule:', error);
        this.showNotification('error', 'Failed to analyze rule. Please try again.');
      } finally {
        this.analyzing = null;
      }
    },
    selectSuggestion(ruleId, suggestionIndex) {
      this.selectedSuggestions = { ...this.selectedSuggestions, [ruleId]: suggestionIndex };
    },
    async migrateRule(ruleId, suggestion) {
      this.migrating = ruleId;
      try {
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };

        const response = await fetch(`/api/migration/rules/${ruleId}/migrate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ migrationChoice: suggestion }),
        });

        if (response.ok) {
          // Remove from selectedSuggestions
          const { [ruleId]: _, ...rest } = this.selectedSuggestions;
          this.selectedSuggestions = rest;
          
          // Mark rule as migrated
          const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
          if (ruleIndex !== -1) {
            this.rules[ruleIndex].migrated_at = new Date().toISOString();
          }
          
          this.$emit('migrated');
        } else {
          throw new Error('Migration failed');
        }
      } catch (error) {
        console.error('Failed to migrate rule:', error);
        this.showNotification('error', 'Migration failed. Please try again.');
      } finally {
        this.migrating = null;
      }
    },
    async migrateSelected() {
      const rulesToMigrate = Object.entries(this.selectedSuggestions);
      let successCount = 0;
      let failCount = 0;
      
      for (const [ruleId, suggestionIndex] of rulesToMigrate) {
        const analysis = this.analyses[ruleId];
        if (analysis && analysis.suggestions[suggestionIndex]) {
          try {
            await this.migrateRule(parseInt(ruleId, 10), analysis.suggestions[suggestionIndex]);
            successCount++;
          } catch (error) {
            failCount++;
          }
        }
      }
      
      // Show summary notification after all migrations complete
      const total = rulesToMigrate.length;
      if (total > 0) {
        if (failCount === 0) {
          this.showNotification('success', `Successfully migrated ${successCount} rule${successCount === 1 ? '' : 's'}.`);
        } else if (successCount === 0) {
          this.showNotification('error', `Failed to migrate ${failCount} rule${failCount === 1 ? '' : 's'}.`);
        } else {
          this.showNotification('warning', `Migrated ${successCount} rule${successCount === 1 ? '' : 's'}, ${failCount} failed.`);
        }
      }
    },
    getConfidenceClass(confidence) {
      if (confidence >= 80) return 'high';
      if (confidence >= 50) return 'medium';
      return 'low';
    },
    showNotification(type, message) {
      // Clear any existing timeout to prevent race conditions
      if (this.notificationTimeout) {
        clearTimeout(this.notificationTimeout);
      }
      
      this.notification = { type, message };
      
      // Auto-dismiss after 5 seconds
      this.notificationTimeout = setTimeout(() => {
        this.notification = null;
        this.notificationTimeout = null;
      }, 5000);
    },
    dismissNotification() {
      if (this.notificationTimeout) {
        clearTimeout(this.notificationTimeout);
        this.notificationTimeout = null;
      }
      this.notification = null;
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-background, #ffffff);
  border-radius: 16px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  position: relative;
}

.notification-toast {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 1001;
  animation: slideIn 0.3s ease;
  min-width: 250px;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.notification-toast.success {
  background-color: #4caf50;
  color: white;
}

.notification-toast.error {
  background-color: #f44336;
  color: white;
}

.notification-toast.warning {
  background-color: #ff9800;
  color: white;
}

.notification-message {
  flex: 1;
  font-size: 0.9rem;
}

.notification-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.notification-close:hover {
  opacity: 1;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.btn-close:hover {
  background-color: var(--color-background-hover, #f5f5f5);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.loading, .analyzing {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary);
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.rule-item {
  padding: 1.5rem;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 12px;
  background: var(--color-background-card, #ffffff);
}

.rule-item.migrated {
  opacity: 0.6;
  background: var(--color-success-light, #e8f5e9);
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.rule-header h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.migrated-badge {
  background-color: var(--color-success, #4caf50);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.rule-description {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.rule-analysis {
  margin-top: 1rem;
}

.suggestions h5 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.75rem 0;
}

.suggestion {
  padding: 1rem;
  border: 2px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.suggestion:hover {
  border-color: var(--color-primary, #2196f3);
  background-color: var(--color-primary-light, #e3f2fd);
}

.suggestion.selected {
  border-color: var(--color-primary, #2196f3);
  background-color: var(--color-primary-light, #e3f2fd);
}

.suggestion-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.suggestion-type {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.suggestion-type.preset {
  background-color: #e3f2fd;
  color: #1976d2;
}

.suggestion-type.override {
  background-color: #fff3e0;
  color: #f57c00;
}

.suggestion-name {
  flex: 1;
  font-weight: 500;
  color: var(--color-text);
}

.confidence {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.confidence.high {
  background-color: #c8e6c9;
  color: #2e7d32;
}

.confidence.medium {
  background-color: #fff9c4;
  color: #f57f17;
}

.confidence.low {
  background-color: #ffccbc;
  color: #d84315;
}

.suggestion-reason {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-analyze {
  background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
  color: white;
}

.btn-analyze:hover:not(:disabled) {
  background: linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%);
}

.btn-migrate {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
  margin-top: 0.5rem;
}

.btn-migrate:hover:not(:disabled) {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--color-border, #e0e0e0);
}

.btn-secondary {
  background-color: var(--color-background-hover, #f5f5f5);
  color: var(--color-text);
}

.btn-secondary:hover {
  background-color: var(--color-border, #e0e0e0);
}

.btn-primary {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .modal {
    background: var(--color-background, #1e1e1e);
  }

  .rule-item {
    background: var(--color-background-card, #2d2d2d);
  }

  .rule-item.migrated {
    background: rgba(76, 175, 80, 0.2);
  }

  .suggestion:hover,
  .suggestion.selected {
    background-color: rgba(33, 150, 243, 0.2);
  }

  .btn-secondary {
    background-color: #3a3a3a;
  }

  .btn-secondary:hover {
    background-color: #4a4a4a;
  }
}
</style>

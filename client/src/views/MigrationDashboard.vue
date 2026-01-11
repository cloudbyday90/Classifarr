<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
-->

<template>
  <div class="migration-dashboard">
    <!-- Notification toast -->
    <div v-if="notification" class="notification-toast" :class="notification.type">
      <span class="notification-message">{{ notification.message }}</span>
      <button @click="dismissNotification" class="notification-close">×</button>
    </div>

    <div class="header">
      <h1>Legacy Rule Migration</h1>
      <div v-if="migrationStatus" class="status-badge" :class="statusClass">
        {{ migrationStatus.pending }} rules pending migration
      </div>
    </div>
    
    <!-- Deprecation notice -->
    <div class="deprecation-notice">
      <span class="icon">⚠️</span>
      <div class="notice-content">
        <strong>Legacy rules are deprecated</strong>
        <p>Custom rules will be removed in v0.39. Please migrate to the new policy system.</p>
        <p class="timeline">
          <strong>Timeline:</strong> v0.37 (current) → v0.38 (warnings) → v0.39 (removal)
        </p>
      </div>
    </div>
    
    <!-- Migration progress -->
    <div v-if="migrationStatus" class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <span class="progress-text">
        {{ migrationStatus.migrated }} / {{ migrationStatus.total }} rules migrated ({{ progressPercent.toFixed(0) }}%)
      </span>
    </div>
    
    <!-- Libraries with legacy rules -->
    <div class="libraries-section">
      <h2>Libraries with Legacy Rules</h2>
      <div v-if="loading" class="loading">Loading libraries...</div>
      <div v-else-if="librariesWithRules.length === 0" class="empty-state">
        <p>✅ No libraries with legacy rules found. All rules have been migrated!</p>
      </div>
      <div v-else class="library-cards">
        <MigrationLibraryCard
          v-for="library in librariesWithRules"
          :key="library.library_id"
          :library="library"
          @migrate="openMigrationWizard"
          @migrate-all="migrateAllRules"
        />
      </div>
    </div>
    
    <!-- Migration wizard modal -->
    <MigrationWizard
      v-if="wizardLibrary"
      :library="wizardLibrary"
      @close="wizardLibrary = null"
      @migrated="onRuleMigrated"
    />
  </div>
</template>

<script>
import MigrationLibraryCard from '@/components/migration/MigrationLibraryCard.vue';
import MigrationWizard from '@/components/migration/MigrationWizard.vue';

export default {
  name: 'MigrationDashboard',
  components: {
    MigrationLibraryCard,
    MigrationWizard,
  },
  data() {
    return {
      migrationStatus: null,
      librariesWithRules: [],
      wizardLibrary: null,
      loading: true,
      notification: null, // For displaying notifications
      notificationTimeout: null, // Store timeout ID to prevent race conditions
    };
  },
  computed: {
    progressPercent() {
      if (!this.migrationStatus || this.migrationStatus.total === 0) return 0;
      return (parseInt(this.migrationStatus.migrated) / parseInt(this.migrationStatus.total)) * 100;
    },
    statusClass() {
      if (!this.migrationStatus) return '';
      const pending = parseInt(this.migrationStatus.pending);
      if (pending === 0) return 'success';
      if (pending < 5) return 'warning';
      return 'error';
    },
  },
  async mounted() {
    await this.loadData();
  },
  methods: {
    async loadData() {
      this.loading = true;
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const [statusRes, librariesRes] = await Promise.all([
          fetch('/api/migration/status', { headers }),
          fetch('/api/migration/libraries', { headers }),
        ]);

        if (!statusRes.ok) {
          throw new Error(`Failed to fetch migration status: ${statusRes.status} ${statusRes.statusText}`);
        }

        if (!librariesRes.ok) {
          throw new Error(`Failed to fetch migration libraries: ${librariesRes.status} ${librariesRes.statusText}`);
        }

        this.migrationStatus = await statusRes.json();
        this.librariesWithRules = await librariesRes.json();
      } catch (error) {
        console.error('Failed to load migration data:', error);
        this.showNotification('error', 'Failed to load migration data. Please try again.');
      } finally {
        this.loading = false;
      }
    },
    openMigrationWizard(library) {
      this.wizardLibrary = library;
    },
    async migrateAllRules(library) {
      if (!confirm(`Auto-migrate all ${library.rule_count} rules in "${library.library_name}"? This will use the top suggestion for each rule.`)) {
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };

        const response = await fetch(`/api/migration/libraries/${library.library_id}/migrate-all`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ autoSuggest: true }),
        });

        if (!response.ok) {
          let errorMessage = 'Migration request failed.';
          try {
            const errorBody = await response.json();
            if (errorBody && errorBody.error) {
              errorMessage = errorBody.error;
            }
          } catch (_) {
            // Ignore JSON parse errors
          }
          throw new Error(errorMessage);
        }

        const results = await response.json();
        const successCount = results.filter(r => r.migrated).length;
        
        // Show success notification
        this.showNotification('success', `Migration complete! ${successCount} of ${results.length} rules migrated successfully.`);
        await this.loadData();
      } catch (error) {
        console.error('Failed to migrate library:', error);
        this.showNotification('error', error.message || 'Migration failed. Please try again.');
      }
    },
    async onRuleMigrated() {
      await this.loadData();
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
.migration-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  position: relative;
}

.notification-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 1000;
  animation: slideIn 0.3s ease;
  min-width: 300px;
  max-width: 500px;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
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

.notification-message {
  flex: 1;
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

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-text);
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.9rem;
}

.status-badge.success {
  background-color: var(--color-success-light, #d4edda);
  color: var(--color-success, #155724);
}

.status-badge.warning {
  background-color: var(--color-warning-light, #fff3cd);
  color: var(--color-warning, #856404);
}

.status-badge.error {
  background-color: var(--color-error-light, #f8d7da);
  color: var(--color-error, #721c24);
}

.deprecation-notice {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #fff3cd 0%, #ffe6a3 100%);
  border-left: 4px solid #ffc107;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.deprecation-notice .icon {
  font-size: 2rem;
}

.notice-content {
  flex: 1;
}

.notice-content strong {
  font-size: 1.1rem;
  color: #856404;
  display: block;
  margin-bottom: 0.5rem;
}

.notice-content p {
  margin: 0.5rem 0 0 0;
  color: #856404;
}

.notice-content .timeline {
  font-size: 0.9rem;
  margin-top: 0.75rem;
}

.progress-section {
  margin-bottom: 2rem;
}

.progress-bar {
  width: 100%;
  height: 24px;
  background-color: #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50 0%, #66bb6a 100%);
  transition: width 0.3s ease;
}

.progress-text {
  display: block;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.libraries-section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--color-text);
}

.loading, .empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-secondary);
}

.empty-state {
  font-size: 1.1rem;
}

.library-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .deprecation-notice {
    background: linear-gradient(135deg, #4a3800 0%, #5a4200 100%);
    border-left-color: #ffc107;
  }

  .deprecation-notice .notice-content strong,
  .deprecation-notice .notice-content p {
    color: #ffd54f;
  }

  .progress-bar {
    background-color: #2d3748;
  }
}
</style>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
-->

<template>
  <div class="migration-library-card">
    <div class="card-header">
      <h3>{{ library.library_name }}</h3>
      <span class="rule-count">{{ library.rule_count }} rules</span>
    </div>
    
    <div class="card-actions">
      <button @click="$emit('migrate', library)" class="btn btn-primary">
        <span class="icon">🔧</span>
        Migration Wizard
      </button>
      <button @click="$emit('migrate-all', library)" class="btn btn-secondary">
        <span class="icon">⚡</span>
        Auto-Migrate All
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MigrationLibraryCard',
  props: {
    library: {
      type: Object,
      required: true,
    },
  },
  emits: ['migrate', 'migrate-all'],
};
</script>

<style scoped>
.migration-library-card {
  background: var(--color-background-card, #ffffff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.migration-library-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--color-primary, #2196f3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.card-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.rule-count {
  background-color: var(--color-primary-light, #e3f2fd);
  color: var(--color-primary, #2196f3);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  flex: 1;
  min-width: 140px;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.btn .icon {
  font-size: 1rem;
}

.btn-primary {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(33, 150, 243, 0.3);
}

.btn-secondary {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
}

.btn-secondary:hover {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
}

.btn:active {
  transform: translateY(0);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .migration-library-card {
    background: var(--color-background-card, #1e1e1e);
    border-color: var(--color-border, #3a3a3a);
  }

  .rule-count {
    background-color: rgba(33, 150, 243, 0.2);
    color: #64b5f6;
  }
}
</style>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
-->

<template>
  <div v-if="hasLegacyRules" class="legacy-warning">
    <span class="icon">⚠️</span>
    <span class="message">
      This library has {{ ruleCount }} legacy {{ ruleCount === 1 ? 'rule' : 'rules' }} that should be migrated.
    </span>
    <router-link to="/migration" class="btn btn-migrate">Migrate Now</router-link>
  </div>
</template>

<script>
import api from '@/api'

export default {
  name: 'LegacyRuleWarning',
  props: {
    libraryId: {
      type: [Number, String],
      required: true,
    },
  },
  data() {
    return {
      ruleCount: 0,
    };
  },
  computed: {
    hasLegacyRules() {
      return this.ruleCount > 0;
    },
  },
  async mounted() {
    await this.checkLegacyRules();
  },
  methods: {
    async checkLegacyRules() {
      try {
        const rules = await api.getLibraryMigrationRules(this.libraryId);
        this.ruleCount = Array.isArray(rules) ? rules.length : 0;
      } catch (error) {
        console.error('Failed to check legacy rules:', error);
        this.ruleCount = 0;
      }
    },
  },
};
</script>

<style scoped>
.legacy-warning {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #fff3cd 0%, #ffe6a3 100%);
  border-left: 4px solid #ffc107;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.icon {
  font-size: 1.5rem;
}

.message {
  flex: 1;
  color: #856404;
  font-weight: 500;
}

.btn-migrate {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-migrate:hover {
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 152, 0, 0.3);
}

.btn-migrate:active {
  transform: translateY(0);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .legacy-warning {
    background: linear-gradient(135deg, #4a3800 0%, #5a4200 100%);
  }

  .message {
    color: #ffd54f;
  }
}
</style>

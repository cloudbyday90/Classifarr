<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  Licensed under GPL-3.0
-->

<template>
  <div class="policy-stats-card" @click="$emit('view-details', policy)">
    <div class="card-header">
      <h3>{{ policy.name }}</h3>
      <span class="trend-badge" :class="policy.trend || 'stable'">
        {{ policy.trend || 'stable' }}
      </span>
    </div>

    <div class="library-name">{{ policy.library_name }}</div>

    <div class="stats-grid">
      <div class="stat">
        <span class="label">Decisions</span>
        <span class="value">{{ policy.total_decisions || 0 }}</span>
      </div>
      <div class="stat">
        <span class="label">Accuracy</span>
        <span class="value" :class="getAccuracyClass(policy.accuracy_rate)">
          {{ formatPercent(policy.accuracy_rate) }}
        </span>
      </div>
      <div class="stat">
        <span class="label">Auto Rate</span>
        <span class="value">{{ formatAutoRate(policy) }}</span>
      </div>
      <div class="stat">
        <span class="label">7-Day Accuracy</span>
        <span class="value">{{ formatPercent(policy.last_7_days_accuracy) }}</span>
      </div>
    </div>

    <div v-if="policy.last_decision_at" class="last-activity">
      Last activity: {{ formatTime(policy.last_decision_at) }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'PolicyStatsCard',
  props: {
    policy: {
      type: Object,
      required: true
    }
  },
  emits: ['view-details'],
  methods: {
    formatPercent(value) {
      if (value === null || value === undefined) return 'N/A';
      return `${(value * 100).toFixed(1)}%`;
    },
    formatAutoRate(policy) {
      if (!policy.total_decisions || policy.total_decisions === 0) return 'N/A';
      const rate = (policy.auto_classified || 0) / policy.total_decisions;
      return `${(rate * 100).toFixed(1)}%`;
    },
    getAccuracyClass(accuracy) {
      if (!accuracy) return '';
      if (accuracy >= 0.9) return 'high';
      if (accuracy >= 0.7) return 'medium';
      return 'low';
    },
    formatTime(timestamp) {
      if (!timestamp) return 'Never';
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    }
  }
};
</script>

<style scoped>
.policy-stats-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.policy-stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  color: #1f2937;
  font-weight: 600;
}

.trend-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  text-transform: capitalize;
  font-weight: 500;
}

.trend-badge.improving {
  background: #d1fae5;
  color: #065f46;
}

.trend-badge.declining {
  background: #fee2e2;
  color: #991b1b;
}

.trend-badge.stable {
  background: #e5e7eb;
  color: #374151;
}

.library-name {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat .label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat .value {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.stat .value.high {
  color: #10b981;
}

.stat .value.medium {
  color: #f59e0b;
}

.stat .value.low {
  color: #ef4444;
}

.last-activity {
  font-size: 12px;
  color: #9ca3af;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}
</style>

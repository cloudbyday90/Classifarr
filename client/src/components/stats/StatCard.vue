<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  Licensed under GPL-3.0
-->

<template>
  <div
    class="stat-card"
    :class="variant"
  >
    <div class="stat-icon">
      {{ icon }}
    </div>
    <div class="stat-content">
      <span class="stat-value">{{ value }}</span>
      <span class="stat-title">{{ title }}</span>
    </div>
    <div
      v-if="trend"
      class="stat-trend"
      :class="trend"
    >
      <span v-if="trend === 'improving'">↑</span>
      <span v-else-if="trend === 'declining'">↓</span>
      <span v-else>→</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StatCard',
  props: {
    title: {
      type: String,
      required: true
    },
    value: {
      type: [String, Number],
      required: true
    },
    icon: {
      type: String,
      default: '📊'
    },
    trend: {
      type: String,
      default: null,
      validator: (value) => ['improving', 'declining', 'stable', null].includes(value)
    },
    variant: {
      type: String,
      default: 'default',
      validator: (value) => ['default', 'success', 'warning', 'error'].includes(value)
    }
  }
};
</script>

<style scoped>
.stat-card {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: transform 0.2s, border-color 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: #4b5563;
}

.stat-card.success {
  border-left: 4px solid #10b981;
}

.stat-card.warning {
  border-left: 4px solid #f59e0b;
}

.stat-card.error {
  border-left: 4px solid #ef4444;
}

.stat-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #f9fafb;
}

.stat-title {
  font-size: 14px;
  color: #9ca3af;
}

.stat-trend {
  font-size: 24px;
  flex-shrink: 0;
}

.stat-trend.improving {
  color: #10b981;
}

.stat-trend.declining {
  color: #ef4444;
}

.stat-trend.stable {
  color: #6b7280;
}
</style>

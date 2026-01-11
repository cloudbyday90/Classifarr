<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  Licensed under GPL-3.0
-->

<template>
  <div v-if="alerts.length > 0" class="alerts-banner">
    <div v-for="alert in alerts" :key="`${alert.policy_id}-${alert.type}`" 
         class="alert" :class="alert.severity">
      <span class="alert-icon">
        {{ alert.severity === 'warning' ? '⚠️' : 'ℹ️' }}
      </span>
      <span class="alert-message">{{ alert.message }}</span>
      <button @click="$emit('dismiss', alert)" class="alert-dismiss">×</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AlertsBanner',
  props: {
    alerts: {
      type: Array,
      default: () => []
    }
  },
  emits: ['dismiss']
};
</script>

<style scoped>
.alerts-banner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
}

.alert.warning {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  color: #92400e;
}

.alert.info {
  background: #dbeafe;
  border: 1px solid #60a5fa;
  color: #1e40af;
}

.alert-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.alert-message {
  flex: 1;
}

.alert-dismiss {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.alert-dismiss:hover {
  opacity: 1;
}
</style>

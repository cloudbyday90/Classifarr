<template>
  <div :class="['connection-status', `status-${status}`]">
    <!-- Idle State -->
    <div v-if="status === 'idle'" class="status-idle">
      <div class="status-icon">○</div>
      <div class="status-content">
        <span class="status-title">Not Connected</span>
        <span class="status-hint">Click "Test Connection" to verify your settings</span>
      </div>
    </div>

    <!-- Testing State -->
    <div v-else-if="status === 'testing'" class="status-testing">
      <div class="status-icon spinning">🔄</div>
      <div class="status-content">
        <span class="status-title">Testing Connection...</span>
        <div class="progress-bar">
          <div class="progress-bar-fill"></div>
        </div>
        <span class="status-hint">Connecting to {{ serviceName }}</span>
      </div>
    </div>

    <!-- Success State -->
    <div v-else-if="status === 'success'" class="status-success">
      <div class="status-header">
        <div class="status-icon">✅</div>
        <span class="status-title">Connected Successfully</span>
      </div>
      <div class="status-details" v-if="details">
        <div class="detail-row" v-if="details.serverName">
          <span class="detail-label">Server:</span>
          <span class="detail-value">{{ details.serverName }}</span>
        </div>
        <div class="detail-row" v-if="details.version">
          <span class="detail-label">Version:</span>
          <span class="detail-value">{{ details.version }}</span>
        </div>
        <div class="detail-row" v-if="details.status">
          <span class="detail-label">Status:</span>
          <span class="detail-value status-badge success">{{ details.status }}</span>
        </div>
        <div class="detail-row" v-for="(value, key) in details.additionalInfo" :key="key">
          <span class="detail-label">{{ formatLabel(key) }}:</span>
          <span class="detail-value">{{ value }}</span>
        </div>
      </div>
      <div class="status-footer" v-if="lastChecked">
        Last checked: {{ formatTime(lastChecked) }}
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="status === 'error'" class="status-error">
      <div class="status-header">
        <div class="status-icon">❌</div>
        <span class="status-title">Connection Failed</span>
      </div>
      <div class="error-message" v-if="error">
        <code>{{ error.code ? `${error.code}: ` : '' }}{{ error.message }}</code>
      </div>
      <div class="troubleshooting" v-if="error?.troubleshooting?.length">
        <span class="troubleshooting-title">💡 Troubleshooting:</span>
        <ul>
          <li v-for="tip in error.troubleshooting" :key="tip">{{ tip }}</li>
        </ul>
      </div>
      <div class="status-footer" v-if="lastChecked">
        Last attempt: {{ formatTime(lastChecked) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'testing', 'success', 'error'].includes(v)
  },
  serviceName: {
    type: String,
    default: 'Service'
  },
  details: {
    type: Object,
    default: null
  },
  error: {
    type: Object,
    default: null
  },
  lastChecked: {
    type: Date,
    default: null
  }
})

const formatLabel = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
}

const formatTime = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000)
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return `${seconds} seconds ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  return date.toLocaleTimeString()
}
</script>

<style scoped>
.connection-status {
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
}

.status-idle {
  background: var(--color-card, #242731);
  border: 1px dashed var(--color-border, #374151);
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-testing {
  background: var(--color-card, #242731);
  border: 1px solid var(--color-primary, #3b82f6);
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid var(--color-success, #22c55e);
}

.status-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error, #ef4444);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.status-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.status-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.status-title {
  font-weight: 600;
  font-size: 1rem;
}

.status-hint {
  color: var(--color-muted, #9ca3af);
  font-size: 0.875rem;
}

.status-details {
  display: grid;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid rgba(255,255,255,0.1);
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin: 12px 0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
}

.detail-label {
  color: var(--color-muted, #9ca3af);
}

.detail-value {
  font-weight: 500;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
}

.status-badge.success {
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success, #22c55e);
}

.error-message {
  background: rgba(0,0,0,0.2);
  padding: 8px 12px;
  border-radius: 4px;
  margin: 8px 0;
}

.error-message code {
  color: var(--color-error, #ef4444);
  font-family: monospace;
}

.troubleshooting {
  margin-top: 12px;
}

.troubleshooting-title {
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.troubleshooting ul {
  margin: 0;
  padding-left: 20px;
}

.troubleshooting li {
  color: var(--color-muted, #9ca3af);
  font-size: 0.875rem;
  margin: 4px 0;
}

.status-footer {
  color: var(--color-muted, #9ca3af);
  font-size: 0.75rem;
  margin-top: 12px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  margin: 8px 0;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--color-primary, #3b82f6);
  width: 30%;
  animation: progress 1.5s ease-in-out infinite;
}

@keyframes progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
</style>

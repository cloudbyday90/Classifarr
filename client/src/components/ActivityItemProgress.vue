<template>
  <div v-if="showProgress" class="activity-item-progress">
    <div class="progress-header">
      <span class="current-phase" :class="`phase-${currentPhase}`">
        <span class="phase-icon">{{ getPhaseIcon(currentPhase) }}</span>
        {{ getPhaseLabel(currentPhase) }}
      </span>
      <span class="progress-percent">{{ progress }}%</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill"
        :class="`phase-${currentPhase}`"
        :style="{ width: progress + '%' }"
      ></div>
    </div>
    <div v-if="showPhaseDetails" class="phase-timeline">
      <div
        v-for="(phase, index) in phases"
        :key="phase.id"
        class="phase-item"
        :class="{
          'phase-active': phase.id === currentPhase,
          'phase-completed': isPhaseCompleted(phase.id),
          'phase-pending': isPhasePending(phase.id)
        }"
      >
        <div class="phase-dot"></div>
        <div class="phase-label">{{ phase.label }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ActivityItemProgress',
  props: {
    progress: {
      type: Number,
      default: 0
    },
    currentPhase: {
      type: String,
      default: 'queued'
    },
    showPhaseDetails: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      phases: [
        { id: 'queued', label: 'Queued' },
        { id: 'metadata_fetch', label: 'Metadata Fetch' },
        { id: 'policy_evaluation', label: 'Policy Evaluation' },
        { id: 'rag_analysis', label: 'RAG Analysis' },
        { id: 'signal_combination', label: 'Signal Combination' },
        { id: 'decision', label: 'Decision' },
        { id: 'notification', label: 'Notification' }
      ],
      phaseOrder: ['queued', 'metadata_fetch', 'policy_evaluation', 'rag_analysis', 'signal_combination', 'decision', 'notification']
    }
  },
  computed: {
    showProgress() {
      return this.progress > 0 && this.progress < 100
    }
  },
  methods: {
    getPhaseLabel(phase) {
      const labels = {
        queued: 'Queued',
        metadata_fetch: 'Fetching Metadata',
        policy_evaluation: 'Evaluating Policies',
        rag_analysis: 'Analyzing with RAG',
        signal_combination: 'Combining Signals',
        decision: 'Making Decision',
        notification: 'Sending Notification'
      }
      return labels[phase] || phase
    },
    getPhaseIcon(phase) {
      const icons = {
        queued: '⏳',
        metadata_fetch: '📊',
        policy_evaluation: '📋',
        rag_analysis: '🔍',
        signal_combination: '🔀',
        decision: '✅',
        notification: '📢'
      }
      return icons[phase] || '•'
    },
    isPhaseCompleted(phaseId) {
      const currentIndex = this.phaseOrder.indexOf(this.currentPhase)
      const phaseIndex = this.phaseOrder.indexOf(phaseId)
      return phaseIndex < currentIndex
    },
    isPhasePending(phaseId) {
      const currentIndex = this.phaseOrder.indexOf(this.currentPhase)
      const phaseIndex = this.phaseOrder.indexOf(phaseId)
      return phaseIndex > currentIndex
    }
  }
}
</script>

<style scoped>
.activity-item-progress {
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  margin-top: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.current-phase {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.phase-icon {
  font-size: 14px;
}

.phase-queued { color: #64748b; }
.phase-metadata_fetch { color: #3b82f6; }
.phase-policy_evaluation { color: #8b5cf6; }
.phase-rag_analysis { color: #ec4899; }
.phase-signal_combination { color: #f97316; }
.phase-decision { color: #22c55e; }
.phase-notification { color: #eab308; }

.progress-percent {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.progress-bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease-out, background-color 0.3s ease-out;
}

.progress-fill.phase-queued { background: #94a3b8; }
.progress-fill.phase-metadata_fetch { background: #3b82f6; }
.progress-fill.phase-policy_evaluation { background: #8b5cf6; }
.progress-fill.phase-rag_analysis { background: #ec4899; }
.progress-fill.phase-signal_combination { background: #f97316; }
.progress-fill.phase-decision { background: #22c55e; }
.progress-fill.phase-notification { background: #eab308; }

.phase-timeline {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.phase-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
}

.phase-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 6px;
  left: 50%;
  width: calc(100% - 12px);
  height: 2px;
  background: #e2e8f0;
}

.phase-item.phase-completed:not(:last-child)::after {
  background: #22c55e;
}

.phase-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e2e8f0;
  border: 2px solid #cbd5e1;
  z-index: 1;
  transition: all 0.3s ease-out;
}

.phase-item.phase-completed .phase-dot {
  background: #22c55e;
  border-color: #22c55e;
}

.phase-item.phase-active .phase-dot {
  background: #3b82f6;
  border-color: #3b82f6;
  animation: pulse 1.5s ease-in-out infinite;
}

.phase-item.phase-pending .phase-dot {
  background: #f1f5f9;
  border-color: #e2e8f0;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

.phase-label {
  font-size: 9px;
  color: #94a3b8;
  margin-top: 4px;
  text-align: center;
  line-height: 1.1;
}

.phase-item.phase-completed .phase-label {
  color: #22c55e;
}

.phase-item.phase-active .phase-label {
  color: #3b82f6;
  font-weight: 600;
}
</style>

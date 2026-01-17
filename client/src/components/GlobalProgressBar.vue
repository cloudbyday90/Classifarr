<template>
  <div v-if="showBar" class="global-progress-bar">
    <div class="progress-container">
      <div class="progress-info">
        <span class="progress-label">
          {{ activeCount }} {{ activeCount === 1 ? 'classification' : 'classifications' }} in progress
        </span>
        <span class="progress-percent">{{ overallProgress }}%</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: overallProgress + '%' }"
        ></div>
      </div>
      <div class="phase-badges">
        <span
          v-for="count in phaseCounts"
          :key="count.phase"
          class="phase-badge"
          :class="`phase-${count.phase}`"
        >
          {{ getPhaseLabel(count.phase) }}: {{ count.count }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GlobalProgressBar',
  props: {
    activeClassifications: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    showBar() {
      return this.activeClassifications.length > 0
    },
    activeCount() {
      return this.activeClassifications.length
    },
    overallProgress() {
      if (this.activeClassifications.length === 0) return 0
      const totalProgress = this.activeClassifications.reduce((sum, item) => sum + (item.progress || 0), 0)
      return Math.round(totalProgress / this.activeClassifications.length)
    },
    phaseCounts() {
      const counts = {}
      const phases = ['queued', 'metadata_fetch', 'policy_evaluation', 'rag_analysis', 'signal_combination', 'decision', 'notification']
      phases.forEach(phase => {
        counts[phase] = 0
      })
      this.activeClassifications.forEach(item => {
        if (item.current_phase && counts[item.current_phase] !== undefined) {
          counts[item.current_phase]++
        }
      })
      return Object.entries(counts)
        .filter(([_, count]) => count > 0)
        .map(([phase, count]) => ({ phase, count }))
    }
  },
  methods: {
    getPhaseLabel(phase) {
      const labels = {
        queued: 'Queued',
        metadata_fetch: 'Metadata',
        policy_evaluation: 'Policy',
        rag_analysis: 'RAG',
        signal_combination: 'Combine',
        decision: 'Decision',
        notification: 'Notify'
      }
      return labels[phase] || phase
    }
  }
}
</script>

<style scoped>
.global-progress-bar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 16px 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.progress-container {
  max-width: 1200px;
  margin: 0 auto;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.progress-percent {
  color: white;
  font-weight: 700;
  font-size: 16px;
}

.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
  border-radius: 4px;
  transition: width 0.3s ease-out;
}

.phase-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.phase-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  backdrop-filter: blur(10px);
}

.phase-queued {
  background: rgba(156, 163, 175, 0.3);
}

.phase-metadata_fetch {
  background: rgba(59, 130, 246, 0.3);
}

.phase-policy_evaluation {
  background: rgba(139, 92, 246, 0.3);
}

.phase-rag_analysis {
  background: rgba(236, 72, 153, 0.3);
}

.phase-signal_combination {
  background: rgba(249, 115, 22, 0.3);
}

.phase-decision {
  background: rgba(34, 197, 94, 0.3);
}

.phase-notification {
  background: rgba(234, 179, 8, 0.3);
}
</style>

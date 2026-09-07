<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  Licensed under GPL-3.0
-->

<template>
  <div
    class="modal-overlay"
    @click.self="$emit('close')"
  >
    <div class="modal stats-modal">
      <div class="modal-header">
        <h2>{{ policy.name }} - Statistics</h2>
        <button
          class="btn-close"
          aria-label="Close modal"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        <p class="scope-description">
          Totals and accuracy use all retained feedback for this policy.
        </p>
        <FeedbackEvaluationCoverage :stats="stats" />
        <!-- Key metrics -->
        <div class="metrics-row">
          <div class="metric-box">
            <span class="metric-value">{{ stats.total_decisions || 0 }}</span>
            <span class="metric-label">Total Decisions</span>
          </div>
          <div class="metric-box">
            <span class="metric-value">{{ formatPercent(stats.accuracy_rate) }}</span>
            <span class="metric-label">Overall Accuracy</span>
          </div>
          <div class="metric-box">
            <span class="metric-value">{{ formatPercent(stats.evaluation_coverage) }}</span>
            <span class="metric-label">Evaluated Coverage</span>
          </div>
          <div class="metric-box">
            <span class="metric-value">{{ formatPercent(stats.auto_accuracy_rate) }}</span>
            <span class="metric-label">Auto-Classify Accuracy</span>
          </div>
          <div class="metric-box">
            <span class="metric-value">{{ stats.user_corrections || 0 }}</span>
            <span class="metric-label">Corrections</span>
          </div>
        </div>

        <!-- Accuracy trend chart -->
        <div
          v-if="stats.time_series && stats.time_series.length > 0"
          class="chart-section"
        >
          <h3>Activity Over Time (Last 30 Days)</h3>
          <AccuracyChart :data="stats.time_series" />
        </div>

        <!-- Prompt type breakdown -->
        <div
          v-if="stats.prompt_breakdown && stats.prompt_breakdown.length > 0"
          class="breakdown-section"
        >
          <h3>Decision Breakdown (Last 30 Days)</h3>
          <div class="breakdown-bars">
            <div
              v-for="item in stats.prompt_breakdown"
              :key="item.prompt_type"
              class="breakdown-item"
            >
              <span class="type-label">{{ formatPromptType(item.prompt_type) }}</span>
              <div class="bar-container">
                <div
                  class="bar"
                  :style="{ width: getBarWidth(item.count) }"
                />
              </div>
              <span class="count">{{ item.count }}</span>
              <span class="accuracy">{{ formatPercent(item.accuracy) }}</span>
            </div>
          </div>
        </div>

        <!-- Period comparison -->
        <div
          v-if="comparison.length > 0"
          class="comparison-section"
        >
          <h3>7-Day Comparison</h3>
          <div class="comparison-table">
            <div class="comparison-row header">
              <span>Metric</span>
              <span>Last 7 Days</span>
              <span>Previous 7 Days</span>
              <span>Change</span>
            </div>
            <div class="comparison-row">
              <span>Decisions</span>
              <span>{{ current.decisions || 0 }}</span>
              <span>{{ previous.decisions || 0 }}</span>
              <span :class="getChangeClass(current.decisions, previous.decisions)">
                {{ formatChange(current.decisions, previous.decisions) }}
              </span>
            </div>
            <div class="comparison-row">
              <span>Accuracy</span>
              <span>{{ formatPercent(current.accuracy) }}</span>
              <span>{{ formatPercent(previous.accuracy) }}</span>
              <span :class="getChangeClass(current.accuracy, previous.accuracy)">
                {{ formatChange(current.accuracy, previous.accuracy, true) }}
              </span>
            </div>
            <div class="comparison-row">
              <span>Auto Rate</span>
              <span>{{ formatPercent(current.auto_rate / 100) }}</span>
              <span>{{ formatPercent(previous.auto_rate / 100) }}</span>
              <span :class="getChangeClass(current.auto_rate, previous.auto_rate)">
                {{ formatChange(current.auto_rate, previous.auto_rate, true) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import api from '@/api';
import AccuracyChart from './AccuracyChart.vue';
import FeedbackEvaluationCoverage from './FeedbackEvaluationCoverage.vue';

export default {
  name: 'PolicyStatsModal',
  components: {
    AccuracyChart,
    FeedbackEvaluationCoverage
  },
  props: {
    policy: {
      type: Object,
      required: true
    }
  },
  emits: ['close'],
  setup(props) {
    const stats = ref({});
    const comparison = ref([]);

    const lastWeek = computed(() => comparison.value.find(c => c.period === 'last_7_days') || {});
    const previousWeek = computed(() => comparison.value.find(c => c.period === 'previous_7_days') || {});

    const formatPercent = (value) => {
      if (value === null || value === undefined) return 'N/A';
      return `${(value * 100).toFixed(1)}%`;
    };

    const formatPromptType = (type) => {
      const labels = {
        'auto_classify': 'Auto Classify',
        'prompt_confirm': 'Prompt Confirm',
        'prompt_select': 'Prompt Select',
        'ai_validate': 'AI Validate'
      };
      return labels[type] || type;
    };

    const getBarWidth = (count) => {
      const maxCount = Math.max(...(stats.value.prompt_breakdown || []).map(b => b.count));
      return `${(count / maxCount) * 100}%`;
    };

    const getChangeClass = (currentVal, previousVal) => {
      if (currentVal == null || previousVal == null) return '';
      if (currentVal > previousVal) return 'positive';
      if (currentVal < previousVal) return 'negative';
      return '';
    };

    const formatChange = (currentVal, previousVal, isPercent = false) => {
      if (currentVal == null || previousVal == null) return '-';
      const diff = currentVal - previousVal;
      const sign = diff > 0 ? '+' : '';
      if (isPercent) {
        return `${sign}${diff.toFixed(1)}%`;
      }
      return `${sign}${diff}`;
    };

    const loadStats = async () => {
      try {
        const response = await api.getPolicyStatsDetail(props.policy.id);
        stats.value = response;
      } catch (error) {
        console.error('Failed to load policy stats:', error);
      }
    };

    const loadComparison = async () => {
      try {
        const response = await api.getPolicyStatsComparison(props.policy.id);
        comparison.value = response;
      } catch (error) {
        console.error('Failed to load comparison:', error);
      }
    };

    onMounted(() => {
      loadStats();
      loadComparison();
    });

    return {
      stats,
      comparison,
      current: lastWeek,
      previous: previousWeek,
      formatPercent,
      formatPromptType,
      getBarWidth,
      getChangeClass,
      formatChange
    };
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 12px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  color: #1f2937;
}

.btn-close {
  background: none;
  border: none;
  font-size: 32px;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #1f2937;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  color: #1f2937;
}

.modal-body :deep(.evaluation-coverage),
.scope-description {
  color: #4b5563;
}

.scope-description {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
}

.metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.metric-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.metric-value {
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
}

.metric-label {
  font-size: 14px;
  color: #6b7280;
}

.chart-section,
.breakdown-section,
.comparison-section {
  margin-bottom: 32px;
}

.chart-section h3,
.breakdown-section h3,
.comparison-section h3 {
  font-size: 18px;
  color: #1f2937;
  margin-bottom: 16px;
}

.breakdown-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.breakdown-item {
  display: grid;
  grid-template-columns: 150px 1fr 60px 80px;
  gap: 12px;
  align-items: center;
}

.type-label {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.bar-container {
  background: #e5e7eb;
  border-radius: 4px;
  height: 24px;
  overflow: hidden;
}

.bar {
  background: #3b82f6;
  height: 100%;
  transition: width 0.3s;
}

.count,
.accuracy {
  font-size: 14px;
  color: #6b7280;
  text-align: right;
}

.comparison-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comparison-row {
  display: grid;
  grid-template-columns: 150px 1fr 1fr 1fr;
  gap: 16px;
  padding: 12px;
  border-radius: 6px;
}

.comparison-row.header {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.comparison-row:not(.header) {
  background: white;
  border: 1px solid #e5e7eb;
}

.positive {
  color: #047857;
  font-weight: 500;
}

.negative {
  color: #b91c1c;
  font-weight: 500;
}
</style>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  Licensed under GPL-3.0
-->

<template>
  <div class="stats-dashboard">
    <div class="header">
      <h1>Policy Statistics</h1>
    </div>

    <!-- Alerts banner -->
    <AlertsBanner
      :alerts="alerts"
      @dismiss="dismissAlert"
    />

    <section
      class="overview-section"
      aria-labelledby="policy-feedback-heading"
      aria-describedby="policy-feedback-scope"
    >
      <h2 id="policy-feedback-heading">
        Policy Feedback Overview
      </h2>
      <p
        id="policy-feedback-scope"
        class="scope-description"
      >
        Totals and rates use all retained feedback for current policies, including disabled policies.
        Average accuracy weights each policy with evaluated evidence equally.
        Trends compare the last 7 days with the last 30 days.
      </p>
      <FeedbackEvaluationCoverage :stats="overview" />

      <!-- Overview cards -->
      <div class="overview-cards">
        <StatCard
          title="Total Decisions"
          :value="overview.total_decisions || 0"
          icon="📊"
        />
        <StatCard
          title="Average Evaluated Accuracy"
          :value="formatPercent(overview.avg_accuracy)"
          icon="🎯"
          :trend="accuracyTrend"
        />
        <StatCard
          title="Evaluated Coverage"
          :value="formatPercent(overview.evaluation_coverage)"
          icon="%"
        />
        <StatCard
          title="Auto-Classified"
          :value="formatPercent(overview.auto_rate)"
          icon="⚡"
        />
        <StatCard
          title="Policies Improving"
          :value="overview.improving_count || 0"
          icon="📈"
          variant="success"
        />
      </div>
    </section>

    <EvidenceCoverageBreakdown :coverage="overview.evidence_coverage" />

    <!-- Policy cards grid -->
    <section
      class="policies-section"
      aria-labelledby="policy-performance-heading"
      aria-describedby="policy-performance-scope"
    >
      <h2 id="policy-performance-heading">
        Policy Performance
      </h2>
      <p
        id="policy-performance-scope"
        class="scope-description"
      >
        Enabled policies. Totals cover all retained feedback; 7-day accuracy is shown separately.
      </p>
      <div class="policies-grid">
        <PolicyStatsCard
          v-for="policy in policiesWithStats"
          :key="policy.id"
          :policy="policy"
          @view-details="showPolicyDetails"
        />
      </div>
      <div
        v-if="policiesWithStats.length === 0"
        class="empty-state"
      >
        <p>No policies with statistics found. Policies will appear here after they process classifications.</p>
      </div>
    </section>

    <!-- Live feed -->
    <section
      class="live-feed-section"
      aria-labelledby="live-activity-heading"
      aria-describedby="live-activity-scope"
    >
      <h2 id="live-activity-heading">
        Live Activity
      </h2>
      <p
        id="live-activity-scope"
        class="scope-description"
      >
        Up to 20 latest events: retained feedback decisions, plus patterns and suggestions
        created in the last 7 days.
      </p>
      <LiveFeed :items="liveFeed" />
    </section>

    <!-- Policy detail modal -->
    <PolicyStatsModal
      v-if="selectedPolicy"
      :policy="selectedPolicy"
      @close="selectedPolicy = null"
    />
  </div>
</template>

<script>
import FeedbackEvaluationCoverage from '@/components/stats/FeedbackEvaluationCoverage.vue';
import EvidenceCoverageBreakdown from '@/components/stats/EvidenceCoverageBreakdown.vue';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import api from '@/api';
import AlertsBanner from '@/components/stats/AlertsBanner.vue';
import StatCard from '@/components/stats/StatCard.vue';
import PolicyStatsCard from '@/components/stats/PolicyStatsCard.vue';
import LiveFeed from '@/components/stats/LiveFeed.vue';
import PolicyStatsModal from '@/components/stats/PolicyStatsModal.vue';

export default {
  name: 'PolicyStatsDashboard',
  components: {
    FeedbackEvaluationCoverage,
    EvidenceCoverageBreakdown,
    AlertsBanner,
    StatCard,
    PolicyStatsCard,
    LiveFeed,
    PolicyStatsModal
  },
  setup() {
    const overview = ref({});
    const policiesWithStats = ref({});
    const liveFeed = ref([]);
    const alerts = ref([]);
    const selectedPolicy = ref(null);
    let refreshInterval = null;
    const MAX_CONSECUTIVE_ERRORS = 3;
    let consecutiveErrors = 0;

    const accuracyTrend = computed(() => {
      if (overview.value.avg_accuracy == null) return null;
      if (overview.value.improving_count > overview.value.declining_count) return 'improving';
      if (overview.value.declining_count > overview.value.improving_count) return 'declining';
      return 'stable';
    });

    const formatPercent = (value) => {
      if (value === null || value === undefined) return 'N/A';
      return `${(value * 100).toFixed(1)}%`;
    };

    const loadOverview = async () => {
      const response = await api.getPolicyStatsOverview();
      overview.value = response;
    };

    const loadPolicies = async () => {
      const response = await api.getPolicyStatsList();
      policiesWithStats.value = response;
    };

    const loadLiveFeed = async () => {
      const response = await api.getPolicyStatsLiveFeed(20);
      liveFeed.value = response;
    };

    const loadAlerts = async () => {
      const response = await api.getPolicyStatsAlerts();
      alerts.value = response;
    };

    const showPolicyDetails = (policy) => {
      selectedPolicy.value = policy;
    };

    const dismissAlert = (alert) => {
      const index = alerts.value.findIndex(
        a => a.policy_id === alert.policy_id && a.type === alert.type
      );
      if (index > -1) {
        alerts.value.splice(index, 1);
      }
    };

    const loadAllData = async () => {
      try {
        await Promise.all([
          loadOverview(),
          loadPolicies(),
          loadLiveFeed(),
          loadAlerts()
        ]);
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors += 1;
        console.error('Failed to load policy stats dashboard data', error);

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && refreshInterval) {
          console.warn('Too many consecutive errors. Stopping auto-refresh.');
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      } else if (document.visibilityState === 'visible' && !refreshInterval) {
        loadAllData();
        refreshInterval = setInterval(loadAllData, 30000);
      }
    };

    onMounted(() => {
      loadAllData();

      // Auto-refresh every 30 seconds
      refreshInterval = setInterval(loadAllData, 30000);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    });

    onUnmounted(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    });

    return {
      overview,
      policiesWithStats,
      liveFeed,
      alerts,
      selectedPolicy,
      accuracyTrend,
      formatPercent,
      showPolicyDetails,
      dismissAlert
    };
  }
};
</script>

<style scoped>
.stats-dashboard {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 24px;
}

.header h1 {
  margin: 0;
  font-size: 28px;
  color: #f9fafb;
  font-weight: 700;
}

.scope-description {
  color: #d1d5db;
  font-size: 14px;
  line-height: 1.6;
  margin: 8px 0 16px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.policies-section {
  margin-bottom: 32px;
}

.overview-section h2,
.policies-section h2,
.live-feed-section h2 {
  font-size: 20px;
  color: #f9fafb;
  margin-bottom: 8px;
  font-weight: 600;
}

.policies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(350px, 100%), 1fr));
  gap: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 8px;
}

.live-feed-section {
  margin-bottom: 32px;
}

</style>

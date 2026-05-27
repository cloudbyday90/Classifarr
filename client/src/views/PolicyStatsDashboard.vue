<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  Licensed under GPL-3.0
-->

<template>
  <div class="stats-dashboard">
    <div class="header">
      <h1>Policy Statistics</h1>
      <div class="time-filter">
        <button
          :class="{ active: timeRange === '7d' }"
          :aria-pressed="timeRange === '7d'"
          @click="timeRange = '7d'"
        >
          7 Days
        </button>
        <button
          :class="{ active: timeRange === '30d' }"
          :aria-pressed="timeRange === '30d'"
          @click="timeRange = '30d'"
        >
          30 Days
        </button>
        <button
          :class="{ active: timeRange === 'all' }"
          :aria-pressed="timeRange === 'all'"
          @click="timeRange = 'all'"
        >
          All Time
        </button>
      </div>
    </div>

    <!-- Alerts banner -->
    <AlertsBanner
      :alerts="alerts"
      @dismiss="dismissAlert"
    />

    <!-- Overview cards -->
    <div class="overview-cards">
      <StatCard 
        title="Total Decisions" 
        :value="overview.total_decisions || 0" 
        icon="📊"
      />
      <StatCard 
        title="Average Accuracy" 
        :value="formatPercent(overview.avg_accuracy)" 
        icon="🎯"
        :trend="accuracyTrend"
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

    <!-- Policy cards grid -->
    <div class="policies-section">
      <h2>Policy Performance</h2>
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
    </div>

    <!-- Live feed -->
    <div class="live-feed-section">
      <h2>Live Activity</h2>
      <LiveFeed :items="liveFeed" />
    </div>

    <!-- Policy detail modal -->
    <PolicyStatsModal
      v-if="selectedPolicy"
      :policy="selectedPolicy"
      @close="selectedPolicy = null"
    />
  </div>
</template>

<script>
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
    AlertsBanner,
    StatCard,
    PolicyStatsCard,
    LiveFeed,
    PolicyStatsModal
  },
  setup() {
    const timeRange = ref('7d');
    const overview = ref({});
    const policiesWithStats = ref({});
    const liveFeed = ref([]);
    const alerts = ref([]);
    const selectedPolicy = ref(null);
    let refreshInterval = null;
    const MAX_CONSECUTIVE_ERRORS = 3;
    let consecutiveErrors = 0;

    const accuracyTrend = computed(() => {
      if (!overview.value.avg_accuracy) return null;
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

    onMounted(() => {
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

      loadAllData();
      
      // Auto-refresh every 30 seconds
      refreshInterval = setInterval(loadAllData, 30000);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    });

    onUnmounted(() => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      document.removeEventListener('visibilitychange', () => {});
    });

    return {
      timeRange,
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h1 {
  margin: 0;
  font-size: 28px;
  color: #f9fafb;
  font-weight: 700;
}

.time-filter {
  display: flex;
  gap: 8px;
}

.time-filter button {
  padding: 8px 16px;
  border: 1px solid #374151;
  background: #1f2937;
  color: #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.time-filter button:hover {
  background: #374151;
  border-color: #4b5563;
}

.time-filter button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.policies-section {
  margin-bottom: 32px;
}

.policies-section h2 {
  font-size: 20px;
  color: #f9fafb;
  margin-bottom: 16px;
  font-weight: 600;
}

.policies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
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

.live-feed-section h2 {
  font-size: 20px;
  color: #f9fafb;
  margin-bottom: 16px;
  font-weight: 600;
}
</style>

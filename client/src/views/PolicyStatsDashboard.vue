<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  Licensed under GPL-3.0
-->

<template>
  <div class="stats-dashboard">
    <div class="header">
      <h1>Policy Statistics</h1>
      <div class="time-filter">
        <button :class="{ active: timeRange === '7d' }" @click="timeRange = '7d'">7 Days</button>
        <button :class="{ active: timeRange === '30d' }" @click="timeRange = '30d'">30 Days</button>
        <button :class="{ active: timeRange === 'all' }" @click="timeRange = 'all'">All Time</button>
      </div>
    </div>

    <!-- Alerts banner -->
    <AlertsBanner :alerts="alerts" @dismiss="dismissAlert" />

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
      <div v-if="policiesWithStats.length === 0" class="empty-state">
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
import { ref, computed, onMounted, watch } from 'vue';
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
    const policiesWithStats = ref([]);
    const liveFeed = ref([]);
    const alerts = ref([]);
    const selectedPolicy = ref(null);

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
      try {
        const response = await fetch('/api/stats/overview', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        if (response.ok) {
          overview.value = await response.json();
        }
      } catch (error) {
        console.error('Failed to load overview:', error);
      }
    };

    const loadPolicies = async () => {
      try {
        const response = await fetch('/api/stats/policies', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        if (response.ok) {
          policiesWithStats.value = await response.json();
        }
      } catch (error) {
        console.error('Failed to load policies:', error);
      }
    };

    const loadLiveFeed = async () => {
      try {
        const response = await fetch('/api/stats/live-feed?limit=20', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        if (response.ok) {
          liveFeed.value = await response.json();
        }
      } catch (error) {
        console.error('Failed to load live feed:', error);
      }
    };

    const loadAlerts = async () => {
      try {
        const response = await fetch('/api/stats/alerts', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        if (response.ok) {
          alerts.value = await response.json();
        }
      } catch (error) {
        console.error('Failed to load alerts:', error);
      }
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

    const loadAllData = () => {
      loadOverview();
      loadPolicies();
      loadLiveFeed();
      loadAlerts();
    };

    onMounted(() => {
      loadAllData();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(loadAllData, 30000);
      
      // Cleanup on unmount
      return () => clearInterval(interval);
    });

    watch(timeRange, () => {
      // Time range filter would affect queries if implemented
      loadAllData();
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
  color: #1f2937;
}

.time-filter {
  display: flex;
  gap: 8px;
}

.time-filter button {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.time-filter button:hover {
  background: #f3f4f6;
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
  color: #1f2937;
  margin-bottom: 16px;
}

.policies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 8px;
}

.live-feed-section {
  margin-bottom: 32px;
}

.live-feed-section h2 {
  font-size: 20px;
  color: #1f2937;
  margin-bottom: 16px;
}
</style>

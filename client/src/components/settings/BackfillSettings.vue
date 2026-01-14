<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Card title="🔄 Embedding Backfill">
    <div v-if="loading" class="text-center py-8">
      <Spinner />
      <p class="text-gray-400 mt-2">Loading backfill configuration...</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Pending Count Display -->
      <div class="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400">Pending Embeddings</p>
            <p class="text-3xl font-bold text-white">{{ pendingCount }}</p>
          </div>
          <div class="text-blue-400">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Real-Time Section -->
      <div class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 class="font-medium text-gray-200">⚡ Real-Time Mode</h3>
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="text-sm text-gray-300">Generate embeddings immediately during classification</p>
            <p class="text-xs text-gray-500 mt-1">Best for keeping RAG data current. Adds ~100-300ms to classification time.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              v-model="realtimeConfig.enabled" 
              class="sr-only peer"
              @change="saveRealtimeConfig"
            />
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      <!-- Idle Backfill Section -->
      <div class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 class="font-medium text-gray-200">🌙 Idle Backfill Mode</h3>
        <div class="flex items-center justify-between mb-4">
          <div class="flex-1">
            <p class="text-sm text-gray-300">Automatically process pending embeddings during quiet periods</p>
            <p class="text-xs text-gray-500 mt-1">Starts after {{ idleConfig.threshold / 1000 }} seconds of no classification activity.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              v-model="idleConfig.enabled" 
              class="sr-only peer"
              @change="saveIdleConfig"
            />
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div v-if="idleConfig.enabled" class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Idle Threshold (seconds)</label>
            <input 
              v-model.number="idleThresholdSeconds"
              type="number"
              min="10"
              max="300"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              @change="saveIdleConfig"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Batch Size</label>
            <input 
              v-model.number="idleConfig.batchSize"
              type="number"
              min="1"
              max="50"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              @change="saveIdleConfig"
            />
          </div>
        </div>
      </div>

      <!-- Scheduled Backfill Section -->
      <div class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 class="font-medium text-gray-200">📅 Scheduled Backfill Mode</h3>
        <div class="flex items-center justify-between mb-4">
          <div class="flex-1">
            <p class="text-sm text-gray-300">Large batch processing at configured times</p>
            <p class="text-xs text-gray-500 mt-1">Perfect for overnight processing without impacting daytime performance.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              v-model="scheduleConfig.enabled" 
              class="sr-only peer"
              @change="saveScheduleConfig"
            />
            <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div v-if="scheduleConfig.enabled" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Time (HH:MM)</label>
              <input 
                v-model="scheduleConfig.time"
                type="time"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                @change="saveScheduleConfig"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Batch Size</label>
              <input 
                v-model.number="scheduleConfig.batchSize"
                type="number"
                min="10"
                max="500"
                class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                @change="saveScheduleConfig"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Days of Week</label>
            <div class="flex gap-2">
              <label v-for="day in daysOfWeek" :key="day.value" class="flex items-center">
                <input 
                  type="checkbox" 
                  :value="day.value"
                  v-model="scheduleConfig.days"
                  class="mr-1"
                  @change="saveScheduleConfig"
                />
                <span class="text-sm text-gray-300">{{ day.label }}</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Max Duration (minutes)</label>
            <input 
              v-model.number="scheduleMaxDurationMinutes"
              type="number"
              min="10"
              max="240"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              @change="saveScheduleConfig"
            />
          </div>
        </div>
      </div>

      <!-- Manual Backfill Section -->
      <div class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 class="font-medium text-gray-200">🎮 Manual Backfill Mode</h3>
        <p class="text-sm text-gray-400">Take control with on-demand backfill processing</p>
        
        <!-- Status Display -->
        <div v-if="manualStatus.status !== 'idle'" class="bg-gray-900/50 rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-300">Status:</span>
            <span :class="getStatusClass(manualStatus.status)">
              {{ getStatusText(manualStatus.status) }}
            </span>
          </div>
          
          <div v-if="manualStatus.total > 0">
            <div class="flex items-center justify-between text-sm mb-1">
              <span class="text-gray-400">Progress</span>
              <span class="text-white">{{ manualStatus.processed }} / {{ manualStatus.total }} ({{ manualStatus.progress }}%)</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                class="bg-primary h-2.5 rounded-full transition-all duration-300"
                :style="{ width: manualStatus.progress + '%' }"
              ></div>
            </div>
          </div>

          <div v-if="manualStatus.eta" class="flex items-center justify-between text-sm">
            <span class="text-gray-400">Estimated Time Remaining:</span>
            <span class="text-white">{{ formatETA(manualStatus.eta) }}</span>
          </div>

          <div v-if="manualStatus.error" class="text-sm text-red-400">
            Error: {{ manualStatus.error }}
          </div>
        </div>

        <!-- Controls -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Batch Size</label>
            <input 
              v-model.number="manualBatchSize"
              type="number"
              min="10"
              max="200"
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              :disabled="manualStatus.status === 'running'"
            />
          </div>
        </div>

        <div class="flex gap-2">
          <Button 
            v-if="manualStatus.status === 'idle' || manualStatus.status === 'completed'"
            variant="primary" 
            @click="startManualBackfill"
            :disabled="pendingCount === 0 || manualProcessing"
          >
            <span v-if="manualProcessing">Starting...</span>
            <span v-else>▶️ Start Backfill</span>
          </Button>

          <Button 
            v-if="manualStatus.status === 'running'"
            variant="warning" 
            @click="pauseManualBackfill"
            :disabled="manualProcessing"
          >
            ⏸️ Pause
          </Button>

          <Button 
            v-if="manualStatus.status === 'paused'"
            variant="primary" 
            @click="resumeManualBackfill"
            :disabled="manualProcessing"
          >
            ▶️ Resume
          </Button>

          <Button 
            v-if="manualStatus.status !== 'idle'"
            variant="secondary" 
            @click="clearManualBackfill"
            :disabled="manualStatus.status === 'running' || manualProcessing"
          >
            🔄 Clear
          </Button>
        </div>
      </div>

      <!-- History Section -->
      <div class="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="font-medium text-gray-200">📊 Backfill History</h3>
          <Button variant="secondary" size="sm" @click="loadHistory">
            🔄 Refresh
          </Button>
        </div>

        <div v-if="history.length === 0" class="text-center py-4 text-gray-500">
          No backfill runs yet
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Processed</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Started</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Completed</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr v-for="run in history" :key="run.id">
                <td class="px-4 py-2 text-sm text-gray-300">
                  <span class="px-2 py-1 rounded-full text-xs" :class="getTypeClass(run.type)">
                    {{ run.type }}
                  </span>
                </td>
                <td class="px-4 py-2 text-sm">
                  <span :class="getStatusClass(run.status)">
                    {{ run.status }}
                  </span>
                </td>
                <td class="px-4 py-2 text-sm text-gray-300">{{ run.processed || 0 }}</td>
                <td class="px-4 py-2 text-sm text-gray-400">{{ formatDate(run.started_at) }}</td>
                <td class="px-4 py-2 text-sm text-gray-400">{{ run.completed_at ? formatDate(run.completed_at) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Card>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import Card from '@/components/common/Card.vue';
import Button from '@/components/common/Button.vue';
import Spinner from '@/components/common/Spinner.vue';
import api from '@/api';
import { parseDaysConfig } from '@/utils/backfillHelpers';

export default {
  name: 'BackfillSettings',
  components: {
    Card,
    Button,
    Spinner
  },
  setup() {
    const loading = ref(true);
    const manualProcessing = ref(false);
    const pendingCount = ref(0);
    const history = ref([]);
    
    const realtimeConfig = ref({
      enabled: true
    });

    const idleConfig = ref({
      enabled: true,
      threshold: 30000,
      batchSize: 10
    });

    const scheduleConfig = ref({
      enabled: false,
      time: '02:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      batchSize: 100,
      maxDuration: 3600000
    });

    const manualStatus = ref({
      status: 'idle',
      processed: 0,
      total: 0,
      progress: 0,
      eta: null,
      error: null
    });

    const manualBatchSize = ref(50);

    const daysOfWeek = [
      { label: 'Sun', value: 0 },
      { label: 'Mon', value: 1 },
      { label: 'Tue', value: 2 },
      { label: 'Wed', value: 3 },
      { label: 'Thu', value: 4 },
      { label: 'Fri', value: 5 },
      { label: 'Sat', value: 6 }
    ];

    const idleThresholdSeconds = computed({
      get: () => idleConfig.value.threshold / 1000,
      set: (val) => { idleConfig.value.threshold = val * 1000; }
    });

    const scheduleMaxDurationMinutes = computed({
      get: () => scheduleConfig.value.maxDuration / 60000,
      set: (val) => { scheduleConfig.value.maxDuration = val * 60000; }
    });

    let statusInterval = null;

    const loadStatus = async () => {
      try {
        const response = await api.get('/api/rag/backfill/status');
        pendingCount.value = response.data.pending || 0;
        if (response.data.manual) {
          manualStatus.value = response.data.manual;
        }
      } catch (error) {
        console.error('Failed to load backfill status:', error);
      }
    };

    const loadRealtimeConfig = async () => {
      try {
        const response = await api.get('/api/rag/backfill/realtime');
        realtimeConfig.value.enabled = response.data.realtime_embedding_enabled !== false;
      } catch (error) {
        console.error('Failed to load realtime config:', error);
      }
    };

    const loadIdleConfig = async () => {
      try {
        const response = await api.get('/api/rag/backfill/idle');
        if (response.data) {
          idleConfig.value = {
            enabled: response.data.idle_backfill_enabled !== false,
            threshold: response.data.idle_threshold || 30000,
            batchSize: response.data.idle_batch_size || 10
          };
        }
      } catch (error) {
        console.error('Failed to load idle config:', error);
      }
    };

    const loadScheduleConfig = async () => {
      try {
        const response = await api.get('/api/rag/backfill/schedule');
        if (response.data) {
          scheduleConfig.value = {
            enabled: response.data.scheduled_backfill_enabled || false,
            time: response.data.scheduled_backfill_time || '02:00',
            days: parseDaysConfig(response.data.scheduled_backfill_days),
            batchSize: response.data.scheduled_backfill_batch_size || 100,
            maxDuration: response.data.scheduled_backfill_max_duration || 3600000
          };
        }
      } catch (error) {
        console.error('Failed to load schedule config:', error);
      }
    };

    const loadHistory = async () => {
      try {
        const response = await api.get('/api/rag/backfill/history');
        history.value = response.data.history || [];
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    };

    const saveRealtimeConfig = async () => {
      try {
        await api.put('/api/rag/backfill/realtime', {
          enabled: realtimeConfig.value.enabled
        });
      } catch (error) {
        console.error('Failed to save realtime config:', error);
      }
    };

    const saveIdleConfig = async () => {
      try {
        await api.put('/api/rag/backfill/idle', {
          enabled: idleConfig.value.enabled,
          threshold: idleConfig.value.threshold,
          batchSize: idleConfig.value.batchSize
        });
      } catch (error) {
        console.error('Failed to save idle config:', error);
      }
    };

    const saveScheduleConfig = async () => {
      try {
        await api.put('/api/rag/backfill/schedule', {
          enabled: scheduleConfig.value.enabled,
          time: scheduleConfig.value.time,
          days: scheduleConfig.value.days,
          batchSize: scheduleConfig.value.batchSize,
          maxDuration: scheduleConfig.value.maxDuration
        });
      } catch (error) {
        console.error('Failed to save schedule config:', error);
      }
    };

    const startManualBackfill = async () => {
      manualProcessing.value = true;
      try {
        await api.post('/api/rag/backfill/manual/start', {
          batchSize: manualBatchSize.value
        });
        await loadStatus();
      } catch (error) {
        console.error('Failed to start manual backfill:', error);
        alert('Failed to start backfill: ' + (error.response?.data?.error || error.message));
      } finally {
        manualProcessing.value = false;
      }
    };

    const pauseManualBackfill = async () => {
      manualProcessing.value = true;
      try {
        await api.post('/api/rag/backfill/manual/pause');
        await loadStatus();
      } catch (error) {
        console.error('Failed to pause manual backfill:', error);
      } finally {
        manualProcessing.value = false;
      }
    };

    const resumeManualBackfill = async () => {
      manualProcessing.value = true;
      try {
        await api.post('/api/rag/backfill/manual/resume');
        await loadStatus();
      } catch (error) {
        console.error('Failed to resume manual backfill:', error);
      } finally {
        manualProcessing.value = false;
      }
    };

    const clearManualBackfill = async () => {
      manualProcessing.value = true;
      try {
        await api.post('/api/rag/backfill/manual/clear');
        await loadStatus();
      } catch (error) {
        console.error('Failed to clear manual backfill:', error);
      } finally {
        manualProcessing.value = false;
      }
    };

    const getStatusClass = (status) => {
      const classes = {
        idle: 'text-gray-400',
        running: 'text-blue-400',
        paused: 'text-yellow-400',
        completed: 'text-green-400',
        failed: 'text-red-400'
      };
      return classes[status] || 'text-gray-400';
    };

    const getStatusText = (status) => {
      const texts = {
        idle: 'Idle',
        running: 'Running',
        paused: 'Paused',
        completed: 'Completed',
        failed: 'Failed'
      };
      return texts[status] || status;
    };

    const getTypeClass = (type) => {
      const classes = {
        idle: 'bg-purple-900/50 text-purple-300',
        scheduled: 'bg-blue-900/50 text-blue-300',
        manual: 'bg-green-900/50 text-green-300'
      };
      return classes[type] || 'bg-gray-900/50 text-gray-300';
    };

    const formatETA = (seconds) => {
      if (!seconds) return '-';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    };

    const formatDate = (dateString) => {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleString();
    };

    onMounted(async () => {
      await Promise.all([
        loadRealtimeConfig(),
        loadIdleConfig(),
        loadScheduleConfig(),
        loadStatus(),
        loadHistory()
      ]);
      loading.value = false;

      // Poll status every 2 seconds if manual backfill is running
      statusInterval = setInterval(async () => {
        if (manualStatus.value.status === 'running' || manualStatus.value.status === 'paused') {
          await loadStatus();
        }
      }, 2000);
    });

    onUnmounted(() => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    });

    return {
      loading,
      manualProcessing,
      pendingCount,
      history,
      realtimeConfig,
      idleConfig,
      scheduleConfig,
      manualStatus,
      manualBatchSize,
      daysOfWeek,
      idleThresholdSeconds,
      scheduleMaxDurationMinutes,
      loadHistory,
      saveRealtimeConfig,
      saveIdleConfig,
      saveScheduleConfig,
      startManualBackfill,
      pauseManualBackfill,
      resumeManualBackfill,
      clearManualBackfill,
      getStatusClass,
      getStatusText,
      getTypeClass,
      formatETA,
      formatDate
    };
  }
};
</script>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold mb-2">Pattern Management</h2>
        <p class="text-gray-400 text-sm">Manage discovered classification patterns</p>
      </div>
      <div class="flex gap-2">
        <Button @click="discoverPatterns" variant="secondary" :disabled="discovering">
          <span v-if="discovering">🔄 Discovering...</span>
          <span v-else>🔍 Discover New Patterns</span>
        </Button>
        <Button v-if="summary.conflicts > 0" @click="resolveConflicts" variant="warning">
          ⚠️ Resolve {{ summary.conflicts }} Conflicts
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <Spinner />
      <p class="text-gray-400 mt-4">Loading patterns...</p>
    </div>

    <template v-else>
      <!-- Summary Stats -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card class="text-center">
          <div class="text-2xl font-bold text-blue-400">{{ summary.total || 0 }}</div>
          <div class="text-sm text-gray-400 mt-1">Total Patterns</div>
        </Card>
        <Card class="text-center">
          <div class="text-2xl font-bold text-green-400">{{ summary.approved || 0 }}</div>
          <div class="text-sm text-gray-400 mt-1">Approved</div>
        </Card>
        <Card class="text-center">
          <div class="text-2xl font-bold text-yellow-400">{{ summary.discovered || 0 }}</div>
          <div class="text-sm text-gray-400 mt-1">Suggested</div>
        </Card>
        <Card class="text-center">
          <div class="text-2xl font-bold text-orange-400">{{ summary.conflicts || 0 }}</div>
          <div class="text-sm text-gray-400 mt-1">Conflicts</div>
        </Card>
        <Card class="text-center">
          <div class="text-2xl font-bold text-purple-400">{{ summary.avg_confidence ? summary.avg_confidence.toFixed(1) : 0 }}%</div>
          <div class="text-sm text-gray-400 mt-1">Avg Confidence</div>
        </Card>
      </div>

      <!-- Conflict Alert -->
      <div v-if="summary.conflicts > 0" class="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <span class="text-2xl">⚠️</span>
          <div class="flex-1">
            <h3 class="font-semibold text-orange-400">Pattern Conflicts Detected</h3>
            <p class="text-sm text-gray-300 mt-1">
              {{ summary.conflicts }} pattern(s) have conflicting library suggestions. 
              Click "Resolve Conflicts" to automatically keep the highest confidence pattern for each conflict.
            </p>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <Card>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <Select v-model="filters.status">
              <option value="">All Status</option>
              <option value="discovered">Discovered</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="decayed">Decayed</option>
            </Select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <Select v-model="filters.type">
              <option value="">All Types</option>
              <option value="studio">Studio</option>
              <option value="franchise">Franchise</option>
              <option value="genre">Genre</option>
              <option value="certification">Certification</option>
            </Select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Min Confidence</label>
            <Input v-model.number="filters.min_confidence" type="number" min="0" max="100" placeholder="0" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <Input v-model="filters.search" placeholder="Search patterns..." />
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <Button @click="loadPatterns" variant="primary">Apply Filters</Button>
        </div>
      </Card>

      <!-- Patterns Table -->
      <Card>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-700">
                <th class="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
                <th class="text-left py-3 px-4 text-gray-400 font-medium">Pattern</th>
                <th class="text-left py-3 px-4 text-gray-400 font-medium">Library</th>
                <th class="text-left py-3 px-4 text-gray-400 font-medium">Confidence</th>
                <th class="text-left py-3 px-4 text-gray-400 font-medium">Matches</th>
                <th class="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                <th class="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="patterns.length === 0">
                <td colspan="7" class="text-center py-8 text-gray-400">
                  No patterns found. Try adjusting your filters or discover new patterns.
                </td>
              </tr>
              <tr v-for="pattern in patterns" :key="pattern.id" class="border-b border-gray-800 hover:bg-gray-800/50">
                <td class="py-3 px-4">
                  <Badge :variant="getTypeColor(pattern.pattern_type)">
                    {{ pattern.pattern_type }}
                  </Badge>
                </td>
                <td class="py-3 px-4 text-gray-200 max-w-xs truncate" :title="pattern.pattern_value">
                  {{ pattern.pattern_value }}
                </td>
                <td class="py-3 px-4 text-gray-300">{{ pattern.library_name }}</td>
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-700 rounded-full h-2 max-w-[100px]">
                      <div 
                        :class="getConfidenceColor(pattern.confidence)" 
                        class="h-2 rounded-full transition-all" 
                        :style="{width: pattern.confidence + '%'}"
                      ></div>
                    </div>
                    <span class="text-sm text-gray-400 min-w-[3rem] text-right">{{ pattern.confidence }}%</span>
                  </div>
                </td>
                <td class="py-3 px-4 text-gray-300">{{ pattern.match_count || 0 }}</td>
                <td class="py-3 px-4">
                  <Badge :variant="getStatusColor(pattern.status)">
                    {{ pattern.status }}
                  </Badge>
                </td>
                <td class="py-3 px-4 text-right space-x-2">
                  <button @click="viewDetails(pattern)" class="text-blue-400 hover:text-blue-300 text-sm">View</button>
                  <button v-if="pattern.status === 'discovered'" @click="approvePattern(pattern.id)" class="text-green-400 hover:text-green-300 text-sm">Approve</button>
                  <button v-if="pattern.status === 'discovered'" @click="rejectPattern(pattern.id)" class="text-red-400 hover:text-red-300 text-sm">Reject</button>
                  <button @click="deletePattern(pattern.id)" class="text-red-400 hover:text-red-300 text-sm">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.total_pages > 1" class="mt-4 flex justify-between items-center">
          <span class="text-sm text-gray-400">
            Page {{ pagination.page }} of {{ pagination.total_pages }} ({{ pagination.total }} total)
          </span>
          <div class="flex gap-2">
            <Button @click="changePage(pagination.page - 1)" :disabled="pagination.page === 1" variant="secondary" size="sm">
              Previous
            </Button>
            <Button @click="changePage(pagination.page + 1)" :disabled="pagination.page === pagination.total_pages" variant="secondary" size="sm">
              Next
            </Button>
          </div>
        </div>
      </Card>
    </template>

    <!-- Pattern Detail Modal -->
    <Modal v-if="selectedPattern" @close="selectedPattern = null" :title="`Pattern Details: ${selectedPattern.pattern_value}`">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="text-sm text-gray-400">Type:</span>
            <p class="text-white">{{ selectedPattern.pattern_type }}</p>
          </div>
          <div>
            <span class="text-sm text-gray-400">Library:</span>
            <p class="text-white">{{ selectedPattern.library_name }}</p>
          </div>
          <div>
            <span class="text-sm text-gray-400">Confidence:</span>
            <p class="text-white">{{ selectedPattern.confidence }}%</p>
          </div>
          <div>
            <span class="text-sm text-gray-400">Status:</span>
            <p class="text-white">{{ selectedPattern.status }}</p>
          </div>
          <div>
            <span class="text-sm text-gray-400">Sample Size:</span>
            <p class="text-white">{{ selectedPattern.sample_size }}</p>
          </div>
          <div>
            <span class="text-sm text-gray-400">Match Count:</span>
            <p class="text-white">{{ selectedPattern.match_count || 0 }}</p>
          </div>
        </div>

        <div v-if="patternDetails.accuracy" class="bg-gray-800 rounded-lg p-4">
          <h4 class="font-medium mb-2">Accuracy Statistics</h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-400">Total Uses:</span>
              <span class="text-white ml-2">{{ patternDetails.accuracy.total_uses }}</span>
            </div>
            <div>
              <span class="text-gray-400">Correct:</span>
              <span class="text-green-400 ml-2">{{ patternDetails.accuracy.correct_predictions }}</span>
            </div>
            <div>
              <span class="text-gray-400">Incorrect:</span>
              <span class="text-red-400 ml-2">{{ patternDetails.accuracy.incorrect_predictions }}</span>
            </div>
            <div>
              <span class="text-gray-400">Accuracy:</span>
              <span class="text-blue-400 ml-2">{{ patternDetails.accuracy.accuracy_percentage }}%</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import { ref, onMounted, reactive } from 'vue';
import { Card, Button, Badge, Spinner, Input, Select, Modal } from '../../components/common';
import api from '../../api/client';

export default {
  name: 'PatternManagement',
  components: {
    Card,
    Button,
    Badge,
    Spinner,
    Input,
    Select,
    Modal
  },
  setup() {
    const loading = ref(true);
    const discovering = ref(false);
    const patterns = ref([]);
    const summary = ref({});
    const selectedPattern = ref(null);
    const patternDetails = ref({});
    const filters = reactive({
      status: '',
      type: '',
      min_confidence: '',
      search: ''
    });
    const pagination = ref({
      page: 1,
      per_page: 30,
      total: 0,
      total_pages: 0
    });

    const loadSummary = async () => {
      try {
        const response = await api.get('/patterns/summary');
        summary.value = response.data;
      } catch (error) {
        console.error('Failed to load pattern summary:', error);
      }
    };

    const loadPatterns = async () => {
      try {
        loading.value = true;
        const params = {
          page: pagination.value.page,
          per_page: pagination.value.per_page,
          ...filters
        };
        const response = await api.get('/patterns', { params });
        patterns.value = response.data.patterns;
        pagination.value = response.data.pagination;
      } catch (error) {
        console.error('Failed to load patterns:', error);
      } finally {
        loading.value = false;
      }
    };

    const discoverPatterns = async () => {
      try {
        discovering.value = true;
        await api.post('/patterns/discover');
        await loadSummary();
        await loadPatterns();
      } catch (error) {
        console.error('Failed to discover patterns:', error);
      } finally {
        discovering.value = false;
      }
    };

    const resolveConflicts = async () => {
      try {
        await api.post('/patterns/resolve-conflicts');
        await loadSummary();
        await loadPatterns();
      } catch (error) {
        console.error('Failed to resolve conflicts:', error);
      }
    };

    const viewDetails = async (pattern) => {
      try {
        selectedPattern.value = pattern;
        const response = await api.get(`/patterns/${pattern.id}`);
        patternDetails.value = response.data;
      } catch (error) {
        console.error('Failed to load pattern details:', error);
      }
    };

    const approvePattern = async (id) => {
      try {
        await api.put(`/patterns/${id}/approve`, { approved_by: 'user' });
        await loadPatterns();
        await loadSummary();
      } catch (error) {
        console.error('Failed to approve pattern:', error);
      }
    };

    const rejectPattern = async (id) => {
      try {
        await api.put(`/patterns/${id}/reject`, { rejected_by: 'user', rejection_reason: 'Manual rejection' });
        await loadPatterns();
        await loadSummary();
      } catch (error) {
        console.error('Failed to reject pattern:', error);
      }
    };

    const deletePattern = async (id) => {
      if (!confirm('Are you sure you want to delete this pattern?')) return;
      try {
        await api.delete(`/patterns/${id}`);
        await loadPatterns();
        await loadSummary();
      } catch (error) {
        console.error('Failed to delete pattern:', error);
      }
    };

    const changePage = (page) => {
      pagination.value.page = page;
      loadPatterns();
    };

    const getTypeColor = (type) => {
      const colors = {
        studio: 'blue',
        franchise: 'purple',
        genre: 'green',
        certification: 'orange'
      };
      return colors[type] || 'gray';
    };

    const getStatusColor = (status) => {
      const colors = {
        discovered: 'yellow',
        approved: 'green',
        rejected: 'red',
        decayed: 'gray'
      };
      return colors[status] || 'gray';
    };

    const getConfidenceColor = (confidence) => {
      if (confidence >= 80) return 'bg-green-500';
      if (confidence >= 60) return 'bg-yellow-500';
      if (confidence >= 40) return 'bg-orange-500';
      return 'bg-red-500';
    };

    onMounted(async () => {
      await loadSummary();
      await loadPatterns();
    });

    return {
      loading,
      discovering,
      patterns,
      summary,
      selectedPattern,
      patternDetails,
      filters,
      pagination,
      loadPatterns,
      discoverPatterns,
      resolveConflicts,
      viewDetails,
      approvePattern,
      rejectPattern,
      deletePattern,
      changePage,
      getTypeColor,
      getStatusColor,
      getConfidenceColor
    };
  }
};
</script>

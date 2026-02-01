<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  Library Profile Panel - Shows library profile used in classification decision
  For Issue #142 (Epic #136 - v0.39.0-alpha)
-->

<template>
  <div v-if="profileStats" class="library-profile-panel bg-background rounded-lg p-4 border border-gray-700">
    <h4 class="font-semibold mb-3 text-blue-400">📊 Library Profile Used in Decision</h4>
    
    <!-- Stats Summary -->
    <div class="stats-summary grid grid-cols-2 gap-4 mb-4">
      <div class="stat-item">
        <span class="text-gray-400 text-sm">Total Items</span>
        <div class="text-xl font-bold text-white">{{ profileStats.totalItems }}</div>
      </div>
      <div class="stat-item">
        <span class="text-gray-400 text-sm">Profile Updated</span>
        <div class="text-sm text-gray-300">{{ formatDate(profileStats.lastUpdated) }}</div>
      </div>
    </div>
    
    <!-- Content Rating Distribution -->
    <div v-if="profileStats.certificationDistribution?.length" class="distribution-section mb-4">
      <h5 class="text-sm font-semibold text-gray-300 mb-2">Content Rating Distribution</h5>
      <div class="distribution-bars space-y-2">
        <div 
          v-for="cert in profileStats.certificationDistribution.slice(0, 5)" 
          :key="cert.certification"
          class="distribution-bar"
        >
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="bar-label text-gray-300">{{ cert.certification }}</span>
            <span class="bar-value text-gray-400">{{ cert.percentage }}% ({{ cert.count }} items)</span>
          </div>
          <div class="bar-track bg-gray-800 rounded-full h-2 overflow-hidden">
            <div 
              class="bar-fill bg-blue-500 h-full rounded-full transition-all" 
              :style="{ width: cert.percentage + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Genre Distribution -->
    <div v-if="profileStats.genreDistribution?.length" class="distribution-section mb-4">
      <h5 class="text-sm font-semibold text-gray-300 mb-2">Genre Distribution</h5>
      <div class="distribution-bars space-y-2">
        <div 
          v-for="genre in profileStats.genreDistribution.slice(0, 5)" 
          :key="genre.genre"
          class="distribution-bar"
        >
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="bar-label text-gray-300">{{ genre.genre }}</span>
            <span class="bar-value text-gray-400">{{ genre.percentage }}% ({{ genre.count }} items)</span>
          </div>
          <div class="bar-track bg-gray-800 rounded-full h-2 overflow-hidden">
            <div 
              class="bar-fill bg-purple-500 h-full rounded-full transition-all" 
              :style="{ width: genre.percentage + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Top Studios -->
    <div v-if="profileStats.studioDistribution?.length" class="distribution-section mb-4">
      <h5 class="text-sm font-semibold text-gray-300 mb-2">Top Studios</h5>
      <ul class="studio-list space-y-1">
        <li 
          v-for="studio in profileStats.studioDistribution" 
          :key="studio.studio"
          class="text-sm text-gray-300"
        >
          <span class="text-gray-400">•</span> {{ studio.studio }} 
          <span class="text-gray-500">({{ studio.percentage }}%)</span>
        </li>
      </ul>
    </div>
    
    <!-- Languages -->
    <div v-if="profileStats.languageDistribution?.length" class="distribution-section">
      <h5 class="text-sm font-semibold text-gray-300 mb-2">Languages</h5>
      <div class="language-tags flex flex-wrap gap-2">
        <span 
          v-for="lang in profileStats.languageDistribution" 
          :key="lang.language"
          class="language-tag px-2 py-1 bg-gray-800 text-gray-300 rounded-sm text-sm"
        >
          {{ lang.language }}: {{ lang.percentage }}%
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-4 text-gray-400">
      Loading profile statistics...
    </div>

    <!-- Error State -->
    <div v-if="error" class="text-center py-4 text-red-400">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  classificationId: {
    type: Number,
    required: true
  }
});

const profileStats = ref(null);
const loading = ref(false);
const error = ref(null);

const loadProfileStats = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/classification/history/${props.classificationId}/profile`);
    if (response.ok) {
      profileStats.value = await response.json();
    } else {
      error.value = 'Profile not available for this classification';
    }
  } catch (err) {
    console.error('Failed to load profile stats:', err);
    error.value = 'Failed to load profile statistics';
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
};

onMounted(() => {
  loadProfileStats();
});
</script>

<style scoped>
.library-profile-panel {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bar-fill {
  transition: width 0.5s ease-out;
}
</style>

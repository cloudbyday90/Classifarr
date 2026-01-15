<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Statistics & Analytics</h1>
      <p class="text-gray-400 text-sm">Performance metrics and trends</p>
    </div>

    <!-- Tab Navigation -->
    <div class="border-b border-gray-700">
      <nav class="-mb-px flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === tab.id
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          ]"
        >
          {{ tab.icon }} {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <component :is="currentTabComponent" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ClassificationStats from './statistics/ClassificationStats.vue'
import RAGStats from './statistics/RAGStats.vue'

const activeTab = ref('classification')

const tabs = [
  { id: 'classification', label: 'Classification', icon: '🎯', component: ClassificationStats },
  { id: 'rag', label: 'RAG & Embeddings', icon: '🧠', component: RAGStats }
]

const currentTabComponent = computed(() => {
  return tabs.find(t => t.id === activeTab.value)?.component
})
</script>

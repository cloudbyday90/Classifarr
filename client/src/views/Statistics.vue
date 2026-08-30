<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">
        Statistics & Analytics
      </h1>
      <p class="text-gray-400 text-sm">
        Performance metrics and trends
      </p>
    </div>

    <!-- Tab Navigation -->
    <div class="border-b border-gray-700">
      <nav class="-mb-px flex overflow-x-auto space-x-4 sm:space-x-8 scrollbar-none">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'whitespace-nowrap flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === tab.id
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          ]"
          @click="activeTab = tab.id"
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
import CandidateBoundVerificationStats from './statistics/CandidateBoundVerificationStats.vue'
import ClassificationStats from './statistics/ClassificationStats.vue'
import CurrentLibraryCandidateRetrievalStats from './statistics/CurrentLibraryCandidateRetrievalStats.vue'
import RAGStats from './statistics/RAGStats.vue'

const tabs = [
  { id: 'classification', label: 'Classification', icon: '🎯', component: ClassificationStats },
  { id: 'verification', label: 'Verification', icon: '🛡️', component: CandidateBoundVerificationStats },
  { id: 'retrieval', label: 'Candidate Retrieval', icon: '🔎', component: CurrentLibraryCandidateRetrievalStats },
  { id: 'rag', label: 'RAG & Embeddings', icon: '🧠', component: RAGStats }
]

const requestedTab = typeof window === 'undefined'
  ? null
  : new URLSearchParams(window.location.search).get('tab')
const activeTab = ref(tabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'classification')

const currentTabComponent = computed(() => {
  return tabs.find(t => t.id === activeTab.value)?.component
})
</script>

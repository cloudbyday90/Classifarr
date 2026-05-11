<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">RAG Settings</h1>
    </div>

    <!-- Tab Navigation -->
    <div class="border-b border-gray-700">
      <nav class="-mb-px flex overflow-x-auto space-x-4 sm:space-x-8 scrollbar-none">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="setActiveTab(tab.id)"
          :class="[
            'whitespace-nowrap flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === tab.id
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
          ]"
        >
          <span class="mr-1">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Status Bar -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
      <div class="space-y-3 text-sm">
        <!-- Text Embeddings row -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/40 text-xs uppercase tracking-wide">
            Text Embeddings
          </span>
          <div class="flex items-center gap-2">
            <span :class="['w-2 h-2 rounded-full', statusBar.textOnline ? 'bg-green-500' : 'bg-red-500']"></span>
            <span class="text-gray-400">Status:</span>
            <span :class="statusBar.textOnline ? 'text-green-400' : 'text-red-400'">
              {{ statusBar.textOnline ? 'Online' : 'Offline' }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span :class="['w-2 h-2 rounded-full', statusBar.heartbeatActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500']"></span>
            <span class="text-gray-400">Heartbeat:</span>
            <span :class="statusBar.heartbeatActive ? 'text-green-400' : 'text-gray-400'">
              {{ statusBar.heartbeatActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">📊 Queue:</span>
            <span class="text-white">{{ formatStatusCount(statusBar.queueText) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">📁 Total:</span>
            <span class="text-white">{{ formatStatusCount(statusBar.totalTextEmbeddings) }}</span>
          </div>
        </div>

        <!-- Image Embeddings row -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/40 text-xs uppercase tracking-wide">
            Image Embeddings
          </span>
          <div class="flex items-center gap-2">
            <span :class="['w-2 h-2 rounded-full', imageStatusDotClass]"></span>
            <span class="text-gray-400">Status:</span>
            <span :class="imageStatusTextClass">
              {{ imageStatusLabel }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">📊 Queue:</span>
            <span class="text-white">{{ formatStatusCount(statusBar.queueImage) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">📁 Total:</span>
            <span class="text-white">{{ formatStatusCount(statusBar.totalImageEmbeddings) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab Content -->
    <component :is="currentTabComponent" @navigate="setActiveTab" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRagStatusBar } from '@/composables/useRagStatusBar'
import {
  normalizeRagTabId,
  ragTabs as tabs,
  resolveRagTabComponent,
} from './rag/ragTabRegistry.js'

const route = useRoute()
const router = useRouter()

// NOTE: Settings.vue uses `?tab=` to select the Settings page section.
// RAG Settings is a nested tab UI, so we store its state in `?ragTab=` to avoid collisions.
const QUERY_KEY = 'ragTab'
const activeTab = ref(normalizeRagTabId(String(route.query[QUERY_KEY] || 'overview')))

const {
  formatStatusCount,
  imageStatusDotClass,
  imageStatusLabel,
  imageStatusTextClass,
  statusBar,
} = useRagStatusBar()

const setActiveTab = async (tabId) => {
  const nextTab = normalizeRagTabId(String(tabId || 'overview'))
  activeTab.value = nextTab

  const nextQuery = { ...route.query }
  if (nextTab === 'overview') {
    delete nextQuery[QUERY_KEY]
  } else {
    nextQuery[QUERY_KEY] = nextTab
  }

  await router.replace({ query: nextQuery })
}

watch(
  () => route.query[QUERY_KEY],
  (tab) => {
    const normalized = normalizeRagTabId(String(tab || 'overview'))
    if (activeTab.value !== normalized) activeTab.value = normalized
  },
)

const currentTabComponent = computed(() => {
  return resolveRagTabComponent(activeTab.value)
})
</script>

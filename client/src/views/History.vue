<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">Classification History</h1>

    <Card>
      <div v-if="loading" class="text-center py-12 text-gray-400">
        Loading history...
      </div>

      <div v-else-if="history.length === 0" class="text-center py-12 text-gray-400">
        No classification history yet
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b border-gray-800">
            <tr class="text-left text-sm text-gray-400">
              <th class="pb-3">Title</th>
              <th class="pb-3">Type</th>
              <th class="pb-3">Library</th>
              <th class="pb-3">Method</th>
              <th class="pb-3">Confidence</th>
              <th class="pb-3">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in history"
              :key="item.id"
              class="border-b border-gray-800 hover:bg-background transition-colors"
            >
              <td class="py-3">
                <div class="font-medium">{{ item.title }}</div>
                <div class="text-sm text-gray-400">{{ item.year }}</div>
              </td>
              <td class="py-3">
                <Badge>{{ item.media_type }}</Badge>
              </td>
              <td class="py-3">{{ item.library_name }}</td>
              <td class="py-3">
                <Badge :variant="getMethodVariant(item.method)">
                  {{ item.method }}
                </Badge>
              </td>
              <td class="py-3">
                <Badge :variant="getConfidenceVariant(item.confidence)">
                  {{ item.confidence }}%
                </Badge>
              </td>
              <td class="py-3 text-sm text-gray-400">
                {{ formatDate(item.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="pagination" class="flex items-center justify-between mt-6">
          <div class="text-sm text-gray-400">
            Page {{ pagination.page }} of {{ pagination.totalPages }}
          </div>
          <div class="flex gap-2">
            <Button
              @click="loadPage(pagination.page - 1)"
              :disabled="pagination.page <= 1"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              @click="loadPage(pagination.page + 1)"
              :disabled="pagination.page >= pagination.totalPages"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'

const history = ref([])
const loading = ref(true)
const pagination = ref(null)

onMounted(async () => {
  await loadPage(1)
})

const loadPage = async (page) => {
  loading.value = true
  try {
    const response = await api.getHistory({ page, limit: 50 })
    history.value = response.data.data
    pagination.value = response.data.pagination
  } catch (error) {
    console.error('Failed to load history:', error)
  } finally {
    loading.value = false
  }
}

const getMethodVariant = (method) => {
  const variants = {
    exact_match: 'success',
    learned_pattern: 'info',
    rule_match: 'default',
    ai_fallback: 'warning',
  }
  return variants[method] || 'default'
}

const getConfidenceVariant = (confidence) => {
  if (confidence >= 90) return 'success'
  if (confidence >= 70) return 'info'
  if (confidence >= 50) return 'warning'
  return 'error'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString()
}
</script>

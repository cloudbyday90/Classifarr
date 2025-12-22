<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Libraries</h1>
      <Button @click="syncLibraries" :loading="syncing">
        🔄 Sync Libraries
      </Button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">
      Loading libraries...
    </div>

    <div v-else-if="libraries.length === 0" class="text-center py-12">
      <div class="text-gray-400 mb-4">No libraries found</div>
      <Button @click="$router.push('/settings')">
        Configure Media Server
      </Button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        v-for="library in libraries"
        :key="library.id"
        class="cursor-pointer hover:border-primary transition-colors"
        @click="$router.push(`/libraries/${library.id}`)"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-lg">{{ library.name }}</h3>
              <p class="text-sm text-gray-400">{{ library.media_type }}</p>
            </div>
            <Badge :variant="library.is_active ? 'success' : 'default'">
              {{ library.is_active ? 'Active' : 'Inactive' }}
            </Badge>
          </div>

          <div class="text-sm space-y-1">
            <div v-if="library.arr_type" class="flex items-center gap-2">
              <span class="text-gray-400">ARR:</span>
              <span>{{ library.arr_type }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-400">Priority:</span>
              <span>{{ library.priority }}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibrariesStore } from '@/stores/libraries'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'

const librariesStore = useLibrariesStore()
const { libraries, loading } = storeToRefs(librariesStore)

const syncing = ref(false)

onMounted(async () => {
  await librariesStore.fetchLibraries()
})

const syncLibraries = async () => {
  syncing.value = true
  try {
    await api.syncMediaServer()
    await librariesStore.fetchLibraries()
  } catch (error) {
    console.error('Failed to sync libraries:', error)
    alert('Failed to sync libraries: ' + error.message)
  } finally {
    syncing.value = false
  }
}
</script>

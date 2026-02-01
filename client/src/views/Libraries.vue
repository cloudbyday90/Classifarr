<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <!-- Mapping Warning Banner -->
    <MappingWarningBanner />

    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Libraries</h1>
      <div class="relative">
        <Button 
          @click="handleSyncClick" 
          :disabled="!syncStore.canStartSync || !canSyncLibraries"
          :loading="syncStore.isRunning && syncStore.type === SYNC_TYPE.LIBRARY_SYNC"
          :title="!canSyncLibraries ? lockdownTooltip : undefined"
        >
          <template v-if="syncStore.isRunning && syncStore.type === SYNC_TYPE.LIBRARY_SYNC">
            Syncing... {{ syncStore.progress }}%
          </template>
          <template v-else-if="syncStore.isRunning">
            {{ syncStore.statusText }}
          </template>
          <template v-else>
            <span v-if="!canSyncLibraries">🔒 </span>🔄 Sync Libraries
          </template>
        </Button>
      </div>
    </div>

    <!-- Progress bar during sync -->
    <div v-if="syncStore.isRunning" class="p-4 bg-gray-800 rounded-lg border border-gray-700">
      <div class="mb-2 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-primary transition-all duration-300"
          :style="{ width: `${syncStore.progress}%` }"
        ></div>
      </div>
      <span class="text-sm text-gray-400">
        {{ syncStore.currentLibrary || 'Processing...' }}
      </span>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">
      Loading libraries...
    </div>

    <div v-else-if="libraries.length === 0" class="text-center py-12">
      <div class="text-gray-400 mb-4">No libraries found</div>
      <Button @click="$router.push('/settings?tab=mediaserver')">
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
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibrariesStore } from '@/stores/libraries'
import { useSyncStatusStore, SYNC_TYPE } from '@/stores/syncStatus'
import { useToast } from '@/stores/toast'
import { useServiceRequirements } from '@/composables/useServiceRequirements'
import { useServiceLockdownToast } from '@/composables/useServiceLockdownToast'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import MappingWarningBanner from '@/components/MappingWarningBanner.vue'

// HTTP status codes
const HTTP_CONFLICT = 409

const librariesStore = useLibrariesStore()
const { libraries, loading } = storeToRefs(librariesStore)

const syncStore = useSyncStatusStore()
const toast = useToast()

// Service lockdown for media server
const { canUseFeature: canSyncLibraries, lockdownTooltip, firstUnavailableService } = useServiceRequirements(['mediaServer'])
const { showLockdownNotification } = useServiceLockdownToast()

onMounted(async () => {
  await librariesStore.fetchLibraries()
  syncStore.startPolling()
})

onUnmounted(() => {
  syncStore.stopPolling()
})

const handleSyncClick = () => {
  // Check if media server is available
  if (!canSyncLibraries.value) {
    showLockdownNotification(firstUnavailableService.value)
    return
  }
  
  syncLibraries()
}

const syncLibraries = async () => {
  try {
    await api.syncMediaServer()
    await librariesStore.fetchLibraries()
  } catch (error) {
    if (error.response?.status === HTTP_CONFLICT) {
      // Sync already running - show message
      toast.warning(error.response.data.message || 'Sync already in progress', 'Sync In Progress')
    } else {
      console.error('Failed to sync libraries:', error)
      toast.error(error.message || 'An error occurred while syncing libraries', 'Sync Failed')
    }
  }
}
</script>

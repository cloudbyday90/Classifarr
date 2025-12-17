<template>
  <div>
    <div v-if="loading" class="flex justify-center py-12">
      <Spinner class="w-12 h-12" />
    </div>
    
    <Alert v-else-if="error" variant="error" :message="error" class="mb-6" />
    
    <div v-else-if="libraries.length === 0" class="text-center py-12">
      <FolderIcon class="w-16 h-16 text-text-muted mx-auto mb-4" />
      <h3 class="text-xl font-semibold text-text mb-2">No Libraries Found</h3>
      <p class="text-text-muted mb-6">Connect your media server to discover libraries</p>
      <Button variant="primary" @click="$router.push('/settings/media-server')">
        Configure Media Server
      </Button>
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="library in libraries"
        :key="library.id"
        @click="$emit('select', library)"
      >
        <LibraryCard
          :library="library"
          :disabled="!library.enabled"
          @toggle="$emit('toggle', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import LibraryCard from './LibraryCard.vue'
import Button from '@/components/common/Button.vue'
import Alert from '@/components/common/Alert.vue'
import Spinner from '@/components/common/Spinner.vue'
import { FolderIcon } from '@heroicons/vue/24/outline'

defineProps({
  libraries: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: null,
  },
})

defineEmits(['select', 'toggle'])
</script>

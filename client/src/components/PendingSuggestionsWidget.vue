<template>
  <div 
    v-if="totalPending > 0"
    class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4"
  >
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-2xl">📊</span>
        <h3 class="font-medium text-white">New Pattern Suggestions</h3>
      </div>
      <span class="bg-purple-600 text-white text-sm font-bold px-2 py-1 rounded-full">
        {{ totalPending }}
      </span>
    </div>
    
    <p class="text-sm text-gray-400 mb-3">
      New filter conditions detected in your libraries based on recent imports.
    </p>
    
    <div class="space-y-2">
      <div 
        v-for="lib in libraries" 
        :key="lib.library_id"
        class="flex items-center justify-between bg-background/50 rounded p-2 hover:bg-background transition-colors cursor-pointer group"
        @click="goToRuleBuilder(lib.library_id)"
      >
        <div>
          <span class="font-medium text-white">{{ lib.library_name }}</span>
          <span class="text-sm text-gray-400 ml-2">{{ lib.pending_count }} patterns</span>
        </div>
        <div class="flex items-center gap-2">
          <button 
            @click.stop="dismiss(lib.library_id)"
            class="text-gray-500 hover:text-gray-300 text-xs"
            title="Dismiss"
          >
            ✕
          </button>
          <span class="text-primary group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

const router = useRouter()

const totalPending = ref(0)
const libraries = ref([])
const loading = ref(true)

const loadSuggestions = async () => {
  try {
    loading.value = true
    const response = await api.getPendingSuggestions()
    totalPending.value = response.data.totalPending
    libraries.value = response.data.libraries
  } catch (error) {
    console.error('Failed to load pending suggestions:', error)
  } finally {
    loading.value = false
  }
}

const goToRuleBuilder = (libraryId) => {
  router.push(`/rule-builder/${libraryId}`)
}

const dismiss = async (libraryId) => {
  try {
    await api.dismissSuggestions(libraryId)
    // Remove from local list
    libraries.value = libraries.value.filter(l => l.library_id !== libraryId)
    totalPending.value = libraries.value.reduce((sum, l) => sum + l.pending_count, 0)
  } catch (error) {
    console.error('Failed to dismiss suggestions:', error)
  }
}

onMounted(() => {
  loadSuggestions()
  // Refresh every 5 minutes
  setInterval(loadSuggestions, 5 * 60 * 1000)
})
</script>

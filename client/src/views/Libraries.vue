<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-text">Libraries</h1>
        <p class="text-text-muted mt-2">Manage media libraries from your server</p>
      </div>
      <Button variant="primary" :loading="syncing" @click="syncLibraries">
        <ArrowPathIcon class="w-5 h-5 mr-2" />
        Sync Libraries
      </Button>
    </div>
    
    <LibraryList
      :libraries="libraries"
      :loading="loading"
      :error="error"
      @select="selectLibrary"
      @toggle="toggleLibrary"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLibrariesStore } from '@/stores/libraries'
import { syncLibraries as syncLibrariesApi } from '@/api/libraries'
import LibraryList from '@/components/libraries/LibraryList.vue'
import Button from '@/components/common/Button.vue'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const librariesStore = useLibrariesStore()

const libraries = ref([])
const loading = ref(false)
const syncing = ref(false)
const error = ref(null)

onMounted(async () => {
  await loadLibraries()
})

const loadLibraries = async () => {
  loading.value = true
  error.value = null
  try {
    libraries.value = await librariesStore.fetchLibraries()
  } catch (err) {
    error.value = err.message
    console.error('Error loading libraries:', err)
  } finally {
    loading.value = false
  }
}

const syncLibraries = async () => {
  syncing.value = true
  try {
    await syncLibrariesApi()
    await loadLibraries()
  } catch (err) {
    error.value = err.message
    console.error('Error syncing libraries:', err)
  } finally {
    syncing.value = false
  }
}

const selectLibrary = (library) => {
  router.push(`/libraries/${library.id}`)
}

const toggleLibrary = async (libraryId, enabled) => {
  try {
    await librariesStore.updateLibrary(libraryId, { enabled })
    await loadLibraries()
  } catch (err) {
    console.error('Error toggling library:', err)
  }
}
</script>

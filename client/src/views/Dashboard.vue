<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-text">Dashboard</h1>
      <p class="text-text-muted mt-2">Overview of your classification system</p>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Total Classifications"
        :value="stats.total"
        :icon="ChartBarIcon"
        variant="primary"
      />
      <StatsCard
        title="Success Rate"
        :value="`${stats.successRate}%`"
        :icon="CheckCircleIcon"
        variant="success"
      />
      <StatsCard
        title="Corrections Needed"
        :value="stats.correctionsNeeded"
        :icon="ExclamationTriangleIcon"
        variant="warning"
      />
      <StatsCard
        title="Libraries"
        :value="libraries.length"
        :icon="FolderIcon"
        variant="primary"
      />
    </div>
    
    <!-- Recent Activity and Quick Actions -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <RecentClassifications
        :classifications="recentClassifications"
        :loading="loading"
        @select="showClassificationDetail"
      />
      <QuickActions />
    </div>
    
    <!-- Classification Detail Modal -->
    <Modal
      v-model="showDetailModal"
      title="Classification Details"
      size="lg"
    >
      <ClassificationDetail
        v-if="selectedClassification"
        :item="selectedClassification"
        @correct="handleCorrection"
      />
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useLibrariesStore } from '@/stores/libraries'
import { useClassificationStore } from '@/stores/classification'
import StatsCard from '@/components/dashboard/StatsCard.vue'
import RecentClassifications from '@/components/dashboard/RecentClassifications.vue'
import QuickActions from '@/components/dashboard/QuickActions.vue'
import Modal from '@/components/common/Modal.vue'
import ClassificationDetail from '@/components/history/ClassificationDetail.vue'
import {
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FolderIcon,
} from '@heroicons/vue/24/outline'

const librariesStore = useLibrariesStore()
const classificationStore = useClassificationStore()

const libraries = ref([])
const stats = ref({
  total: 0,
  successRate: 0,
  correctionsNeeded: 0,
})
const recentClassifications = ref([])
const loading = ref(false)
const showDetailModal = ref(false)
const selectedClassification = ref(null)

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([
      loadLibraries(),
      loadStats(),
      loadRecentClassifications(),
    ])
  } catch (error) {
    console.error('Error loading dashboard:', error)
  } finally {
    loading.value = false
  }
})

const loadLibraries = async () => {
  try {
    libraries.value = await librariesStore.fetchLibraries()
  } catch (error) {
    console.error('Error loading libraries:', error)
    libraries.value = []
  }
}

const loadStats = async () => {
  try {
    stats.value = await classificationStore.fetchStats()
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

const loadRecentClassifications = async () => {
  try {
    const history = await classificationStore.fetchHistory({ limit: 10 })
    recentClassifications.value = history.slice(0, 10)
  } catch (error) {
    console.error('Error loading recent classifications:', error)
    recentClassifications.value = []
  }
}

const showClassificationDetail = (classification) => {
  selectedClassification.value = classification
  showDetailModal.value = true
}

const handleCorrection = async (item) => {
  try {
    await classificationStore.correctClassification(item.id, { corrected: true })
    showDetailModal.value = false
    await loadRecentClassifications()
    await loadStats()
  } catch (error) {
    console.error('Error correcting classification:', error)
  }
}
</script>

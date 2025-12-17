<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-text">Classification History</h1>
        <p class="text-text-muted mt-2">View and manage classification history</p>
      </div>
      <Button variant="secondary" @click="exportHistory">
        <ArrowDownTrayIcon class="w-5 h-5 mr-2" />
        Export
      </Button>
    </div>
    
    <!-- Filters -->
    <HistoryFilters
      :filters="filters"
      @update="updateFilters"
      class="mb-6"
    />
    
    <!-- History Table -->
    <Card>
      <div v-if="loading" class="flex justify-center py-12">
        <Spinner class="w-12 h-12" />
      </div>
      
      <HistoryTable
        v-else
        :items="history"
        @select="showDetail"
      />
    </Card>
    
    <!-- Detail Modal -->
    <Modal
      v-model="showDetailModal"
      title="Classification Details"
      size="lg"
    >
      <ClassificationDetail
        v-if="selectedItem"
        :item="selectedItem"
        @correct="handleCorrection"
      />
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useClassificationStore } from '@/stores/classification'
import { exportHistory as exportHistoryApi } from '@/api/classification'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Modal from '@/components/common/Modal.vue'
import Spinner from '@/components/common/Spinner.vue'
import HistoryTable from '@/components/history/HistoryTable.vue'
import HistoryFilters from '@/components/history/HistoryFilters.vue'
import ClassificationDetail from '@/components/history/ClassificationDetail.vue'
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline'

const classificationStore = useClassificationStore()

const history = ref([])
const loading = ref(false)
const showDetailModal = ref(false)
const selectedItem = ref(null)
const filters = ref({
  type: '',
  library: '',
  status: '',
  dateRange: '',
})

onMounted(async () => {
  await loadHistory()
})

const loadHistory = async () => {
  loading.value = true
  try {
    history.value = await classificationStore.fetchHistory(filters.value)
  } catch (error) {
    console.error('Error loading history:', error)
  } finally {
    loading.value = false
  }
}

const updateFilters = async (newFilters) => {
  filters.value = newFilters
  await loadHistory()
}

const showDetail = (item) => {
  selectedItem.value = item
  showDetailModal.value = true
}

const handleCorrection = async (item) => {
  try {
    await classificationStore.correctClassification(item.id, { corrected: true })
    showDetailModal.value = false
    await loadHistory()
  } catch (error) {
    console.error('Error correcting classification:', error)
  }
}

const exportHistory = async () => {
  try {
    const blob = await exportHistoryApi(filters.value)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `classification-history-${Date.now()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting history:', error)
  }
}
</script>

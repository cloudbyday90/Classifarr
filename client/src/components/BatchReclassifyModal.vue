<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal
    v-model="showModal"
    :title="modalTitle"
  >
    <!-- Step 1: Configure Batch -->
    <div
      v-if="step === 'configure'"
      class="space-y-4"
    >
      <div class="text-sm text-gray-400 mb-4">
        {{ items.length }} item(s) selected for reclassification
      </div>

      <!-- Items Preview -->
      <div class="max-h-60 overflow-y-auto border border-gray-700 rounded-lg">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-center justify-between p-3 border-b border-gray-700 last:border-b-0"
        >
          <div>
            <div class="font-medium">
              {{ item.title }}
            </div>
            <div class="text-sm text-gray-400">
              {{ item.media_type }} • Current: {{ item.library_name || 'Unknown' }}
            </div>
          </div>
          <div>
            <select
              v-model="itemTargets[item.id]"
              class="bg-background border border-gray-700 rounded-sm px-2 py-1 text-sm"
            >
              <option
                value=""
                disabled
              >
                Select library...
              </option>
              <option
                v-for="lib in getCompatibleLibraries(item.media_type)"
                :key="lib.id"
                :value="lib.id"
              >
                {{ lib.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Options -->
      <div class="flex items-center gap-2 pt-4 border-t border-gray-700">
        <input
          id="pauseOnError"
          v-model="pauseOnError"
          type="checkbox"
          class="w-4 h-4 rounded-sm"
        >
        <label
          for="pauseOnError"
          class="text-sm text-gray-400"
        >
          Pause on error (recommended)
        </label>
      </div>
    </div>

    <!-- Step 2: Validating -->
    <div
      v-else-if="step === 'validating'"
      class="space-y-4"
    >
      <div class="text-center py-8">
        <Spinner class="mx-auto mb-4" />
        <p class="text-gray-400">
          Validating {{ items.length }} items...
        </p>
      </div>
    </div>

    <!-- Step 3: Validation Results -->
    <div
      v-else-if="step === 'validated'"
      class="space-y-4"
    >
      <div class="flex items-center gap-4 mb-4">
        <Badge variant="success">
          {{ validCount }} Valid
        </Badge>
        <Badge
          v-if="invalidCount"
          variant="error"
        >
          {{ invalidCount }} Invalid
        </Badge>
      </div>

      <div
        v-if="invalidCount > 0"
        class="text-yellow-400 text-sm mb-4"
      >
        ⚠️ Some items failed validation. They will be skipped during execution.
      </div>

      <div class="max-h-60 overflow-y-auto border border-gray-700 rounded-lg">
        <div
          v-for="item in batchStatus?.items || []"
          :key="item.id"
          class="flex items-center justify-between p-3 border-b border-gray-700 last:border-b-0"
        >
          <div>
            <div class="font-medium">
              {{ item.title }}
            </div>
            <div class="text-sm text-gray-400">
              {{ item.original_library_name }} → {{ item.target_library_name }}
            </div>
          </div>
          <Badge :variant="item.status === 'validated' ? 'success' : 'error'">
            {{ item.status }}
          </Badge>
        </div>
      </div>
    </div>

    <!-- Step 4: Executing -->
    <div
      v-else-if="step === 'executing'"
      class="space-y-4"
    >
      <div class="mb-4">
        <p
          v-if="batchStatus?.status === 'executing'"
          role="status"
          class="text-sm text-gray-400 mb-3"
        >
          Batch active. Work continues in the background, including after a restart.
          Closing this window does not pause it. Pause or cancel to stop remaining items.
        </p>
        <div class="flex justify-between text-sm text-gray-400 mb-2">
          <span>Progress</span>
          <span>{{ progress.completed }}/{{ progress.total }}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Batch completion"
          :aria-valuenow="progress.completed"
          :aria-valuemax="progress.total"
          aria-valuemin="0"
          class="w-full bg-gray-700 rounded-full h-3"
        >
          <div
            class="bg-primary h-3 rounded-full transition-all duration-300"
            :style="{ width: `${progress.percentage}%` }"
          />
        </div>
      </div>

      <div class="flex items-center gap-4">
        <Badge variant="success">
          {{ progress.completed }} Completed
        </Badge>
        <Badge
          v-if="progress.failed"
          variant="error"
        >
          {{ progress.failed }} Failed
        </Badge>
        <Badge
          v-if="progress.skipped"
          variant="warning"
        >
          {{ progress.skipped }} Skipped
        </Badge>
      </div>

      <div
        v-if="batchStatus?.status === 'paused'"
        class="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mt-4"
      >
        <div class="flex items-center gap-2 text-yellow-400 font-semibold mb-2">
          ⏸️ Execution Paused
        </div>
        <p class="text-sm text-gray-400 mb-3">
          {{ allItemsFinished ? 'All items are finished. The batch remains paused; there is nothing left to resume.' : progress.failed ? batchStatus.error_message : 'No failed items remain. The batch stays paused until you choose Resume.' }}
        </p>
        <div class="flex gap-2">
          <Button
            v-if="progress.failed"
            variant="warning"
            size="sm"
            @click="skipCurrentItem"
          >
            Skip & Continue
          </Button>
          <Button
            v-if="progress.failed"
            size="sm"
            @click="retryCurrentItem"
          >
            Retry
          </Button>
          <Button
            v-if="!allItemsFinished"
            variant="secondary"
            size="sm"
            @click="cancelBatch"
          >
            Cancel Remaining
          </Button>
        </div>
        <p
          v-if="!allItemsFinished"
          class="mt-3 text-sm text-gray-400"
        >
          Skipping or cancelling remaining items does not undo a move that already started; its recovery may still finish.
        </p>
      </div>
    </div>

    <!-- Step 5: Complete -->
    <div
      v-else-if="step === 'complete'"
      class="space-y-4"
    >
      <div class="text-center py-4">
        <div class="text-4xl mb-4">
          {{ batchStatus?.status === 'completed' && !progress.failed ? '✅' : '⚠️' }}
        </div>
        <h3 class="text-xl font-semibold mb-2">
          {{ batchStatus?.status === 'completed' && !progress.failed ? 'Batch Complete!' : 'Batch Finished with Issues' }}
        </h3>
        <div class="flex items-center justify-center gap-4 mt-4">
          <Badge variant="success">
            {{ progress.completed }} Completed
          </Badge>
          <Badge
            v-if="progress.failed"
            variant="error"
          >
            {{ progress.failed }} Failed
          </Badge>
          <Badge
            v-if="progress.skipped"
            variant="warning"
          >
            {{ progress.skipped }} Skipped
          </Badge>
        </div>
      </div>
    </div>

    <div
      v-if="['executing', 'complete'].includes(step)"
      class="mt-4 space-y-3"
    >
      <p
        role="status"
        aria-atomic="true"
        class="text-sm"
      >
        {{ recoveryError ? 'Status unavailable; displayed results may be out of date.' : `${progress.completed} completed, ${progress.failed} failed.` }}
      </p>
      <div
        v-for="item in batchStatus?.items || []"
        :key="item.id"
      >
        <template v-if="item.move_recovery || item.execution_result?.moveReconciled">
          <p class="font-medium">
            {{ item.title || `Item ${item.classification_id}` }}
          </p>
          <MoveRecoveryStatus
            :recovery="item.move_recovery"
            :reconciled="item.execution_result?.moveReconciled === true"
          />
        </template>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <Button
        v-if="step === 'configure'"
        variant="secondary"
        @click="close"
      >
        Cancel
      </Button>
      <Button
        v-if="step === 'configure'"
        :disabled="!canValidate"
        @click="startValidation"
      >
        Validate & Continue
      </Button>

      <Button
        v-if="step === 'validated'"
        variant="secondary"
        @click="step = 'configure'"
      >
        Back
      </Button>
      <Button
        v-if="step === 'validated' && validCount > 0"
        @click="startExecution"
      >
        Execute {{ validCount }} Items
      </Button>

      <Button
        v-if="step === 'executing' && batchStatus?.status === 'executing'"
        variant="warning"
        @click="pauseBatch"
      >
        Pause
      </Button>
      <Button
        v-if="step === 'executing' && batchStatus?.status === 'paused' && !allItemsFinished"
        @click="resumeBatch"
      >
        Resume
      </Button>

      <Button
        v-if="step === 'complete' || (batchStatus?.status === 'paused' && allItemsFinished)"
        @click="close"
      >
        Close
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useLibrariesStore } from '@/stores/libraries'
import api from '@/api'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import Spinner from '@/components/common/Spinner.vue'
import MoveRecoveryStatus from '@/components/history/MoveRecoveryStatus.vue'
import { useSWR } from '@/composables/useSWR'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  items: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'complete'])

const librariesStore = useLibrariesStore()
const libraries = computed(() => librariesStore.libraries)

const step = ref('configure')
const pauseOnError = ref(true)
const itemTargets = ref({})
const batchId = ref(null)
const batchStatus = ref(null)
const polling = ref(false)

const showModal = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const modalTitle = computed(() => {
  if (step.value === 'executing' && batchStatus.value?.status === 'paused') return 'Batch Paused'
  const titles = {
    configure: 'Batch Reclassification',
    validating: 'Validating...',
    validated: 'Validation Complete',
    executing: 'Executing Batch',
    complete: 'Batch Complete'
  }
  return titles[step.value] || 'Batch Reclassification'
})

const canValidate = computed(() => {
  return props.items.every(item => itemTargets.value[item.id])
})

const validCount = computed(() => {
  return batchStatus.value?.items?.filter(i => i.status === 'validated').length || 0
})

const invalidCount = computed(() => {
  return batchStatus.value?.items?.filter(i => i.status === 'invalid').length || 0
})

const progress = computed(() => {
  return batchStatus.value?.progress || {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    percentage: 0
  }
})

const hasPendingRecovery = computed(() => batchStatus.value?.items?.some(item =>
  ['moving', 'files_verified'].includes(item.move_recovery?.state)))
const allItemsFinished = computed(() => progress.value.total > 0 && progress.value.failed === 0 &&
  progress.value.completed + progress.value.skipped + (progress.value.cancelled || 0) >= progress.value.total)
const { data: recoveryData, error: recoveryError, refresh: refreshRecovery } = useSWR(
  'reclassification-batch-recovery',
  async () => {
    const id = batchId.value
    if (!id || !showModal.value || !polling.value) return null
    return { id, batch: await api.getReclassificationBatchStatus(id) }
  },
  { persist: false, pollInterval: () => polling.value && showModal.value ? 2000 : null },
)
watch(recoveryData, value => {
  if (!value || value.id !== batchId.value || !showModal.value || !polling.value) return
  const previousCompleted = progress.value.completed
  batchStatus.value = value.batch
  if (['completed', 'cancelled', 'failed'].includes(value.batch.status)) {
    const wasComplete = step.value === 'complete'
    step.value = 'complete'
    if (!wasComplete || progress.value.completed !== previousCompleted) emit('complete')
    if (!hasPendingRecovery.value) stopPolling()
  } else if (progress.value.completed !== previousCompleted) {
    emit('complete')
  }
})

const getCompatibleLibraries = (mediaType) => {
  return libraries.value.filter(lib => lib.media_type === mediaType)
}

const close = () => {
  stopPolling()
  step.value = 'configure'
  itemTargets.value = {}
  batchId.value = null
  batchStatus.value = null
  emit('update:modelValue', false)
}

const startValidation = async () => {
  step.value = 'validating'
  try {
    // Create batch
    const batchItems = props.items.map(item => ({
      classificationId: item.id,
      targetLibraryId: itemTargets.value[item.id]
    }))

    const createResponse = await api.createReclassificationBatch(batchItems, pauseOnError.value)
    batchId.value = createResponse.data.id

    // Validate batch
    const validateResponse = await api.validateReclassificationBatch(batchId.value)
    batchStatus.value = validateResponse.data
    step.value = 'validated'
  } catch (error) {
    console.error('Validation failed:', error)
    alert('Validation failed: ' + error.message)
    step.value = 'configure'
  }
}

const startExecution = async () => {
  step.value = 'executing'
  startPolling()
  try {
    await api.executeReclassificationBatch(batchId.value)
    await refreshBatchStatus()
  } catch (error) {
    console.error('Execution failed:', error)
  }
}

const pauseBatch = async () => {
  try {
    await api.pauseReclassificationBatch(batchId.value)
    await refreshBatchStatus()
  } catch (error) {
    console.error('Pause failed:', error)
  }
}

const resumeBatch = async () => {
  try {
    await api.resumeReclassificationBatch(batchId.value)
    startPolling()
    await refreshBatchStatus()
  } catch (error) {
    console.error('Resume failed:', error)
  }
}

const cancelBatch = async () => {
  try {
    await api.cancelReclassificationBatch(batchId.value)
    await refreshBatchStatus()
    step.value = 'complete'
  } catch (error) {
    console.error('Cancel failed:', error)
  }
}

const skipCurrentItem = async () => {
  const failedItem = batchStatus.value?.items?.find(i => i.status === 'failed')
  if (failedItem) {
    try {
      await api.skipReclassificationItem(batchId.value, failedItem.id)
      await resumeBatch()
    } catch (error) {
      console.error('Skip failed:', error)
    }
  }
}

const retryCurrentItem = async () => {
  const failedItem = batchStatus.value?.items?.find(i => i.status === 'failed')
  if (failedItem) {
    try {
      await api.retryReclassificationItem(batchId.value, failedItem.id)
      await resumeBatch()
    } catch (error) {
      console.error('Retry failed:', error)
    }
  }
}

const refreshBatchStatus = async () => {
  if (!batchId.value) return
  polling.value = true
  await refreshRecovery()
}

const startPolling = () => {
  polling.value = true
}

const stopPolling = () => {
  polling.value = false
}

// useSWR handles unmount; closing or reopening the modal controls polling here.
watch(showModal, (val) => {
  if (!val) {
    stopPolling()
  } else if (batchId.value && ['executing', 'complete'].includes(step.value)) {
    void refreshBatchStatus()
  }
})

// Initialize item targets when items change
watch(() => props.items, (newItems) => {
  itemTargets.value = {}
  newItems.forEach(item => {
    itemTargets.value[item.id] = ''
  })
}, { immediate: true })
</script>

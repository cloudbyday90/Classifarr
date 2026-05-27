<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="mobile-sheet-overlay"
      aria-hidden="false"
    >
      <button
        type="button"
        class="mobile-sheet-backdrop"
        aria-label="Close processing details"
        @click="$emit('close')"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="processing-bottom-sheet-title"
        class="mobile-sheet"
      >
        <div class="mobile-sheet-header">
          <h3
            id="processing-bottom-sheet-title"
            class="mobile-sheet-title"
          >
            Processing Details
          </h3>
          <button
            ref="closeButtonRef"
            type="button"
            class="mobile-sheet-close"
            @click="$emit('close')"
          >
            Close
          </button>
        </div>
        <div
          v-if="task"
          class="mobile-sheet-content"
        >
          <p class="mobile-sheet-item-title">
            {{ task.title }}
            <span
              v-if="task.year"
              class="mobile-sheet-item-year"
            >({{ task.year }})</span>
          </p>
          <p class="mobile-sheet-item-meta">
            Phase: {{ phaseLabel(task.currentPhase) }} • Step {{ task.phaseIndex || 1 }}/{{ task.totalPhases || 8 }}
          </p>
          <div class="mobile-sheet-stepper">
            <div
              v-for="row in phaseRows(task)"
              :key="`mobile-${row.name}`"
              class="mobile-stepper-item"
            >
              <span
                class="mobile-stepper-marker"
                :class="row.statusClass"
              >{{ row.marker }}</span>
              <span
                class="mobile-stepper-label"
                :class="row.textClass"
              >{{ row.label }}</span>
              <span
                v-if="row.timing"
                class="mobile-stepper-timing"
              >{{ row.timing }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  phaseLabel: {
    type: Function,
    required: true,
  },
  phaseRows: {
    type: Function,
    required: true,
  },
  task: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close'])

const closeButtonRef = ref(null)

function handleSheetKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

watch(() => props.open, async (isOpen) => {
  if (typeof document === 'undefined') return

  if (isOpen) {
    await nextTick()
    closeButtonRef.value?.focus()
    document.addEventListener('keydown', handleSheetKeydown)
    document.body.classList.add('overflow-hidden')
  } else {
    document.removeEventListener('keydown', handleSheetKeydown)
    document.body.classList.remove('overflow-hidden')
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', handleSheetKeydown)
    document.body.classList.remove('overflow-hidden')
  }
})
</script>

<style scoped>
.mobile-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.mobile-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.mobile-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 85vh;
  overflow-y: auto;
  border-radius: 1rem 1rem 0 0;
  border: 1px solid #374151;
  background: #111827;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.mobile-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.mobile-sheet-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #f3f4f6;
}

.mobile-sheet-close {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid #4b5563;
  background: #1f2937;
  color: #e5e7eb;
  font-size: 0.75rem;
  cursor: pointer;
}

.mobile-sheet-close:hover {
  background: #374151;
}

.mobile-sheet-item-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #f3f4f6;
}

.mobile-sheet-item-year {
  font-weight: 400;
  color: #6b7280;
}

.mobile-sheet-item-meta {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.mobile-sheet-stepper {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: #030712;
}

.mobile-stepper-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.375rem 0;
}

.mobile-stepper-marker {
  width: 1rem;
  text-align: center;
  font-size: 0.75rem;
}

.mobile-stepper-complete {
  color: #22c55e;
}

.mobile-stepper-in_progress {
  color: #60a5fa;
}

.mobile-stepper-pending {
  color: #6b7280;
}

.mobile-stepper-skipped {
  color: #f59e0b;
}

.mobile-stepper-label {
  font-size: 0.8125rem;
}

.mobile-stepper-label-complete {
  color: #9ca3af;
}

.mobile-stepper-label-in_progress {
  color: #60a5fa;
}

.mobile-stepper-label-pending {
  color: #6b7280;
}

.mobile-stepper-label-skipped {
  color: #fbbf24;
}

.mobile-stepper-timing {
  margin-left: auto;
  font-size: 0.75rem;
  color: #6b7280;
}
</style>

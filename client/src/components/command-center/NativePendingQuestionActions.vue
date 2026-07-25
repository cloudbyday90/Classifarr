<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="native-pending-question-actions"
    :aria-labelledby="headingId"
  >
    <h4
      :id="headingId"
      class="native-pending-question-title"
    >
      Resolve this item
    </h4>
    <p class="native-pending-question-copy">
      These choices resolve only this item. They do not update future policy learning.
    </p>
    <div class="question-actions">
      <Button
        v-for="action in presentation.actions"
        :key="action.id"
        :variant="action.variant"
        size="sm"
        :disabled="isResolving"
        :aria-busy="isResolving"
        @click="$emit('resolve-option', action)"
      >
        {{ action.label }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="isResolving"
        @click="$emit('choose-alternative', presentation.alternativeDestination)"
      >
        {{ presentation.alternativeDestination.label }}
      </Button>
    </div>
    <Button
      variant="warning"
      size="sm"
      class="native-pending-question-retry"
      :disabled="isRetrying || isResolving"
      :loading="isRetrying"
      @click="$emit('retry-item')"
    >
      Retry Classification
    </Button>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Button } from '@/components/common'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  presentation: {
    type: Object,
    required: true,
  },
  isActionBusy: {
    type: Function,
    required: true,
  },
})

defineEmits(['choose-alternative', 'resolve-option', 'retry-item'])

const headingId = computed(() => `native-pending-question-${props.item.id}`)
const isResolving = computed(() => props.isActionBusy(`resolve-${props.item.id}`))
const isRetrying = computed(() => props.isActionBusy(`retry-classification-${props.item.id}`))
</script>

<style scoped>
.native-pending-question-actions {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #3b82f6;
  border-radius: 0.375rem;
  background: rgba(30, 64, 175, 0.12);
}

.native-pending-question-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #dbeafe;
}

.native-pending-question-copy {
  margin: 0.25rem 0 0.75rem;
  font-size: 0.75rem;
  color: #bfdbfe;
}

.question-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.native-pending-question-retry {
  margin-top: 0.75rem;
}
</style>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/75"
          @click="close"
        />
        <div
          ref="dialogRef"
          class="relative bg-background-light rounded-lg border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : null"
          tabindex="-1"
          v-bind="$attrs"
          @keydown="onKeydown"
        >
          <div class="flex items-center justify-between p-6 border-b border-gray-800">
            <h3
              v-if="title"
              :id="titleId"
              ref="titleRef"
              class="rounded-sm text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-background-light"
              tabindex="-1"
            >
              {{ title }}
            </h3>
            <button
              type="button"
              class="text-primary hover:text-primary-light text-2xl leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-background-light"
              :aria-label="closeLabel"
              @click="close"
            >
              &times;
            </button>
          </div>
          <div class="p-6">
            <slot />
          </div>
          <div
            v-if="$slots.footer"
            class="flex items-center justify-end gap-3 p-6 border-t border-gray-800"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { useModalFocusManagement } from '@/composables/useModalFocusManagement'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  restoreFocus: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue'])

const dialogRef = ref(null)
const titleRef = ref(null)
const titleId = `modal-title-${useId()}`
const closeLabel = computed(() => (
  props.title ? `Close ${props.title}` : 'Close dialog'
))

const { handleKeydown } = useModalFocusManagement({
  isOpen: computed(() => props.modelValue),
  dialogRef,
  titleRef,
  restoreFocus: computed(() => props.restoreFocus),
})

const onKeydown = event => {
  if (handleKeydown(event) === false) close()
}

const close = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

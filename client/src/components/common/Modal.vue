<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Teleport to="body">
    <dialog
      v-if="modelValue"
      ref="dialogRef"
      class="modal-panel bg-background-light rounded-lg border border-gray-800 max-w-2xl overflow-y-auto"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
      v-bind="$attrs"
      :onKeydown="onKeydown"
      :onCancel="onCancel"
      :onPointerdown="onPointerdown"
      :onPointercancel="onPointercancel"
      :onClick="onBackdropClick"
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
          class="text-primary hover:text-primary-light text-2xl leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-background-light disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="closeDisabled"
          :aria-label="closeLabel"
          :onClick="close"
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
    </dialog>
  </Teleport>
</template>

<script setup>
import { computed, useId, useTemplateRef } from 'vue'
import { useModalFocusManagement } from '@/composables/useModalFocusManagement'
import { useModalDismissal } from '@/composables/useModalDismissal'

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
  closeDisabled: {
    type: Boolean,
    default: false,
  },
  fallbackFocusTarget: {
    type: /** @type {import('vue').PropType<() => HTMLElement | null>} */ (Function),
    default: () => null,
  },
})

const emit = defineEmits({
  'update:modelValue': /** @param {boolean} value */ value => typeof value === 'boolean',
})

const dialogRef = useTemplateRef('dialogRef')
const titleRef = useTemplateRef('titleRef')
const titleId = `modal-title-${useId()}`
const closeLabel = computed(() => (
  props.title ? `Close ${props.title}` : 'Close dialog'
))

const { handleKeydown } = useModalFocusManagement({
  isOpen: computed(() => props.modelValue),
  dialogRef,
  titleRef,
  restoreFocus: computed(() => props.restoreFocus),
  fallbackFocusTarget: () => props.fallbackFocusTarget(),
})

/** @param {KeyboardEvent} event */
const onKeydown = event => {
  if (handleKeydown(event) === false) close()
}

const close = () => {
  if (props.closeDisabled) return
  emit('update:modelValue', false)
}

const { onCancel, onPointerdown, onPointercancel, onBackdropClick } = useModalDismissal(dialogRef, close)
</script>

<style scoped>
.modal-panel {
  margin: auto;
  padding: 0;
  width: calc(100% - 2rem);
  max-height: 90dvh;
  color: inherit;
  animation: modal-enter 0.15s ease;
}

.modal-panel::backdrop {
  background: rgb(0 0 0 / 75%);
}

@keyframes modal-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .modal-panel {
    animation: none;
  }
}
</style>

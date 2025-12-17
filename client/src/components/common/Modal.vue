<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="fixed inset-0 bg-black/75" @click="close"></div>
        
        <div
          :class="[
            'relative bg-card rounded-lg shadow-xl max-h-[90vh] overflow-y-auto',
            sizeClass,
          ]"
        >
          <div class="sticky top-0 bg-card border-b border-gray-700 px-6 py-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold text-text">{{ title }}</h2>
            <button
              @click="close"
              class="text-text-muted hover:text-text transition-colors"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <div class="p-6">
            <slot />
          </div>
          
          <div v-if="$slots.footer" class="sticky bottom-0 bg-card border-t border-gray-700 px-6 py-4">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value),
  },
})

const emit = defineEmits(['update:modelValue'])

const close = () => {
  emit('update:modelValue', false)
}

const sizeClass = computed(() => {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }
  return sizes[props.size] + ' w-full'
})
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

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.3s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>

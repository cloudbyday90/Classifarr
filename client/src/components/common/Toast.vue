<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="flex items-start gap-3 p-4 rounded-lg shadow-lg border"
          :class="toastClasses(toast.type)"
        >
          <span class="text-xl">{{ toastIcon(toast.type) }}</span>
          <div class="flex-1">
            <div v-if="toast.title" class="font-medium">{{ toast.title }}</div>
            <div class="text-sm opacity-90">{{ toast.message }}</div>
          </div>
          <button @click="removeToast(toast.id)" class="opacity-60 hover:opacity-100">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToastStore } from '@/stores/toast'
import { storeToRefs } from 'pinia'

const toastStore = useToastStore()
const { toasts } = storeToRefs(toastStore)
const { removeToast } = toastStore

const toastClasses = (type) => ({
  'success': 'bg-green-900/90 border-green-700 text-green-100',
  'error': 'bg-red-900/90 border-red-700 text-red-100',
  'warning': 'bg-yellow-900/90 border-yellow-700 text-yellow-100',
  'info': 'bg-blue-900/90 border-blue-700 text-blue-100'
}[type])

const toastIcon = (type) => ({
  'success': '✅',
  'error': '❌',
  'warning': '⚠️',
  'info': 'ℹ️'
}[type])
</script>

<style scoped>
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>

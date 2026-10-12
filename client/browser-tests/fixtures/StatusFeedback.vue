<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref } from 'vue'
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
import Toast from '@/components/common/Toast.vue'
import { useToastStore } from '@/stores/toast'

const store = useToastStore()
const submissions = ref(0)
const sample = '<img src=x onerror="alert(1)">'
function showNotifications() {
  store.addToast({ title: 'Saved sample', message: sample, duration: 0 })
  store.addToast({ type: 'warning', message: 'Check sample connection', duration: 0 })
}
</script>

<template>
  <main class="p-6 max-w-lg space-y-4">
    <h1>Status feedback fixture</h1>
    <ConnectionStatus
      status="error"
      :error="`Connection failed: ${sample}`"
    />
    <ConnectionStatus
      status="success"
      details="Connection successful!"
    />
    <form @submit.prevent="submissions++">
      <button
        type="button"
        :onClick="showNotifications"
      >
        Show sample notifications
      </button>
      <Toast />
    </form>
    <output aria-label="Status form submissions">{{ submissions }}</output>
    <output aria-label="Remaining notifications">{{ store.toasts.length }}</output>
  </main>
</template>

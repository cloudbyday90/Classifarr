<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal v-model="isOpen" title="⚠️ Clear & Re-sync All">
    <div class="space-y-4">
      <div class="p-4 bg-error/10 border border-error/30 rounded-lg">
        <p class="font-semibold mb-2">This will:</p>
        <ul class="list-disc list-inside space-y-1 text-sm">
          <li>Stop any active sync operation</li>
          <li>Delete ALL classification history and embeddings</li>
          <li>Delete ALL library data and collections</li>
          <li>Re-sync everything fresh from your media server</li>
        </ul>
      </div>

      <div class="p-4 bg-primary/10 border border-primary/30 rounded-lg">
        <p class="font-semibold mb-2">What happens to your settings:</p>
        <ul class="list-disc list-inside space-y-1 text-sm">
          <li>✅ Policies and presets will be <strong>preserved</strong></li>
          <li>✅ AI provider settings will be <strong>preserved</strong></li>
          <li>✅ Discord settings will be <strong>preserved</strong></li>
          <li>✅ Radarr/Sonarr connections will be <strong>preserved</strong></li>
          <li>🔄 Radarr/Sonarr library mappings will be <strong>auto-restored</strong></li>
        </ul>
      </div>

      <div class="p-4 bg-gray-800 border border-gray-700 rounded-lg">
        <p class="text-sm">
          <strong>Note:</strong> RAG embeddings will be cleared and will rebuild
          automatically. This may take some time depending on your library size.
        </p>
      </div>
    </div>

    <template #footer>
      <Button variant="secondary" @click="close">Cancel</Button>
      <Button variant="error" @click="confirm">
        🗑️ Clear & Re-sync All
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref } from 'vue'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'

const isOpen = ref(false)
const emit = defineEmits(['confirm'])

const open = () => {
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
}

const confirm = () => {
  emit('confirm')
  close()
}

defineExpose({ open, close })
</script>

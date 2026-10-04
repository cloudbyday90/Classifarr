<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import PolicyBuilderModal from '@/components/policies/PolicyBuilderModal.vue'
import PresetsManager from '@/views/PresetsManager.vue'

const open = ref(false)
const route = useRoute()
</script>

<template>
  <main class="p-6">
    <template v-if="route.name === 'Fixture'">
      <button
        type="button"
        @click="open = true"
      >
        Open policy builder
      </button>
      <PresetsManager />
    </template>
    <!-- Kept mounted across navigation, so the caller must release modality. -->
    <PolicyBuilderModal
      v-if="open"
      v-model="open"
      :library-id="1"
    />
    <RouterView />
  </main>
</template>

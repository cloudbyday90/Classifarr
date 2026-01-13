<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Card class="hover:border-primary transition-colors">
    <div class="space-y-4">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-1">
            <h3 class="text-lg font-semibold">{{ policy.name }}</h3>
            <Badge :variant="policy.enabled ? 'success' : 'default'">
              {{ policy.enabled ? 'Active' : 'Disabled' }}
            </Badge>
            <Badge variant="info">{{ policy.preset_count || 0 }} presets</Badge>
          </div>
          <p v-if="policy.description" class="text-sm text-gray-400">{{ policy.description }}</p>
        </div>
      </div>

      <!-- Empty State / Thresholds -->
      <div v-if="(!policy.preset_count || policy.preset_count === 0)" class="bg-blue-900 bg-opacity-20 border border-blue-800 rounded p-3 text-center">
        <p class="text-sm text-blue-200 mb-2">No presets selected. Connect signals to this library.</p>
        <Button @click="$emit('add-presets', policy)" variant="primary" size="sm">
          + Add Presets
        </Button>
      </div>
      <div v-else class="flex gap-4 text-sm">
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Auto-classify:</span>
          <span class="font-medium">≥{{ policy.auto_classify_threshold }}%</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Prompt:</span>
          <span class="font-medium">≥{{ policy.prompt_threshold }}%</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">Priority:</span>
          <span class="font-medium">{{ policy.priority }}</span>
        </div>
      </div>

      <!-- Weights -->
      <div v-if="showWeights && policy.preset_count > 0" class="grid grid-cols-4 gap-2 text-xs">
        <div>
          <span class="text-gray-400">Presets:</span>
          <span class="ml-1">{{ Math.round((policy.preset_weight || 0.4) * 100) }}%</span>
        </div>
        <div>
          <span class="text-gray-400">Patterns:</span>
          <span class="ml-1">{{ Math.round((policy.pattern_weight || 0.3) * 100) }}%</span>
        </div>
        <div>
          <span class="text-gray-400">RAG:</span>
          <span class="ml-1">{{ Math.round((policy.rag_weight || 0.2) * 100) }}%</span>
        </div>
        <div>
          <span class="text-gray-400">History:</span>
          <span class="ml-1">{{ Math.round((policy.history_weight || 0.1) * 100) }}%</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2 pt-2 border-t border-gray-800">
        <Button @click="$emit('edit', policy)" variant="ghost" size="sm">
          Edit
        </Button>
        <Button @click="$emit('delete', policy)" variant="ghost" size="sm" class="text-red-400 hover:text-red-300">
          Reset
        </Button>
        <Button v-if="policy.preset_count > 0" @click="showWeights = !showWeights" variant="ghost" size="sm" class="ml-auto">
          {{ showWeights ? 'Hide' : 'Show' }} Weights
        </Button>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'

defineProps({
  policy: {
    type: Object,
    required: true,
  },
})

defineEmits(['edit', 'delete', 'add-presets'])

const showWeights = ref(false)
</script>

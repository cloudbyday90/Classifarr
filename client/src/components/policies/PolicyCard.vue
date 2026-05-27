<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Card class="hover:border-primary transition-colors">
    <div class="space-y-4">
      <!-- Library Header -->
      <div class="flex items-center gap-3 pb-3 border-b border-gray-800">
        <span class="text-2xl">📚</span>
        <div class="flex-1">
          <h4 class="text-sm font-medium text-gray-400">
            {{ policy.library_name || 'Library' }}
          </h4>
        </div>
      </div>

      <!-- Policy Header -->
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-1">
            <h3 class="text-lg font-semibold">
              {{ policy.name }}
            </h3>
            <Badge :variant="policy.enabled ? 'success' : 'default'">
              {{ policy.enabled ? 'Active' : 'Disabled' }}
            </Badge>
            <Badge
              v-if="policy.preset_count > 0"
              variant="info"
            >
              {{ policy.preset_count }} presets
            </Badge>
          </div>
          <p
            v-if="policy.description"
            class="text-sm text-gray-400"
          >
            {{ policy.description }}
          </p>
        </div>
      </div>

      <!-- Empty State / Thresholds -->
      <div
        v-if="(!policy.preset_count || policy.preset_count == 0)"
        class="border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg p-8 text-center"
      >
        <div class="flex flex-col items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <span class="text-2xl text-primary">+</span>
          </div>
          <p class="text-secondary-foreground font-medium">
            No presets configured.
          </p>
          <Button
            variant="primary"
            size="default"
            @click="$emit('configure', policy)"
          >
            Configure
          </Button>
        </div>
      </div>
      <div
        v-else
        class="flex gap-4 text-sm"
      >
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
      <div
        v-if="showWeights && policy.preset_count > 0"
        class="grid grid-cols-4 gap-2 text-xs pt-2"
      >
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

      <!-- Combined Footer -->
      <div class="flex items-center justify-between pt-4 mt-2 border-t border-gray-800">
        <!-- Left: Stats (visible if empty) -->
        <div class="flex gap-3 text-xs text-gray-400">
          <template v-if="(!policy.preset_count || policy.preset_count == 0)">
            <span>Auto-classify: ≥{{ policy.auto_classify_threshold || 85 }}%</span>
            <span>Prompt: ≥{{ policy.prompt_threshold || 60 }}%</span>
          </template>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-2">
          <Button
            v-if="policy.preset_count > 0"
            variant="ghost"
            size="sm"
            class="text-red-400 hover:text-red-300"
            @click="$emit('delete', policy)"
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            @click="$emit('configure', policy)"
          >
            Configure
          </Button>
          <Button
            v-if="policy.preset_count > 0"
            variant="ghost"
            size="sm"
            @click="showWeights = !showWeights"
          >
            {{ showWeights ? 'Hide' : 'Show' }} Weights
          </Button>
        </div>
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

defineEmits(['configure', 'delete'])

const showWeights = ref(false)
</script>

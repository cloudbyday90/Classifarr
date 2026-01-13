<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Card class="relative hover:border-gray-600 transition-colors">
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div class="text-4xl flex-shrink-0">
        {{ preset.icon || '🎬' }}
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-lg mb-1 truncate">{{ preset.name }}</h3>
        
        <Badge :variant="categoryVariant" class="mb-2">
          {{ formatCategory(preset.category) }}
        </Badge>

        <p v-if="preset.description" class="text-sm text-gray-400 mb-3 line-clamp-2">
          {{ preset.description }}
        </p>

        <!-- Signal Summary -->
        <div class="text-xs text-gray-500 space-y-1">
          <div v-if="signalSummary.certifications" class="flex items-center gap-1">
            <span>🔞</span>
            <span>{{ signalSummary.certifications }}</span>
          </div>
          <div v-if="signalSummary.genres" class="flex items-center gap-1">
            <span>🎭</span>
            <span>{{ signalSummary.genres }}</span>
          </div>
          <div v-if="signalSummary.keywords" class="flex items-center gap-1">
            <span>🔑</span>
            <span>{{ signalSummary.keywords }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions (only for custom presets) -->
    <div v-if="!readonly" class="mt-4 pt-4 border-t border-gray-700 flex gap-2">
      <Button variant="secondary" size="sm" @click="$emit('edit', preset)" class="flex-1">
        <PencilIcon class="w-4 h-4 mr-1" />
        Edit
      </Button>
      <Button variant="ghost" size="sm" @click="$emit('delete', preset)" aria-label="Delete preset">
        <TrashIcon class="w-4 h-4 text-red-400" />
      </Button>
    </div>
  </Card>
</template>

<script setup>
import { computed } from 'vue'
import { PencilIcon, TrashIcon } from '@heroicons/vue/24/outline'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  preset: {
    type: Object,
    required: true
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

defineEmits(['edit', 'delete'])

const categoryVariant = computed(() => {
  const categoryMap = {
    'audience': 'info',
    'genre': 'success',
    'rating': 'warning',
    'theme': 'info',
    'era': 'default',
    'studio': 'default',
    'language': 'default',
    'custom': 'default'
  }
  return categoryMap[props.preset.category] || 'default'
})

function formatCategory(category) {
  if (!category) return 'General'
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const signalSummary = computed(() => {
  const signals = props.preset.signals || {}
  const summary = {}

  // Certifications summary
  if (signals.certifications) {
    const cert = signals.certifications
    if (cert.mode === 'include' && cert.include?.length > 0) {
      summary.certifications = `${cert.include.length} ratings allowed`
    } else if (cert.mode === 'exclude' && cert.exclude?.length > 0) {
      summary.certifications = `${cert.exclude.length} ratings excluded`
    } else if (cert.mode === 'max' && cert.max) {
      summary.certifications = `Max: ${cert.max}`
    }
  }

  // Genres summary
  if (signals.genres) {
    const preferCount = signals.genres.prefer?.length || 0
    const excludeCount = signals.genres.exclude?.length || 0
    const parts = []
    if (preferCount > 0) parts.push(`${preferCount} preferred`)
    if (excludeCount > 0) parts.push(`${excludeCount} excluded`)
    if (parts.length > 0) summary.genres = parts.join(', ')
  }

  // Keywords summary
  if (signals.keywords) {
    const preferCount = signals.keywords.prefer?.length || 0
    const excludeCount = signals.keywords.exclude?.length || 0
    const parts = []
    if (preferCount > 0) parts.push(`${preferCount} preferred`)
    if (excludeCount > 0) parts.push(`${excludeCount} excluded`)
    if (parts.length > 0) summary.keywords = parts.join(', ')
  }

  return summary
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

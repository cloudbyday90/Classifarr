<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal v-model="isOpen" :title="preset?.name || 'Preset Details'" class="max-w-3xl">
    <div v-if="preset" class="space-y-6">
      <!-- Header Section -->
      <div class="flex items-start gap-4">
        <div class="text-5xl shrink-0">
          {{ preset.icon || '🎬' }}
        </div>
        <div class="flex-1">
          <h2 class="text-2xl font-bold mb-2">{{ preset.name }}</h2>
          <p v-if="preset.description" class="text-gray-400 mb-3">
            {{ preset.description }}
          </p>
          <div v-if="usageCount !== null" class="flex items-center gap-2 text-sm text-primary">
            <span>📊</span>
            <span>Used in {{ usageCount }} {{ usageCount === 1 ? 'policy' : 'policies' }}</span>
          </div>
        </div>
      </div>

      <div class="border-t border-gray-700"></div>

      <!-- Content Ratings Section -->
      <div v-if="hasContentRatings" class="space-y-3">
        <h3 class="text-lg font-semibold text-primary flex items-center gap-2">
          <span>🔞</span>
          <span>Content Ratings</span>
        </h3>
        <div class="bg-background-light rounded-lg p-4 space-y-3">
          <div>
            <span class="text-sm text-gray-400">Mode: </span>
            <span class="text-white capitalize">{{ formatRatingMode(preset.signals.certifications.mode) }}</span>
          </div>
          <div v-if="preset.signals.certifications.mode === 'include' && preset.signals.certifications.include?.length > 0">
            <div class="text-sm text-gray-400 mb-2">Allowed:</div>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="rating in preset.signals.certifications.include" :key="rating" variant="info">
                {{ rating }}
              </Badge>
            </div>
          </div>
          <div v-else-if="preset.signals.certifications.mode === 'exclude' && preset.signals.certifications.exclude?.length > 0">
            <div class="text-sm text-gray-400 mb-2">Excluded:</div>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="rating in preset.signals.certifications.exclude" :key="rating" variant="error">
                {{ rating }}
              </Badge>
            </div>
          </div>
          <div v-else-if="preset.signals.certifications.mode === 'max' && preset.signals.certifications.max">
            <div class="text-sm text-gray-400 mb-2">Maximum:</div>
            <Badge variant="warning">{{ preset.signals.certifications.max }}</Badge>
          </div>
        </div>
      </div>

      <!-- Genres Section -->
      <div v-if="hasGenres" class="space-y-3">
        <h3 class="text-lg font-semibold text-primary flex items-center gap-2">
          <span>🎭</span>
          <span>Genres</span>
        </h3>
        <div class="bg-background-light rounded-lg p-4 space-y-3">
          <div v-if="preset.signals.genres.prefer?.length > 0">
            <div class="text-sm text-gray-400 mb-2 flex items-center gap-1">
              <span>✅</span>
              <span>Preferred:</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="genre in preset.signals.genres.prefer" :key="genre" variant="success">
                {{ genre }}
              </Badge>
            </div>
          </div>
          <div v-if="preset.signals.genres.exclude?.length > 0">
            <div class="text-sm text-gray-400 mb-2 flex items-center gap-1">
              <span>❌</span>
              <span>Excluded:</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="genre in preset.signals.genres.exclude" :key="genre" variant="error">
                {{ genre }}
              </Badge>
            </div>
          </div>
          <div v-if="!preset.signals.genres.prefer?.length && !preset.signals.genres.exclude?.length">
            <span class="text-sm text-gray-500">(none)</span>
          </div>
        </div>
      </div>

      <!-- Keywords Section -->
      <div v-if="hasKeywords" class="space-y-3">
        <h3 class="text-lg font-semibold text-primary flex items-center gap-2">
          <span>🔑</span>
          <span>Keywords</span>
        </h3>
        <div class="bg-background-light rounded-lg p-4 space-y-3">
          <div v-if="preset.signals.keywords.prefer?.length > 0">
            <div class="text-sm text-gray-400 mb-2">Preferred:</div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="keyword in preset.signals.keywords.prefer"
                :key="keyword"
                class="px-3 py-1 bg-green-500/20 text-success rounded-full text-sm"
              >
                {{ keyword }}
              </span>
            </div>
          </div>
          <div v-if="preset.signals.keywords.exclude?.length > 0">
            <div class="text-sm text-gray-400 mb-2">Excluded:</div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="keyword in preset.signals.keywords.exclude"
                :key="keyword"
                class="px-3 py-1 bg-red-500/20 text-error rounded-full text-sm"
              >
                {{ keyword }}
              </span>
            </div>
          </div>
          <div v-if="!preset.signals.keywords.prefer?.length && !preset.signals.keywords.exclude?.length">
            <span class="text-sm text-gray-500">(none)</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <Button variant="ghost" @click="close">Close</Button>
        <Button variant="primary" @click="handleCustomize">
          <span class="mr-2">✏️</span>
          Customize
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import presetsApi from '@/api/presets'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  preset: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'customize'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const usageCount = ref(null)

// Computed flags for sections
const hasContentRatings = computed(() => {
  return props.preset?.signals?.certifications?.mode && (
    (props.preset.signals.certifications.mode === 'include' && props.preset.signals.certifications.include?.length > 0) ||
    (props.preset.signals.certifications.mode === 'exclude' && props.preset.signals.certifications.exclude?.length > 0) ||
    (props.preset.signals.certifications.mode === 'max' && props.preset.signals.certifications.max)
  )
})

const hasGenres = computed(() => {
  return props.preset?.signals?.genres && (
    props.preset.signals.genres.prefer?.length > 0 ||
    props.preset.signals.genres.exclude?.length > 0
  )
})

const hasKeywords = computed(() => {
  return props.preset?.signals?.keywords && (
    props.preset.signals.keywords.prefer?.length > 0 ||
    props.preset.signals.keywords.exclude?.length > 0
  )
})

function formatRatingMode(mode) {
  if (mode === 'include') return 'Include (allow these ratings)'
  if (mode === 'exclude') return 'Exclude (block these ratings)'
  if (mode === 'max') return 'Maximum rating allowed'
  return mode
}

async function fetchUsageCount() {
  if (!props.preset?.id) {
    usageCount.value = null
    return
  }

  try {
    // Try to fetch usage count from API
    const response = await presetsApi.getPresetUsageCount(props.preset.id)
    usageCount.value = response.data.count
  } catch (error) {
    console.error('Error fetching preset usage count:', error)
    // Silently fail - usage count is optional; hide indicator when unavailable
    usageCount.value = null
  }
}

// Fetch usage count when modal opens with a preset
watch([() => props.modelValue, () => props.preset?.id], ([isOpen, presetId]) => {
  if (isOpen && presetId) {
    fetchUsageCount()
  } else {
    usageCount.value = null
  }
}, { immediate: true })

function handleCustomize() {
  emit('customize', props.preset)
}

function close() {
  emit('update:modelValue', false)
}
</script>

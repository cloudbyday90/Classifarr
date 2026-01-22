<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div 
    class="preset-card border rounded-lg p-4 cursor-pointer transition-all"
    :class="{ 
      'border-primary bg-blue-500/10': selected,
      'border-gray-800 hover:border-gray-700': !selected
    }"
    @click="$emit('toggle')"
  >
    <div class="flex items-start gap-3">
      <div class="text-2xl">{{ preset.icon || '📦' }}</div>
      
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <h4 class="font-semibold text-sm truncate">{{ preset.name }}</h4>
          <Badge v-if="preset.category" variant="default" size="sm">
            {{ preset.category }}
          </Badge>
        </div>
        
        <p class="text-xs text-gray-400 line-clamp-2">{{ preset.description }}</p>
        
        <!-- Weight input for selected presets -->
        <div v-if="selected" class="flex items-center gap-2 mt-2" @click.stop>
          <label class="text-xs text-gray-400">Weight:</label>
          <input 
            type="number" 
            :value="weight"
            @input="handleWeightInput($event)"
            min="0.1" 
            max="2" 
            step="0.1"
            class="w-20 px-2 py-1 text-xs bg-background border border-gray-700 rounded-sm"
          />
        </div>
      </div>
      
      <div class="flex items-center">
        <input 
          type="checkbox" 
          :checked="selected" 
          @click.stop
          @change="$emit('toggle')"
          class="w-4 h-4"
        />
      </div>
    </div>
    
    <!-- Expandable signal details (read-only) -->
    <div v-if="expanded && preset.signals" class="mt-3 pt-3 border-t border-gray-800 text-xs" @click.stop>
      <h5 class="font-semibold mb-2 text-gray-300">Matching Criteria:</h5>
      <div class="space-y-1 text-gray-400">
        <div v-if="preset.signals.certifications">
          <span class="font-medium">Certifications:</span>
          {{ formatCertifications(preset.signals.certifications) }}
        </div>
        <div v-if="preset.signals.genres">
          <span class="font-medium">Genres:</span>
          {{ formatGenres(preset.signals.genres) }}
        </div>
        <div v-if="preset.signals.keywords">
          <span class="font-medium">Keywords:</span>
          {{ formatKeywords(preset.signals.keywords) }}
        </div>
        <div v-if="preset.signals.studios">
          <span class="font-medium">Studios:</span>
          {{ formatStudios(preset.signals.studios) }}
        </div>
        <div v-if="preset.signals.release_year">
          <span class="font-medium">Years:</span>
          {{ formatYears(preset.signals.release_year) }}
        </div>
        <div v-if="preset.signals.language">
          <span class="font-medium">Languages:</span>
          {{ formatLanguages(preset.signals.language) }}
        </div>
      </div>
    </div>
    
    <button 
      v-if="preset.signals"
      @click.stop="expanded = !expanded" 
      class="text-xs text-primary hover:underline mt-2"
    >
      {{ expanded ? 'Less' : 'More' }} details
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Badge from '@/components/common/Badge.vue'

const props = defineProps({
  preset: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  weight: {
    type: Number,
    default: 1.0,
  },
  customSignals: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['toggle', 'update-weight', 'update-signals'])

const expanded = ref(false)
const newKeyword = ref('')

// Available options for dropdowns
const availableRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR']
const availableGenres = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western']

// Merge preset signals with custom overrides
const signalConfig = computed(() => {
  const base = JSON.parse(JSON.stringify(props.preset.signals || {}))
  const custom = props.customSignals || {}
  
  // Merge certifications
  if (custom.certifications) {
    base.certifications = { ...base.certifications, ...custom.certifications }
  }
  // Merge genres
  if (custom.genres) {
    base.genres = { ...base.genres, ...custom.genres }
  }
  // Merge keywords
  if (custom.keywords) {
    base.keywords = { ...base.keywords, ...custom.keywords }
  }
  
  return base
})

// Helper to emit updated signals
const emitSignalUpdate = (signalType, key, value) => {
  const currentCustom = JSON.parse(JSON.stringify(props.customSignals || {}))
  if (!currentCustom[signalType]) {
    currentCustom[signalType] = {}
  }
  currentCustom[signalType][key] = value
  emit('update-signals', currentCustom)
}

const addCertification = (event) => {
  const value = event.target.value
  if (!value) return
  event.target.value = ''
  
  const [action, rating] = value.split(':')
  const current = signalConfig.value.certifications || {}
  const list = [...(current[action] || [])]
  
  if (!list.includes(rating)) {
    list.push(rating)
    emitSignalUpdate('certifications', action, list)
  }
}

const addGenre = (event) => {
  const value = event.target.value
  if (!value) return
  event.target.value = ''
  
  const [action, genre] = value.split(':')
  const current = signalConfig.value.genres || {}
  const list = [...(current[action] || [])]
  
  if (!list.includes(genre)) {
    list.push(genre)
    emitSignalUpdate('genres', action, list)
  }
}

const addKeyword = (action) => {
  const keyword = newKeyword.value.trim().toLowerCase()
  if (!keyword) return
  newKeyword.value = ''
  
  const current = signalConfig.value.keywords || {}
  const list = [...(current[action] || [])]
  
  if (!list.includes(keyword)) {
    list.push(keyword)
    emitSignalUpdate('keywords', action, list)
  }
}

const removeSignalItem = (signalType, key, value) => {
  const current = signalConfig.value[signalType] || {}
  const list = (current[key] || []).filter(item => item !== value)
  emitSignalUpdate(signalType, key, list)
}

const handleWeightInput = (event) => {
  const value = parseFloat(event.target.value)
  if (!isNaN(value)) {
    const clampedValue = Math.min(2, Math.max(0.1, value))
    emit('update-weight', clampedValue)
  }
}

const formatCertifications = (config) => {
  if (!config) return ''
  if (config.mode === 'include' && config.include) {
    return config.include.join(', ')
  }
  if (config.mode === 'exclude' && config.exclude) {
    return 'Exclude: ' + config.exclude.join(', ')
  }
  if (config.mode === 'max' && config.max) {
    return 'Max: ' + config.max
  }
  return JSON.stringify(config)
}

const formatGenres = (config) => {
  if (!config) return ''
  const parts = []
  if (config.require_all?.length) parts.push('Require: ' + config.require_all.join(', '))
  if (config.require_any?.length) parts.push('Any: ' + config.require_any.join(', '))
  if (config.prefer?.length) parts.push('Prefer: ' + config.prefer.join(', '))
  if (config.exclude?.length) parts.push('Exclude: ' + config.exclude.join(', '))
  return parts.join(' | ') || JSON.stringify(config)
}

const formatKeywords = (config) => {
  if (!config) return ''
  const parts = []
  if (config.require_any?.length) parts.push(config.require_any.slice(0, 5).join(', '))
  if (config.prefer?.length) parts.push('Prefer: ' + config.prefer.slice(0, 3).join(', '))
  if (parts.length === 0 && config.exclude?.length) {
    parts.push('Exclude: ' + config.exclude.slice(0, 3).join(', '))
  }
  return parts.join(' | ') || JSON.stringify(config)
}

const formatStudios = (config) => {
  if (!config) return ''
  const parts = []
  if (config.require_any?.length) parts.push(config.require_any.join(', '))
  if (config.prefer?.length) parts.push('Prefer: ' + config.prefer.join(', '))
  return parts.join(' | ') || JSON.stringify(config)
}

const formatYears = (config) => {
  if (!config) return ''
  const parts = []
  if (config.min) parts.push(`${config.min}+`)
  if (config.max) parts.push(`≤${config.max}`)
  if (config.min && config.max) return `${config.min}-${config.max}`
  return parts.join(' ') || JSON.stringify(config)
}

const formatLanguages = (config) => {
  if (!config) return ''
  const parts = []
  if (config.require_any?.length) parts.push(config.require_any.join(', '))
  if (config.prefer?.length) parts.push('Prefer: ' + config.prefer.join(', '))
  if (config.exclude?.length) parts.push('Exclude: ' + config.exclude.join(', '))
  return parts.join(' | ') || JSON.stringify(config)
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal v-model="isOpen" :title="isEditing ? 'Edit Policy' : 'Create Policy'" class="max-w-6xl">
    <div class="space-y-6">
      <!-- Basic Info -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Basic Information</h3>
        
        <div>
          <label class="block text-sm font-medium mb-2">Policy Name</label>
          <input 
            v-model="form.name" 
            type="text" 
            placeholder="e.g., Family Content Policy"
            class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-2">Description</label>
          <textarea 
            v-model="form.description" 
            placeholder="Describe what this policy matches..."
            rows="3"
            class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
          ></textarea>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-2">Library</label>
          <select 
            v-model="form.library_id" 
            :disabled="isEditing"
            class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
          >
            <option value="">Select a library</option>
            <option v-for="lib in libraries" :key="lib.id" :value="lib.id">
              {{ lib.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Preset Selection -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Select Presets</h3>
        <p class="text-sm text-gray-400">Choose presets that define what content belongs in this library</p>
        
        <!-- Category filter -->
        <div class="flex flex-wrap gap-2">
          <Button 
            v-for="cat in presetCategories" 
            :key="cat.category"
            @click="filterCategory = filterCategory === cat.category ? null : cat.category"
            :variant="filterCategory === cat.category ? 'primary' : 'ghost'"
            size="sm"
          >
            {{ cat.category }} ({{ cat.count }})
          </Button>
        </div>
        
        <!-- Search -->
        <input 
          v-model="presetSearch" 
          type="search" 
          placeholder="Search presets..."
          class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
        />
        
        <!-- Preset grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
          <PresetCard
            v-for="preset in filteredPresets"
            :key="preset.id"
            :preset="preset"
            :selected="isPresetSelected(preset.id)"
            :weight="getPresetWeight(preset.id)"
            @toggle="togglePreset(preset)"
            @update-weight="updatePresetWeight(preset.id, $event)"
          />
        </div>
        
        <!-- Selected presets summary -->
        <div v-if="selectedPresets.length > 0" class="border border-gray-700 rounded-lg p-4">
          <h4 class="font-semibold mb-3">Selected Presets ({{ selectedPresets.length }})</h4>
          <div class="space-y-2 max-h-40 overflow-y-auto">
            <div 
              v-for="sp in selectedPresets" 
              :key="sp.id" 
              class="flex items-center gap-3 text-sm bg-background-light p-2 rounded"
            >
              <span class="text-lg">{{ sp.icon || '📦' }}</span>
              <span class="flex-1">{{ sp.name }}</span>
              <input 
                type="number" 
                v-model.number="sp.weight" 
                min="0.1" 
                max="2" 
                step="0.1"
                class="w-20 px-2 py-1 bg-background border border-gray-700 rounded text-center"
              />
              <button 
                @click="removePreset(sp.id)" 
                class="text-red-400 hover:text-red-300 text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Thresholds -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Classification Thresholds</h3>
        
        <div>
          <label class="block text-sm font-medium mb-2">
            Auto-classify threshold: {{ form.auto_classify_threshold }}%
          </label>
          <input 
            type="range" 
            v-model.number="form.auto_classify_threshold" 
            min="50" 
            max="95" 
            class="w-full"
          />
          <p class="text-xs text-gray-400 mt-1">Items scoring above this will be auto-classified</p>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-2">
            Prompt threshold: {{ form.prompt_threshold }}%
          </label>
          <input 
            type="range" 
            v-model.number="form.prompt_threshold" 
            min="30" 
            max="80" 
            class="w-full"
          />
          <p class="text-xs text-gray-400 mt-1">Items scoring above this will prompt for confirmation</p>
        </div>
      </div>

      <!-- Weights -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Scoring Weights</h3>
        <p class="text-sm text-gray-400">Adjust how much each factor contributes to the final score</p>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">
              Presets: {{ Math.round(form.preset_weight * 100) }}%
            </label>
            <input 
              type="range" 
              v-model.number="form.preset_weight" 
              min="0" 
              max="1" 
              step="0.05" 
              class="w-full"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">
              Patterns: {{ Math.round(form.pattern_weight * 100) }}%
            </label>
            <input 
              type="range" 
              v-model.number="form.pattern_weight" 
              min="0" 
              max="1" 
              step="0.05" 
              class="w-full"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">
              RAG: {{ Math.round(form.rag_weight * 100) }}%
            </label>
            <input 
              type="range" 
              v-model.number="form.rag_weight" 
              min="0" 
              max="1" 
              step="0.05" 
              class="w-full"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-2">
              History: {{ Math.round(form.history_weight * 100) }}%
            </label>
            <input 
              type="range" 
              v-model.number="form.history_weight" 
              min="0" 
              max="1" 
              step="0.05" 
              class="w-full"
            />
          </div>
        </div>
        
        <div 
          class="text-sm p-3 rounded-lg"
          :class="totalWeight !== 1 ? 'bg-yellow-900 bg-opacity-20 text-yellow-400' : 'bg-green-900 bg-opacity-20 text-green-400'"
        >
          Total: {{ Math.round(totalWeight * 100) }}% 
          <span v-if="totalWeight !== 1">(should equal 100%)</span>
          <span v-else>✓</span>
        </div>
      </div>

      <!-- Combination Mode -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Combination Mode</h3>
        <div class="space-y-2">
          <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
            <input 
              type="radio" 
              v-model="form.combination_mode" 
              value="best_match" 
              class="w-4 h-4"
            />
            <div>
              <div class="font-medium">Best Match</div>
              <div class="text-xs text-gray-400">Use highest scoring preset</div>
            </div>
          </label>
          
          <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
            <input 
              type="radio" 
              v-model="form.combination_mode" 
              value="average" 
              class="w-4 h-4"
            />
            <div>
              <div class="font-medium">Average</div>
              <div class="text-xs text-gray-400">Average all matching preset scores</div>
            </div>
          </label>
          
          <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
            <input 
              type="radio" 
              v-model="form.combination_mode" 
              value="weighted_average" 
              class="w-4 h-4"
            />
            <div>
              <div class="font-medium">Weighted Average</div>
              <div class="text-xs text-gray-400">Use preset weights</div>
            </div>
          </label>
          
          <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600">
            <input 
              type="radio" 
              v-model="form.combination_mode" 
              value="require_all" 
              class="w-4 h-4"
            />
            <div>
              <div class="font-medium">Require All</div>
              <div class="text-xs text-gray-400">All presets must match</div>
            </div>
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <Button @click="$emit('close')" variant="ghost">Cancel</Button>
      <Button @click="save" variant="primary" :disabled="!isValid">
        {{ isEditing ? 'Update Policy' : 'Create Policy' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '@/api'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import PresetCard from '@/components/policies/PresetCard.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  policy: {
    type: Object,
    default: null,
  },
  libraryId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'close'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const isEditing = computed(() => !!props.policy)

const form = ref({
  library_id: null,
  name: '',
  description: '',
  enabled: true,
  priority: 5,
  sort_order: 0,
  auto_classify_threshold: 85,
  prompt_threshold: 60,
  require_ai_validation: true,
  trust_patterns: true,
  trust_rag: true,
  trust_history: true,
  preset_weight: 0.40,
  pattern_weight: 0.30,
  rag_weight: 0.20,
  history_weight: 0.10,
  combination_mode: 'best_match',
})

const libraries = ref([])
const allPresets = ref([])
const presetCategories = ref([])
const selectedPresets = ref([])
const filterCategory = ref(null)
const presetSearch = ref('')

const totalWeight = computed(() => {
  return form.value.preset_weight + form.value.pattern_weight + 
         form.value.rag_weight + form.value.history_weight
})

const filteredPresets = computed(() => {
  let presets = allPresets.value

  if (filterCategory.value) {
    presets = presets.filter(p => p.category === filterCategory.value)
  }

  if (presetSearch.value) {
    const search = presetSearch.value.toLowerCase()
    presets = presets.filter(p => 
      p.name.toLowerCase().includes(search) || 
      p.description?.toLowerCase().includes(search)
    )
  }

  return presets
})

const isValid = computed(() => {
  return form.value.library_id && form.value.name && selectedPresets.value.length > 0
})

watch(() => props.policy, (newPolicy) => {
  if (newPolicy) {
    // Load existing policy data
    form.value = {
      library_id: newPolicy.library_id,
      name: newPolicy.name,
      description: newPolicy.description || '',
      enabled: newPolicy.enabled !== false,
      priority: newPolicy.priority || 5,
      sort_order: newPolicy.sort_order || 0,
      auto_classify_threshold: newPolicy.auto_classify_threshold || 85,
      prompt_threshold: newPolicy.prompt_threshold || 60,
      require_ai_validation: newPolicy.require_ai_validation !== false,
      trust_patterns: newPolicy.trust_patterns !== false,
      trust_rag: newPolicy.trust_rag !== false,
      trust_history: newPolicy.trust_history !== false,
      preset_weight: newPolicy.preset_weight ?? 0.40,
      pattern_weight: newPolicy.pattern_weight ?? 0.30,
      rag_weight: newPolicy.rag_weight ?? 0.20,
      history_weight: newPolicy.history_weight ?? 0.10,
      combination_mode: newPolicy.combination_mode || 'best_match',
    }

    // Load selected presets
    if (newPolicy.presets) {
      selectedPresets.value = newPolicy.presets.map(p => ({
        id: p.id,
        preset_id: p.id,
        name: p.name,
        icon: p.icon,
        weight: p.weight || 1.0,
      }))
    }
  } else {
    resetForm()
  }
}, { immediate: true })

watch(() => props.libraryId, (newLibraryId) => {
  if (newLibraryId && !props.policy) {
    form.value.library_id = newLibraryId
  }
}, { immediate: true })

onMounted(async () => {
  await Promise.all([
    fetchLibraries(),
    fetchPresets(),
    fetchPresetCategories()
  ])
})

const fetchLibraries = async () => {
  try {
    const response = await api.get('/libraries')
    libraries.value = response.data
  } catch (error) {
    console.error('Failed to fetch libraries:', error)
  }
}

const fetchPresets = async () => {
  try {
    const response = await api.get('/presets/all')
    allPresets.value = response.data
  } catch (error) {
    console.error('Failed to fetch presets:', error)
  }
}

const fetchPresetCategories = async () => {
  try {
    const response = await api.get('/presets/categories')
    presetCategories.value = response.data
  } catch (error) {
    console.error('Failed to fetch preset categories:', error)
  }
}

const isPresetSelected = (presetId) => {
  return selectedPresets.value.some(p => p.preset_id === presetId || p.id === presetId)
}

const getPresetWeight = (presetId) => {
  const preset = selectedPresets.value.find(p => p.preset_id === presetId || p.id === presetId)
  return preset?.weight || 1.0
}

const togglePreset = (preset) => {
  const index = selectedPresets.value.findIndex(p => p.preset_id === preset.id || p.id === preset.id)
  
  if (index >= 0) {
    selectedPresets.value.splice(index, 1)
  } else {
    selectedPresets.value.push({
      id: preset.id,
      preset_id: preset.id,
      name: preset.name,
      icon: preset.icon,
      weight: 1.0,
    })
  }
}

const updatePresetWeight = (presetId, weight) => {
  const preset = selectedPresets.value.find(p => p.preset_id === presetId || p.id === presetId)
  if (preset) {
    preset.weight = weight
  }
}

const removePreset = (presetId) => {
  const index = selectedPresets.value.findIndex(p => p.preset_id === presetId || p.id === presetId)
  if (index >= 0) {
    selectedPresets.value.splice(index, 1)
  }
}

const resetForm = () => {
  form.value = {
    library_id: props.libraryId || null,
    name: '',
    description: '',
    enabled: true,
    priority: 5,
    sort_order: 0,
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    preset_weight: 0.40,
    pattern_weight: 0.30,
    rag_weight: 0.20,
    history_weight: 0.10,
    combination_mode: 'best_match',
  }
  selectedPresets.value = []
  filterCategory.value = null
  presetSearch.value = ''
}

const save = async () => {
  if (!isValid.value) return

  const policyData = {
    ...form.value,
    presets: selectedPresets.value.map(p => ({
      preset_id: p.preset_id || p.id,
      weight: p.weight || 1.0,
    })),
  }

  try {
    await emit('save', policyData)
  } catch (error) {
    console.error('Failed to save policy:', error)
    alert('Failed to save policy: ' + error.message)
  }
}
</script>

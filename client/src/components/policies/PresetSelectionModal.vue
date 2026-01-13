<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal v-model="isOpen" title="Add Presets" class="max-w-4xl">
    <div class="space-y-5">
      <!-- Library Context (read-only) with Info Tooltip -->
      <div class="flex items-center gap-3 p-3 bg-background-light rounded-lg border border-gray-700">
        <span class="text-2xl">📚</span>
        <div class="flex-1">
          <div class="font-medium">{{ library?.name || 'Unknown Library' }}</div>
          <div class="text-sm text-gray-400">Select presets to define what content belongs here</div>
        </div>
        <!-- Info Tooltip -->
        <div class="relative group">
          <button 
            class="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold transition-colors"
            @click.stop="showInfoTooltip = !showInfoTooltip"
          >
            i
          </button>
          <div 
            v-if="showInfoTooltip"
            class="absolute right-0 top-8 w-72 p-4 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 text-sm"
          >
            <button 
              @click="showInfoTooltip = false" 
              class="absolute top-2 right-2 text-gray-400 hover:text-white"
            >×</button>
            <h4 class="font-semibold text-primary mb-2">💡 Tips</h4>
            <ul class="space-y-2 text-gray-300">
              <li class="flex gap-2">
                <span class="text-primary">✓</span>
                <span>Select <strong>multiple presets</strong> to combine their signals</span>
              </li>
              <li class="flex gap-2">
                <span class="text-primary">✓</span>
                <span>Suggested presets are based on your library name</span>
              </li>
              <li class="flex gap-2">
                <span class="text-primary">✓</span>
                <span>Custom presets can be created in the Presets manager</span>
              </li>
              <li class="flex gap-2">
                <span class="text-primary">✓</span>
                <span>After adding, you can adjust weights in the policy editor</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Suggested Presets Section -->
      <div v-if="suggestedPresets.length > 0" class="space-y-3">
        <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
          <span>✨</span> Suggested for {{ library?.name }}
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="preset in suggestedPresets"
            :key="'suggested-' + preset.id"
            @click="togglePreset(preset)"
            class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary"
            :class="isSelected(preset.id) ? 'bg-primary bg-opacity-10 border-primary' : 'bg-background-light border-gray-700'"
          >
            <input 
              type="checkbox" 
              :checked="isSelected(preset.id)"
              class="h-4 w-4 rounded border-gray-600 bg-background text-primary focus:ring-primary"
              @click.stop
              @change="togglePreset(preset)"
            />
            <span class="text-lg">{{ preset.icon || '📦' }}</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ preset.name }}</div>
              <div class="text-xs text-gray-400 truncate">
                Score: {{ preset.match_score }} • {{ preset.match_reasons?.join(', ') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="cat in categoryTabs"
            :key="cat.value"
            @click="selectedCategory = cat.value"
            class="px-3 py-1.5 text-sm rounded-lg transition-colors"
            :class="selectedCategory === cat.value 
              ? 'bg-primary text-white' 
              : 'bg-background-light text-gray-300 hover:bg-gray-700'"
          >
            {{ cat.label }} 
            <span v-if="cat.count" class="text-xs opacity-70">({{ cat.count }})</span>
          </button>
        </div>

        <!-- Search -->
        <input 
          v-model="searchQuery"
          type="search"
          placeholder="Search presets..."
          class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
        />
      </div>

      <!-- Preset Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="preset in filteredPresets"
          :key="preset.id"
          @click="togglePreset(preset)"
          class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary"
          :class="isSelected(preset.id) ? 'bg-primary bg-opacity-10 border-primary' : 'bg-background-light border-gray-700'"
        >
          <input 
            type="checkbox" 
            :checked="isSelected(preset.id)"
            class="h-4 w-4 rounded border-gray-600 bg-background text-primary focus:ring-primary"
            @click.stop
            @change="togglePreset(preset)"
          />
          <span class="text-lg">{{ preset.icon || '📦' }}</span>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ preset.name }}</div>
            <div class="text-xs text-gray-400 truncate">{{ preset.description || preset.category }}</div>
          </div>
          <span 
            v-if="preset.source === 'custom'" 
            class="text-xs px-1.5 py-0.5 bg-blue-900 bg-opacity-50 text-blue-300 rounded"
          >
            Custom
          </span>
        </div>
        
        <div v-if="filteredPresets.length === 0" class="col-span-2 text-center py-8 text-gray-400">
          No presets found matching your search
        </div>
      </div>

      <!-- Selected Summary -->
      <div v-if="selectedPresets.length > 0" class="flex flex-wrap gap-2 p-3 bg-background-light rounded-lg border border-gray-700">
        <span class="text-sm text-gray-400">Selected:</span>
        <span 
          v-for="preset in selectedPresets" 
          :key="'sel-' + preset.id"
          class="inline-flex items-center gap-1 px-2 py-1 bg-primary bg-opacity-20 text-primary rounded text-sm"
        >
          {{ preset.icon }} {{ preset.name }}
          <button @click="togglePreset(preset)" class="hover:text-white">×</button>
        </span>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-sm text-gray-400">
          {{ selectedPresets.length }} preset{{ selectedPresets.length !== 1 ? 's' : '' }} selected
        </span>
        <div class="flex gap-3">
          <Button variant="ghost" @click="close">Cancel</Button>
          <Button 
            variant="primary" 
            @click="confirm"
            :disabled="selectedPresets.length === 0"
          >
            Add Selected ({{ selectedPresets.length }})
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import Modal from '@/components/common/Modal.vue';
import Button from '@/components/common/Button.vue';
import api from '@/api';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  library: { type: Object, default: null },
  existingPresetIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue', 'confirm']);

// State
const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const allPresets = ref([]);
const suggestedPresets = ref([]);
const selectedPresets = ref([]);
const searchQuery = ref('');
const selectedCategory = ref('all');
const loading = ref(false);
const showInfoTooltip = ref(false);

// Category tabs
const categoryTabs = computed(() => {
  const categories = [
    { value: 'all', label: 'All', count: allPresets.value.length }
  ];
  
  // Get unique categories from presets
  const categoryCounts = {};
  allPresets.value.forEach(p => {
    const cat = p.category || 'uncategorized';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    categories.push({ 
      value: cat, 
      label: cat.charAt(0).toUpperCase() + cat.slice(1), 
      count 
    });
  });
  
  // Add "My Presets" tab for custom presets
  const customCount = allPresets.value.filter(p => p.source === 'custom').length;
  if (customCount > 0) {
    categories.push({ value: 'custom', label: 'My Presets', count: customCount });
  }
  
  return categories;
});

// Filtered presets
const filteredPresets = computed(() => {
  let presets = allPresets.value;
  
  // Filter by category
  if (selectedCategory.value !== 'all') {
    if (selectedCategory.value === 'custom') {
      presets = presets.filter(p => p.source === 'custom');
    } else {
      presets = presets.filter(p => p.category === selectedCategory.value);
    }
  }
  
  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    presets = presets.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    );
  }
  
  // Exclude already selected presets from main grid (they're shown in selected summary)
  // Actually, keep them but show as selected
  
  return presets;
});

// Helper functions
function isSelected(presetId) {
  return selectedPresets.value.some(p => p.id === presetId);
}

function togglePreset(preset) {
  const idx = selectedPresets.value.findIndex(p => p.id === preset.id);
  if (idx >= 0) {
    selectedPresets.value.splice(idx, 1);
  } else {
    // Don't add if already in policy
    if (!props.existingPresetIds.includes(preset.id)) {
      selectedPresets.value.push(preset);
    }
  }
}

async function loadPresets() {
  loading.value = true;
  try {
    // Load all presets (builtin + custom)
    const { data } = await api.get('/presets/all?include_custom=true');
    
    // Filter out existing policy presets
    allPresets.value = data.filter(p => !props.existingPresetIds.includes(p.id));
    
    // Load suggestions if library is provided
    if (props.library?.id) {
      const suggestionsRes = await api.get(`/policies/presets/suggest/${props.library.id}`);
      suggestedPresets.value = suggestionsRes.data.suggestions || [];
    }
  } catch (error) {
    console.error('Failed to load presets:', error);
  } finally {
    loading.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
  selectedPresets.value = [];
}

function confirm() {
  emit('confirm', selectedPresets.value);
  close();
}

// Reload when modal opens
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    selectedPresets.value = [];
    searchQuery.value = '';
    selectedCategory.value = 'all';
    loadPresets();
  }
});
</script>

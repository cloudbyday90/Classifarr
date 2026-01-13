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
            <optgroup v-if="movieLibraries.length" label="🎬 Movies">
              <option v-for="lib in movieLibraries" :key="lib.id" :value="lib.id">
                {{ lib.name }}
              </option>
            </optgroup>
            <optgroup v-if="tvLibraries.length" label="📺 TV Shows">
              <option v-for="lib in tvLibraries" :key="lib.id" :value="lib.id">
                {{ lib.name }}
              </option>
            </optgroup>
            <optgroup v-if="otherLibraries.length" label="📁 Other">
              <option v-for="lib in otherLibraries" :key="lib.id" :value="lib.id">
                {{ lib.name }}
              </option>
            </optgroup>
          </select>
        </div>
      </div>

      <!-- Preset Selection -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Select Presets</h3>
        <p class="text-sm text-gray-400">Choose presets that define what content belongs in this library</p>
        
        <div class="flex items-center justify-between bg-background-light p-4 rounded-lg border border-gray-700">
          <div>
            <div class="font-medium text-gray-200">Manually Add Presets.</div>
            <div class="text-sm text-gray-400">Search for presets or see AI suggestions based on library name.</div>
          </div>
          <Button @click="showPresetSelector = true" variant="primary" :disabled="!form.library_id">
            + Add Presets
          </Button>
        </div>
        
        <!-- Selected presets summary -->
        <div v-if="selectedPresets.length > 0" class="border border-gray-700 rounded-lg p-4">
          <h4 class="font-semibold mb-3">Selected Presets ({{ selectedPresets.length }})</h4>
          <div class="space-y-3">
            <div 
              v-for="sp in selectedPresets" 
              :key="sp.id" 
              class="bg-background-light rounded-lg overflow-hidden"
            >
              <!-- Preset header row -->
              <div class="flex items-center gap-3 text-sm p-3">
                <span class="text-lg">{{ sp.icon || '📦' }}</span>
                <span class="flex-1 font-medium">{{ sp.name }}</span>
                <button 
                  @click="togglePresetCustomize(sp.id)"
                  class="text-xs px-2 py-1 border rounded hover:bg-gray-700"
                  :class="expandedPresetIds.has(sp.id) ? 'border-primary text-primary' : 'border-gray-600 text-gray-400'"
                >
                  {{ expandedPresetIds.has(sp.id) ? '▲ Close' : '▼ Customize' }}
                </button>
                <input 
                  type="number" 
                  v-model.number="sp.weight" 
                  min="0.1" 
                  max="2" 
                  step="0.1"
                  class="w-16 px-2 py-1 bg-background border border-gray-700 rounded text-center text-sm"
                />
                <button 
                  @click="removePreset(sp.id)" 
                  class="text-red-400 hover:text-red-300 text-xl leading-none"
                >
                  ×
                </button>
              </div>
              
              <!-- Customization panel -->
              <div v-if="expandedPresetIds.has(sp.id)" class="border-t border-gray-700 p-3 space-y-3 text-xs">
                <!-- Content Ratings -->
                <div>
                  <label class="font-medium text-gray-300 block mb-1">Content Ratings:</label>
                  <div class="flex flex-wrap gap-1">
                    <!-- Base preset signals (can be removed) -->
                    <span 
                      v-for="cert in getPresetBaseSignals(sp, 'certifications', 'include')" 
                      :key="'base-inc-'+cert"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900 bg-opacity-30 text-green-400 rounded"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'certifications', 'include', cert)}"
                    >
                      {{ cert }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button v-if="!isSignalRemoved(sp, 'certifications', 'include', cert)" @click="markSignalRemoved(sp, 'certifications', 'include', cert)" class="hover:text-red-400" title="Remove">×</button>
                      <button v-else @click="unmarkSignalRemoved(sp, 'certifications', 'include', cert)" class="hover:text-green-400" title="Restore">↩</button>
                    </span>
                    <!-- Custom added signals -->
                    <span 
                      v-for="cert in getCustomSignalList(sp, 'certifications', 'include')" 
                      :key="'cust-inc-'+cert"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900 bg-opacity-30 text-blue-400 rounded"
                    >
                      + {{ cert }}
                      <button @click="removeCustomSignal(sp, 'certifications', 'include', cert)" class="hover:text-red-400">×</button>
                    </span>
                    <select @change="addCustomSignal(sp, 'certifications', $event)" class="px-2 py-0.5 bg-background border border-gray-700 rounded">
                      <option value="">+ Add</option>
                      <optgroup label="Include">
                        <option v-for="r in availableRatings" :key="'inc-'+r" :value="'include:' + r">✓ {{ r }}</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
                
                <!-- Genres -->
                <div>
                  <label class="font-medium text-gray-300 block mb-1">Genres:</label>
                  <div class="flex flex-wrap gap-1">
                    <!-- Base preset signals (can be removed) -->
                    <span 
                      v-for="g in getPresetBaseSignals(sp, 'genres', 'prefer')" 
                      :key="'base-pref-'+g"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900 bg-opacity-30 text-blue-400 rounded"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'genres', 'prefer', g)}"
                    >
                      {{ g }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button v-if="!isSignalRemoved(sp, 'genres', 'prefer', g)" @click="markSignalRemoved(sp, 'genres', 'prefer', g)" class="hover:text-red-400" title="Remove">×</button>
                      <button v-else @click="unmarkSignalRemoved(sp, 'genres', 'prefer', g)" class="hover:text-green-400" title="Restore">↩</button>
                    </span>
                    <!-- Excluded genres from base -->
                    <span 
                      v-for="g in getPresetBaseSignals(sp, 'genres', 'exclude')" 
                      :key="'base-exc-'+g"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900 bg-opacity-30 text-red-400 rounded"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'genres', 'exclude', g)}"
                    >
                      ✕ {{ g }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button v-if="!isSignalRemoved(sp, 'genres', 'exclude', g)" @click="markSignalRemoved(sp, 'genres', 'exclude', g)" class="hover:text-white" title="Remove">×</button>
                      <button v-else @click="unmarkSignalRemoved(sp, 'genres', 'exclude', g)" class="hover:text-green-400" title="Restore">↩</button>
                    </span>
                    <!-- Custom added signals -->
                    <span 
                      v-for="g in getCustomSignalList(sp, 'genres', 'prefer')" 
                      :key="'cust-pref-'+g"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900 bg-opacity-30 text-green-400 rounded"
                    >
                      + {{ g }}
                      <button @click="removeCustomSignal(sp, 'genres', 'prefer', g)" class="hover:text-red-400">×</button>
                    </span>
                    <select @change="addCustomSignal(sp, 'genres', $event)" class="px-2 py-0.5 bg-background border border-gray-700 rounded">
                      <option value="">+ Add</option>
                      <optgroup label="Prefer">
                        <option v-for="g in availableGenres" :key="'pref-'+g" :value="'prefer:' + g">✓ {{ g }}</option>
                      </optgroup>
                      <optgroup label="Exclude">
                        <option v-for="g in availableGenres" :key="'exc-'+g" :value="'exclude:' + g">✕ {{ g }}</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
                
                <!-- Keywords -->
                <div>
                  <label class="font-medium text-gray-300 block mb-1">Keywords:</label>
                  <div class="flex flex-wrap gap-1">
                    <!-- Excluded keywords from base -->
                    <span 
                      v-for="k in getPresetBaseSignals(sp, 'keywords', 'exclude')" 
                      :key="'base-exc-'+k"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900 bg-opacity-30 text-red-400 rounded"
                      :class="{'opacity-40 line-through': isSignalRemoved(sp, 'keywords', 'exclude', k)}"
                    >
                      ✕ {{ k }} <span class="text-gray-500 text-xs">({{ sp.name }})</span>
                      <button v-if="!isSignalRemoved(sp, 'keywords', 'exclude', k)" @click="markSignalRemoved(sp, 'keywords', 'exclude', k)" class="hover:text-white" title="Remove">×</button>
                      <button v-else @click="unmarkSignalRemoved(sp, 'keywords', 'exclude', k)" class="hover:text-green-400" title="Restore">↩</button>
                    </span>
                    <!-- Custom added keywords -->
                    <span 
                      v-for="k in getCustomSignalList(sp, 'keywords', 'require_any')" 
                      :key="'cust-req-'+k"
                      class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900 bg-opacity-30 text-green-400 rounded"
                    >
                      + {{ k }}
                      <button @click="removeCustomSignal(sp, 'keywords', 'require_any', k)" class="hover:text-red-400">×</button>
                    </span>
                    <input 
                      type="text"
                      v-model="newKeyword"
                      @keydown.enter="addKeywordToPreset(sp)"
                      placeholder="+ keyword (Enter)"
                      class="w-32 px-2 py-0.5 bg-background border border-gray-700 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Combined Signals Summary (when multiple presets selected) -->
        <div v-if="selectedPresets.length > 1" class="border border-primary/30 rounded-lg p-4 bg-primary/5">
          <h4 class="font-semibold mb-3 flex items-center gap-2">
            <span class="text-primary">🔗</span>
            Combined Signals ({{ selectedPresets.length }} presets)
          </h4>
          <div class="space-y-3 text-sm">
            <!-- Combined Content Ratings -->
            <div v-if="combinedSignals.certifications.include.length">
              <label class="font-medium text-gray-300 block mb-1">Content Ratings (included):</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.certifications.include" 
                  :key="'comb-cert-'+item.value"
                  class="px-2 py-0.5 bg-green-900 bg-opacity-30 text-green-400 rounded text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Genres (Prefer) -->
            <div v-if="combinedSignals.genres.prefer.length">
              <label class="font-medium text-gray-300 block mb-1">Preferred Genres:</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.genres.prefer" 
                  :key="'comb-genre-'+item.value"
                  class="px-2 py-0.5 bg-blue-900 bg-opacity-30 text-blue-400 rounded text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Genres (Exclude) -->
            <div v-if="combinedSignals.genres.exclude.length">
              <label class="font-medium text-gray-300 block mb-1">Excluded Genres:</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.genres.exclude" 
                  :key="'comb-exc-'+item.value"
                  class="px-2 py-0.5 bg-red-900 bg-opacity-30 text-red-400 rounded text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  ✕ {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Keywords (Excluded) -->
            <!-- Combined Keywords (Preferred) -->
            <div v-if="combinedSignals.keywords.prefer.length">
              <label class="font-medium text-gray-300 block mb-1">Preferred Keywords:</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.keywords.prefer" 
                  :key="'comb-pref-'+item.value"
                  class="px-2 py-0.5 bg-blue-900 bg-opacity-30 text-blue-400 rounded text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Keywords (Excluded) -->
            <div v-if="combinedSignals.keywords.exclude.length">
              <label class="font-medium text-gray-300 block mb-1">Excluded Keywords:</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.keywords.exclude" 
                  :key="'comb-kw-'+item.value"
                  class="px-2 py-0.5 bg-red-900 bg-opacity-30 text-red-400 rounded text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  ✕ {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
            </div>
            
            <!-- Combined Keywords (Required) -->
            <div v-if="combinedSignals.keywords.require_any.length">
              <label class="font-medium text-gray-300 block mb-1">Required Keywords (any match):</label>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="item in combinedSignals.keywords.require_any" 
                  :key="'comb-req-'+item.value"
                  class="px-2 py-0.5 bg-green-900 bg-opacity-30 text-green-400 rounded text-xs"
                  :title="'From: ' + item.sources.join(', ')"
                >
                  {{ item.value }} <span class="text-gray-500">({{ item.sources.length }})</span>
                </span>
              </div>
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
          :class="Math.abs(totalWeight - 1) > 0.001 ? 'bg-yellow-900 bg-opacity-20 text-yellow-400' : 'bg-green-900 bg-opacity-20 text-green-400'"
        >
          Total: {{ Math.round(totalWeight * 100) }}% 
          <span v-if="Math.abs(totalWeight - 1) > 0.001">(should equal 100%)</span>
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
    
    <!-- Preset Selection Modal -->
    <PresetSelectionModal
      v-if="showPresetSelector"
      v-model="showPresetSelector"
      :library="currentLibrary"
      :existing-preset-ids="existingPresetIds"
      @confirm="addPresets"
    />
  </Modal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '@/api'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import PresetSelectionModal from '@/components/policies/PresetSelectionModal.vue'

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
const selectedPresets = ref([])
const expandedPresetIds = ref(new Set())
const newKeyword = ref('')
const showPresetSelector = ref(false)

// Available options for signal customization
const availableRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR']
const availableGenres = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western']

const totalWeight = computed(() => {
  return form.value.preset_weight + form.value.pattern_weight + 
         form.value.rag_weight + form.value.history_weight
})

// Current library object for suggestions
const currentLibrary = computed(() => {
  if (!form.value.library_id) return null
  return libraries.value.find(l => l.id === form.value.library_id) || { id: form.value.library_id, name: 'Unknown' }
})

const existingPresetIds = computed(() => {
  return selectedPresets.value.map(p => p.preset_id || p.id)
})

// Group libraries by media type
const movieLibraries = computed(() => 
  libraries.value.filter(lib => lib.media_type === 'movie' || lib.media_type === 'movies')
)
const tvLibraries = computed(() => 
  libraries.value.filter(lib => lib.media_type === 'tv' || lib.media_type === 'show' || lib.media_type === 'shows')
)
const otherLibraries = computed(() => 
  libraries.value.filter(lib => !['movie', 'movies', 'tv', 'show', 'shows'].includes(lib.media_type))
)

// Combined signals from all selected presets (union of all signals)
// Combined signals from all selected presets (union of all signals with source attribution)
const combinedSignals = computed(() => {
  // Early return if no presets selected
  if (!selectedPresets.value || selectedPresets.value.length === 0) {
    return {
      certifications: { include: [], exclude: [] },
      genres: { prefer: [], exclude: [], require_any: [] },
      keywords: { prefer: [], require_any: [], exclude: [] }
    }
  }
  
  // Storage for signals: { [value]: Set(sourceNames) }
  const trackers = {
    certifications: { include: {}, exclude: {} },
    genres: { prefer: {}, exclude: {}, require_any: {} },
    keywords: { prefer: {}, require_any: {}, exclude: {} }
  }
  
  for (const sp of selectedPresets.value) {
    // Find full preset data
    const fullPreset = allPresets.value.find(p => p.id === sp.id || p.id === sp.preset_id)
    if (!fullPreset?.signals) continue
    
    const removedSignals = sp.customSignals?.removed || {}
    
    // Helper to add signals respecting removals
    const addSignals = (signalType, key) => {
      const baseItems = fullPreset.signals[signalType]?.[key] || []
      const removedItems = removedSignals[signalType]?.[key] || []
      const customItems = sp.customSignals?.[signalType]?.[key] || []
      
      // Add base items that aren't removed
      for (const item of baseItems) {
        if (!removedItems.includes(item)) {
          if (!trackers[signalType][key][item]) trackers[signalType][key][item] = new Set()
          trackers[signalType][key][item].add(sp.name)
        }
      }
      // Add custom items
      for (const item of customItems) {
        if (!trackers[signalType][key][item]) trackers[signalType][key][item] = new Set()
        trackers[signalType][key][item].add(sp.name)
      }
    }
    
    // Certifications
    addSignals('certifications', 'include')
    addSignals('certifications', 'exclude')
    
    // Genres
    addSignals('genres', 'prefer')
    addSignals('genres', 'exclude')
    addSignals('genres', 'require_any')
    
    // Keywords
    addSignals('keywords', 'prefer')
    addSignals('keywords', 'require_any')
    addSignals('keywords', 'exclude')
  }
  
  // Convert trackers to sorted arrays of objects { value, sources: [] }
  const formatResults = (categoryMap) => {
    return Object.entries(categoryMap)
      .map(([value, sourcesSet]) => ({
        value,
        sources: Array.from(sourcesSet).sort()
      }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }

  return {
    certifications: {
      include: formatResults(trackers.certifications.include),
      exclude: formatResults(trackers.certifications.exclude)
    },
    genres: {
      prefer: formatResults(trackers.genres.prefer),
      exclude: formatResults(trackers.genres.exclude),
      require_any: formatResults(trackers.genres.require_any)
    },
    keywords: {
      prefer: formatResults(trackers.keywords.prefer),
      require_any: formatResults(trackers.keywords.require_any),
      exclude: formatResults(trackers.keywords.exclude)
    }
  }
})



const isValid = computed(() => {
  const hasBasicInfo = form.value.library_id && form.value.name && selectedPresets.value.length > 0
  const weightsValid = Math.abs(totalWeight.value - 1) <= 0.001
  return hasBasicInfo && weightsValid
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
    fetchPresets()
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
    const response = await api.get('/policies/presets/all')
    allPresets.value = response.data
  } catch (error) {
    console.error('Failed to fetch presets:', error)
  }
}

const addPresets = (presets) => {
  if (!presets || !presets.length) return
  
  // Auto-fill policy name/desc if first presets
  if (selectedPresets.value.length === 0) {
      if (!form.value.name) {
        form.value.name = `${presets[0].name} Policy`
      }
      if (!form.value.description) {
        form.value.description = presets[0].description || ''
      }
  }

  for (const preset of presets) {
    const id = preset.id || preset.preset_id
    if (!selectedPresets.value.some(p => (p.id === id || p.preset_id === id))) {
      selectedPresets.value.push({
        id: id,
        preset_id: id,
        name: preset.name,
        icon: preset.icon,
        weight: 1.0,
      })
    }
  }
  showPresetSelector.value = false
}



const updatePresetWeight = (presetId, weight) => {
  const preset = selectedPresets.value.find(p => p.preset_id === presetId || p.id === presetId)
  if (preset) {
    preset.weight = weight
  }
}

const getPresetCustomSignals = (presetId) => {
  const preset = selectedPresets.value.find(p => p.preset_id === presetId || p.id === presetId)
  return preset?.customSignals || null
}

const updatePresetSignals = (presetId, signals) => {
  const preset = selectedPresets.value.find(p => p.preset_id === presetId || p.id === presetId)
  if (preset) {
    preset.customSignals = signals
  }
}

const removePreset = (presetId) => {
  const index = selectedPresets.value.findIndex(p => p.preset_id === presetId || p.id === presetId)
  if (index >= 0) {
    selectedPresets.value.splice(index, 1)
  }
  // Close customization panel if this preset was expanded
  expandedPresetIds.value.delete(presetId)
}

// Toggle customization panel for a preset
const togglePresetCustomize = (presetId) => {
  if (expandedPresetIds.value.has(presetId)) {
    expandedPresetIds.value.delete(presetId)
  } else {
    expandedPresetIds.value.add(presetId)
  }
  // Force reactivity update
  expandedPresetIds.value = new Set(expandedPresetIds.value)
}

// Get list of custom signal items for a preset
const getCustomSignalList = (preset, signalType, key) => {
  return preset.customSignals?.[signalType]?.[key] || []
}

// Add a custom signal item
const addCustomSignal = (preset, signalType, event) => {
  const value = event.target.value
  if (!value) return
  event.target.value = ''
  
  const [action, item] = value.split(':')
  
  // Initialize customSignals structure if needed
  if (!preset.customSignals) preset.customSignals = {}
  if (!preset.customSignals[signalType]) preset.customSignals[signalType] = {}
  if (!preset.customSignals[signalType][action]) preset.customSignals[signalType][action] = []
  
  // Add if not already present
  if (!preset.customSignals[signalType][action].includes(item)) {
    preset.customSignals[signalType][action].push(item)
  }
}

// Remove a custom signal item
const removeCustomSignal = (preset, signalType, key, item) => {
  if (preset.customSignals?.[signalType]?.[key]) {
    preset.customSignals[signalType][key] = preset.customSignals[signalType][key].filter(i => i !== item)
  }
}

// Get base signals from the preset's original signals definition
const getPresetBaseSignals = (selectedPreset, signalType, key) => {
  // Find the full preset data from allPresets
  const fullPreset = allPresets.value.find(p => p.id === selectedPreset.id || p.id === selectedPreset.preset_id)
  if (!fullPreset?.signals?.[signalType]?.[key]) return []
  return fullPreset.signals[signalType][key] || []
}

// Check if a base signal has been marked as removed
const isSignalRemoved = (preset, signalType, key, item) => {
  return preset.customSignals?.removed?.[signalType]?.[key]?.includes(item) || false
}

// Mark a base signal as removed
const markSignalRemoved = (preset, signalType, key, item) => {
  if (!preset.customSignals) preset.customSignals = {}
  if (!preset.customSignals.removed) preset.customSignals.removed = {}
  if (!preset.customSignals.removed[signalType]) preset.customSignals.removed[signalType] = {}
  if (!preset.customSignals.removed[signalType][key]) preset.customSignals.removed[signalType][key] = []
  
  if (!preset.customSignals.removed[signalType][key].includes(item)) {
    preset.customSignals.removed[signalType][key].push(item)
  }
}

// Restore a previously removed base signal
const unmarkSignalRemoved = (preset, signalType, key, item) => {
  if (preset.customSignals?.removed?.[signalType]?.[key]) {
    preset.customSignals.removed[signalType][key] = 
      preset.customSignals.removed[signalType][key].filter(i => i !== item)
  }
}

// Add keyword to preset
const addKeywordToPreset = (preset) => {
  const keyword = newKeyword.value.trim().toLowerCase()
  if (!keyword) return
  newKeyword.value = ''
  
  // Initialize customSignals structure if needed
  if (!preset.customSignals) preset.customSignals = {}
  if (!preset.customSignals.keywords) preset.customSignals.keywords = {}
  if (!preset.customSignals.keywords.require_any) preset.customSignals.keywords.require_any = []
  
  // Add if not already present
  if (!preset.customSignals.keywords.require_any.includes(keyword)) {
    preset.customSignals.keywords.require_any.push(keyword)
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
}

const save = async () => {
  if (!isValid.value) return

  const policyData = {
    ...form.value,
    presets: selectedPresets.value.map(p => ({
      preset_id: p.preset_id || p.id,
      weight: p.weight || 1.0,
      customSignals: p.customSignals || null,
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

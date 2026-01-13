<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <Modal v-model="isOpen" :title="isEditing ? 'Edit Custom Preset' : 'Create Custom Preset'" class="max-w-4xl">
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Basic Information -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-primary">Basic Information</h3>
        
        <div>
          <label class="block text-sm font-medium mb-2">Name *</label>
          <input
            v-model="form.name"
            type="text"
            required
            placeholder="e.g., Family Friendly Animation"
            class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Description</label>
          <textarea
            v-model="form.description"
            rows="2"
            placeholder="Brief description of this preset's purpose..."
            class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Icon</label>
          <select
            v-model="form.icon"
            class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none text-lg"
          >
            <optgroup label="Movies">
              <option value="🎬">🎬 Clapperboard</option>
              <option value="🎞️">🎞️ Film Frames</option>
              <option value="🎥">🎥 Movie Camera</option>
              <option value="📽️">📽️ Film Projector</option>
            </optgroup>
            <optgroup label="TV Shows">
              <option value="📺">📺 Television</option>
              <option value="📡">📡 Satellite</option>
            </optgroup>
            <optgroup label="Genres">
              <option value="🎭">🎭 Theater Masks</option>
              <option value="💥">💥 Action</option>
              <option value="😰">😰 Thriller</option>
              <option value="🔍">🔍 Mystery</option>
              <option value="💕">💕 Romance</option>
              <option value="👻">👻 Horror</option>
              <option value="🤣">🤣 Comedy</option>
              <option value="🧠">🧠 Psychological</option>
              <option value="🦸">🦸 Superhero</option>
              <option value="🌌">🌌 Sci-Fi</option>
              <option value="🧟">🧟 Zombie</option>
              <option value="🧛">🧛 Vampire</option>
              <option value="🕵️">🕵️ Spy</option>
              <option value="💰">💰 Heist</option>
              <option value="🥋">🥋 Martial Arts</option>
            </optgroup>
            <optgroup label="Themes/Seasonal">
              <option value="🎄">🎄 Christmas/Holiday</option>
              <option value="🎃">🎃 Halloween</option>
              <option value="🦃">🦃 Thanksgiving</option>
              <option value="💘">💘 Valentine's</option>
              <option value="🐰">🐰 Easter</option>
              <option value="☀️">☀️ Summer</option>
              <option value="❄️">❄️ Winter</option>
            </optgroup>
            <optgroup label="Quality/Awards">
              <option value="⭐">⭐ Star</option>
              <option value="🏆">🏆 Trophy</option>
              <option value="🏅">🏅 Award</option>
              <option value="💎">💎 Gem</option>
            </optgroup>
            <optgroup label="General">
              <option value="📁">📁 Folder</option>
              <option value="🎯">🎯 Target</option>
              <option value="🔖">🔖 Bookmark</option>
              <option value="📦">📦 Package</option>
            </optgroup>
            <optgroup label="Regional (Flags)">
              <option value="🇺🇸">🇺🇸 USA</option>
              <option value="🇬🇧">🇬🇧 UK</option>
              <option value="🇯🇵">🇯🇵 Japan</option>
              <option value="🇰🇷">🇰🇷 Korea</option>
              <option value="🇮🇳">🇮🇳 India</option>
              <option value="🇫🇷">🇫🇷 France</option>
              <option value="🌍">🌍 International</option>
            </optgroup>
            <optgroup label="Special Interest">
              <option value="🎤">🎤 Stand-up/Music</option>
              <option value="🎸">🎸 Music</option>
              <option value="🍳">🍳 Food/Cooking</option>
              <option value="🔬">🔬 Science</option>
              <option value="📚">📚 Documentary/Educational</option>
              <option value="🙏">🙏 Faith/Spiritual</option>
              <option value="👽">👽 Conspiracy/UFO</option>
            </optgroup>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Category</label>
          <select
            v-model="form.category"
            class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg focus:border-primary focus:outline-none"
          >
            <option value="general">General</option>
            <option value="genre">Genre</option>
            <option value="rating">Rating</option>
            <option value="theme">Theme</option>
            <option value="era">Era</option>
            <option value="studio">Studio</option>
            <option value="language">Language</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <!-- Signal Configuration -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-primary">Signal Configuration</h3>
        
        <!-- Content Rating Rules -->
        <div class="border border-gray-700 rounded-lg p-4 space-y-3">
          <h4 class="font-medium flex items-center gap-2">
            🔞 Content Ratings
          </h4>
          
          <div>
            <label class="block text-sm text-gray-400 mb-2">Mode</label>
            <select
              v-model="form.signals.certifications.mode"
              class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg text-sm"
            >
              <option value="include">Include (allow these ratings)</option>
              <option value="exclude">Exclude (block these ratings)</option>
              <option value="max">Maximum rating allowed</option>
            </select>
          </div>

          <div v-if="form.signals.certifications.mode === 'include'">
            <label class="block text-sm text-gray-400 mb-2">Allowed Ratings</label>
            <div class="flex flex-wrap gap-2">
              <label v-for="rating in availableRatings" :key="rating" class="flex items-center gap-2 px-3 py-2 bg-background-light rounded border border-gray-700 text-sm">
                <input
                  type="checkbox"
                  :value="rating"
                  v-model="form.signals.certifications.include"
                />
                {{ rating }}
              </label>
            </div>
          </div>

          <div v-else-if="form.signals.certifications.mode === 'exclude'">
            <label class="block text-sm text-gray-400 mb-2">Excluded Ratings</label>
            <div class="flex flex-wrap gap-2">
              <label v-for="rating in availableRatings" :key="rating" class="flex items-center gap-2 px-3 py-2 bg-background-light rounded border border-gray-700 text-sm">
                <input
                  type="checkbox"
                  :value="rating"
                  v-model="form.signals.certifications.exclude"
                />
                {{ rating }}
              </label>
            </div>
          </div>

          <div v-else-if="form.signals.certifications.mode === 'max'">
            <label class="block text-sm text-gray-400 mb-2">Maximum Rating</label>
            <select
              v-model="form.signals.certifications.max"
              class="w-full px-3 py-2 bg-background border border-gray-700 rounded-lg text-sm"
            >
              <option v-for="rating in availableRatings" :key="rating" :value="rating">{{ rating }}</option>
            </select>
          </div>
        </div>

        <!-- Genre Rules -->
        <div class="border border-gray-700 rounded-lg p-4 space-y-3">
          <h4 class="font-medium flex items-center gap-2">
            🎭 Genres
          </h4>
          
          <div>
            <label class="block text-sm text-gray-400 mb-2">Preferred Genres (boost score)</label>
            <div class="flex flex-wrap gap-2">
              <label v-for="genre in availableGenres" :key="genre" class="flex items-center gap-2 px-3 py-2 bg-background-light rounded border border-gray-700 text-sm">
                <input
                  type="checkbox"
                  :value="genre"
                  v-model="form.signals.genres.prefer"
                />
                {{ genre }}
              </label>
            </div>
          </div>

          <div>
            <label class="block text-sm text-gray-400 mb-2">Excluded Genres (penalize score)</label>
            <div class="flex flex-wrap gap-2">
              <label v-for="genre in availableGenres" :key="genre" class="flex items-center gap-2 px-3 py-2 bg-background-light rounded border border-gray-700 text-sm">
                <input
                  type="checkbox"
                  :value="genre"
                  v-model="form.signals.genres.exclude"
                />
                {{ genre }}
              </label>
            </div>
          </div>
        </div>

        <!-- Keyword Rules -->
        <div class="border border-gray-700 rounded-lg p-4 space-y-3">
          <h4 class="font-medium flex items-center gap-2">
            🔑 Keywords
          </h4>
          
          <div>
            <label class="block text-sm text-gray-400 mb-2">Preferred Keywords (boost if found in plot)</label>
            <TagInput v-model="form.signals.keywords.prefer" placeholder="Add keyword..." />
          </div>

          <div>
            <label class="block text-sm text-gray-400 mb-2">Excluded Keywords (penalize if found)</label>
            <TagInput v-model="form.signals.keywords.exclude" placeholder="Add keyword..." />
          </div>
        </div>
      </div>

      <div v-if="error" class="p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
        {{ error }}
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-3">
        <Button variant="ghost" @click="close">Cancel</Button>
        <Button variant="primary" @click="handleSubmit" :loading="saving">
          {{ isEditing ? 'Update' : 'Create' }} Preset
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import TagInput from '@/components/common/TagInput.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  preset: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'save'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const isEditing = computed(() => !!props.preset?.id)
const saving = ref(false)
const error = ref('')

const availableRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR']
const availableGenres = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 
  'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
]

const defaultForm = () => ({
  name: '',
  description: '',
  icon: '🎬',
  category: 'custom',
  signals: {
    certifications: {
      mode: 'include',
      include: [],
      exclude: [],
      max: null
    },
    genres: {
      prefer: [],
      exclude: []
    },
    keywords: {
      prefer: [],
      exclude: []
    }
  }
})

const form = ref(defaultForm())

// Reset form when modal opens
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    if (props.preset) {
      // Load existing preset data
      form.value = {
        name: props.preset.name || '',
        description: props.preset.description || '',
        icon: props.preset.icon || '🎬',
        category: props.preset.category || 'custom',
        signals: {
          certifications: {
            mode: props.preset.signals?.certifications?.mode || 'include',
            include: props.preset.signals?.certifications?.include || [],
            exclude: props.preset.signals?.certifications?.exclude || [],
            max: props.preset.signals?.certifications?.max || null
          },
          genres: {
            prefer: props.preset.signals?.genres?.prefer || [],
            exclude: props.preset.signals?.genres?.exclude || []
          },
          keywords: {
            prefer: props.preset.signals?.keywords?.prefer || [],
            exclude: props.preset.signals?.keywords?.exclude || []
          }
        }
      }
    } else {
      form.value = defaultForm()
    }
    error.value = ''
  }
})

async function handleSubmit() {
  error.value = ''
  
  if (!form.value.name.trim()) {
    error.value = 'Please enter a preset name'
    return
  }

  saving.value = true
  
  try {
    const presetData = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      icon: form.value.icon || '🎬',
      category: form.value.category,
      signals: form.value.signals
    }

    // Emit save event - parent will handle closing on success
    emit('save', presetData)
  } catch (err) {
    error.value = err.message || 'Failed to save preset'
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:modelValue', false)
  form.value = defaultForm()
  error.value = ''
}
</script>

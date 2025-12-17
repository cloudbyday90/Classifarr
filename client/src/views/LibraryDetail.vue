<template>
  <div>
    <div v-if="loading" class="flex justify-center py-12">
      <Spinner class="w-12 h-12" />
    </div>
    
    <div v-else-if="library">
      <!-- Header -->
      <div class="mb-6">
        <router-link
          to="/libraries"
          class="text-primary hover:text-blue-400 text-sm mb-2 inline-flex items-center"
        >
          <ChevronLeftIcon class="w-4 h-4 mr-1" />
          Back to Libraries
        </router-link>
        <h1 class="text-3xl font-bold text-text mt-2">{{ library.name }}</h1>
        <p class="text-text-muted mt-2">{{ library.path }}</p>
      </div>
      
      <!-- Tabs -->
      <div class="border-b border-gray-700 mb-6">
        <nav class="flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text hover:border-gray-500',
            ]"
            @click="activeTab = tab.id"
          >
            {{ tab.name }}
          </button>
        </nav>
      </div>
      
      <!-- Tab Content -->
      <div v-show="activeTab === 'labels'">
        <Card>
          <div class="space-y-8">
            <LabelSelector
              v-model="selectedRatings"
              title="Content Ratings"
              :labels="ratingLabels"
            />
            <LabelSelector
              v-model="selectedGenres"
              title="Genres"
              :labels="genreLabels"
            />
            <LabelSelector
              v-model="selectedContentTypes"
              title="Content Types"
              :labels="contentTypeLabels"
            />
          </div>
          
          <div class="mt-6 flex justify-end">
            <Button variant="primary" :loading="saving" @click="saveLabels">
              Save Labels
            </Button>
          </div>
        </Card>
      </div>
      
      <div v-show="activeTab === 'rules'">
        <RulesList
          :rules="library.customRules || []"
          @create="createRule"
          @edit="editRule"
          @delete="deleteRule"
        />
        
        <Modal v-model="showRuleEditor" title="Edit Rule" size="lg">
          <RuleEditor
            :rule="currentRule"
            @save="saveRule"
            @cancel="showRuleEditor = false"
          />
        </Modal>
      </div>
      
      <div v-show="activeTab === 'settings'">
        <Card title="Radarr/Sonarr Settings">
          <div class="space-y-4">
            <FormField label="Root Folder" help="Target folder for this library">
              <Input v-model="librarySettings.rootFolder" placeholder="/movies" />
            </FormField>
            
            <FormField label="Quality Profile">
              <Select
                v-model="librarySettings.qualityProfile"
                :options="qualityProfiles"
                placeholder="Select quality profile"
              />
            </FormField>
            
            <FormField label="Priority">
              <Select
                v-model="librarySettings.priority"
                :options="priorityOptions"
                placeholder="Select priority"
              />
            </FormField>
          </div>
          
          <div class="mt-6 flex justify-end">
            <Button variant="primary" :loading="saving" @click="saveSettings">
              Save Settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLibrariesStore } from '@/stores/libraries'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Modal from '@/components/common/Modal.vue'
import Spinner from '@/components/common/Spinner.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import FormField from '@/components/settings/FormField.vue'
import LabelSelector from '@/components/libraries/LabelSelector.vue'
import RulesList from '@/components/libraries/RulesList.vue'
import RuleEditor from '@/components/libraries/RuleEditor.vue'
import { ChevronLeftIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const librariesStore = useLibrariesStore()

const library = ref(null)
const loading = ref(false)
const saving = ref(false)
const activeTab = ref('labels')
const showRuleEditor = ref(false)
const currentRule = ref(null)

const tabs = [
  { id: 'labels', name: 'Labels' },
  { id: 'rules', name: 'Custom Rules' },
  { id: 'settings', name: 'Settings' },
]

const selectedRatings = ref([])
const selectedGenres = ref([])
const selectedContentTypes = ref([])
const librarySettings = ref({
  rootFolder: '',
  qualityProfile: '',
  priority: 'medium',
})

const ratingLabels = [
  { value: 'G', label: 'G' },
  { value: 'PG', label: 'PG' },
  { value: 'PG-13', label: 'PG-13' },
  { value: 'R', label: 'R' },
  { value: 'NC-17', label: 'NC-17' },
  { value: 'TV-Y', label: 'TV-Y' },
  { value: 'TV-Y7', label: 'TV-Y7' },
  { value: 'TV-G', label: 'TV-G' },
  { value: 'TV-PG', label: 'TV-PG' },
  { value: 'TV-14', label: 'TV-14' },
  { value: 'TV-MA', label: 'TV-MA' },
]

const genreLabels = [
  { value: 'action', label: 'Action' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'animation', label: 'Animation' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'crime', label: 'Crime' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'drama', label: 'Drama' },
  { value: 'family', label: 'Family' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'horror', label: 'Horror' },
  { value: 'romance', label: 'Romance' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'thriller', label: 'Thriller' },
]

const contentTypeLabels = [
  { value: 'movie', label: 'Movie' },
  { value: 'series', label: 'TV Series' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'short', label: 'Short' },
]

const qualityProfiles = [
  { value: 'any', label: 'Any' },
  { value: 'hd-720p', label: 'HD - 720p' },
  { value: 'hd-1080p', label: 'HD - 1080p' },
  { value: 'uhd-4k', label: 'Ultra-HD' },
]

const priorityOptions = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

onMounted(async () => {
  await loadLibrary()
})

const loadLibrary = async () => {
  loading.value = true
  try {
    library.value = await librariesStore.fetchLibrary(route.params.id)
    // Load existing selections
    if (library.value.labels) {
      selectedRatings.value = library.value.labels.ratings || []
      selectedGenres.value = library.value.labels.genres || []
      selectedContentTypes.value = library.value.labels.contentTypes || []
    }
    if (library.value.settings) {
      librarySettings.value = { ...librarySettings.value, ...library.value.settings }
    }
  } catch (error) {
    console.error('Error loading library:', error)
  } finally {
    loading.value = false
  }
}

const saveLabels = async () => {
  saving.value = true
  try {
    await librariesStore.updateLibrary(route.params.id, {
      labels: {
        ratings: selectedRatings.value,
        genres: selectedGenres.value,
        contentTypes: selectedContentTypes.value,
      },
    })
  } catch (error) {
    console.error('Error saving labels:', error)
  } finally {
    saving.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    await librariesStore.updateLibrary(route.params.id, {
      settings: librarySettings.value,
    })
  } catch (error) {
    console.error('Error saving settings:', error)
  } finally {
    saving.value = false
  }
}

const createRule = () => {
  router.push(`/libraries/${route.params.id}/rules/new`)
}

const editRule = (rule) => {
  currentRule.value = rule
  showRuleEditor.value = true
}

const saveRule = async (rule) => {
  saving.value = true
  try {
    await librariesStore.updateLibrary(route.params.id, {
      customRules: [
        ...(library.value.customRules || []).filter(r => r.id !== rule.id),
        rule,
      ],
    })
    showRuleEditor.value = false
    await loadLibrary()
  } catch (error) {
    console.error('Error saving rule:', error)
  } finally {
    saving.value = false
  }
}

const deleteRule = async (rule) => {
  if (confirm(`Delete rule "${rule.name}"?`)) {
    try {
      await librariesStore.updateLibrary(route.params.id, {
        customRules: (library.value.customRules || []).filter(r => r.id !== rule.id),
      })
      await loadLibrary()
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }
}
</script>

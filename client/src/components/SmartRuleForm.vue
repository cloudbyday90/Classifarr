<template>
  <div class="space-y-6">
    <!-- Rule Details -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">Rule Details</h2>
      </template>
      <div class="space-y-4">
        <!-- Library Name (read-only) -->
        <div>
          <label class="block text-sm font-medium text-gray-400 mb-1">Library</label>
          <div class="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white opacity-75 cursor-not-allowed">
            {{ libraryName || 'Loading...' }}
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            v-model="ruleName" 
            label="Rule Name" 
            placeholder="e.g. Holiday Movies"
          />
          <div class="flex items-center space-x-2 mt-8">
            <Toggle v-model="isActive" />
            <span class="text-gray-300">Active</span>
          </div>
          <div class="md:col-span-2">
            <Input 
              v-model="description" 
              label="Description" 
              placeholder="Automatically classify holiday content..."
            />
          </div>
        </div>
      </div>
    </Card>

    <!-- Library Patterns - "Use This" Section -->
    <Card v-if="conditions.length === 0 && !editingRuleId">
      <template #header>
        <h2 class="text-xl font-semibold">📚 Available Library Filters</h2>
      </template>
      
      <div v-if="loadingLibraryPatterns" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-gray-400">Analyzing library metadata...</p>
      </div>
      
      <div v-else-if="libraryPatterns.length > 0" class="space-y-4">
        <p class="text-gray-400">
          Select conditions from your library's metadata to build a rule:
        </p>
        
        <div class="space-y-3">
          <div 
            v-for="(pattern, idx) in libraryPatterns" 
            :key="idx"
            class="bg-background-light p-4 rounded border"
            :class="pattern.selected ? 'border-primary' : 'border-gray-700'"
          >
            <div class="flex items-start gap-3">
              <input 
                type="checkbox" 
                v-model="pattern.selected"
                class="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary"
              />
              <div class="flex-1">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h4 class="font-medium text-white capitalize">{{ pattern.field.replace('_', ' ') }}</h4>
                    <p class="text-sm text-gray-400">
                      {{ pattern.matchCount }} items have this data
                      ({{ pattern.matchPercentage }}% of library)
                    </p>
                  </div>
                  <button 
                    @click.stop="dismissPattern(pattern)" 
                    class="text-gray-500 hover:text-red-400 transition-colors text-sm p-1"
                    title="Dismiss this filter"
                  >
                    ✕
                  </button>
                </div>

                <div class="flex gap-3 flex-wrap">
                  <div class="flex-shrink-0">
                    <label class="block text-xs text-gray-400 mb-1">Operator</label>
                    <select 
                      v-model="pattern.operator"
                      class="bg-gray-900 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-primary"
                    >
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not Equals</option>
                      <option value="contains" v-if="['collections', 'tags', 'genres'].includes(pattern.field)">Contains</option>
                      <option value="is_one_of">Is one of</option>
                    </select>
                  </div>
                  <div class="flex-1 min-w-0">
                    <label class="block text-xs text-gray-400 mb-1">Available Values</label>
                    <div class="flex flex-wrap gap-2">
                      <span 
                        v-for="value in pattern.values.slice(0, 10)" 
                        :key="value"
                        class="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-800 text-gray-300"
                      >
                        {{ value }}
                        <span class="ml-1 text-gray-500">({{ pattern.valueCounts[value] }})</span>
                      </span>
                      <span v-if="pattern.values.length > 10" class="text-xs text-gray-500 py-1">
                        +{{ pattern.values.length - 10 }} more
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Show Dismissed Toggle -->
        <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
          <button 
            @click="showDismissedPatterns = !showDismissedPatterns"
            class="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <span>{{ showDismissedPatterns ? '▼' : '▶' }}</span>
            Show Dismissed ({{ dismissedPatterns.length }})
          </button>
        </div>
        
        <!-- Dismissed Patterns Section -->
        <div v-if="showDismissedPatterns && dismissedPatterns.length > 0" class="mt-4 space-y-2">
          <div 
            v-for="dp in dismissedPatterns" 
            :key="`${dp.pattern_type}-${dp.pattern_value}`"
            class="flex items-center justify-between bg-gray-900/50 p-3 rounded border border-gray-700"
          >
            <div>
              <span class="text-gray-400 capitalize">{{ dp.pattern_type.replace('_', ' ') }}:</span>
              <span class="ml-2 text-gray-300">{{ dp.pattern_value }}</span>
            </div>
            <button 
              @click="restorePattern(dp)"
              class="text-sm text-primary hover:text-primary-light transition-colors"
            >
              Restore
            </button>
          </div>
        </div>
        <div v-else-if="showDismissedPatterns" class="mt-4 text-center text-gray-500 text-sm py-4">
          No dismissed patterns
        </div>
        
        <div class="flex justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-700">
          <Button variant="ghost" @click="addCondition">
            + Add Custom Condition
          </Button>
          <Button variant="primary" @click="applySelectedPatterns" :disabled="!libraryPatterns.some(p => p.selected)">
            Use Selected Conditions
          </Button>
        </div>
      </div>
      
      <div v-else class="text-center py-8">
        <p class="text-gray-500 mb-4">No library items found or still syncing.</p>
        <Button variant="ghost" @click="addCondition">
          + Add Custom Condition
        </Button>
      </div>
    </Card>

    <!-- AI-Powered Suggestions -->
    <Card v-if="conditions.length === 0 && !editingRuleId">
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">🧠 AI Suggestions</h2>
          <Button 
            size="sm" 
            variant="secondary" 
            @click="loadSmartSuggestions" 
            :loading="loadingSmartSuggestions"
          >
            Refresh
          </Button>
        </div>
      </template>
      
      <div v-if="loadingSmartSuggestions" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-gray-400">Generating smart suggestions...</p>
        <p class="text-xs text-gray-500 mt-2">Using AI to analyze library patterns</p>
      </div>
      
      <div v-else-if="smartSuggestions.length > 0" class="space-y-4">
        <p class="text-gray-400 text-sm">
          {{ smartSuggestionsSource === 'llm' ? '🤖 AI-generated' : '📊 Data-driven' }} suggestions based on your library content
        </p>
        
        <div v-for="(suggestion, idx) in smartSuggestions" :key="idx" class="bg-background-light p-4 rounded border border-gray-700 hover:border-primary transition-colors">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-medium text-white">{{ suggestion.name }}</h4>
              <p class="text-sm text-gray-400 mt-1">{{ suggestion.reasoning }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span 
                class="px-2 py-1 text-xs rounded-full"
                :class="getConfidenceClass(suggestion.confidence)"
              >
                {{ suggestion.confidence }}% confidence
              </span>
            </div>
          </div>
          
          <div class="text-xs text-gray-500 font-mono mt-2 mb-3">
            <span v-for="(cond, i) in suggestion.conditions" :key="i">
              {{ cond.field }} {{ cond.operator }} "{{ cond.value }}"
              <span v-if="i < suggestion.conditions.length - 1" class="text-gray-600"> AND </span>
            </span>
          </div>
          
          <Button size="sm" variant="primary" @click="applySmartSuggestion(suggestion)">
            Use This Rule
          </Button>
        </div>
      </div>
      
      <div v-else class="text-center py-8 text-gray-500">
        <p>No suggestions available yet.</p>
        <p class="text-xs mt-2">Make sure Ollama is configured or wait for more content analysis.</p>
      </div>
    </Card>

    <!-- Conditions -->
    <Card v-if="conditions.length > 0">
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Conditions</h2>
          <Button size="sm" variant="secondary" @click="addCondition">
            + Add Condition
          </Button>
        </div>
      </template>

      <div class="space-y-3">
        <div 
          v-for="(condition, index) in conditions" 
          :key="index"
          class="flex flex-col md:flex-row gap-3 items-start md:items-end bg-background-light p-3 rounded border border-gray-700"
        >
          <div class="w-full md:w-1/4">
            <label class="block text-xs text-gray-400 mb-1">Field</label>
            <select 
              v-model="condition.field"
              class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary [&>option]:bg-gray-800 [&>option]:text-white"
            >
              <option value="content_type">Content Type</option>
              <option value="genres">Genre</option>
              <option value="keywords">Keyword</option>
              <option value="certification">Content Rating</option>
              <option value="title">Title</option>
              <option value="year">Year</option>
            </select>
          </div>

          <div class="w-full md:w-1/4">
            <label class="block text-xs text-gray-400 mb-1">Operator</label>
            <select 
              v-model="condition.operator"
              class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary [&>option]:bg-gray-800 [&>option]:text-white"
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Does not equal</option>
              <option value="contains" v-if="['genres', 'keywords', 'title'].includes(condition.field)">Contains</option>
              <option value="not_contains" v-if="['genres', 'keywords', 'title'].includes(condition.field)">Does not contain</option>
              <option value="is_one_of" v-if="['content_type', 'certification', 'genres'].includes(condition.field)">Is one of...</option>
              <option v-if="condition.field === 'year'" value="greater_than">Greater than</option>
              <option v-if="condition.field === 'year'" value="less_than">Less than</option>
            </select>
          </div>

          <div class="w-full md:w-1/3">
            <label class="block text-xs text-gray-400 mb-1">Value</label>
            
            <!-- Content Type Select -->
            <select 
              v-if="condition.field === 'content_type'"
              v-model="condition.value"
              :multiple="condition.operator === 'is_one_of'"
              class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
              :class="{ 'h-32': condition.operator === 'is_one_of' }"
            >
              <option value="holiday">Holiday</option>
              <option value="standup">Stand-up Comedy</option>
              <option value="anime">Anime</option>
              <option value="kdrama">K-Drama</option>
              <option value="realityTV">Reality TV</option>
              <option value="concert">Concert</option>
              <option value="adultAnimation">Adult Animation</option>
              <option value="halloween">Halloween</option>
              <option value="documentary">Documentary</option>
            </select>
            
            <!-- Certification Select (New) -->
            <select 
              v-else-if="condition.field === 'certification'"
              v-model="condition.value"
              :multiple="condition.operator === 'is_one_of'"
              class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
              :class="{ 'h-32': condition.operator === 'is_one_of' }"
            >
              <option value="G">G / TV-G</option>
              <option value="PG">PG / TV-PG</option>
              <option value="PG-13">PG-13 / TV-14</option>
              <option value="R">R / TV-MA</option>
              <option value="NC-17">NC-17</option>
              <option value="NR">Not Rated</option>
            </select>

            <!-- Default Input -->
            <input 
              v-else
              v-model="condition.value"
              type="text"
              class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
              :placeholder="getValuePlaceholder(condition.field)"
            />
          </div>

          <Button 
            variant="ghost" 
            class="text-red-400 hover:text-red-300" 
            @click="removeCondition(index)"
          >
            Trash
          </Button>
        </div>
      </div>
    </Card>

    <!-- Preview -->
    <Card>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Preview Matches</h2>
          <Button :loading="previewLoading" @click="previewRule">
            Update Preview
          </Button>
        </div>
      </template>

      <div v-if="previewItems.length > 0" class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-gray-400 border-b border-gray-700">
              <th class="py-2">Title</th>
              <th class="py-2">Year</th>
              <th class="py-2">Type</th>
              <th class="py-2">Genres</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-for="item in previewItems" :key="item.id" class="border-b border-gray-800">
              <td class="py-2">{{ item.title }}</td>
              <td class="py-2">{{ item.year }}</td>
              <td class="py-2">
                <Badge v-if="item.metadata?.content_analysis?.type">
                  {{ item.metadata.content_analysis.type }}
                </Badge>
                <span v-else class="text-gray-600">-</span>
              </td>
              <td class="py-2 text-gray-400">
                {{ formatGenres(item.genres) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-xs text-gray-500 mt-2">Showing first 20 matches.</p>
      </div>
      <div v-else-if="!previewLoading" class="text-center py-4 text-gray-500">
        No items match the current conditions (or preview not run).
      </div>
    </Card>

    <!-- Pattern Selection Modal -->
    <div 
      v-if="showPatternModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      @click.self="cancelPatternSelection"
    >
      <div class="bg-background border border-gray-700 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold">Select Conditions for "{{ selectedContentType }}" Content</h2>
            <button @click="cancelPatternSelection" class="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>

          <p class="text-gray-400 text-sm mb-6">
            Based on your media server library, we detected {{ detectedPatterns.length }} patterns. 
            Select which conditions you'd like to include in this rule.
          </p>

          <div v-if="loadingPatterns" class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p class="text-gray-400">Analyzing patterns...</p>
          </div>

          <div v-else class="space-y-3">
            <div 
              v-for="(pattern, idx) in detectedPatterns" 
              :key="idx"
              class="bg-background-light p-4 rounded border"
              :class="pattern.selected ? 'border-primary' : 'border-gray-700'"
            >
              <div class="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  v-model="pattern.selected"
                  class="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary"
                />
                <div class="flex-1">
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <h4 class="font-medium text-white capitalize">{{ pattern.field.replace('_', ' ') }}</h4>
                      <p class="text-sm text-gray-400">
                        {{ pattern.matchCount }} of {{ pattern.totalCount }} items 
                        ({{ pattern.matchPercentage }}%)
                      </p>
                    </div>
                    <div v-if="pattern.preSelected" class="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded">
                      Recommended
                    </div>
                  </div>

                  <div class="flex gap-3">
                    <div class="flex-shrink-0">
                      <label class="block text-xs text-gray-400 mb-1">Operator</label>
                      <select 
                        v-model="pattern.operator"
                        class="bg-gray-900 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-primary"
                      >
                        <option value="equals">Equals</option>
                        <option value="not_equals">Not Equals</option>
                        <option value="contains" v-if="['collections', 'labels', 'genres'].includes(pattern.field)">Contains</option>
                        <option value="is_one_of">Is one of</option>
                      </select>
                    </div>
                    <div class="flex-1">
                      <label class="block text-xs text-gray-400 mb-1">Values</label>
                      <div class="flex flex-wrap gap-2">
                        <span 
                          v-for="value in pattern.values" 
                          :key="value"
                          class="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-800 text-gray-300"
                        >
                          {{ value }}
                          <span class="ml-2 text-gray-500">({{ pattern.valueCounts[value] }})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
            <Button variant="secondary" @click="cancelPatternSelection">Cancel</Button>
            <Button variant="primary" @click="confirmPatterns" :disabled="!detectedPatterns.some(p => p.selected)">
              Create Rule with Selected Conditions
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-4">
      <Button variant="secondary" @click="$emit('cancel')">Cancel</Button>
      <Button variant="primary" :loading="saving" @click="saveRule" :disabled="!isValid">
        Save Rule
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Toggle from '@/components/common/Toggle.vue'
import Badge from '@/components/common/Badge.vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const props = defineProps({
  libraryId: {
    type: [String, Number],
    required: true
  }
})

const route = useRoute()
const emit = defineEmits(['cancel', 'save'])
const toast = useToast()

const ruleName = ref('')
const description = ref('')
const isActive = ref(true)
const conditions = ref([])
const previewItems = ref([])
const previewLoading = ref(false)
const saving = ref(false)
const stats = ref({})
const loadingStats = ref(true)
const analyzing = ref(false)
const editingRuleId = ref(null)
const libraryName = ref('')

// Smart suggestions state
const smartSuggestions = ref([])
const smartSuggestionsSource = ref('')
const loadingSmartSuggestions = ref(false)

// Pattern selection modal state
const showPatternModal = ref(false)
const detectedPatterns = ref([])
const loadingPatterns = ref(false)
const selectedContentType = ref('')

// Library patterns state (from media server metadata directly)
const libraryPatterns = ref([])
const loadingLibraryPatterns = ref(false)

const isValid = computed(() => {
  return ruleName.value.trim() && conditions.value.length > 0
})

onMounted(async () => {
  // Load library name first
  try {
    const libResponse = await api.getLibrary(props.libraryId)
    libraryName.value = libResponse.data.name
  } catch (error) {
    console.error('Failed to load library:', error)
  }
  
  // Load available patterns from library metadata
  await loadLibraryPatterns()
  
  // Check if we are editing an existing rule
  if (route.query.ruleId) {
    editingRuleId.value = route.query.ruleId
    await loadRule(editingRuleId.value)
  }
  
  await loadStats()
  await loadSmartSuggestions()
})

const loadRule = async (ruleId) => {
  try {
    const response = await api.getLibraryRule(props.libraryId, ruleId)
    const rule = response.data
    ruleName.value = rule.name
    description.value = rule.description
    isActive.value = rule.is_active
    // Ensure conditions is an array
    conditions.value = Array.isArray(rule.rule_json) ? rule.rule_json : [rule.rule_json]
    
    // Auto-run preview for existing rule
    previewRule()
  } catch (error) {
    console.error('Failed to load rule:', error)
    toast.error('Failed to load rule details')
  }
}

const loadStats = async () => {
  try {
    const response = await api.getRuleStats(props.libraryId)
    stats.value = response.data
    
    // If analysis is in progress (less than 100% complete), poll for updates
    if (stats.value.total > 0 && stats.value.analyzed < stats.value.total) {
      setTimeout(loadStats, 3000) // Access check every 3 seconds
    }
  } catch (error) {
    console.error('Error loading stats:', error)
  } finally {
    loadingStats.value = false
  }
}

const loadSmartSuggestions = async () => {
  loadingSmartSuggestions.value = true
  try {
    const response = await api.getSmartSuggestions(props.libraryId)
    smartSuggestions.value = response.data.suggestions || []
    smartSuggestionsSource.value = response.data.source || 'data-analysis'
  } catch (error) {
    console.error('Error loading smart suggestions:', error)
    smartSuggestions.value = []
  } finally {
    loadingSmartSuggestions.value = false
  }
}

const applySmartSuggestion = async (suggestion) => {
  ruleName.value = suggestion.name
  description.value = suggestion.reasoning || ''
  
  // Map backend field names to frontend form field names
  const fieldMap = {
    'genre': 'genres',
    'rating': 'certification',
    'content_type': 'content_type',
    'language': 'language',
    'keyword': 'keywords'
  }
  
  // Map backend operators to frontend form operators
  const operatorMap = {
    'contains': 'contains',
    'equals': 'equals',
    'includes': 'is_one_of'
  }
  
  conditions.value = suggestion.conditions.map(c => ({
    field: fieldMap[c.field] || c.field,
    operator: operatorMap[c.operator] || c.operator,
    value: c.value
  }))
  
  // Auto-save the rule immediately
  await saveRule()
}

const getConfidenceClass = (confidence) => {
  if (confidence >= 80) return 'bg-green-900/50 text-green-400'
  if (confidence >= 60) return 'bg-yellow-900/50 text-yellow-400'
  return 'bg-gray-700/50 text-gray-400'
}

// Keep the manual trigger available as a fallback/repair utility
const runAnalysis = async () => {
  analyzing.value = true
  try {
    await api.analyzeLibrary(props.libraryId)
    await loadStats() // Refresh stats after analysis
    toast.add({
      title: 'Analysis Complete',
      message: 'Library content has been analyzed.',
      type: 'success'
    })
  } catch (error) {
    console.error('Error running analysis:', error)
    toast.error(error.message || 'Could not run analysis.', 'Analysis Failed')
  } finally {
    analyzing.value = false
  }
}

// Load available patterns from library media server metadata
const loadLibraryPatterns = async () => {
  try {
    loadingLibraryPatterns.value = true
    
    // Load metadata patterns and dismissed patterns in parallel
    const [patternsResponse, dismissedResponse] = await Promise.all([
      api.getAvailablePatterns(props.libraryId),
      api.getDismissedPatterns(props.libraryId)
    ])
    
    dismissedPatterns.value = dismissedResponse.data
    
    const dismissedKeys = new Set(
      dismissedPatterns.value.map(dp => `${dp.pattern_type}:${dp.pattern_value}`)
    )
    
    // Filter out dismissed patterns and add 'selected' property
    libraryPatterns.value = patternsResponse.data.patterns
      .filter(p => !dismissedKeys.has(`${p.field}:${p.values}`)) // Simple check, might need refinement for array values
      // Better check:
      .filter(pattern => {
        // pattern.values is an array like ['PG-13']. Check if this specific combination is dismissed
        // For array values like genres, the pattern suggestions usually return top individual values
        // If the pattern represents a single value (common case for top suggestions), check against dismissed
        if (pattern.values.length === 1) {
           return !dismissedKeys.has(`${pattern.field}:${pattern.values[0]}`)
        }
        return true // Keep complex patterns for now
      })
      .map(pattern => ({
        ...pattern,
        selected: false
      }))
      
  } catch (error) {
    console.error('Failed to load library patterns:', error)
  } finally {
    loadingLibraryPatterns.value = false
  }
}

// Dismissed patterns state
const dismissedPatterns = ref([])
const showDismissedPatterns = ref(false)

const loadDismissedPatterns = async () => {
  try {
    const response = await api.getDismissedPatterns(props.libraryId)
    dismissedPatterns.value = response.data
  } catch (error) {
    console.error('Failed to load dismissed patterns:', error)
  }
}

const dismissPattern = async (pattern) => {
  // Only handling single-value patterns for dismissal for now (common case)
  if (!pattern.values || pattern.values.length !== 1) {
    toast.info('Can only dismiss single-value patterns')
    return
  }
  
  const value = pattern.values[0]
  
  try {
    await api.dismissPattern(props.libraryId, pattern.field, value)
    
    // Remove from active list
    libraryPatterns.value = libraryPatterns.value.filter(p => p !== pattern)
    
    // Add to dismissed list
    dismissedPatterns.value.unshift({
      pattern_type: pattern.field,
      pattern_value: value,
      dismissed_at: new Date().toISOString()
    })
    
    toast.success('Filter dismissed')
  } catch (error) {
    console.error('Failed to dismiss pattern:', error)
    toast.error('Failed to dismiss pattern')
  }
}

const restorePattern = async (dismissedPattern) => {
  try {
    await api.restorePattern(props.libraryId, dismissedPattern.pattern_type, dismissedPattern.pattern_value)
    
    // Remove from dismissed list
    dismissedPatterns.value = dismissedPatterns.value.filter(dp => dp !== dismissedPattern)
    
    // Reload active patterns to bring it back
    // We could manually add it back if we had the full pattern object, but reloading is safer
    await loadLibraryPatterns()
    
    toast.success('Filter restored')
  } catch (error) {
    console.error('Failed to restore pattern:', error)
    toast.error('Failed to restore pattern')
  }
}

// Apply selected library patterns as rule conditions
const applySelectedPatterns = async () => {
  const selected = libraryPatterns.value.filter(p => p.selected)
  
  if (selected.length === 0) {
    toast.error('Please select at least one condition', 'No Conditions Selected')
    return
  }
  
  // Set rule name if not already set
  if (!ruleName.value) {
    ruleName.value = 'Library Filter Rule'
    description.value = 'Rule created from library metadata patterns'
  }
  
  // Map patterns to conditions format
  conditions.value = selected.map(pattern => ({
    field: pattern.field,
    operator: pattern.operator,
    value: pattern.operator === 'is_one_of' ? pattern.values : pattern.values[0]
  }))
  
  // Preview the rule
  await previewRule()
  
  toast.success('Conditions added from library patterns', 'Patterns Applied')
}

const applySuggestion = async (type) => {
  try {
    loadingPatterns.value = true;
    selectedContentType.value = type;
    
    // Fetch pattern suggestions from API
    const response = await api.getPatternSuggestions(props.libraryId, type);
    
    // Add 'selected' property to each pattern (pre-select if preSelected is true)
    detectedPatterns.value = response.data.patterns.map(pattern => ({
      ...pattern,
      selected: pattern.preSelected || false
    }));
    
    // Set default rule name and description
    ruleName.value = `${type.charAt(0).toUpperCase() + type.slice(1)} Content`;
    description.value = `Auto-detected ${type} content based on media server metadata`;
    
    // Show the pattern selection modal
    showPatternModal.value = true;
  } catch (error) {
    console.error('Failed to load pattern suggestions:', error);
    toast.error('Failed to load pattern suggestions', 'Error');
  } finally {
    loadingPatterns.value = false;
  }
}

const confirmPatterns = async () => {
  // Get selected patterns and convert to conditions
  const selectedPatterns = detectedPatterns.value.filter(p => p.selected);
  
  if (selectedPatterns.length === 0) {
    toast.error('Please select at least one condition', 'No Conditions Selected');
    return;
  }
  
  // Map patterns to conditions format
  conditions.value = selectedPatterns.map(pattern => ({
    field: pattern.field,
    operator: pattern.operator,
    value: pattern.operator === 'is_one_of' ? pattern.values : pattern.values[0]
  }));
  
  // Close modal
  showPatternModal.value = false;
  
  // Optionally auto-preview the rule
  await previewRule();
}

const cancelPatternSelection = () => {
  showPatternModal.value = false;
  detectedPatterns.value = [];
  selectedContentType.value = '';
}

const addCondition = () => {
  conditions.value.push({
    field: 'genres',
    operator: 'contains',
    value: ''
  })
}

const removeCondition = (index) => {
  conditions.value.splice(index, 1)
}

const getValuePlaceholder = (field) => {
  switch (field) {
    case 'genres': return 'Action, Comedy...'
    case 'keywords': return 'space, superhero...'
    case 'certification': return 'PG-13, R, TV-MA...'
    case 'year': return '2023'
    default: return ''
  }
}

const formatGenres = (genres) => {
  if (Array.isArray(genres)) {
    return genres.map(g => typeof g === 'string' ? g : g.tag).join(', ')
  }
  return ''
}

const previewRule = async () => {
  if (conditions.value.length === 0) return
  
  previewLoading.value = true
  try {
    const response = await api.previewRule({
      library_id: props.libraryId,
      criteria: conditions.value
    })
    previewItems.value = response.data
  } catch (error) {
    console.error('Preview failed:', error)
    toast.add({
      title: 'Preview Failed',
      message: error.message || 'Could not preview rule matches.',
      type: 'error'
    })
  } finally {
    previewLoading.value = false
  }
}

const saveRule = async () => {
  if (!isValid.value) return
  
  saving.value = true
  try {
    const payload = {
      name: ruleName.value,
      description: description.value,
      is_active: isActive.value,
      conditions: conditions.value // Array of conditions - field name must match backend
    }
    
    if (editingRuleId.value) {
      await api.updateLibraryRule(props.libraryId, editingRuleId.value, payload)
      toast.success('The classification rule has been updated.', 'Rule Updated')
    } else {
      await api.addLibraryRule(props.libraryId, payload)
      toast.success('The classification rule has been created.', 'Rule Saved')
    }
    
    emit('save')
  } catch (error) {
    console.error('Save failed:', error)
    toast.error(error.response?.data?.error || error.message, 'Save Failed')
  } finally {
    saving.value = false
  }
}

// onMounted is now at the top
// onMounted(() => {
//   loadStats();
// })
</script>

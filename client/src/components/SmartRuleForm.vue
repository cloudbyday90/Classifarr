<template>
  <div class="space-y-6">
    <!-- Rule Details -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">Rule Details</h2>
      </template>
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
    </Card>

    <!-- Stats & Suggestions -->
    <Card v-if="conditions.length === 0 && !editingRuleId">
      <template #header>
        <h2 class="text-xl font-semibold">Detected Content</h2>
      </template>
      
      <div v-if="loadingStats" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-gray-400">Analyzing library content...</p>
      </div>
      
      <div v-else-if="stats.types" class="space-y-6">
        <!-- Analysis Progress -->
        <div class="bg-background-light p-4 rounded border border-gray-700">
          <div class="flex justify-between items-end mb-2">
            <div>
              <h3 class="font-medium text-white">Analysis Status</h3>
              <p class="text-sm text-gray-400">
                {{ stats.analyzed }} of {{ stats.total }} items classified
              </p>
            </div>
            <div class="text-right">
              <span class="text-2xl font-bold text-primary">{{ Math.round((stats.analyzed / stats.total) * 100) || 0 }}%</span>
            </div>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-2.5">
            <div 
              class="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out" 
              :style="{ width: `${(stats.analyzed / stats.total) * 100}%` }"
            ></div>
          </div>
          <p v-if="stats.analyzed < stats.total" class="text-xs text-blue-400 mt-2 flex items-center gap-2">
            <span class="animate-pulse">●</span> {{ stats.total - stats.analyzed }} items queued for analysis...
          </p>
        </div>

        <p class="text-gray-400">
          Click "Use This" on any detected group to automatically create a rule.
        </p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="stat in stats.types" 
            :key="stat.type"
            class="bg-background-light p-4 rounded border border-gray-700 hover:border-primary transition-colors cursor-pointer"
            @click="applySuggestion(stat.type)"
          >
            <div class="flex justify-between items-start mb-2">
              <Badge>{{ stat.type }}</Badge>
              <span class="text-xl font-bold">{{ stat.count }}</span>
            </div>
            <p class="text-xs text-gray-500 mb-3">Items found</p>
            <Button size="sm" variant="secondary" class="w-full">Use This</Button>
          </div>
        </div>
        
        <div class="mt-6 pt-6 border-t border-gray-700 text-center">
          <p class="text-sm text-gray-500 mb-2">Or create a custom rule from scratch</p>
          <Button variant="ghost" @click="addCondition">
            + Start Empty
          </Button>
        </div>
      </div>
      
      <div v-else class="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
        <p class="text-gray-400 mb-4">No content types detected yet.</p>
        <p class="text-sm text-gray-500 max-w-md mx-auto mb-6">
          Background analysis runs automatically when new media is added.
          <br>For existing content, run a one-time scan.
        </p>
        <div class="flex justify-center gap-4">
          <Button @click="runAnalysis" :disabled="analyzing" variant="secondary">
            <span v-if="analyzing">Scanning Library...</span>
            <span v-else>Scan Library Content</span>
          </Button>
          <Button variant="primary" @click="addCondition">
            + Add Custom Condition
          </Button>
        </div>
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
              class="w-full bg-input-background border border-input-border rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
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
              class="w-full bg-input-background border border-input-border rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
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
              class="w-full bg-input-background border border-input-border rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
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
              class="w-full bg-input-background border border-input-border rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
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
              class="w-full bg-input-background border border-input-border rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
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

const isValid = computed(() => {
  return ruleName.value.trim() && conditions.value.length > 0
})

onMounted(async () => {
  // Check if we are editing an existing rule
  if (route.query.ruleId) {
    editingRuleId.value = route.query.ruleId
    await loadRule(editingRuleId.value)
  }
  
  await loadStats()
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
    toast.add({
      title: 'Analysis Failed',
      message: error.message || 'Could not run analysis.',
      type: 'error'
    })
  } finally {
    analyzing.value = false
  }
}

const applySuggestion = (type) => {
  ruleName.value = `${type.charAt(0).toUpperCase() + type.slice(1)} Content`;
  description.value = `Automatically matched ${type} content`;
  conditions.value = [{
    field: 'content_type',
    operator: 'equals',
    value: type
  }];
  previewRule();
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
      rule_json: conditions.value // Array of conditions
    }
    
    if (editingRuleId.value) {
      await api.updateLibraryRule(props.libraryId, editingRuleId.value, payload)
      toast.add({
        title: 'Rule Updated',
        message: 'The classification rule has been updated.',
        type: 'success'
      })
    } else {
      await api.addLibraryRule(props.libraryId, payload)
      toast.add({
        title: 'Rule Saved',
        message: 'The classification rule has been created.',
        type: 'success'
      })
    }
    
    emit('save')
  } catch (error) {
    console.error('Save failed:', error)
    toast.add({
      title: 'Save Failed',
      message: error.response?.data?.error || error.message,
      type: 'error'
    })
  } finally {
    saving.value = false
  }
}

// onMounted is now at the top
// onMounted(() => {
//   loadStats();
// })
</script>

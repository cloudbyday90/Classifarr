<template>
  <div>
    <div class="mb-4">
      <label class="block text-sm font-medium text-text mb-2">Rule Name</label>
      <Input v-model="localRule.name" placeholder="e.g., Family Movies Rule" />
    </div>
    
    <div class="mb-4">
      <label class="block text-sm font-medium text-text mb-2">Description</label>
      <Input v-model="localRule.description" placeholder="Brief description of this rule" />
    </div>
    
    <div class="mb-4">
      <label class="block text-sm font-medium text-text mb-2">Priority</label>
      <Select
        v-model="localRule.priority"
        :options="priorityOptions"
        placeholder="Select priority"
      />
    </div>
    
    <div class="mb-4">
      <label class="block text-sm font-medium text-text mb-2">Rule JSON</label>
      <textarea
        v-model="ruleJson"
        class="input w-full h-64 font-mono text-sm"
        placeholder="Enter rule JSON..."
        @blur="validateJson"
      ></textarea>
      <p v-if="jsonError" class="text-error text-sm mt-2">{{ jsonError }}</p>
    </div>
    
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <Toggle v-model="localRule.enabled" />
        <span class="text-text text-sm">{{ localRule.enabled ? 'Enabled' : 'Disabled' }}</span>
      </div>
      
      <div class="flex items-center space-x-3">
        <Button variant="secondary" @click="$emit('cancel')">
          Cancel
        </Button>
        <Button variant="primary" :disabled="!isValid" @click="save">
          Save Rule
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Button from '@/components/common/Button.vue'

const props = defineProps({
  rule: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      priority: 'medium',
      enabled: true,
      conditions: {},
    }),
  },
})

const emit = defineEmits(['save', 'cancel'])

const localRule = ref({ ...props.rule })
const ruleJson = ref(JSON.stringify(props.rule.conditions, null, 2))
const jsonError = ref('')

const priorityOptions = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

watch(() => props.rule, (newRule) => {
  localRule.value = { ...newRule }
  ruleJson.value = JSON.stringify(newRule.conditions, null, 2)
})

const validateJson = () => {
  jsonError.value = ''
  try {
    JSON.parse(ruleJson.value)
  } catch (e) {
    jsonError.value = 'Invalid JSON: ' + e.message
  }
}

const isValid = computed(() => {
  return localRule.value.name && !jsonError.value
})

const save = () => {
  try {
    const conditions = JSON.parse(ruleJson.value)
    emit('save', {
      ...localRule.value,
      conditions,
    })
  } catch (e) {
    jsonError.value = 'Invalid JSON: ' + e.message
  }
}
</script>

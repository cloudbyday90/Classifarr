<template>
  <div>
    <div v-if="rules.length === 0" class="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
      <DocumentTextIcon class="w-16 h-16 text-text-muted mx-auto mb-4" />
      <h3 class="text-xl font-semibold text-text mb-2">No Custom Rules</h3>
      <p class="text-text-muted mb-6">Create custom rules using the chat interface</p>
      <Button variant="primary" @click="$emit('create')">
        Create Rule
      </Button>
    </div>
    
    <div v-else class="space-y-3">
      <div
        v-for="rule in rules"
        :key="rule.id"
        class="flex items-center justify-between p-4 bg-background rounded-lg hover:bg-gray-800 transition-colors"
      >
        <div class="flex-1">
          <h4 class="text-text font-medium mb-1">{{ rule.name }}</h4>
          <p class="text-text-muted text-sm">{{ rule.description }}</p>
          <div class="flex items-center space-x-2 mt-2">
            <Badge variant="primary">Priority: {{ rule.priority }}</Badge>
            <Badge :variant="rule.enabled ? 'success' : 'default'">
              {{ rule.enabled ? 'Enabled' : 'Disabled' }}
            </Badge>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button
            class="p-2 text-text-muted hover:text-text hover:bg-card rounded transition-colors"
            @click="$emit('edit', rule)"
          >
            <PencilIcon class="w-5 h-5" />
          </button>
          <button
            class="p-2 text-text-muted hover:text-error hover:bg-card rounded transition-colors"
            @click="$emit('delete', rule)"
          >
            <TrashIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <Button variant="secondary" full-width @click="$emit('create')">
        Add New Rule
      </Button>
    </div>
  </div>
</template>

<script setup>
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import { DocumentTextIcon, PencilIcon, TrashIcon } from '@heroicons/vue/24/outline'

defineProps({
  rules: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['create', 'edit', 'delete'])
</script>

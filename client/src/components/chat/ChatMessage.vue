<template>
  <div :class="['flex', isUser ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[80%] rounded-lg p-4',
        isUser
          ? 'bg-primary text-white'
          : 'bg-card text-text',
      ]"
    >
      <div v-if="!isUser" class="flex items-center space-x-2 mb-2">
        <CpuChipIcon class="w-5 h-5 text-primary" />
        <span class="font-semibold text-sm">Classifarr Bot</span>
      </div>
      
      <div class="prose prose-invert max-w-none">
        <p class="whitespace-pre-wrap">{{ message.content }}</p>
      </div>
      
      <div class="mt-2 text-xs opacity-75">
        {{ formatTime(message.timestamp) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CpuChipIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
})

const isUser = computed(() => props.message.sender === 'user')

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

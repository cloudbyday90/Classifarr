<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <ChatMessage
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
      
      <div v-if="loading" class="flex justify-center">
        <Spinner class="w-6 h-6" />
      </div>
    </div>
    
    <ChatInput
      :disabled="loading"
      @send="$emit('send', $event)"
    />
  </div>
</template>

<script setup>
import ChatMessage from './ChatMessage.vue'
import ChatInput from './ChatInput.vue'
import Spinner from '@/components/common/Spinner.vue'

defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['send'])
</script>

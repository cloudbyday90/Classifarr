<template>
  <div class="border-t border-gray-700 p-4 bg-sidebar">
    <form @submit.prevent="send" class="flex items-center space-x-3">
      <input
        v-model="message"
        type="text"
        :disabled="disabled"
        placeholder="Type your message..."
        class="input flex-1"
      />
      <Button
        type="submit"
        variant="primary"
        :disabled="!message.trim() || disabled"
      >
        <PaperAirplaneIcon class="w-5 h-5" />
      </Button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Button from '@/components/common/Button.vue'
import { PaperAirplaneIcon } from '@heroicons/vue/24/solid'

defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['send'])

const message = ref('')

const send = () => {
  if (message.value.trim()) {
    emit('send', message.value)
    message.value = ''
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <Button @click="$router.back()" variant="secondary">← Back</Button>
      <h1 class="text-2xl font-bold">AI Rule Builder</h1>
    </div>

    <Card title="Build Custom Classification Rule" description="Chat with AI to create intelligent classification rules">
      <div class="space-y-4">
        <div class="bg-background rounded-lg p-4 h-96 overflow-y-auto space-y-3 border border-gray-800">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[80%] rounded-lg p-3"
              :class="msg.role === 'user' ? 'bg-primary text-white' : 'bg-background-light'"
            >
              {{ msg.content }}
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <Input
            v-model="userMessage"
            placeholder="Type your message..."
            @keyup.enter="sendMessage"
          />
          <Button @click="sendMessage" :loading="sending" :disabled="!userMessage.trim()">
            Send
          </Button>
        </div>

        <div v-if="canGenerate" class="flex justify-end">
          <Button @click="generateRule" :loading="generating" variant="success">
            ✨ Generate Rule
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'

const route = useRoute()
const router = useRouter()

const messages = ref([])
const userMessage = ref('')
const sessionId = ref(null)
const canGenerate = ref(false)
const sending = ref(false)
const generating = ref(false)

onMounted(async () => {
  try {
    const response = await api.startRuleBuilder({
      library_id: route.params.libraryId,
      media_type: 'movie',
    })
    sessionId.value = response.data.sessionId
    messages.value.push({
      role: 'assistant',
      content: response.data.message,
    })
  } catch (error) {
    console.error('Failed to start rule builder:', error)
    alert('Failed to start rule builder')
    router.back()
  }
})

const sendMessage = async () => {
  if (!userMessage.value.trim() || !sessionId.value) return

  const msg = userMessage.value
  userMessage.value = ''

  messages.value.push({
    role: 'user',
    content: msg,
  })

  sending.value = true
  try {
    const response = await api.sendRuleBuilderMessage({
      session_id: sessionId.value,
      message: msg,
    })

    messages.value.push({
      role: 'assistant',
      content: response.data.message,
    })

    canGenerate.value = response.data.canGenerateRule
  } catch (error) {
    console.error('Failed to send message:', error)
    alert('Failed to send message')
  } finally {
    sending.value = false
  }
}

const generateRule = async () => {
  generating.value = true
  try {
    const response = await api.generateRule({
      session_id: sessionId.value,
    })
    alert('Rule created successfully!')
    router.push(`/libraries/${route.params.libraryId}`)
  } catch (error) {
    console.error('Failed to generate rule:', error)
    alert('Failed to generate rule: ' + error.message)
  } finally {
    generating.value = false
  }
}
</script>

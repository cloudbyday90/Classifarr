<template>
  <div class="h-[calc(100vh-12rem)]">
    <div class="mb-6">
      <router-link
        :to="`/libraries/${route.params.id}`"
        class="text-primary hover:text-blue-400 text-sm mb-2 inline-flex items-center"
      >
        <ChevronLeftIcon class="w-4 h-4 mr-1" />
        Back to Library
      </router-link>
      <h1 class="text-3xl font-bold text-text mt-2">Rule Builder</h1>
      <p class="text-text-muted mt-2">Chat with Classifarr to create custom classification rules</p>
    </div>
    
    <Card class="h-[calc(100%-8rem)] flex flex-col" :padding="0">
      <ChatWindow
        :messages="messages"
        :loading="loading"
        @send="sendMessage"
      />
    </Card>
    
    <!-- Generate Rule Section -->
    <div v-if="canGenerate" class="mt-4">
      <Card>
        <div class="flex items-center justify-between">
          <p class="text-text">Ready to generate your rule?</p>
          <Button variant="primary" :loading="generating" @click="generateRule">
            Generate Rule
          </Button>
        </div>
      </Card>
    </div>
    
    <!-- Rule Preview Modal -->
    <Modal v-model="showPreview" title="Rule Preview" size="lg">
      <div v-if="generatedRule">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-text mb-2">{{ generatedRule.name }}</h3>
          <p class="text-text-muted">{{ generatedRule.description }}</p>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-text mb-2">Rule JSON</label>
          <pre class="bg-background p-4 rounded-lg text-sm text-text overflow-x-auto">{{ JSON.stringify(generatedRule.conditions, null, 2) }}</pre>
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-end space-x-3">
          <Button variant="secondary" @click="showPreview = false">
            Cancel
          </Button>
          <Button variant="primary" :loading="saving" @click="saveGeneratedRule">
            Save Rule
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as ruleBuilderApi from '@/api/ruleBuilder'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Modal from '@/components/common/Modal.vue'
import ChatWindow from '@/components/chat/ChatWindow.vue'
import { ChevronLeftIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()

const messages = ref([
  {
    id: 1,
    sender: 'bot',
    content: 'Hi! I\'m here to help you create custom classification rules. What kind of rule would you like to create?',
    timestamp: new Date(),
  },
])
const loading = ref(false)
const generating = ref(false)
const saving = ref(false)
const conversationId = ref(null)
const showPreview = ref(false)
const generatedRule = ref(null)

const canGenerate = computed(() => {
  return messages.value.length > 3
})

const sendMessage = async (content) => {
  // Add user message
  messages.value.push({
    id: Date.now(),
    sender: 'user',
    content,
    timestamp: new Date(),
  })
  
  loading.value = true
  try {
    const response = await ruleBuilderApi.sendMessage(
      route.params.id,
      content,
      conversationId.value
    )
    
    conversationId.value = response.conversationId
    
    // Add bot response
    messages.value.push({
      id: Date.now() + 1,
      sender: 'bot',
      content: response.message,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error sending message:', error)
    messages.value.push({
      id: Date.now() + 1,
      sender: 'bot',
      content: 'Sorry, I encountered an error. Please try again.',
      timestamp: new Date(),
    })
  } finally {
    loading.value = false
  }
}

const generateRule = async () => {
  generating.value = true
  try {
    generatedRule.value = await ruleBuilderApi.generateRule(
      route.params.id,
      conversationId.value
    )
    showPreview.value = true
  } catch (error) {
    console.error('Error generating rule:', error)
  } finally {
    generating.value = false
  }
}

const saveGeneratedRule = async () => {
  saving.value = true
  try {
    await ruleBuilderApi.saveRule(route.params.id, generatedRule.value)
    router.push(`/libraries/${route.params.id}`)
  } catch (error) {
    console.error('Error saving rule:', error)
  } finally {
    saving.value = false
  }
}
</script>

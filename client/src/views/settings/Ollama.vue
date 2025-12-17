<template>
  <SettingsSection
    title="AI / Ollama"
    description="Configure AI model for classification and rule building"
  >
    <Card>
      <Alert
        v-if="connected"
        variant="success"
        title="Connected"
        message="Successfully connected to Ollama"
        class="mb-6"
      />
      
      <div class="space-y-4">
        <FormField
          label="Ollama URL"
          help="URL to your Ollama instance"
          required
        >
          <Input
            v-model="config.url"
            type="url"
            placeholder="http://localhost:11434"
          />
        </FormField>
        
        <FormField
          label="Model"
          help="Ollama model to use for classification"
          required
        >
          <Select
            v-model="config.model"
            :options="modelOptions"
            placeholder="Select model"
          />
        </FormField>
        
        <FormField
          label="Temperature"
          help="Controls randomness in responses (0.0 - 1.0)"
        >
          <Input
            v-model.number="config.temperature"
            type="number"
            step="0.1"
            min="0"
            max="1"
            placeholder="0.7"
          />
        </FormField>
        
        <FormField
          label="Enable AI Classification"
          help="Use AI to help classify media"
        >
          <Toggle v-model="config.enabled" />
        </FormField>
      </div>
      
      <div class="mt-6 flex justify-end space-x-3">
        <ConnectionTest
          :on-test="testConnection"
          :connected="connected"
        />
        <Button variant="primary" :loading="saving" @click="save">
          Save Configuration
        </Button>
      </div>
    </Card>
  </SettingsSection>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as settingsApi from '@/api/settings'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import Card from '@/components/common/Card.vue'
import Alert from '@/components/common/Alert.vue'
import FormField from '@/components/settings/FormField.vue'
import Input from '@/components/common/Input.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Button from '@/components/common/Button.vue'
import ConnectionTest from '@/components/settings/ConnectionTest.vue'

const config = ref({
  url: 'http://localhost:11434',
  model: 'llama2',
  temperature: 0.7,
  enabled: true,
})

const saving = ref(false)
const connected = ref(false)

const modelOptions = [
  { value: 'llama2', label: 'Llama 2' },
  { value: 'llama3', label: 'Llama 3' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'mixtral', label: 'Mixtral' },
  { value: 'codellama', label: 'Code Llama' },
]

onMounted(async () => {
  try {
    const settings = await settingsApi.getSettings()
    if (settings.ollama) {
      config.value = { ...config.value, ...settings.ollama }
    }
  } catch (error) {
    console.error('Error loading config:', error)
  }
})

const testConnection = async () => {
  try {
    const result = await settingsApi.testOllamaConnection(config.value)
    connected.value = result.success
  } catch (error) {
    console.error('Error testing connection:', error)
    connected.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    await settingsApi.updateSettings({ ollama: config.value })
  } catch (error) {
    console.error('Error saving config:', error)
  } finally {
    saving.value = false
  }
}
</script>

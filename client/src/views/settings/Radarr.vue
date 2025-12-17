<template>
  <SettingsSection
    title="Radarr"
    description="Configure connection to Radarr for movie management"
  >
    <Card>
      <Alert
        v-if="connected"
        variant="success"
        title="Connected"
        message="Successfully connected to Radarr"
        class="mb-6"
      />
      
      <div class="space-y-4">
        <FormField
          label="Radarr URL"
          help="Full URL to your Radarr instance"
          required
        >
          <Input
            v-model="config.url"
            type="url"
            placeholder="http://localhost:7878"
          />
        </FormField>
        
        <FormField
          label="API Key"
          help="Radarr API key from Settings > General"
          required
        >
          <Input
            v-model="config.apiKey"
            type="password"
            placeholder="Enter API key"
          />
        </FormField>
        
        <FormField
          label="Enable Integration"
          help="Automatically add classified movies to Radarr"
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
import Toggle from '@/components/common/Toggle.vue'
import Button from '@/components/common/Button.vue'
import ConnectionTest from '@/components/settings/ConnectionTest.vue'

const config = ref({
  url: '',
  apiKey: '',
  enabled: false,
})

const saving = ref(false)
const connected = ref(false)

onMounted(async () => {
  try {
    const settings = await settingsApi.getSettings()
    if (settings.radarr) {
      config.value = { ...config.value, ...settings.radarr }
    }
  } catch (error) {
    console.error('Error loading config:', error)
  }
})

const testConnection = async () => {
  try {
    const result = await settingsApi.testRadarrConnection(config.value)
    connected.value = result.success
  } catch (error) {
    console.error('Error testing connection:', error)
    connected.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    await settingsApi.updateSettings({ radarr: config.value })
  } catch (error) {
    console.error('Error saving config:', error)
  } finally {
    saving.value = false
  }
}
</script>
